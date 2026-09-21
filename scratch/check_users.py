import sqlite3
conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
c = conn.cursor()
c.execute("SELECT id, username, password FROM user;")
print(c.fetchall())
