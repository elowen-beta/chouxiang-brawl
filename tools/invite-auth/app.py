#!/usr/bin/env python3
"""Local invite registration for 抽象大乱斗. Stdlib only, loopback only."""

from __future__ import annotations

import hashlib
import hmac
import html
import os
import re
import secrets
import sqlite3
import sys
import urllib.parse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Iterator

HOST = "127.0.0.1"
DEFAULT_PORT = 43180
DEFAULT_DB = "/var/lib/brawl-auth/brawl.db"
DEFAULT_STATIC = "/var/www/brawl"
PBKDF2_ROUNDS = 200_000
SESSION_SECONDS = 604800
MAX_BODY = 16_384
PASSWORD_MIN = 8
PASSWORD_MAX = 128
INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
INVITE_LENGTH = 10
VERSION_RE = re.compile(r"^v\d+\.\d+\.\d+$")
ASSET_SUFFIXES = {".js", ".css", ".svg", ".woff", ".woff2"}
NEXT_CHARS = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/._-~")
HERE = Path(__file__).resolve().parent
LANDING_PATH = HERE / "index.html"

CONTENT_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def expires_iso() -> str:
    moment = datetime.now(timezone.utc) + timedelta(seconds=SESSION_SECONDS)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


@contextmanager
def connect(db_path: Path) -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(db_path, timeout=5, isolation_level=None)
    conn.row_factory = sqlite3.Row
    try:
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=5000")
        yield conn
    finally:
        conn.close()


