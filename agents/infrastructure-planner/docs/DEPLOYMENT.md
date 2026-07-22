# Deployment

This package is an ADK/Python agent. It can run locally, in a container, on Cloud Run, on Agent Runtime, or in another ADK-compatible environment. The Infrastructure MCP backend remains a separate deployable service.

## Required Wiring

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `INFRASTRUCTURE_MCP_URL` | No | `http://localhost:3012` | Infrastructure MCP backend URL |
| `INFRASTRUCTURE_PLANNER_ADK_MODEL` | No | `gemini-flash-latest` | ADK model for the root agent |

Provider credentials should come from the deployment environment or secret manager. Do not bake credentials or confidential project data into the image.

## Pair Deployment

Deploy `servers/infrastructure` and `agents/infrastructure-planner` independently. Point the agent at the backend with `INFRASTRUCTURE_MCP_URL`.

```yaml
services:
  infrastructure:
    image: shaleyeah/infrastructure:latest
    environment:
      PORT: "3012"
  infrastructure-planner:
    image: shaleyeah/infrastructure-planner:latest
    environment:
      INFRASTRUCTURE_MCP_URL: http://infrastructure:3012
```

Before production deployment, verify HITL handling for route approval, construction, capital, ROW/easement, midstream commitments, permit certification, PHMSA/UIC approvals, environmental conclusions, public disclosure, and sensitive memory promotion.
