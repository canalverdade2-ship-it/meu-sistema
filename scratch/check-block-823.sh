python3 -c "
import sys
sys.path.insert(0, '/opt/gsa-tv/bin')
import psycopg2
from config import config

conn = psycopg2.connect(
    dbname=config.DB_NAME, user=config.DB_USER,
    password=config.DB_PASSWORD, host=config.DB_HOST, port=config.DB_PORT
)
cur = conn.cursor()
cur.execute('SELECT b.id, b.title, b.start_time, b.end_time, b.duration, b.media_item_id, m.duration_s, m.storage_path FROM gsa_tv_schedule_blocks b LEFT JOIN gsa_tv_media_items m ON b.media_item_id = m.id WHERE b.id = %s', ('823999aa-010f-4d8e-aaba-07db6bf53b91',))
row = cur.fetchone()
print('Block:', row)
"
