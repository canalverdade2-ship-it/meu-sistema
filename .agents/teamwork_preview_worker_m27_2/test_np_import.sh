python3 -c "
import sys
sys.path.insert(0, '/opt/gsa-tv/bin')
import night_production as np

date = '2026-09-15'
version, blocks = np.published(date)
print('Published version:', version)
print('Total blocks:', len(blocks))
" 2>&1 || python3 -c "
import sys
import importlib.util
spec = importlib.util.spec_from_file_location('np', '/opt/gsa-tv/bin/night-production.py')
np = importlib.util.module_from_spec(spec)
spec.loader.exec_module(np)

date = '2026-09-15'
version, blocks = np.published(date)
print('Published version:', version)
print('Total blocks:', len(blocks))
for b in blocks:
    if b.get('is_reprise') or (b.get('metadata') or {}).get('content_mode')=='library':
        print(f'Block {b[\"id\"]}: {b[\"name\"]} start={b[\"planned_start_offset_s\"]} dur={b[\"planned_duration_s\"]} media={b[\"media_item_id\"]}')
"
