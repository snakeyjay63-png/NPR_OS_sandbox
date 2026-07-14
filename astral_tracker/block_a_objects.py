"""
BLOCK A — Objectdata

Minimal object definitions for major solar system bodies.
Orbital parameters are approximate; used for indicative phase calculation only.
"""

OBJECTS = [
    {
        "id": "sun",
        "name": "Zon",
        "center": None,
        "semi_major_axis_au": 0.0,
        "orbital_period_days": None,
        "radius_km": 696_340.0,
        "color": "#FDB813",
        "label": "☀",
    },
    {
        "id": "mercury",
        "name": "Mercurius",
        "center": "sun",
        "semi_major_axis_au": 0.387,
        "orbital_period_days": 87.969,
        "radius_km": 2_439.7,
        "color": "#A0522D",
        "label": "☿",
    },
    {
        "id": "venus",
        "name": "Venus",
        "center": "sun",
        "semi_major_axis_au": 0.723,
        "orbital_period_days": 224.701,
        "radius_km": 6_051.8,
        "color": "#E6A817",
        "label": "♀",
    },
    {
        "id": "earth",
        "name": "Aarde",
        "center": "sun",
        "semi_major_axis_au": 1.0,
        "orbital_period_days": 365.256,
        "radius_km": 6_371.0,
        "color": "#4169E1",
        "label": "♁",
    },
    {
        "id": "mars",
        "name": "Mars",
        "center": "sun",
        "semi_major_axis_au": 1.524,
        "orbital_period_days": 686.98,
        "radius_km": 3_389.5,
        "color": "#CD5C5C",
        "label": "♂",
    },
    {
        "id": "jupiter",
        "name": "Jupiter",
        "center": "sun",
        "semi_major_axis_au": 5.203,
        "orbital_period_days": 4_332.59,
        "radius_km": 69_911.0,
        "color": "#DEB887",
        "label": "♃",
    },
    {
        "id": "saturn",
        "name": "Saturnus",
        "center": "sun",
        "semi_major_axis_au": 9.537,
        "orbital_period_days": 10_759.22,
        "radius_km": 58_232.0,
        "color": "#DAA520",
        "label": "♄",
    },
    {
        "id": "uranus",
        "name": "Uranus",
        "center": "sun",
        "semi_major_axis_au": 19.191,
        "orbital_period_days": 30_688.5,
        "radius_km": 25_362.0,
        "color": "#87CEEB",
        "label": "⛢",
    },
    {
        "id": "neptune",
        "name": "Neptunus",
        "center": "sun",
        "semi_major_axis_au": 30.069,
        "orbital_period_days": 60_182.0,
        "radius_km": 24_622.0,
        "color": "#4682B4",
        "label": "♆",
    },
    {
        "id": "moon",
        "name": "Maan",
        "center": "earth",
        "semi_major_axis_km": 384_400,
        "semi_major_axis_au": 0.00257,  # for reference
        "orbital_period_days": 27.3217,
        "radius_km": 1_737.4,
        "color": "#D3D3D3",
        "label": "☽",
    },
]

# Lookup
OBJECT_MAP = {obj["id"]: obj for obj in OBJECTS}
