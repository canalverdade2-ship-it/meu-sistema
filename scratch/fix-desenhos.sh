python3 - << 'EOF'
import importlib.util
spec = importlib.util.spec_from_file_location("night_production", "/opt/gsa-tv/bin/night-production.py")
np = importlib.util.module_from_spec(spec)
spec.loader.exec_module(np)

block_id = '823999aa-010f-4d8e-aaba-07db6bf53b91'
blocks = np.query("SELECT id, program_id, media_item_id, planned_duration_s FROM gsa_tv_program_blocks WHERE id = $1", [block_id])
print('Block:', blocks)

if blocks and blocks[0]['media_item_id']:
    mid = blocks[0]['media_item_id']
    media = np.query("SELECT id, title, duration_s, drive_path, state, approval_state, rights_ok FROM gsa_tv_media_items WHERE id = $1", [mid])
    print('Media item:', media)
    m = media[0]
    file_path = np.media_path(m['drive_path'])
    print('File path:', file_path)
    actual_dur = np.probe(file_path)
    print(f"Current DB duration_s: {m['duration_s']}, Probed actual: {actual_dur}")
    diff = abs(actual_dur - float(m['duration_s']))
    print(f"Difference: {diff:.4f}s")
    if diff > 2:
        print(f"Updating gsa_tv_media_items id={mid} to duration_s={actual_dur}...")
        np.query("UPDATE gsa_tv_media_items SET duration_s = $1 WHERE id = $2", [actual_dur, mid])
        updated = np.query("SELECT id, duration_s FROM gsa_tv_media_items WHERE id = $1", [mid])
        print('Updated Media item:', updated)
    else:
        print("Duration difference <= 2s, no update needed.")
EOF
