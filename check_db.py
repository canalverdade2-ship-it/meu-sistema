import importlib.util
spec = importlib.util.spec_from_file_location('production', '/opt/gsa-tv/bin/night-production.py')
production = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)
rows = production.query("SELECT id, title, drive_path, duration_s FROM gsa_tv_media_items")
for row in rows:
    title = row['title'].lower()
    if 'pipoca' in title or 'cinema' in title or 'desenhos' in title or 'rede' in title:
        print(row)
