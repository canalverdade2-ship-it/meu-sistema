python3 -c "
import sys; sys.path.append('/opt/gsa-tv/bin')
import night_production, json
rows = night_production.query(\"select id, title, state, approval_state, rights_ok, duration_s, drive_path from gsa_tv_media_items where id='media-auto-ac56ae82-85dd-4ea2-98ef-6751bd3a9daf'\")
print('MEDIA ITEM:', json.dumps(rows, indent=2))
"
