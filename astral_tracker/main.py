#!/usr/bin/env python3
"""
Astral Tracker — NPR-OS

Indicative orbital positions for major solar system bodies.
NOT ephemeris-grade. Simplified circular orbits with log-scaled display.

Usage:
  python main.py                          # stdout
  python main.py -o output.html           # write file
  python main.py -o output.html --tick N  # use tick N instead of now
"""

import sys
import argparse
from datetime import datetime, timezone, timedelta

from block_a_objects import OBJECTS
from block_b_phase import phase_at, resolve_positions, EPOCH
from block_c_svg import render_html


def tick_to_datetime(tick):
    """Convert tick to datetime (1 tick = 1 day from J2000 epoch)."""
    return EPOCH + timedelta(days=tick)


def main():
    parser = argparse.ArgumentParser(description="NPR-OS Astral Tracker")
    parser.add_argument("-o", "--output", help="Write HTML to file")
    parser.add_argument("--tick", type=int, help="Use tick N (days since J2000) instead of now")
    args = parser.parse_args()

    if args.tick is not None:
        now = tick_to_datetime(args.tick)
    else:
        now = datetime.now(timezone.utc)

    # Block B: compute phases
    phases = phase_at(OBJECTS, now)
    resolved = resolve_positions(phases)

    # Block C: render
    html_out = render_html(resolved, now)

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(html_out)
        print(f"→ {args.output}")
    else:
        print(html_out)


if __name__ == "__main__":
    main()
