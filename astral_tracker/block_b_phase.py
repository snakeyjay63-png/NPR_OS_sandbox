"""
BLOCK B — Actuele Fase

Compute orbital phase and indicative position for each object.
Uses simplified circular orbits; NOT ephemeris-grade.
"""

import math
from datetime import datetime, timezone
from block_a_objects import OBJECTS, OBJECT_MAP

# J2000 epoch
EPOCH = datetime(2000, 1, 1, 12, 0, tzinfo=timezone.utc)


def phase_at(objects, now=None):
    """
    Compute indicative positions for all objects at a given time.

    Returns list of dicts with:
      id, name, angle_deg, x, y, phase_fraction, center
    """
    if now is None:
        now = datetime.now(timezone.utc)

    elapsed_days = (now - EPOCH).total_seconds() / 86400.0
    results = []

    for obj in objects:
        sid = obj["id"]
        period = obj.get("orbital_period_days")

        if period is None:
            # Sun is stationary at center
            results.append({
                "id": sid,
                "name": obj["name"],
                "angle_deg": 0.0,
                "x": 0.0,
                "y": 0.0,
                "phase_fraction": 0.0,
                "center": None,
                "radius_km": obj["radius_km"],
                "color": obj["color"],
                "label": obj["label"],
            })
            continue

        # Phase fraction: where in the orbital cycle
        phase_fraction = (elapsed_days % period) / period
        angle_rad = 2 * math.pi * phase_fraction
        angle_deg = math.degrees(angle_rad)

        # Distance in AU (or converted from km)
        dist_au = obj.get("semi_major_axis_au", 0.0)
        if dist_au == 0.0 and "semi_major_axis_km" in obj:
            dist_au = obj["semi_major_axis_km"] / 149_597_870.7

        # Position on circular orbit
        x = dist_au * math.cos(angle_rad)
        y = dist_au * math.sin(angle_rad)

        # Center offset (for moon → earth)
        center_id = obj.get("center")

        results.append({
            "id": sid,
            "name": obj["name"],
            "angle_deg": angle_deg,
            "x": x,
            "y": y,
            "phase_fraction": phase_fraction,
            "center": center_id,
            "radius_km": obj["radius_km"],
            "color": obj["color"],
            "label": obj["label"],
            "dist_au": dist_au,
        })

    return results


def resolve_positions(phases):
    """
    Resolve centered objects (e.g. moon around earth) to absolute positions.
    """
    positions = {p["id"]: (p["x"], p["y"]) for p in phases if p["center"] is None}

    resolved = []
    for p in phases:
        cx, cy = 0.0, 0.0
        if p["center"] and p["center"] in positions:
            cx, cy = positions[p["center"]]

        resolved.append({
            **p,
            "abs_x": p["x"] + cx,
            "abs_y": p["y"] + cy,
        })

    return resolved
