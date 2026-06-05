# How the Geologist Agent Works

## The simple version

Imagine you have a super-smart geologist friend who knows everything about oil and gas rocks. You give them a question like "What does this well log tell us about the Permian Basin?" and they go figure it out for you.

The geologist agent is like that friend, but it's software. You give it a question in plain English. It figures out which tools it needs to use (like a rock analysis tool, or a map tool), uses them one by one, and then writes you a clear answer.

## The two pieces

There are actually two separate pieces working together, like a doctor and their medical lab:

**The geowiz server (the lab)** — This is a collection of 8 specialized tools. Each tool does one specific thing:
- Analyze a well log file
- Process a map file
- Read a geological database
- Assess data quality
- and more

The server doesn't think — it just runs tools when asked.

**The geologist agent (the doctor)** — This is the smart layer. It:
1. Reads your question
2. Decides which tools to use
3. Calls the lab (geowiz server) with the right tool
4. Reads the result
5. Decides if it needs more tools
6. Writes a final answer

## Step by step

Here's what happens when you ask "Analyze the Permian Basin formation in this LAS file":

```
You:      "Analyze the Permian Basin formation in test.las"
                              ↓
Agent thinks: "I need analyze_formation. Let me call that tool."
                              ↓
Agent calls:  geowiz server → analyze_formation(test.las)
                              ↓
Server returns: { porosity: 12%, netPay: 150ft, maturity: "Early Oil Window" }
                              ↓
Agent thinks: "Got enough information. Time to write the answer."
                              ↓
You get:  "The Permian Basin formation shows 12% porosity with 150 feet of net pay,
           indicating an Early Oil Window maturity stage. This is a viable target..."
```

## The safety layer

Before the agent can use any tool, it goes through a safety checkpoint:

- **Scope check**: Does the caller have `read:geology` permission? No → blocked.
- **HITL gate**: Is this a sensitive or destructive action? Yes → pause and ask a human.
- **Audit log**: Every single tool call is recorded with timestamp, how long it took, and whether it succeeded.

This means you always know what the agent did and when.

## What it can't do yet

- **Memory**: The agent doesn't remember your previous questions (coming in issue #395)
- **Long jobs**: Seismic processing can take minutes. Right now it just waits (polling pattern coming in issue #396)
- **Write anything**: All 8 tools are read-only — the agent only analyzes, never modifies data

## The contract

The geologist agent follows the `AgentManifest` contract. Think of it like a job description for software:
- "Here are my 8 tools"
- "Here's what each tool needs as input"
- "Here's what permissions are required"
- "Here's when a human needs to approve"

Any system that speaks the `AgentRuntime` language can call the geologist the same way.
