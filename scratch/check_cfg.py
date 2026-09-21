import sqlite3
conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
c = conn.cursor()
c.execute("SELECT output_id FROM configurations WHERE id=1")
print('output_id:', c.fetchone()[0])
