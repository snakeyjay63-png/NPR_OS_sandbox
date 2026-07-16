#!/usr/bin/env python3
"""
Generate IPv4 block addresses for npr-local source files.
Maps each function/method to an IPv4 address + line range.
Usage: python3 block_gen.py <file.js> [--check]
"""

import re, sys, json, os

# File-to-network mapping
FILE_NET_MAP = {
    "index.js": "10.01.0.0/24",
    "gateway.js": "10.02.0.0/24",
    "loop.js": "10.03.0.0/24",
    "npr.js": "10.04.0.0/24",
    "keyboard-npr.js": "10.05.0.0/24",
    "context.js": "10.06.0.0/24",
    "capabilities.js": "10.07.0.0/24",
    "core.js": "10.08.0.0/24",
    "map-registry.js": "10.09.0.0/24",
    "map-to-ipv6.js": "10.10.0.0/24",
    "server-config.js": "10.11.0.0/24",
    "handler.js": "10.12.0.0/24",
    "sources/index.js": "10.13.0.0/24",
    "system-scan.js": "10.14.0.0/24",
    "workspace-context.js": "10.15.0.0/24",
}

CATEGORY_LABELS = {
    0: "util",
    1: "handler",
    2: "route",
    3: "internal",
}

def detect_category(func_name, line_text):
    """Heuristic category detection."""
    text = (func_name + " " + line_text).lower()
    if any(w in text for w in ["get ", "post ", "route", "handle", "serve", "render"]):
        return 1  # handler
    if any(w in text for w in ["router", "/field", "/verify", "/tick", "endpoints"]):
        return 2  # route
    if any(w in text for w in ["log", "format", "parse", "count", "empty", "safe"]):
        return 0  # util
    return 3  # internal

def find_functions(lines):
    """Find function/method definitions and their line ranges."""
    patterns = [
        # function name(
        r'(?:export\s+)?function\s+(\w+)\s*\(',
        # const/let/var name = function
        r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function',
        # const/let/var name = async (params) =>
        r'(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(.*?\)\s*=>',
        # const/let/var { name } = require
        # (skip requires)
    ]
    
    funcs = []
    i = 0
    while i < len(lines):
        line = lines[i]
        for pat in patterns:
            m = re.search(pat, line)
            if m:
                name = m.group(1)
                if name in ("require", "module", "console", "process"):
                    break
                start = i + 1  # 1-indexed
                # Find end: count braces
                brace_count = 0
                started = False
                end = start
                for j in range(i, len(lines)):
                    for ch in lines[j]:
                        if ch == '{':
                            brace_count += 1
                            started = True
                        elif ch == '}':
                            brace_count -= 1
                    if started and brace_count <= 0:
                        end = j + 1
                        break
                    end = j + 1
                cat = detect_category(name, line)
                funcs.append((name, start, end, cat))
                break
        i += 1
    return funcs

def process_file(filepath, check_only=False):
    """Process a single file."""
    basename = os.path.basename(filepath)
    rel = os.path.relpath(filepath, "npr-local/src")
    
    # Find matching network
    net = None
    for key, val in FILE_NET_MAP.items():
        if key == basename or key == rel or rel.endswith("/" + key):
            net = val
            break
    
    if not net:
        print(f"  ⚠ No network mapping for {rel}")
        return []
    
    with open(filepath) as f:
        lines = f.readlines()
    
    funcs = find_functions(lines)
    blocks = []
    
    addr_counter = 1
    for name, start, end, cat in funcs:
        addr = f"{net.split('.')[0]}.{net.split('.')[1]}.{cat}.{addr_counter}"
        blocks.append({
            "func": name,
            "addr": addr,
            "start": start,
            "end": end,
            "cat": cat,
            "label": CATEGORY_LABELS[cat],
        })
        addr_counter += 1
    
    if check_only:
        # Show existing @addr vs expected
        existing = []
        for i, line in enumerate(lines):
            m = re.search(r'@addr\s+(10\.\d+\.\d+\.\d+)', line)
            if m:
                existing.append((i+1, m.group(1)))
        
        print(f"  File: {rel}")
        print(f"  Network: {net}")
        print(f"  Functions found: {len(funcs)}")
        print(f"  Existing @addr: {len(existing)}")
        print()
        
        for b in blocks:
            marker = "🆕" if not any(e[1] == b['addr'] for e in existing) else "✅"
            print(f"  {marker} {b['addr']:12s} lines {b['start']:3d}-{b['end']:3d} | {b['func']:20s} [{b['label']}]")
    else:
        # Generate patch
        header = f"// @net {net}\n"
        for b in blocks:
            header += f"// @addr {b['addr']}\n"
        
        print(f"  {rel} ({net}):")
        for b in blocks:
            print(f"    {b['addr']:12s} L{b['start']:3d}-{b['end']:3d} | {b['func']:20s} [{b['label']}]")
    
    return blocks

def main():
    src_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "src")
    check_only = "--check" in sys.argv
    
    if len(sys.argv) > 1 and sys.argv[1] != "--check":
        # Single file
        filepath = sys.argv[1]
        if not os.path.isabs(filepath):
            filepath = os.path.join(src_dir, filepath)
        process_file(filepath, check_only)
    else:
        # All files
        for root, dirs, files in os.walk(src_dir):
            for f in sorted(files):
                if f.endswith('.js'):
                    filepath = os.path.join(root, f)
                    blocks = process_file(filepath, check_only)
                    if blocks:
                        print()


if __name__ == "__main__":
    main()
