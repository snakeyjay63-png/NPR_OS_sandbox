#!/usr/bin/env python3
"""
UTF-8 Encoding Verifier
========================
Checks all files in a directory for consistent UTF-8 encoding.

Standard: UTF-8 without BOM, LF line endings.

Usage:
    python verify_encoding.py [directory] [fix]
    
    fix=1   → auto-fix BOM and CRLF
    fix=0   → report only (default)
"""

import os
import sys
import argparse

# ─── Config ───

BOM = b'\xef\xbb\xbf'
STANDARD = "utf-8-no-bom-lf"

def check_file(filepath):
    """Check a single file for encoding issues."""
    issues = []
    
    try:
        with open(filepath, 'rb') as f:
            raw = f.read()
    except (IOError, OSError) as e:
        return [f"UNREADABLE: {e}"]
    
    # Empty file — skip
    if not raw:
        return []
    
    # Check BOM
    has_bom = raw.startswith(BOM)
    if has_bom:
        issues.append("BOM")
    
    # Check line endings
    has_crlf = b'\r\n' in raw
    has_cr = b'\r' in raw and not has_crlf
    if has_crlf:
        issues.append("CRLF")
    elif has_cr:
        issues.append("CR")
    
    # Check UTF-8 validity
    try:
        raw.decode('utf-8')
    except UnicodeDecodeError:
        issues.append("NOT_UTF8")
    
    return issues

def fix_file(filepath):
    """Fix BOM and CRLF in a file."""
    try:
        with open(filepath, 'rb') as f:
            raw = f.read()
    except (IOError, OSError):
        return False, "unreadable"
    
    if not raw:
        return False, "empty"
    
    fixed = False
    original = raw
    
    # Remove BOM
    if raw.startswith(BOM):
        raw = raw[3:]
        fixed = True
    
    # Normalize line endings: CRLF → LF, CR → LF
    if b'\r\n' in raw:
        raw = raw.replace(b'\r\n', b'\n')
        fixed = True
    elif b'\r' in raw:
        raw = raw.replace(b'\r', b'\n')
        fixed = True
    
    if fixed:
        try:
            with open(filepath, 'wb') as f:
                f.write(raw)
            return True, "fixed"
        except (IOError, OSError) as e:
            return False, str(e)
    
    return False, "ok"

def scan_directory(directory, do_fix=False):
    """Scan all files in a directory tree."""
    results = {
        "clean": [],
        "issues": {},
        "skipped": [],
        "fixed": [],
    }
    
    # Skip patterns
    skip_dirs = {'.git', 'node_modules', '__pycache__', '.DS_Store'}
    skip_exts = {'.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.zip',
                 '.tar', '.gz', '.bz2', '.xz', '.woff', '.woff2', '.ttf',
                 '.eot', '.mp3', '.mp4', '.ogg', '.webm', '.wav', '.flac',
                 '.midi', '.mid', '.m4a', '.bin', '.exe', '.dll', '.so',
                 '.jar', '.tgz', '.tar.gz', '.icns', '.webp', '.class',
                 '.o', '.a', '.pyc', '.pyo', '.db', '.sqlite', '.wasm',
                 '.node', '.bundle', '.snap', '.deb', '.rpm', '.msi'}
    
    for root, dirs, files in os.walk(directory):
        # Skip certain directories
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        
        for fname in files:
            fpath = os.path.join(root, fname)
            relpath = os.path.relpath(fpath, directory)
            
            # Skip binary extensions
            _, ext = os.path.splitext(fname)
            if ext.lower() in skip_exts:
                results["skipped"].append(relpath)
                continue
            
            issues = check_file(fpath)
            
            if not issues:
                results["clean"].append(relpath)
            else:
                if do_fix:
                    ok, msg = fix_file(fpath)
                    if ok:
                        results["fixed"].append(relpath)
                    else:
                        results["issues"][relpath] = {"issues": issues, "fix": msg}
                else:
                    results["issues"][relpath] = {"issues": issues}
    
    return results

def print_report(results, directory):
    """Print verification report."""
    print(f"\n{'='*60}")
    print(f"UTF-8 Encoding Report")
    print(f"{'='*60}")
    print(f"Directory: {directory}")
    print(f"Standard:  {STANDARD}")
    print()
    
    # Summary
    total = len(results["clean"]) + len(results["issues"]) + len(results["fixed"])
    print(f"Files scanned: {total}")
    print(f"  ✅ Clean:    {len(results['clean']):>5}")
    print(f"  ⚠️  Issues:  {len(results['issues']):>5}")
    print(f"  🔧 Fixed:    {len(results['fixed']):>5}")
    print(f"  ⏭️  Skipped: {len(results['skipped']):>5} (binary)")
    print()
    
    # Issues detail
    if results["issues"]:
        print(f"{'─'*60}")
        print("ISSUES:")
        print(f"{'─'*60}")
        for fpath, info in sorted(results["issues"].items()):
            print(f"  ❌ {fpath}")
            print(f"     Issues: {', '.join(info['issues'])}")
            if 'fix' in info:
                print(f"     Fix:    {info['fix']}")
        print()
    
    # Fixed detail
    if results["fixed"]:
        print(f"{'─'*60}")
        print("FIXED:")
        print(f"{'─'*60}")
        for fpath in sorted(results["fixed"]):
            print(f"  ✅ {fpath}")
        print()
    
    # Clean (if small)
    if results["clean"] and len(results["clean"]) <= 20:
        print(f"{'─'*60}")
        print("CLEAN FILES:")
        print(f"{'─'*60}")
        for fpath in sorted(results["clean"]):
            print(f"  ✅ {fpath}")
        print()

def main():
    parser = argparse.ArgumentParser(description="UTF-8 encoding verifier")
    parser.add_argument("directory", nargs="?", default=".", 
                        help="Directory to scan (default: current)")
    parser.add_argument("--fix", action="store_true", 
                        help="Auto-fix BOM and CRLF issues")
    args = parser.parse_args()
    
    directory = os.path.abspath(args.directory)
    if not os.path.isdir(directory):
        print(f"Error: '{directory}' is not a directory", file=sys.stderr)
        sys.exit(1)
    
    results = scan_directory(directory, do_fix=args.fix)
    print_report(results, directory)
    
    # Exit code
    if results["issues"]:
        sys.exit(1)
    sys.exit(0)

if __name__ == "__main__":
    main()
