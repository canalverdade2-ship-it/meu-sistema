import sqlite3
import json
conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
c = conn.cursor()
c.execute("SELECT * FROM configurations;")
print("Config:", c.fetchall())
c.execute("SELECT * FROM outputs;")
print("Outputs:", c.fetchall())
