# Astral Tracker — NPR-OS Route

**Doel:** Indicatieve planetaire posities via NPR-OS route-notatie.
Niet een ephemeris. Een transparante actuele indicatie waarvan iedere objectroute afzonderlijk valideerbaar is.

**Afhankelijkheid:** Stap 19 (Return, taal-adres), Stap 71 (route-notatie), Stap 64 (śūnya-routing).

---

## Route

```
ROUTE {
  id: "npr:route:astral_tracker"

  source: {
    type: text
    content: "orbital parameters of major solar system bodies"
    language: "und"
    origin: "declared orbital data (simplified)"
    context: "indicative positions, not ephemeris-grade"
  }

  noise: {
    tokens: ["sun", "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune", "moon"]
    raw_pattern: "10 major bodies with orbital parameters"
    modality: spatial
  }

  transform: {
    tokenization_rule: "split_on_objects"
    normalization_rule: "as_is"
    mapping_rule: "custom(orbital_period -> phase_angle -> position)"
    reduction_rule: "none"
  }

  pattern: {
    intermediate_values: [
      {
        token: "object",
        numeric_value: orbital_period_days,
        digital_root: phase_fraction
      }
    ]
    cycle: "cyclic return — phase wraps at orbital period"
  }

  return: {
    address: "taal://npr/astral_tracker/indicative_positions"
    address_rule: "sequence"
    interpretation: "log-scaled spatial positions with orbital phase overlay"
  }

  trace: {
    steps: ["load orbital data", "compute phase", "render SVG", "export HTML"]
    consistency: true
    hypothesis_status: "indicative — simplified circular orbits"
  }
}
```

---

## Scope

```
scope := major_bodies
model := simplified_orbits
output := indicative_current_system

display_position ≠ exact_observed_position
```

---

## Objectset

```
Zon          (centrum)
Mercurius
Venus
Aarde        ← Maan (geocentrisch)
Mars
Jupiter
Saturnus
Uranus
Neptunus
```

---

## Faseberekening

```
phase_fraction := (elapsed_days mod orbital_period_days) / orbital_period_days
angle := 2 * pi * phase_fraction
x := a * cos(angle)
y := a * sin(angle)
```

Log-schaal voor display:

```
display_radius := log(1 + distance_au) * scale_factor
```
