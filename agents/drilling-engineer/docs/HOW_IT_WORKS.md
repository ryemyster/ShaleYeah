# How It Works — @shaleyeah/drilling-engineer

> **Status: Planned** — Not yet implemented. See [#374](https://github.com/ryemyster/ShaleYeah/issues/374).

## The simple version (for a 12-year-old)

Drilling an oil well is like using the world's biggest drill bit — except it has to go straight down (or sometimes sideways) through miles of rock without getting stuck or breaking.

The **drilling engineer** is like the architect for the hole in the ground. You tell it where you want to drill and what rocks are in the way. It figures out:
- How big to make the hole at each depth
- What kind of drill bit to use
- What to pump into the hole to keep the walls from collapsing
- How much the whole thing will cost

## The technical version

1. **drilling server (Tier 1):** Runs wellbore engineering calculations — trajectory design, casing programs, AFE cost models, BHA configurations. Stateless: inputs in, structured outputs out.
2. **drilling-engineer agent (Tier 2):** ReAct loop — interprets the drilling objective, sequences the right calculations, synthesizes a drilling program recommendation.

Hazard assessment tools use `deep-reasoning` model routing because formation pressure prediction requires multi-step inference across uncertain data.

## What it can't do (yet)

- Pull live rig rate quotes
- Interface with directional drilling software (Landmark, Halliburton WellPlan)
- Generate regulatory permits
