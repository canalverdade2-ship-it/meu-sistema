#!/usr/bin/env bash
python3 - <<'EOF'
import json
d = json.load(open('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-14/pilot-reflection-02/script.json'))
print("Keys:", d.keys())
print("word_count:", d.get('word_count'))
print("sections count:", len(d.get('sections', [])))
print("mode:", d.get('mode'))
EOF
