python3 -c "
import json
import psycopg2
from psycopg2.extras import RealDictCursor

conn = psycopg2.connect('postgresql://postgres:postgres@localhost:5432/postgres')
cur = conn.cursor(cursor_factory=RealDictCursor)
cur.execute('''
    select b.id, b.name, b.media_item_id, m.id as m_id, m.state, m.approval_state, m.rights_ok, m.drive_path
    from gsa_tv_program_blocks b
    left join gsa_tv_media_items m on b.media_item_id = m.id
    where b.id = '0f2f9292-a83b-462b-aab7-b09cbff27b8a'
''')
print('BLOCK AND MEDIA:', json.dumps(cur.fetchall(), default=str, indent=2))

cur.execute('''
    select id, title, state, approval_state, rights_ok, drive_path, metadata
    from gsa_tv_media_items
    where title like '%Tá na Rede%' or id like '%ta-na-rede%'
''')
print('ALL TA NA REDE MEDIA:', json.dumps(cur.fetchall(), default=str, indent=2))
"
