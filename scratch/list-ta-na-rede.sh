python3 << 'EOF'
import os
files = [f for f in os.listdir('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/') if 'ta-na-rede' in f]
for f in sorted(files):
    path = os.path.join('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/', f)
    print(f, os.path.getsize(path))
EOF
