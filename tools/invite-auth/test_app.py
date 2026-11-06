#!/usr/bin/env python3
"""Local checks: an invite is consumed once, and login reaches the version page."""

from __future__ import annotations

import http.client
import os
import sqlite3
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import app  # noqa: E402


TOOL = Path(__file__).resolve().parent


class InviteAuthTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.db = root / "brawl.db"
        self.static = root / "www"
        version = self.static / "v0.1.0"
        (version / "assets").mkdir(parents=True)
        (version / "index.html").write_text("<!doctype html><title>game</title>", encoding="utf-8")
        (version / "assets" / "app.js").write_text("console.log(1)\n", encoding="utf-8")
        (version / "assets" / "app.css").write_text("body{}\n", encoding="utf-8")
        (version / "favicon.svg").write_text("<svg xmlns='http://www.w3.org/2000/svg'/>", encoding="utf-8")
        (version / "assets" / "font.woff2").write_bytes(b"woff2")
        (version / "notes.txt").write_text("hidden-note", encoding="utf-8")
        (root / "outside.txt").write_text("outside-secret", encoding="utf-8")
        self.server = app.AuthServer(("127.0.0.1", 0), self.db, self.static)
        self.port = self.server.server_address[1]
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=3)
        self.tmp.cleanup()

    def request(
        self,
        method: str,
        path: str,
        form: dict[str, str] | None = None,
        cookie: str | None = None,
    ) -> tuple[int, list[tuple[str, str]], bytes]:
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        headers: dict[str, str] = {}
        body = None
        if form is not None:
            body = urllib.parse.urlencode(form).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        if cookie:
            headers["Cookie"] = f"brawl_session={cookie}"
        conn.request(method, path, body=body, headers=headers)
        resp = conn.getresponse()
        payload = resp.read()
        headers_out = resp.getheaders()
        status = resp.status
        conn.close()
        return status, headers_out, payload

    def header(self, headers: list[tuple[str, str]], name: str) -> str:
        for key, value in headers:
            if key.lower() == name.lower():
                return value
        return ""

    def sid_from(self, headers: list[tuple[str, str]]) -> str:
        cookie = self.header(headers, "Set-Cookie")
        self.assertIn("brawl_session=", cookie)
        self.assertIn("HttpOnly", cookie)
        self.assertIn("Secure", cookie)
        self.assertIn("SameSite=Lax", cookie)
        self.assertIn("Path=/brawl", cookie)
        self.assertIn("Max-Age=604800", cookie)
        token = cookie.split(";", 1)[0]
        return token.split("=", 1)[1]

    def test_alphabet_and_rounds(self) -> None:
        self.assertTrue(set("0O1I").isdisjoint(app.INVITE_ALPHABET))
        self.assertEqual(app.PBKDF2_ROUNDS, 200_000)
        self.assertEqual(app.SESSION_SECONDS, 604800)

    def test_manage_new_and_ls(self) -> None:
        env = os.environ.copy()
        env["BRAWL_DB"] = str(self.db)
        created = subprocess.run(
            [sys.executable, str(TOOL / "manage.py"), "new", "20"],
            cwd=TOOL,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(created.returncode, 0, created.stderr)
        codes = [line for line in created.stdout.splitlines() if line]
        self.assertEqual(len(codes), 20)
        self.assertEqual(len(set(codes)), 20)
        for code in codes:
            self.assertEqual(len(code), app.INVITE_LENGTH)
            self.assertTrue(set(code) <= set(app.INVITE_ALPHABET))
        listed = subprocess.run(
            [sys.executable, str(TOOL / "manage.py"), "ls"],
            cwd=TOOL,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(listed.returncode, 0, listed.stderr)
        self.assertIn(codes[0], listed.stdout)
        self.assertIn("\t-", listed.stdout)

    def test_invite_consumed_once_and_login(self) -> None:
        code = app.create_invites(self.db, 1)[0]
        status, headers, _body = self.request(
            "POST",
            "/brawl/api/register",
            {"invite": code.lower(), "username": "Momo", "password": "password1"},
        )
        self.assertEqual(status, 303)
        self.assertEqual(self.header(headers, "Location"), "/brawl/")
        sid = self.sid_from(headers)

        again, _, body = self.request(
            "POST",
            "/brawl/api/register",
            {"invite": code, "username": "Other", "password": "password1"},
        )
        self.assertEqual(again, 400)
        self.assertIn("已经用过".encode(), body)

        with sqlite3.connect(self.db) as conn:
            users = conn.execute("SELECT username FROM users").fetchall()
            used = conn.execute("SELECT used_by FROM invites WHERE code = ?", (code,)).fetchone()
        self.assertEqual(users, [("Momo",)])
        self.assertEqual(used[0], "Momo")

        bad, bad_headers, _ = self.request(
            "POST",
            "/brawl/api/login",
            {"username": "Momo", "password": "wrong-password", "next": "/brawl/v0.1.0/"},
        )
        self.assertEqual(bad, 401)
        self.assertNotIn("brawl_session=", self.header(bad_headers, "Set-Cookie"))

        foreign, foreign_headers, _ = self.request(
            "POST",
            "/brawl/api/login",
            {"username": "momo", "password": "password1", "next": "https://evil.example/brawl/"},
        )
        self.assertEqual(foreign, 303)
        self.assertEqual(self.header(foreign_headers, "Location"), "/brawl/")

        home, _, landing = self.request("GET", "/brawl/")
        self.assertEqual(home, 200)
        self.assertIn("不是在线对战".encode(), landing)
        self.assertIn(b'href="/brawl/v0.1.0/"', landing)
        self.assertIn(b'href="/brawl/register"', landing)
        self.assertIn(b'href="/brawl/login"', landing)

        blocked, blocked_headers, _ = self.request("GET", "/brawl/v0.1.0/")
        self.assertEqual(blocked, 303)
        location = self.header(blocked_headers, "Location")
        parsed = urllib.parse.urlsplit(location)
        self.assertEqual(parsed.path, "/brawl/login")
        self.assertEqual(urllib.parse.parse_qs(parsed.query)["next"], ["/brawl/v0.1.0/"])

        asset, _, script = self.request("GET", "/brawl/v0.1.0/assets/app.js")
        self.assertEqual(asset, 200)
        self.assertEqual(script, b"console.log(1)\n")
        font, font_headers, _ = self.request("GET", "/brawl/v0.1.0/assets/font.woff2")
        self.assertEqual(font, 200)
        self.assertIn("font/woff2", self.header(font_headers, "Content-Type"))

        denied, _, secret_body = self.request("GET", "/brawl/v0.1.0/notes.txt")
        self.assertEqual(denied, 404)
        self.assertNotIn(b"hidden-note", secret_body)
        escaped, _, outside = self.request("GET", "/brawl/v0.1.0/../../outside.txt")
        self.assertEqual(escaped, 404)
        self.assertNotIn(b"outside-secret", outside)

        opened, opened_headers, page = self.request("GET", "/brawl/v0.1.0/index.html", cookie=sid)
        self.assertEqual(opened, 200)
        self.assertIn(b"game", page)
        self.assertNotIn("login", self.header(opened_headers, "Location"))

        logged_in, login_headers, _ = self.request(
            "POST",
            "/brawl/api/login",
            {
                "username": "MOMO",
                "password": "password1",
                "next": "/brawl/v0.1.0/\r\nLocation: https://evil.example/",
            },
        )
        self.assertEqual(logged_in, 303)
        self.assertEqual(self.header(login_headers, "Location"), "/brawl/")

        safe, safe_headers, _ = self.request(
            "POST",
            "/brawl/api/login",
            {"username": "momo", "password": "password1", "next": "/brawl/v0.1.0/"},
        )
        fresh = self.sid_from(safe_headers)
        self.assertEqual(self.header(safe_headers, "Location"), "/brawl/v0.1.0/")
        shown, _, game = self.request("GET", "/brawl/v0.1.0/", cookie=fresh)
        self.assertEqual(shown, 200)
        self.assertIn(b"game", game)

        short_code = app.create_invites(self.db, 1)[0]
        short, _, _ = self.request(
            "POST",
            "/brawl/api/register",
            {"invite": short_code, "username": "ab", "password": "short"},
        )
        self.assertEqual(short, 400)
        with sqlite3.connect(self.db) as conn:
            still = conn.execute(
                "SELECT used_at FROM invites WHERE code = ?",
                (short_code,),
            ).fetchone()
        self.assertIsNone(still[0])

        taken_code = app.create_invites(self.db, 1)[0]
        taken, _, _ = self.request(
            "POST",
            "/brawl/api/register",
            {"invite": taken_code, "username": "momo", "password": "password1"},
        )
        self.assertEqual(taken, 400)
        with sqlite3.connect(self.db) as conn:
            unused = conn.execute(
                "SELECT used_at FROM invites WHERE code = ?",
                (taken_code,),
            ).fetchone()
            count = conn.execute("SELECT COUNT(*) FROM users").fetchone()
        self.assertIsNone(unused[0])
        self.assertEqual(count[0], 1)

        out, out_headers, _ = self.request("POST", "/brawl/api/logout", {}, cookie=fresh)
        self.assertEqual(out, 303)
        self.assertEqual(self.header(out_headers, "Location"), "/brawl/")
        self.assertIn("Max-Age=0", self.header(out_headers, "Set-Cookie"))
        closed, closed_headers, _ = self.request("GET", "/brawl/v0.1.0/", cookie=fresh)
        self.assertEqual(closed, 303)
        self.assertTrue(self.header(closed_headers, "Location").startswith("/brawl/login?"))

    def test_unit_file(self) -> None:
        text = (TOOL / "brawl-auth.service").read_text(encoding="utf-8")
        self.assertIn("WorkingDirectory=/opt/brawl-auth", text)
        self.assertIn("ExecStart=/usr/bin/python3 /opt/brawl-auth/app.py", text)
        self.assertIn("Environment=BRAWL_PORT=43180", text)
        self.assertIn("Restart=on-failure", text)
        self.assertNotIn("auth_basic", text)
        self.assertNotIn("Password", text)


if __name__ == "__main__":
    unittest.main()
