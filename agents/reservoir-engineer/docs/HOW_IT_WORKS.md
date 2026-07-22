# How It Works — @shaleyeah/reservoir-engineer

> **Status: Planned** — Not yet implemented. See [#365](https://github.com/ryemyster/ShaleYeah/issues/365).

## The simple version (for a 12-year-old)

Imagine there's a giant sponge full of oil buried underground. You can't see it, but you need to figure out: how much oil is in there? How fast can you pump it out? And when will it run out?

The **reservoir engineer** is like a scientist who studies that underground sponge. You give it well logs (measurements taken while drilling) and production history (how much oil has already come out). It figures out:
- How much oil is still in the rock
- How fast it will flow out over time
- How many wells you'd need to get it all out
- When the field will stop being profitable

## The technical version

1. **curve-smith server (Tier 1):** Runs reservoir engineering calculations — decline curve fitting, production forecasting, petrophysical log interpretation, material balance. Returns structured numeric outputs.
2. **reservoir-engineer agent (Tier 2):** ReAct loop — interprets the reservoir question, selects and sequences the right calculations, synthesizes a coherent picture of the reservoir.

Material balance calculations (estimating in-place volumes) use `deep-reasoning` routing because they require multi-constraint inference across uncertain inputs.

## What it can't do (yet)

- Run full reservoir simulation (CMG, Eclipse)
- Integrate with subsurface interpretation software
- Handle 3D seismic attribute extraction (that's geowiz's domain)
