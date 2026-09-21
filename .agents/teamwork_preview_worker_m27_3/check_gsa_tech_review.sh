#!/usr/bin/env bash
python3 - <<'EOF'
import json
d = json.load(open('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-tech-905688bd-435c-4be6-961d-6a5fcabb8eac.json'))
print("Review:", d.get('review'))
EOF
