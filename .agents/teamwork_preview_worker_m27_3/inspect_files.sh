#!/usr/bin/env bash
set -e

echo "=== RAW 2026-09-15.JSON ==="
cat /opt/gsa-tv/runtime/production/2026-09-15.json || true

echo -e "\n=== OTHER PRODUCTION JSON FILES ==="
ls -la /opt/gsa-tv/runtime/production/

echo -e "\n=== AUTONOMOUS DIRS FOR 2026-09-15 ==="
ls -la /opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/ || true

echo -e "\n=== SEARCH FOR RECENT LOGS OR RUNTIME FILES ==="
find /opt/gsa-tv/ -name "*2026-09-15*" 2>/dev/null || true
