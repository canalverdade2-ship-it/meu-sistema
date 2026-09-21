import sqlite3

conn = sqlite3.connect('/opt/gsa-tv/config/ffplayout/ffplayout.db')
c = conn.cursor()
options = '{"maxrate":"6000","preset":"ultrafast","quality":"23","rate_control":"cbr"}'
c.execute("UPDATE outputs SET video_options=? WHERE id=2", (options,))
conn.commit()
