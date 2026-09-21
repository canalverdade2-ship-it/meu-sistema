import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/test-recipe-tag.py
import subprocess
from pathlib import Path

svg_path = '/tmp/test_tag_salmao.svg'
# Numeric character entities: &#227; = ã, &#231; = ç, &#250; = ú, &#233; = é
svg_content = '''<svg xmlns="http://www.w3.org/2000/svg" width="820" height="92" viewBox="0 0 820 92">
  <defs>
    <linearGradient id="cardGrad3" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0F172A" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#1E293B" stop-opacity="0.90"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="820" height="92" rx="14" fill="url(#cardGrad3)"/>
  <rect x="0" y="0" width="820" height="92" rx="14" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="28" y1="20" x2="28" y2="72" stroke="#D4AF37" stroke-width="4" stroke-linecap="round"/>
  <text x="44" y="42" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#D4AF37" letter-spacing="1">GSA SABOR &#x25C6; ALTA GASTRONOMIA</text>
  <text x="44" y="70" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#F8FAFC">Salm&#227;o Grelhado em Crosta de Ervas e Lim&#227;o Siciliano</text>
</svg>'''
Path(svg_path).write_text(svg_content, encoding='utf-8')

# Overlay on culinaria_05.mp4
out_frame = '/tmp/test_salmao_tag_frame.jpg'
subprocess.run([
    'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
    '-ss', '10', '-i', '/opt/gsa-tv/cache/media/1/broll/culinaria/raw/culinaria_05.mp4',
    '-i', svg_path,
    '-filter_complex',
    '[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080[base];'
    '[1:v]scale=820:92[tag];'
    '[base][tag]overlay=40:40[out]',
    '-map', '[out]',
    '-frames:v', '1',
    out_frame
], check=True)
print("Tag frame generated:", out_frame)
EOF
python3 /tmp/test-recipe-tag.py
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
