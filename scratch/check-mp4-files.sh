python3 << 'EOF'
import os
for f in sorted(os.listdir('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/')):
    if f.endswith('.mp4') or '0f2f' in f or 'rede' in f:
        path = os.path.join('/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/', f)
        print(f, os.path.getsize(path))
EOF
