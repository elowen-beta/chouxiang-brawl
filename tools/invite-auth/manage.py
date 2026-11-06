#!/usr/bin/env python3
"""Create and list invite codes. Prints codes to stdout; do not commit them."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from app import DEFAULT_DB, create_invites, init_db, list_invites


def main(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    db_path = Path(os.environ.get("BRAWL_DB", DEFAULT_DB))
    init_db(db_path)
    if not args or args[0] not in {"new", "ls"} or (args[0] == "ls" and len(args) != 1):
        print("usage: manage.py new COUNT | manage.py ls", file=sys.stderr)
        return 2
    if args[0] == "ls":
        for row in list_invites(db_path):
            used_at = row["used_at"] or "-"
            used_by = row["used_by"] or "-"
            print(f"{row['code']}\t{row['created_at']}\t{used_at}\t{used_by}")
        return 0
    if len(args) != 2:
        print("usage: manage.py new COUNT", file=sys.stderr)
        return 2
    try:
        count = int(args[1])
    except ValueError:
        print("COUNT must be an integer", file=sys.stderr)
        return 2
    try:
        codes = create_invites(db_path, count)
    except ValueError as exc:
        print(str(exc), file=sys.stderr)
        return 2
    for code in codes:
        print(code)
    return 0


if __name__ == "__main__":
    sys.exit(main())
