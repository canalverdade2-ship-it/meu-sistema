import sqlite3
import os

conn = sqlite3.connect('/opt/gsa-tv/backups/ffplayout/ffplayout-20260914T062218Z.db')
c = conn.cursor()
c.execute("SELECT video_options FROM outputs WHERE id=2")
print('Sept 14:', c.fetchone()[0])

conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
c = conn.cursor()
c.execute("SELECT video_options FROM outputs WHERE id=2")
print('Current:', c.fetchone()[0])
