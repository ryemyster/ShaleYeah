#!/usr/bin/env bash
set -e
export RUN_ID=$(date +%Y%m%d-%H%M%S)
mkdir -p data/outputs/$RUN_ID
echo "RUN_ID=$RUN_ID"
npm run start &
SWARM_PID=$!
sleep 2
echo "Launching flow…"
npx claude-flow@alpha run pipelines/shale.yaml --vars RUN_ID=$RUN_ID
kill $SWARM_PID || true
echo "Done. Outputs in data/outputs/$RUN_ID"