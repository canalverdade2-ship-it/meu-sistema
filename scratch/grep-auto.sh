python3 << 'EOF'
with open('/opt/gsa-tv/cache/media/1/production/autonomous/tools/autonomous-script.cjs') as f:
    lines = f.readlines()
for i, l in enumerate(lines):
    if any(k in l for k in ['video_assembler', 'synthesize', 'mp4', 'assemble', 'ffmpeg', 'media_items']):
        print(f'{i+1}: {l.strip()[:100]}')
EOF
