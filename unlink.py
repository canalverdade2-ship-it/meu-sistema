import sys, json, subprocess
sys.path.append('/opt/gsa-tv/bin')
import importlib.util
spec = importlib.util.spec_from_file_location('np', '/opt/gsa-tv/bin/night-production.py')
np = importlib.util.module_from_spec(spec)
sys.modules['np'] = np
spec.loader.exec_module(np)
try:
    np.query("UPDATE gsa_tv_schedule_blocks SET media_item_id=NULL WHERE id='0f2f9292-a83b-462b-aab7-b09cbff27b8a'")
except Exception as e:
    print(e)
