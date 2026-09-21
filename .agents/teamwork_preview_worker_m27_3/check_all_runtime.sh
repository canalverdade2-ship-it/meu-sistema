#!/usr/bin/env bash
python3 - <<'EOF'
import json
d = json.load(open('/opt/gsa-tv/runtime/production/2026-09-15.json'))
print("State:", d.get('state'))
print("Started at:", d.get('started_at'))
print("Finished at:", d.get('finished_at'))
programs = d.get('programs', [])
print(f"Total programs in 2026-09-15.json: {len(programs)}")
for i, p in enumerate(programs):
    print(f"[{i+1:02d}] {p.get('program')} ({p.get('slug')}) -> state: {p.get('state')} | error: {str(p.get('error'))[:80]}")
EOF
