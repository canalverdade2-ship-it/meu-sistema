import sqlite3
conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
c = conn.cursor()
c.execute("PRAGMA table_info(configurations);")
for row in c.fetchall():
    print(row)
