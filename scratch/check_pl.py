import sqlite3
import os

conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
conn.row_factory = sqlite3.Row
c = conn.cursor()
c.execute("SELECT * FROM playlist WHERE date = '2026-09-15' ORDER BY begin ASC")
for row in c.fetchall()[:20]:
    print(f"{row['begin']} - {row['duration']} - {row['source']}")
