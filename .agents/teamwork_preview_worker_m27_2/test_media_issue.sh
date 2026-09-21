python3 -c "
import importlib.util
spec = importlib.util.spec_from_file_location('np', '/opt/gsa-tv/bin/night-production.py')
np = importlib.util.module_from_spec(spec)
spec.loader.exec_module(np)

date = '2026-09-15'
version, blocks = np.published(date)
blocks_by_id = {b['id']: b for b in blocks}

test_links = {
  '823999aa-010f-4d8e-aaba-07db6bf53b91': 'media-ent-desenhos-sabado',
  'c25b969e-5c85-471a-b3d7-df1f14e86eb7': 'media-ent-pipoca-sabado',
  '2a8851c9-af05-4e8b-b337-53e5c615bb5d': 'media-auto-ad31636f-c7c7-4aa8-a6ae-8add00139bdc',
  '91368035-2657-430a-b148-d0a466e5327a': 'media-gsa-tv-continuity-600'
}

for b_id, m_id in test_links.items():
    b = blocks_by_id[b_id]
    rows = np.query('select * from gsa_tv_media_items where id=\$1', [m_id])
    if not rows:
        print(f'Media {m_id} not found in DB')
        continue
    m = rows[0]
    issue = np.media_issue(m, b, date)
    print(f'Block {b_id} ({b[\"name\"]}, dur={b[\"planned_duration_s\"]}): Media {m_id} (dur={m[\"duration_s\"]}) -> issue: {issue}')
"
