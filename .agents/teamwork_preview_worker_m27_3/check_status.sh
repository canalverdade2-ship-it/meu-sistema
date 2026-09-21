#!/usr/bin/env bash
set -e

echo "=== CHECKING RUNTIME PRODUCTION 2026-09-15.JSON ==="
python3 - <<'EOF'
import json
from pathlib import Path

path = Path('/opt/gsa-tv/runtime/production/2026-09-15.json')
if not path.is_file():
    print("File not found:", path)
else:
    data = json.loads(path.read_text())
    print("Generated at:", data.get('generated_at'))
    print("Date:", data.get('date'))
    print("Schedule version:", data.get('schedule_version_id'))
    blocks = data.get('blocks', [])
    print("Total blocks:", len(blocks))
    states = {}
    for b in blocks:
        st = b.get('state', 'unknown')
        states[st] = states.get(st, 0) + 1
    print("States summary:", states)
    print("\nDetailed blocks:")
    for i, b in enumerate(blocks):
        print(f"[{i:02d}] {b.get('time')} | {b.get('slug')} | state: {b.get('state')} | media_id: {b.get('media_id')} | error: {b.get('error')}")
EOF

echo -e "\n=== CHECKING EXECUTION LOGS ==="
ls -la /opt/gsa-tv/logs/ 2>/dev/null || true
tail -n 30 /opt/gsa-tv/logs/2026-09-15-execution.log 2>/dev/null || tail -n 30 /opt/gsa-tv/logs/night-production.log 2>/dev/null || true

echo -e "\n=== NIGHT-PRODUCTION.PY CLI HELP ==="
python3 /opt/gsa-tv/bin/night-production.py --help || true
