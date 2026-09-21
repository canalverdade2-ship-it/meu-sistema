python3 << 'EOF'
import json
data = json.loads(open('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.json').read())
print('KEYS:', data.keys())
print('REVIEW:', data.get('review'))
print('PROGRAM:', data.get('program'))
print('SECTIONS:', len(data.get('sections', [])))
EOF
