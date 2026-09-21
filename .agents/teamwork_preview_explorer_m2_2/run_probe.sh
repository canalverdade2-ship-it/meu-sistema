#!/bin/bash
python3 << 'EOF'
import os
import subprocess
import json
from pathlib import Path

def probe(p):
    try:
        r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,size:stream=codec_name,width,height,r_frame_rate,sample_rate,channels', '-of', 'json', str(p)], capture_output=True, text=True, timeout=15)
        data = json.loads(r.stdout)
        dur = float(data.get('format', {}).get('duration', 0))
        size = int(data.get('format', {}).get('size', 0))
        video = next((s for s in data.get('streams', []) if s.get('width')), {})
        audio = next((s for s in data.get('streams', []) if s.get('sample_rate')), {})
        return {
            'duration_s': round(dur, 2),
            'duration_min': round(dur / 60, 2),
            'size_mb': round(size / (1024*1024), 2),
            'video_codec': video.get('codec_name'),
            'width': video.get('width'),
            'height': video.get('height'),
            'audio_codec': audio.get('codec_name'),
            'sample_rate': audio.get('sample_rate'),
            'channels': audio.get('channels'),
            'path': str(p)
        }
    except Exception as e:
        return {'error': str(e), 'path': str(p)}

base = Path('/opt/gsa-tv/cache/media/1')
dirs_to_check = ['entertainment', 'filler', 'specials', 'gsa-em-fe-10min', 'identity']
results = []
for d in dirs_to_check:
    dp = base / d
    if not dp.exists(): continue
    for f in dp.rglob('*'):
        if f.is_file() and f.suffix.lower() in ['.mp4', '.mkv', '.mov']:
            info = probe(f)
            results.append(info)

for r in results:
    print(f"{r.get('duration_s', 0):>8.1f}s ({r.get('duration_min', 0):>5.1f}m) | {r.get('width', '-')}x{r.get('height', '-')} | {r.get('video_codec', '-')}/{r.get('audio_codec', '-')} | {r.get('size_mb', 0):>7.1f}MB | {r.get('path')}")

EOF