def init_db(db_path: Path) -> None:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    with connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS invites (
              code TEXT PRIMARY KEY,
              created_at TEXT NOT NULL,
              used_at TEXT,
              used_by TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              username TEXT NOT NULL COLLATE NOCASE UNIQUE,
              pw_hash TEXT NOT NULL,
              pw_salt TEXT NOT NULL,
              created_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              sid TEXT PRIMARY KEY,
              username TEXT NOT NULL,
              created_at TEXT NOT NULL,
              expires_at TEXT NOT NULL
            )
            """
        )


def hash_password(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    if salt is None:
        salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ROUNDS)
    return salt, digest


def valid_username(name: str) -> bool:
    if not (2 <= len(name) <= 24):
        return False
    for char in name:
        if char in "_-":
            continue
        if not char.isalnum():
            return False
    return True


def valid_password(password: str) -> bool:
    return PASSWORD_MIN <= len(password) <= PASSWORD_MAX and "\x00" not in password


def create_invites(db_path: Path, count: int) -> list[str]:
    if count < 1 or count > 500:
        raise ValueError("invite count must be 1..500")
    init_db(db_path)
    codes: list[str] = []
    with connect(db_path) as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            while len(codes) < count:
                code = "".join(secrets.choice(INVITE_ALPHABET) for _ in range(INVITE_LENGTH))
                conn.execute("SAVEPOINT one_code")
                try:
                    conn.execute(
                        "INSERT INTO invites (code, created_at) VALUES (?, ?)",
                        (code, now_iso()),
                    )
                except sqlite3.IntegrityError:
                    conn.execute("ROLLBACK TO one_code")
                    conn.execute("RELEASE one_code")
                    continue
                conn.execute("RELEASE one_code")
                codes.append(code)
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise
    return codes


def list_invites(db_path: Path) -> list[sqlite3.Row]:
    init_db(db_path)
    with connect(db_path) as conn:
        rows = conn.execute(
            """
            SELECT code, created_at, used_at, used_by
            FROM invites
            ORDER BY created_at, code
            """
        ).fetchall()
    return list(rows)


def session_cookie(sid: str, max_age: int = SESSION_SECONDS) -> str:
    # Secure is always set. Browsers store it only on HTTPS.
    return (
        f"brawl_session={sid}; HttpOnly; Secure; SameSite=Lax; "
        f"Path=/brawl; Max-Age={max_age}"
    )


def clear_cookie() -> str:
    return "brawl_session=; HttpOnly; Secure; SameSite=Lax; Path=/brawl; Max-Age=0"


def safe_next(raw: str | None) -> str:
    """Allow a local /brawl path and nothing that can leave this site."""
    if not raw:
        return "/brawl/"
    value = raw.strip()
    if not value.startswith("/") or value.startswith("//") or "\\" in value:
        return "/brawl/"
    if any(char in value for char in ("\r", "\n", "\x00")):
        return "/brawl/"
    parts = urllib.parse.urlsplit(value)
    if parts.scheme or parts.netloc:
        return "/brawl/"
    path = urllib.parse.unquote(parts.path)
    if path.startswith("//") or "\\" in path or "\x00" in path:
        return "/brawl/"
    segments = path.split("/")
    if any(segment in ("..", ".") for segment in segments):
        return "/brawl/"
    if path != "/brawl" and not path.startswith("/brawl/"):
        return "/brawl/"
    if any(char not in NEXT_CHARS for char in path):
        return "/brawl/"
    if path == "/brawl":
        return "/brawl/"
    return path


def user_for_session(db_path: Path, sid: str | None) -> str | None:
    if not sid:
        return None
    with connect(db_path) as conn:
        row = conn.execute(
            "SELECT username, expires_at FROM sessions WHERE sid = ?",
            (sid,),
        ).fetchone()
        if row is None:
            return None
        if row["expires_at"] <= now_iso():
            conn.execute("DELETE FROM sessions WHERE sid = ?", (sid,))
            return None
        return str(row["username"])


def register_account(db_path: Path, invite: str, username: str, password: str) -> tuple[int, str, str]:
    """Return (status, error, sid). Sid is set only on success. Invite stays unused on failure."""
    code = invite.strip().upper()
    name = username.strip()
    if not code:
        return 400, "请填写邀请码", ""
    if not valid_username(name):
        return 400, "用户名需要 2 到 24 个字符，只能用字母、数字、下划线和连字符", ""
    if not valid_password(password):
        return 400, "密码至少 8 位，最长 128 位", ""

    salt, digest = hash_password(password)
    with connect(db_path) as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            row = conn.execute(
                "SELECT used_at FROM invites WHERE code = ?",
                (code,),
            ).fetchone()
            if row is None or row["used_at"]:
                conn.execute("ROLLBACK")
                return 400, "邀请码无效或已经用过", ""
            taken = conn.execute(
                "SELECT 1 FROM users WHERE username = ? COLLATE NOCASE",
                (name,),
            ).fetchone()
            if taken is not None:
                conn.execute("ROLLBACK")
                return 400, "这个用户名已经有人用了", ""
            conn.execute(
                """
                INSERT INTO users (username, pw_hash, pw_salt, created_at)
                VALUES (?, ?, ?, ?)
                """,
                (name, digest.hex(), salt.hex(), now_iso()),
            )
            updated = conn.execute(
                """
                UPDATE invites
                SET used_at = ?, used_by = ?
                WHERE code = ? AND used_at IS NULL
                """,
                (now_iso(), name, code),
            )
            if updated.rowcount != 1:
                conn.execute("ROLLBACK")
                return 400, "邀请码无效或已经用过", ""
            sid = secrets.token_urlsafe(32)
            conn.execute(
                """
                INSERT INTO sessions (sid, username, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (sid, name, now_iso(), expires_iso()),
            )
            conn.execute("COMMIT")
        except sqlite3.IntegrityError:
            conn.execute("ROLLBACK")
            return 400, "这个用户名已经有人用了", ""
        except Exception:
            conn.execute("ROLLBACK")
            raise
    return 303, "", sid


