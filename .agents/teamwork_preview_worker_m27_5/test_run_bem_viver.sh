#!/usr/bin/env bash
set -e

echo "=== TESTING AUTONOMOUS PIPELINE FOR GSA BEM VIVER ==="
TASK='{"output":"/media/1/production/autonomous/2026-09-15/gsa-bem-viver-532ddef0-d5c1-40f3-bcdc-4423d0c2073b.json","mode":"generic_program","targetWords":1200,"targetSeconds":3600,"date":"2026-09-15","program":"GSA Bem Viver"}'

docker exec -i gsa-tv-control-plane node /media/1/production/autonomous/tools/autonomous-script.cjs <<< "$TASK"
