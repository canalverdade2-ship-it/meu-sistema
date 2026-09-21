import sys, json, subprocess
sys.path.append('/opt/gsa-tv/bin')
import importlib.util
spec = importlib.util.spec_from_file_location('np', '/opt/gsa-tv/bin/night-production.py')
np = importlib.util.module_from_spec(spec)
sys.modules['np'] = np
spec.loader.exec_module(np)
try:
    np.query("UPDATE gsa_tv_program_blocks SET media_item_id=NULL WHERE id='0f2f9292-a83b-462b-aab7-b09cbff27b8a'")
    np.query("UPDATE gsa_tv_media_items SET state='archived' WHERE metadata->>'program_slug'='gsa-ta-na-rede'")
except Exception as e:
    print(e)

p = '/opt/gsa-tv/runtime/production/2026-09-15.json'
try:
    with open(p, 'r') as f: d = json.load(f)
    d['state'] = 'production'
    d.pop('finished_at', None)
    d.pop('compile_job_id', None)
    for x in d.get('programs', []):
        if x.get('slug') == 'gsa-ta-na-rede':
            x['state'] = 'failed_autonomous'
            x.pop('master', None)
            x.pop('media_id', None)
    with open(p, 'w') as f: json.dump(d, f, indent=2)
except Exception as e:
    print(e)
