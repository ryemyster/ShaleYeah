# How It Works — @shaleyeah/infrastructure-planner

> **Status: Planned** — Not yet implemented. See [#375](https://github.com/ryemyster/ShaleYeah/issues/375).

## The simple version (for a 12-year-old)

After you drill an oil well, the oil doesn't magically appear at a gas station. It has to travel through pipes, get pumped through compressors, and be separated from water before it can be sold.

The **infrastructure planner** designs all the "plumbing" that connects the wells to the market. It figures out how big the pipes need to be, where to put the pump stations, how to handle all the salty water that comes up with the oil, and how much all this equipment will cost.

## The technical version

1. **infrastructure server (Tier 1):** Runs pipeline hydraulic calculations, compression modeling, SWD capacity analysis, and surface facilities cost estimating.
2. **infrastructure-planner agent (Tier 2):** ReAct loop — takes the development plan (well locations, production forecasts), sequences the right facilities calculations, produces an infrastructure design and capital estimate.

`infrastructure_schedule` uses `deep-reasoning` — it must sequence facilities construction to match well completion timing without creating production bottlenecks.
