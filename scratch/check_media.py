import pg8000
conn = pg8000.connect(user='postgres', password='password', host='127.0.0.1', port=5432, database='gsatv')
c = conn.cursor()
c.execute("SELECT id FROM gsa_tv_media_items WHERE id='media-auto-27566c4e-2955-4d55-a972-c4b39c971ed6'")
print(c.fetchall())