def login_account(db_path: Path, username: str, password: str, nxt: str | None) -> tuple[int, str, str, str]:
    """Return (status, error, sid, redirect)."""
    name = username.strip()
    target = safe_next(nxt)
    if not name or not password:
        return 400, "请填写用户名和密码", "", target
    if len(password) > PASSWORD_MAX:
        return 400, "密码最长 128 位", "", target

    with connect(db_path) as conn:
        row = conn.execute(
            """
            SELECT username, pw_hash, pw_salt
            FROM users
            WHERE username = ? COLLATE NOCASE
            """,
            (name,),
        ).fetchone()
    if row is None:
        hash_password(password, salt=b"\x00" * 16)
        return 401, "用户名或密码不正确", "", target
    try:
        salt = bytes.fromhex(row["pw_salt"])
        expect = bytes.fromhex(row["pw_hash"])
    except ValueError:
        return 401, "用户名或密码不正确", "", target
    _salt, got = hash_password(password, salt=salt)
    if not hmac.compare_digest(got, expect):
        return 401, "用户名或密码不正确", "", target

    canonical = str(row["username"])
    sid = secrets.token_urlsafe(32)
    with connect(db_path) as conn:
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute(
                """
                INSERT INTO sessions (sid, username, created_at, expires_at)
                VALUES (?, ?, ?, ?)
                """,
                (sid, canonical, now_iso(), expires_iso()),
            )
            conn.execute("COMMIT")
        except Exception:
            conn.execute("ROLLBACK")
            raise
    return 303, "", sid, target


def logout_account(db_path: Path, sid: str | None) -> None:
    if not sid:
        return
    with connect(db_path) as conn:
        conn.execute("DELETE FROM sessions WHERE sid = ?", (sid,))


def version_file(static_root: Path, path: str) -> tuple[str, Path] | None:
    """Return ('index'|'asset', file) for a safe versioned path, else None."""
    prefix = "/brawl/"
    if not path.startswith(prefix):
        return None
    rel = path[len(prefix) :]
    if rel.endswith("/"):
        rel += "index.html"
    parts = rel.split("/")
    kind = "index" if parts[-1] == "index.html" else "asset"
    if "\\" in rel or "\x00" in rel:
        return None
    if any(part in ("", ".", "..") for part in parts):
        return None
    if not VERSION_RE.fullmatch(parts[0]):
        return None
    if kind == "asset":
        suffix = Path(parts[-1]).suffix.lower()
        if suffix not in ASSET_SUFFIXES:
            return None
    root = static_root.resolve()
    candidate = root.joinpath(*parts).resolve()
    try:
        candidate.relative_to(root)
    except ValueError:
        return None
    return kind, candidate


PAGE_CSS = """
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100vh;
  background: #140e22;
  color: #efe6d8;
  font-family: "PingFang SC", "Noto Sans SC", "Source Han Sans SC", sans-serif;
}
main { max-width: 36rem; margin: 0 auto; padding: 3.5rem 1.25rem 4rem; }
.mark { margin: 0 0 0.6rem; color: #7ad7f0; letter-spacing: 0.08em; font-size: 0.85rem; }
h1 { margin: 0 0 0.8rem; font-size: 2.1rem; font-weight: 700; }
p { line-height: 1.6; }
a { color: #ffd27a; }
form { display: grid; gap: 0.85rem; margin-top: 1.5rem; }
label { display: grid; gap: 0.35rem; font-size: 0.95rem; }
input {
  width: 100%;
  padding: 0.7rem 0.75rem;
  border-radius: 0.6rem;
  border: 1px solid #3a2c55;
  background: #1c1430;
  color: #fff6e4;
  font: inherit;
}
button, .button {
  justify-self: start;
  border: 0;
  border-radius: 999px;
  padding: 0.7rem 1.15rem;
  background: #ffd27a;
  color: #1a0c28;
  font: inherit;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}
.error {
  margin: 1rem 0 0;
  padding: 0.7rem 0.8rem;
  border-radius: 0.6rem;
  background: #3a1424;
  color: #ffd0dc;
}
.back { display: inline-block; margin-top: 1.4rem; }
"""


def page(title: str, body: str) -> bytes:
    document = f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{html.escape(title)}</title>
  <style>{PAGE_CSS}</style>
</head>
<body>
  <main>
    <p class="mark">本地键盘乱斗</p>
    <h1>{html.escape(title)}</h1>
    {body}
  </main>
