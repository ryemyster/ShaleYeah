#!/usr/bin/env bash
export RUN_ID=local
npx claude-flow@alpha agent run .claude-flow/agents/geowiz.yaml --vars RUN_ID=$RUN_ID