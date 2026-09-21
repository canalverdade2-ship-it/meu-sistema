python3 - << 'EOF'
from pathlib import Path
path = Path('/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py')
content = path.read_text(encoding='utf-8')

old_code = """    bumper_path = f'/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-{slug}.mp4'
    if Path(bumper_path).exists():
        bumper_file = bumper_path
    else:
        bumper_file = '/opt/gsa-tv/cache/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4'"""

new_code = """    bumper_candidates = [
        f'/media/1/identity/vinhetas/vinheta-{slug}.mp4',
        f'/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-{slug}.mp4',
        '/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4',
        '/opt/gsa-tv/cache/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4'
    ]
    bumper_file = next((c for c in bumper_candidates if Path(c).exists()), '/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4')"""

if old_code in content:
    content = content.replace(old_code, new_code)
    path.write_text(content, encoding='utf-8')
    print("PATCHED_SUCCESSFULLY")
else:
    print("OLD_CODE_NOT_FOUND")
EOF
