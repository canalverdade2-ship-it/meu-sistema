import sqlite3
import os

backups = [f for f in os.listdir('/opt/gsa-tv/backups/ffplayout') if f.endswith('.db')]
for backup in backups:
    try:
        conn = sqlite3.connect(os.path.join('/opt/gsa-tv/backups/ffplayout', backup))
        c = conn.cursor()
        c.execute("SELECT stream_url FROM outputs WHERE id=2")
        print(backup, c.fetchone()[0])
    except Exception as e:
        print(backup, e)
