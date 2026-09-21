import sys
sys.path.insert(0, '/opt/gsa-tv/bin')
import night_production

try:
    night_production.published('2026-09-16')
    print("SCHEDULE FOR 2026-09-16 IS PUBLISHED!")
except Exception as e:
    print(f"Error checking schedule: {e}")
