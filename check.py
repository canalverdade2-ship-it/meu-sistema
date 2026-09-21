import sys, json, subprocess
sys.path.append('/opt/gsa-tv/bin')
import importlib.util
spec = importlib.util.spec_from_file_location('np', '/opt/gsa-tv/bin/night-production.py')
np = importlib.util.module_from_spec(spec)
sys.modules['np'] = np
spec.loader.exec_module(np)
try:
    res = np.query("SELECT drive_path FROM gsa_tv_media_items WHERE metadata->>'program_slug'='gsa-ta-na-rede' AND state='ready'")
    for r in res: print(r)
except subprocess.CalledProcessError as e:
    print(e.stderr)
