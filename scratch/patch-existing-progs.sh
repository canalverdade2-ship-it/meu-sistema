sudo python3 -c "
path = '/opt/gsa-tv/bin/night-production.py'
with open(path, 'r', encoding='utf8') as f:
    content = f.read()

target = '''    existing_progs = []
    state_file = STATE / (date + '.json')
    if state_file.exists():
        try:
            prev_data = json.loads(state_file.read_text())
            existing_progs = [p for p in prev_data.get('programs', []) if p.get('state') == 'validated']
        except Exception:
            pass
    bv_media = query(\"select id,drive_path,duration_s from gsa_tv_media_items where id='media-auto-2712832c-219b-4eb3-93ba-17a9311728c3' and state='ready'\")
    if bv_media and not any(p.get('slug') == 'gsa-bem-viver' for p in existing_progs):
        existing_progs.insert(0, {
            'block_id': '532ddef0-d5c1-40f3-bcdc-4423d0c2073b',
            'program': 'GSA Bem Viver',
            'slug': 'gsa-bem-viver',
            'state': 'validated',
            'master': bv_media[0]['drive_path'],
            'duration': float(bv_media[0]['duration_s']),
            'media_id': bv_media[0]['id']
        })'''

replacement = '''    existing_progs = []
    seen_slugs = set()
    state_file = STATE / (date + '.json')
    if state_file.exists():
        try:
            prev_data = json.loads(state_file.read_text())
            for p in prev_data.get('programs', []):
                if p.get('state') == 'validated' and p.get('slug') and p.get('slug') not in seen_slugs:
                    existing_progs.append(p)
                    seen_slugs.add(p.get('slug'))
        except Exception: pass
    db_items = query(\"select id,title,duration_s,drive_path,metadata from gsa_tv_media_items where channel_id='ch-main' and state='ready' and (metadata->>'broadcast_date'=$1 or title like ('%' || $1 || '%'))\", [date])
    for row in db_items:
        meta = row.get('metadata') or {}
        p_slug = meta.get('program_slug') or slug(row.get('title','').split(' — ')[0])
        if p_slug and p_slug not in seen_slugs and row['id'].startswith('media-auto'):
            b_id = meta.get('target_block_id')
            p_name = row.get('title', '').split(' — ')[0]
            existing_progs.append({
                'block_id': b_id,
                'program': p_name,
                'slug': p_slug,
                'state': 'validated',
                'master': row['drive_path'],
                'duration': float(row['duration_s']),
                'media_id': row['id']
            })
            seen_slugs.add(p_slug)'''

if target in content:
    content = content.replace(target, replacement, 1)
    with open(path, 'w', encoding='utf8') as f:
        f.write(content)
    print('night-production.py existing_progs logic successfully updated')
else:
    print('Target not found or already patched')
"