</body>
</html>
"""
    return document.encode("utf-8")


def form_body(intro: str, error: str, fields: str, action: str, submit: str, nxt: str | None) -> str:
    error_html = f'<p class="error">{html.escape(error)}</p>' if error else ""
    hidden = ""
    if nxt is not None:
        hidden = f'<input type="hidden" name="next" value="{html.escape(nxt, quote=True)}">'
    return f"""
    <p>{intro}</p>
    {error_html}
    <form method="post" action="{html.escape(action, quote=True)}">
      {fields}
      {hidden}
      <button type="submit">{html.escape(submit)}</button>
    </form>
    <a class="back" href="/brawl/">回入口</a>
    """


def register_page(error: str = "", invite: str = "", username: str = "") -> bytes:
    fields = f"""
      <label>邀请码
        <input name="invite" autocomplete="off" required value="{html.escape(invite, quote=True)}">
      </label>
      <label>用户名（2–24）
        <input name="username" autocomplete="username" required minlength="2" maxlength="24"
          value="{html.escape(username, quote=True)}">
      </label>
      <label>密码（至少 8 位）
        <input name="password" type="password" autocomplete="new-password" required minlength="8">
      </label>
    """
    body = form_body(
        "用一张还没用过的邀请码注册。注册成功会进入入口页，不是在线对战。",
        error,
        fields,
        "/brawl/api/register",
        "注册并进入",
        None,
    )
    return page("注册", body)


def login_page(error: str = "", username: str = "", nxt: str = "/brawl/") -> bytes:
    fields = f"""
      <label>用户名
        <input name="username" autocomplete="username" required value="{html.escape(username, quote=True)}">
      </label>
      <label>密码
        <input name="password" type="password" autocomplete="current-password" required>
      </label>
    """
    body = form_body(
        "登录后才能打开版本页。同一台键盘上的本地对战，没有在线匹配。",
        error,
        fields,
        "/brawl/api/login",
        "登录",
        safe_next(nxt),
    )
    return page("登录", body)


class AuthServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(self, address: tuple[str, int], db_path: Path, static_root: Path) -> None:
        self.db_path = Path(db_path)
        self.static_root = Path(static_root)
        init_db(self.db_path)
        super().__init__(address, Handler)


class Handler(BaseHTTPRequestHandler):
    server: AuthServer
    protocol_version = "HTTP/1.1"

    def log_message(self, fmt: str, *args: object) -> None:
        # Path only. The body (password, invite code) is never formatted here.
        sys.stderr.write("%s [%s] %s\n" % (self.address_string(), self.log_date_time_string(), fmt % args))

    def do_GET(self) -> None:  # noqa: N802
        path = self._path()
        if path is None:
            self._text(400, "请求路径无效")
            return
        if path == "/brawl":
            self._redirect(301, "/brawl/")
            return
        if path in ("/brawl/", "/brawl/index.html"):
            self._bytes(200, LANDING_PATH.read_bytes(), "text/html; charset=utf-8", store=False)
            return
        if path == "/brawl/register":
            self._bytes(200, register_page(), "text/html; charset=utf-8", store=False)
            return
        if path == "/brawl/login":
            query = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
            nxt = query.get("next", ["/brawl/"])[0]
            self._bytes(200, login_page(nxt=nxt), "text/html; charset=utf-8", store=False)
            return
        self._static(path)

    def do_POST(self) -> None:  # noqa: N802
        path = self._path()
        if path is None:
            self._text(400, "请求路径无效")
            return
        form = self._form()
        if form is None:
            self._text(400, "表单无效")
            return
        db = self.server.db_path
        if path == "/brawl/api/register":
            status, error, sid = register_account(
                db,
                form.get("invite", ""),
                form.get("username", ""),
                form.get("password", ""),
            )
            if status == 303 and sid:
                self._redirect(303, "/brawl/", session_cookie(sid))
                return
            self._bytes(
                status,
                register_page(error, form.get("invite", ""), form.get("username", "")),
                "text/html; charset=utf-8",
                store=False,
            )
            return
        if path == "/brawl/api/login":
            status, error, sid, target = login_account(
                db,
                form.get("username", ""),
                form.get("password", ""),
                form.get("next"),
            )
            if status == 303 and sid:
                self._redirect(303, target, session_cookie(sid))
                return
            self._bytes(
                status,
                login_page(error, form.get("username", ""), target),
                "text/html; charset=utf-8",
                store=False,
            )
            return
        if path == "/brawl/api/logout":
            logout_account(db, self._sid())
            self._redirect(303, "/brawl/", clear_cookie())
            return
        self._text(404, "没有这个地址")

    def _static(self, path: str) -> None:
        prefix = "/brawl/"
        if path.startswith(prefix):
            rest = path[len(prefix) :]
            version = rest.split("/", 1)[0]
            if VERSION_RE.fullmatch(version) and "/" not in rest and not path.endswith("/"):
                self._redirect(301, path + "/")
                return
        located = version_file(self.server.static_root, path)
        if located is None:
            self._text(404, "没有这个地址")
            return
        kind, candidate = located
        if kind == "index":
            gate = path if path.endswith("/") or path.endswith("index.html") else path + "/"
            if user_for_session(self.server.db_path, self._sid()) is None:
                query = urllib.parse.urlencode({"next": safe_next(gate)})
                self._redirect(303, "/brawl/login?" + query)
                return
            if not candidate.is_file():
                self._text(404, "这个版本还不在台上")
                return
            self._bytes(200, candidate.read_bytes(), "text/html; charset=utf-8", store=False)
            return
        if not candidate.is_file():
            self._text(404, "没有这个文件")
            return
        content_type = CONTENT_TYPES.get(candidate.suffix.lower(), "application/octet-stream")
        self._bytes(200, candidate.read_bytes(), content_type, store=True)

    def _path(self) -> str | None:
        raw = urllib.parse.urlsplit(self.path).path
        if "\\" in raw or "\x00" in raw or len(raw) > 512:
            return None
        try:
            path = urllib.parse.unquote(raw, errors="strict")
        except UnicodeDecodeError:
            return None
        if not path.startswith("/") or "\\" in path or "\x00" in path or len(path) > 512:
            return None
        return path

    def _sid(self) -> str | None:
        header = self.headers.get("Cookie", "")
        for part in header.split(";"):
            name, sep, value = part.strip().partition("=")
            if sep and name == "brawl_session" and value:
                return value
        return None

    def _form(self) -> dict[str, str] | None:
        length_header = self.headers.get("Content-Length")
        if length_header is None:
            return {}
        try:
            length = int(length_header)
        except ValueError:
            return None
        if length < 0 or length > MAX_BODY:
            return None
        if length == 0:
            return {}
        media = self.headers.get("Content-Type", "").split(";", 1)[0].strip().lower()
        if media != "application/x-www-form-urlencoded":
            return None
        try:
            raw = self.rfile.read(length).decode("utf-8")
        except UnicodeDecodeError:
            return None
        parsed = urllib.parse.parse_qs(raw, keep_blank_values=True)
        return {key: values[0] for key, values in parsed.items() if values}

    def _redirect(self, status: int, location: str, cookie: str | None = None) -> None:
        if "\r" in location or "\n" in location:
            location = "/brawl/"
        self.send_response(status)
        self.send_header("Location", location)
        self.send_header("Content-Length", "0")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()

    def _bytes(self, status: int, body: bytes, content_type: str, store: bool) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Cache-Control", "public, max-age=3600" if store else "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        try:
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionResetError):
            return

    def _text(self, status: int, message: str) -> None:
        self._bytes(status, page("抽象大乱斗", f"<p>{html.escape(message)}</p>"), "text/html; charset=utf-8", store=False)


def main() -> None:
    raw_port = os.environ.get("BRAWL_PORT", str(DEFAULT_PORT))
    try:
        port = int(raw_port)
    except ValueError:
        print("BRAWL_PORT must be an integer", file=sys.stderr)
        sys.exit(1)
    if not 1 <= port <= 65535:
        print("BRAWL_PORT must be 1..65535", file=sys.stderr)
        sys.exit(1)
    db_path = Path(os.environ.get("BRAWL_DB", DEFAULT_DB))
    static_root = Path(os.environ.get("BRAWL_STATIC", DEFAULT_STATIC))
    init_db(db_path)
    server = AuthServer((HOST, port), db_path, static_root)
    print(f"brawl-auth listening on http://{HOST}:{port}/brawl/", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
