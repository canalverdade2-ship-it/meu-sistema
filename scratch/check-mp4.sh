python3 << 'EOF'
import os
path = '/opt/gsa-tv/cache/media/1/production/autonomous/2026-09-15/gsa-ta-na-rede-0f2f9292-a83b-462b-aab7-b09cbff27b8a.mp4'
print('EXISTS:', os.path.isfile(path))
if os.path.isfile(path):
    print('SIZE:', os.path.getsize(path))
EOF
