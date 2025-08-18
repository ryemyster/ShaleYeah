#!/usr/bin/env bash
set -euo pipefail
miss=0
grep -R "Generated with SHALE YEAH" data/outputs || miss=1
grep -q "SHALE YEAH" NOTICE || miss=1
if [ $miss -ne 0 ]; then
  echo "Branding/NOTICE missing"; exit 1
fi