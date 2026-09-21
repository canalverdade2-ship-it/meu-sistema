sudo python3 -c "
path = '/opt/gsa-tv/bin/night-production.py'
with open(path, 'r', encoding='utf8') as f:
    content = f.read()

target1 = '''    if args.check or args.require_ready:'''
replacement1 = '''    if args.check or args.require_ready or args.reconcile:'''

target2 = '''    state={'date':date,'schedule_version_id':version,'state':'running','programs':[],'started_at':now().isoformat()}'''
replacement2 = '''    existing_progs = []
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
        })
    state={'date':date,'schedule_version_id':version,'state':'running','programs':existing_progs,'started_at':now().isoformat()}'''

if target1 in content and target2 in content:
    content = content.replace(target1, replacement1, 1)
    content = content.replace(target2, replacement2, 1)
    with open(path, 'w', encoding='utf8') as f:
        f.write(content)
    print('night-production.py successfully patched')
else:
    print('Targets not found or already patched')
"
