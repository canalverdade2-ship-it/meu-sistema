import sqlite3
conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
c = conn.cursor()
c.execute("UPDATE configurations SET logging_ffmpeg_level='DEBUG' WHERE id=1")
conn.commit()
