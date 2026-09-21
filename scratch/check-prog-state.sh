python3 << 'EOF'
import json
d = json.load(open('/opt/gsa-tv/runtime/production/2026-09-15.json'))
for p in d.get('programs', []):
    if p.get('slug') == 'gsa-ta-na-rede':
        print('GSA TA NA REDE STATE:', json.dumps(p, indent=2))
EOF
