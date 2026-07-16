#!/usr/bin/env python3
"""
Workspace Index — Python context broker voor NPR Local.
Scant directory, query git, query geowon → gestructureerd JSON output.
Buiten llama's context window tot system prompt injectie.

Gebruik:
    python3 workspace-index.py <directory> [--git] [--geowon] [--max-files N]
"""

import json
import os
import sys
import time
import subprocess
from pathlib import Path
from datetime import datetime, timezone

# Geowon endpoint
GEOWON_URL = "http://127.0.0.1:4004"


def time_ago(ts):
    """Format timestamp as relative time (Dutch)."""
    now = time.time()
    diff = now - ts
    if diff < 60:
        return "net"
    if diff < 3600:
        return f"{int(diff // 60)}m"
    if diff < 86400:
        return f"{int(diff // 3600)}u"
    return f"{int(diff // 86400)}d"


def format_bytes(size):
    if size < 1024:
        return f"{size}B"
    if size < 1048576:
        return f"{size / 1024:.1f}KB"
    return f"{size / 1048576:.1f}MB"


def scan_directory(dirpath, max_files=50):
    """Scan directory for file metadata."""
    result = {
        "path": str(dirpath),
        "files": [],
        "dirs": [],
        "recentChanges": [],
        "totalSize": 0,
        "fileCount": 0,
        "gitRoot": None,
        "gitStatus": [],
        "geowonMemory": [],
    }

    try:
        entries = sorted(os.listdir(dirpath))
    except OSError:
        result["error"] = "Directory not accessible"
        return result

    for entry in entries:
        full = dirpath / entry

        if full.is_dir():
            result["dirs"].append(entry)
        elif full.is_file():
            try:
                stat = full.stat()
                ext = full.suffix
                mtime = stat.st_mtime
                result["files"].append({
                    "name": entry,
                    "size": stat.st_size,
                    "ext": ext,
                    "mtime": datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat(),
                    "mtimeAgo": time_ago(mtime),
                    "mtimeTs": mtime,
                })
                result["totalSize"] += stat.st_size
                result["fileCount"] += 1
            except OSError:
                pass

    # Recent changes (last 24h)
    now = time.time()
    day_sec = 86400
    recent = [
        f for f in result["files"]
        if (now - f["mtimeTs"]) < day_sec
    ]
    recent.sort(key=lambda f: f["mtimeTs"], reverse=True)
    result["recentChanges"] = [
        f"{f['name']} ({f['mtimeAgo']})" for f in recent[:10]
    ]

    # Sort files by recency
    result["files"].sort(key=lambda f: f["mtimeTs"], reverse=True)
    result["files"] = result["files"][:max_files]

    return result


def get_git_status(dirpath):
    """Get git status and recent commits."""
    git_status = []
    git_root = None

    try:
        # Find git root
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=str(dirpath),
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            git_root = result.stdout.strip()

        # Git status (short)
        result = subprocess.run(
            ["git", "status", "--short"],
            cwd=str(dirpath),
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            git_status = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]

        # Recent commits (last 3)
        result = subprocess.run(
            ["git", "log", "--oneline", "-3"],
            cwd=str(dirpath),
            capture_output=True, text=True, timeout=5,
        )
        if result.returncode == 0:
            commits = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]
            if commits:
                git_status.append(f"Recent: {', '.join(commits[:2])}")

    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass

    return git_root, git_status


def get_geowon_memory(sessions=None):
    """Query geowon for recent session memory."""
    import urllib.request
    memory = []

    try:
        # Get all sessions
        req = urllib.request.Request(f"{GEOWON_URL}/sessions")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
            session_ids = data.get("sessions", [])

        # Get recent sessions (last 3)
        for sid in session_ids[-3:]:
            try:
                req = urllib.request.Request(f"{GEOWON_URL}/session/{sid}")
                with urllib.request.urlopen(req, timeout=5) as resp:
                    session = json.loads(resp.read().decode())
                    history = session.get("history", [])
                    if history:
                        last = history[-1]
                        memory.append({
                            "session": sid,
                            "turn": last.get("turn", "?"),
                            "content": last.get("content", "")[:200],
                            "route": last.get("route", {}),
                        })
            except Exception:
                continue

    except Exception:
        pass

    return memory


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Workspace indexer for NPR Local")
    parser.add_argument("directory", help="Directory to scan")
    parser.add_argument("--git", action="store_true", help="Include git status")
    parser.add_argument("--geowon", action="store_true", help="Include geowon memory")
    parser.add_argument("--max-files", type=int, default=50, help="Max files to include")
    parser.add_argument("--all", "-a", action="store_true", help="Include both git and geowon")
    args = parser.parse_args()

    dirpath = Path(args.directory).expanduser().resolve()

    if not dirpath.is_dir():
        print(json.dumps({"error": f"Not a directory: {dirpath}"}), file=sys.stderr)
        sys.exit(1)

    # Scan directory
    result = scan_directory(dirpath, args.max_files)

    # Git status
    if args.git or args.all:
        git_root, git_status = get_git_status(dirpath)
        result["gitRoot"] = git_root
        result["gitStatus"] = git_status

    # Geowon memory
    if args.geowon or args.all:
        result["geowonMemory"] = get_geowon_memory()

    # Clean up internal fields
    for f in result["files"]:
        f.pop("mtimeTs", None)

    # Output
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
