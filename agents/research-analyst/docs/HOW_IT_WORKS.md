# How It Works

The Research Analyst helps a user gather market intelligence and competitor evidence for oil and gas diligence.

It collects or infers the research task, identifies missing scope, chooses a Research MCP tool, and turns the tool output into a source-aware intelligence summary. It should be explicit when evidence is stale, inaccessible, conflicting, or low confidence.

## Main Inputs

Useful inputs include:

- topic or research question
- basin, region, operator, commodity, regulation, or technology scope
- timeframe
- preferred public, user-provided, or approved source URLs
- named competitors or operators
- required output style
- confidentiality or sharing constraints

If those inputs are missing, the agent should ask for them or explain that only a provisional research plan is possible.

## Tool Selection

| User Need | Tool |
|-----------|------|
| Market, commodity, source, policy, technology, or regulatory research | `conduct_market_research` |
| Operator, competitor, strategy, performance, or regional competitive landscape | `analyze_competition` |

The agent uses `plan_research_tool_call` to explain the intended backend call and the ADK-to-MCP boundary.

## Output Style

Good responses should:

- ground conclusions in tool output
- separate cited facts from source-derived inferences and assumptions
- identify source URLs, source classes, or source gaps
- name stale, inaccessible, conflicting, or low-confidence evidence
- provide a concise intelligence summary and follow-up data requests
- defer final approvals or disclosures to humans

The agent should not invent market facts, paywalled-source contents, reserve classifications, legal conclusions, or public-disclosure language.
