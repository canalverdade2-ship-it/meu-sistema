import sqlite3
import json
conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
c = conn.cursor()
c.execute("SELECT name FROM sqlite_master WHERE type='table';")
print("Tables:", c.fetchall())

try:
    c.execute("SELECT * FROM config;")
    print("Config:", c.fetchall())
except Exception as e:
    print(e)
