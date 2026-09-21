#!/usr/bin/env bash
set -e

echo "=== TESTING AUTONOMOUS-SCRIPT FOR GSA TECH ==="
docker exec -i gsa-tv-control-plane node /media/1/production/autonomous/tools/autonomous-script.cjs <<'EOF'
{
  "output": "/media/1/production/autonomous/2026-09-15/gsa-tech-905688bd-435c-4be6-961d-6a5fcabb8eac.json",
  "mode": "generic_program",
  "targetWords": 4500,
  "targetSeconds": 1800,
  "date": "2026-09-15",
  "program": "GSA Tech"
}
EOF
echo "GSA Tech autonomous script finished with code $?"
