#!/usr/bin/env tsx
/**
 * Reads ./specs/*.spec.md and asks Claude-Flow to produce agent YAMLs.
 * In OSS, we keep it transparent: template + minimal prompt.
 */
import fs from "node:fs";
import path from "node:path";

const specsDir = "specs";
const outDir = ".claude-flow/agents";
const files = fs.readdirSync(specsDir).filter(f => f.endsWith(".spec.md"));

for (const f of files) {
    const txt = fs.readFileSync(path.join(specsDir, f), "utf8");
    const base = f.replace(".spec.md", "");
    const yaml = `name: ${base}
description: Generated from spec
type: analyst
model: sonnet-4
tools: [Read, Write, Edit, Bash, Grep, Glob, TodoWrite]
instructions: |
  Convert this spec into a working agent:
  ---
  ${txt.trim()}
outputs:
  - data/outputs/\${RUN_ID}/${base}.md
`;
    fs.writeFileSync(path.join(outDir, `${base}.yaml`), yaml);
    console.log("Generated", `${base}.yaml`);
}