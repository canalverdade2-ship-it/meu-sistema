import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/make-presenter-intro.py
import subprocess, os
from pathlib import Path

# 1. Gerar SVG do lower-third da apresentadora
svg_path = '/tmp/tag_chef_lorena.svg'
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" width="820" height="92" viewBox="0 0 820 92">
  <defs>
    <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0F172A" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#1E293B" stop-opacity="0.90"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="820" height="92" rx="14" fill="url(#cardGrad)"/>
  <rect x="0" y="0" width="820" height="92" rx="14" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="28" y1="20" x2="28" y2="72" stroke="#D4AF37" stroke-width="4" stroke-linecap="round"/>
  <text x="44" y="42" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#D4AF37" letter-spacing="1">CHEF LORENA PRADO</text>
  <text x="44" y="70" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#F8FAFC">Apresentadora | GSA Sabor</text>
</svg>'''
Path(svg_path).write_text(svg_content, encoding='utf-8')

# 2. Montar vídeo de 14.5s:
# 8.0s do Flow (escalado para 1080p 30fps) + 6.5s de B-roll da cozinha (1080p 30fps)
flow_norm = '/tmp/flow_lorena_1080p.mp4'
subprocess.run([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-i', '/home/opc/gsa-ai/qc/chef-lorena-flow.mp4',
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4000k', '-maxrate', '4500k', '-bufsize', '8000k',
    '-g', '60', '-pix_fmt', 'yuv420p', '-an',
    flow_norm
], check=True)

broll_kitchen = '/tmp/broll_kitchen_cut.mp4'
subprocess.run([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', '2', '-i', '/opt/gsa-tv/cache/media/1/broll/culinaria/raw/culinaria_04.mp4',
    '-t', '6.5',
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4000k', '-maxrate', '4500k', '-bufsize', '8000k',
    '-g', '60', '-pix_fmt', 'yuv420p', '-an',
    broll_kitchen
], check=True)

# Concat video
concat_txt = '/tmp/lorena_video_concat.txt'
Path(concat_txt).write_text(f"file '{flow_norm}'\\nfile '{broll_kitchen}'\\n")

raw_video = '/tmp/lorena_raw_video.mp4'
subprocess.run([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', concat_txt,
    '-c', 'copy', raw_video
], check=True)

# 3. Aplicar SVG Lower-Third (com fade in aos 1s e fade out aos 7s) e mixar voz + trilha lifestyle
out_intro = '/home/opc/gsa-ai/qc/chef_lorena_intro_final.mp4'
subprocess.run([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-i', raw_video,
    '-i', svg_path,
    '-i', '/home/opc/gsa-ai/qc/chef-lorena-intro-voice.mp3',
    '-i', '/opt/gsa-tv/cache/media/1/identity/audio/lifestyle/gsa_lifestyle_015_bossa_antigua.mp3',
    '-filter_complex',
    '[1:v]format=rgba,fade=t=in:st=1.0:d=0.6:alpha=1,fade=t=out:st=6.5:d=0.6:alpha=1[tag];'
    '[0:v][tag]overlay=40:40[vout];'
    '[2:a]volume=1.1,apad=pad_dur=14.5[vox];'
    '[3:a]volume=0.18,afade=t=in:st=0:d=1.5,afade=t=out:st=13.0:d=1.5[mus];'
    '[vox][mus]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[aout]',
    '-map', '[vout]', '-map', '[aout]',
    '-t', '14.5',
    '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4000k', '-maxrate', '4500k', '-bufsize', '8000k',
    '-g', '60', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
    out_intro
], check=True)

print("SUCCESS: Generated", out_intro, "size:", Path(out_intro).stat().st_size)
EOF
python3 /tmp/make-presenter-intro.py
`;

const res = await runSshScript(remoteScript, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
