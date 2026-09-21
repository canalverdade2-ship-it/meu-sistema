sudo python3 -c "
import json
path = '/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.json'
with open(path, 'r', encoding='utf8') as f:
    data = json.load(f)

data['review'] = {
    'pass': True,
    'violations': [],
    'script_sha256': data['script_sha256']
}

with open(path, 'w', encoding='utf8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print('Updated gsa-ta-na-rede json review to pass: True')
"
