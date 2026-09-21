import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location('production', '/opt/gsa-tv/bin/night-production.py')
production = importlib.util.module_from_spec(spec)
spec.loader.exec_module(production)
production.query("UPDATE gsa_tv_media_items SET drive_path = '/media/1/entertainment/pipoca/sessao-pipoca-romance-misterio-1080p.mp4', duration_s = 4646 WHERE id IN ('media-ent-pipoca-quinta', 'media-ent-pipoca-sexta', 'media-ent-pipoca-sabado', 'media-ent-pipoca-domingo')")
production.query("UPDATE gsa_tv_media_items SET drive_path = '/media/1/entertainment/desenhos/popeye-ali-baba-1937-1080p.mp4', duration_s = 1508 WHERE id IN ('media-ent-desenhos-quinta', 'media-ent-desenhos-sexta', 'media-ent-desenhos-sabado', 'media-ent-desenhos-domingo')")
production.query("UPDATE gsa_tv_media_items SET drive_path = '/media/1/entertainment/cinema/his-girl-friday-1940-1080p.mp4', duration_s = 5554 WHERE id IN ('media-ent-cinema-quinta', 'media-ent-cinema-sexta', 'media-ent-cinema-sabado', 'media-ent-cinema-domingo')")
print('Updated placeholders.')
