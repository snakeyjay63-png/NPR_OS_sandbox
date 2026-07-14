"""
BLOCK C — Statische SVG

Render orbital positions as SVG inside an HTML container.
Uses logarithmic distance scaling for visibility.
Positions are INDICATIVE, not ephemeris-grade.
"""

import math
import html
from datetime import datetime, timezone

# SVG dimensions
W, H = 900, 900
CX, CY = W / 2, H / 2

# Log scale: display_radius = log(1 + dist_au) * scale_factor
# Max dist ~30 AU (neptune) → log(31) ≈ 3.43
# Available radius: ~400px
SCALE = 115  # pixels per log-unit


def au_to_display(dist_au):
    """Convert AU to display pixels using log scale."""
    return math.log(1 + abs(dist_au)) * SCALE


def render_svg(positions, timestamp=None):
    """
    Generate SVG string for current orbital positions.
    """
    if timestamp is None:
        timestamp = datetime.now(timezone.utc)

    ts_str = timestamp.strftime("%Y-%m-%d %H:%M UTC")

    svg_parts = []
    svg_parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}">')
    svg_parts.append(f'  <style>')
    svg_parts.append(f'    bg {{ fill: #0a0a0f; }}')
    svg_parts.append(f'    orbit {{ fill: none; stroke: #222; stroke-width: 0.5; }}')
    svg_parts.append(f'    body {{ stroke: #fff; stroke-width: 0.5; }}')
    svg_parts.append(f'    label {{ fill: #aaa; font-size: 10px; font-family: monospace; }}')
    svg_parts.append(f'    title {{ fill: #fff; font-size: 14px; font-family: monospace; }}')
    svg_parts.append(f'    subtitle {{ fill: #666; font-size: 10px; font-family: monospace; }}')
    svg_parts.append(f'    .warn {{ fill: #f80; font-size: 9px; font-family: monospace; }}')
    svg_parts.append(f'  </style>')

    # Background
    svg_parts.append(f'  <rect class="bg" width="{W}" height="{H}"/>')

    # Title
    svg_parts.append(f'  <text class="title" x="15" y="25">Astral Tracker — Indicatief</text>')
    svg_parts.append(f'  <text class="subtitle" x="15" y="42">{ts_str}</text>')
    svg_parts.append(f'  <text class="warn" x="15" y="58">⚠ Afstanden log-schaal. Posities indicatief.</text>')

    # Draw orbits (circles) for heliocentric bodies
    helio_bodies = [p for p in positions if p.get("center") == "sun" or p.get("center") is None]
    for p in helio_bodies:
        dist = p.get("dist_au", 0.0)
        if dist > 0:
            r = au_to_display(dist)
            svg_parts.append(
                f'  <circle class="orbit" cx="{CX}" cy="{CY}" r="{r:.1f}"/>'
            )

    # Draw bodies
    for p in positions:
        dx = p["abs_x"] if "abs_x" in p else p["x"]
        dy = p["abs_y"] if "abs_y" in p else p["y"]

        # Convert to display coordinates
        if p.get("center") is None and p.get("id") == "sun":
            px, py = CX, CY
        else:
            dist = abs(dx)
            angle = math.atan2(dy, dx)
            r = au_to_display(dist)
            px = CX + r * math.cos(angle)
            py = CY + r * math.sin(angle)

        # Body size (minimum 3px, sun bigger)
        if p["id"] == "sun":
            body_r = 10
        elif p["id"] == "moon":
            body_r = 2
        else:
            body_r = 3

        fill = p.get("color", "#fff")
        label = p.get("label", p["name"])
        name = html.escape(p["name"])

        svg_parts.append(
            f'  <circle class="body" cx="{px:.1f}" cy="{py:.1f}" r="{body_r}" fill="{fill}"/>'
        )
        svg_parts.append(
            f'  <text class="label" x="{px + body_r + 3:.1f}" y="{py + 4:.1f}">{label} {name}</text>'
        )

    # Moon orbit around earth
    moon = [p for p in positions if p["id"] == "moon"]
    earth = [p for p in positions if p["id"] == "earth"]
    if moon and earth:
        m = moon[0]
        e = earth[0]
        e_dx = e["abs_x"] if "abs_x" in e else e["x"]
        e_dy = e["abs_y"] if "abs_y" in e else e["y"]
        earth_angle = math.atan2(e_dy, e_dx)
        earth_r = au_to_display(abs(e_dx))
        ex = CX + earth_r * math.cos(earth_angle)
        ey = CY + earth_r * math.sin(earth_angle)

        moon_r_display = au_to_display(m.get("semi_major_axis_au", 0.00257))
        moon_r_display = max(moon_r_display, 12)  # minimum visible
        svg_parts.append(
            f'  <circle class="orbit" cx="{ex:.1f}" cy="{ey:.1f}" r="{moon_r_display:.1f}" stroke-dasharray="2,3"/>'
        )

    svg_parts.append('</svg>')
    return "\n".join(svg_parts)


def render_html(positions, timestamp=None):
    """Full HTML page with SVG."""
    svg = render_svg(positions, timestamp)

    return f"""<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="utf-8">
<title>Astral Tracker — Indicatief</title>
<style>
  body {{ background: #000; color: #ccc; margin: 0; display: flex; flex-direction: column; align-items: center; }}
  svg {{ max-width: 100%; }}
  footer {{ margin: 1rem; font-size: 11px; color: #555; font-family: monospace; }}
</style>
</head>
<body>
{svg}
<footer>
  NPR-OS astral_tracker | indicatief | niet ephemeris-grade<br/>
  scope: major_bodies | model: simplified_orbits
</footer>
</body>
</html>"""
