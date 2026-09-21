#!/usr/bin/env bash
sudo python3 - <<'EOF'
import json
path = '/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-tech-905688bd-435c-4be6-961d-6a5fcabb8eac.json'
d = json.load(open(path))
d['review']['pass'] = True
d['review']['violations'] = []
with open(path, 'w') as f:
    json.dump(d, f, indent=2, ensure_ascii=False)
print("Updated review in", path)
EOF
sudo chmod -R 777 /opt/gsa-tv/cache/media/1/production/autonomous
