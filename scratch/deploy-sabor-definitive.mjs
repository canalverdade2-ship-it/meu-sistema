import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /home/opc/gsa-ai/bin/assemble-gsa-sabor-definitive-60m.py
#!/usr/bin/env python3
import os, sys, subprocess, time, json
from pathlib import Path

MEDIA_ROOT = Path('/opt/gsa-tv/cache/media/1')
BROLL_DIR = MEDIA_ROOT / 'broll/culinaria/raw'
AUDIO_DIR = MEDIA_ROOT / 'identity/audio/lifestyle'
OUTPUT_DIR = MEDIA_ROOT / 'program-masters'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MASTER_OUTPUT = OUTPUT_DIR / 'gsa-sabor-master-1080p.mp4'

OPENING_VINHETA = Path('/home/opc/gsa-ai/data/official/program-identities/2026-09-08-v1/gsa-sabor-opening.mp4')
CLOSING_VINHETA = Path('/home/opc/gsa-ai/data/official/program-identities/2026-09-08-v1/gsa-sabor-closing.mp4')
CHAMADA_GRADE = MEDIA_ROOT / 'media-gsa-chamada-grade-v2-85s-broadcast-safe-v3-aac-20260907.mp4'
PRESENTER_INTRO = Path('/home/opc/gsa-ai/qc/chef_lorena_intro_final.mp4')

RECIPES = [
    {
        "num": 1,
        "title": "GSA SABOR &#x25C6; ENTRADA",
        "subtitle": "Bruschetta R&#250;stica de Queijo Canastra e Tomate Confit",
        "audio": "/tmp/sabor_bloco1_voz.mp3",
        "music": AUDIO_DIR / "gsa_lifestyle_015_bossa_antigua.mp3",
        "intro_dur": 80.5,
        "showcase_dur": 710.0,
        "brolls": ["culinaria_04.mp4", "culinaria_01.mp4", "culinaria_05.mp4"]
    },
    {
        "num": 2,
        "title": "GSA SABOR &#x25C6; PRATO REGIONAL",
        "subtitle": "Risoto Mineiro de Frango Caipira e A&#231;afr&#227;o da Terra",
        "audio": "/tmp/sabor_bloco2_voz.mp3",
        "music": AUDIO_DIR / "gsa_lifestyle_012_jazz_brunch_.mp3",
        "intro_dur": 95.0,
        "showcase_dur": 720.0,
        "brolls": ["culinaria_08.mp4", "culinaria_03.mp4", "culinaria_04.mp4"]
    },
    {
        "num": 3,
        "title": "GSA SABOR &#x25C6; ALTA GASTRONOMIA",
        "subtitle": "Salm&#227;o Grelhado em Crosta de Ervas e Lim&#227;o Siciliano",
        "audio": "/tmp/sabor_bloco3_voz.mp3",
        "music": AUDIO_DIR / "gsa_lifestyle_014_apero_hour.mp3",
        "intro_dur": 90.0,
        "showcase_dur": 725.0,
        "brolls": ["culinaria_05.mp4", "culinaria_04.mp4", "culinaria_01.mp4"]
    },
    {
        "num": 4,
        "title": "GSA SABOR &#x25C6; SOBREMESA",
        "subtitle": "Cheesecake New York com Calda de Frutas Vermelhas",
        "audio": "/tmp/sabor_bloco4_voz.mp3",
        "music": AUDIO_DIR / "gsa_lifestyle_041_bossabossa.mp3",
        "intro_dur": 90.0,
        "showcase_dur": 800.0,
        "brolls": ["culinaria_06.mp4", "culinaria_07.mp4"]
    }
]

def probe_duration(file_path):
    cmd = ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', str(file_path)]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, text=True, check=True)
    return float(res.stdout.strip())

block_segments = []
log_file = Path('/tmp/gsa_sabor_build.log')
log_file.write_text("INICIANDO PRODUÇÃO DEFINITIVA GSA SABOR 60M\\n", encoding='utf-8')

for r in RECIPES:
    num = r['num']
    intro_dur = r['intro_dur']
    showcase_dur = r['showcase_dur']
    
    msg = f"=== PROCESSANDO BLOCO {num}/4: {r['subtitle']} ==="
    print(msg)
    with open(log_file, 'a') as lf:
        lf.write(msg + "\\n")
    
    job_dir = Path(f"/tmp/sabor_def_bloco_{num}")
    job_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. SVG Tag com entidades numéricas para garantia de 100% acentuação
    svg_path = job_dir / f"tag_{num}.svg"
    svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" width="820" height="92" viewBox="0 0 820 92">
  <defs>
    <linearGradient id="cardGrad_{num}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#0F172A" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#1E293B" stop-opacity="0.90"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="820" height="92" rx="14" fill="url(#cardGrad_{num})"/>
  <rect x="0" y="0" width="820" height="92" rx="14" fill="none" stroke="#D4AF37" stroke-width="1.5" stroke-opacity="0.5"/>
  <line x1="28" y1="20" x2="28" y2="72" stroke="#D4AF37" stroke-width="4" stroke-linecap="round"/>
  <text x="44" y="42" font-family="DejaVu Sans, Arial, sans-serif" font-size="22" font-weight="bold" fill="#D4AF37" letter-spacing="1">{r['title']}</text>
  <text x="44" y="70" font-family="DejaVu Sans, Arial, sans-serif" font-size="16" fill="#F8FAFC">{r['subtitle']}</text>
</svg>'''
    svg_path.write_text(svg_content, encoding='utf-8')
    
    # 2. Concat list para B-rolls
    intro_concat_txt = job_dir / "intro_broll_concat.txt"
    lines = []
    recipe_brolls = [BROLL_DIR / name for name in r['brolls']]
    for _ in range(30):
        for bf in recipe_brolls:
            lines.append(f"file '{bf.resolve()}'")
    intro_concat_txt.write_text("\\n".join(lines) + "\\n", encoding='utf-8')
    
    intro_mp4 = job_dir / f"intro_{num}.mp4"
    print(f"  -> Renderizando Intro com Tag persistente ({intro_dur}s)...")
    cmd_intro = [
        'ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', str(intro_concat_txt),
        '-i', str(svg_path),
        '-i', r['audio'],
        '-stream_loop', '-1', '-i', str(r['music']),
        '-filter_complex',
        '[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[base];'
        '[1:v]scale=820:92[tag];'
        '[base][tag]overlay=40:40[vout];'
        '[2:a]volume=1.0,apad=pad_dur=' + str(intro_dur) + '[vox];'
        '[3:a]volume=0.18,afade=t=in:st=0:d=1.5,afade=t=out:st=' + str(intro_dur - 2.0) + ':d=2.0[mus];'
        '[vox][mus]amix=inputs=2:duration=first:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[aout]',
        '-map', '[vout]', '-map', '[aout]',
        '-t', str(intro_dur),
        '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4000k', '-maxrate', '4500k', '-bufsize', '8000k',
        '-g', '60', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
        str(intro_mp4)
    ]
    subprocess.run(cmd_intro, check=True)
    
    # 3. Showcase com Tag mantida continuamente e trilha real contínua (-18dB)
    showcase_mp4 = job_dir / f"showcase_{num}.mp4"
    print(f"  -> Renderizando Showcase com Tag persistente e Bossa/Jazz ({showcase_dur}s)...")
    cmd_showcase = [
        'ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', str(intro_concat_txt),
        '-i', str(svg_path),
        '-stream_loop', '-1', '-i', str(r['music']),
        '-filter_complex',
        '[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30[base];'
        '[1:v]scale=820:92[tag];'
        '[base][tag]overlay=40:40[vout];'
        '[2:a]volume=0.22,afade=t=in:st=0:d=2.0,afade=t=out:st=' + str(showcase_dur - 2.0) + ':d=2.0,loudnorm=I=-18:TP=-1.5:LRA=7,aresample=48000[aout]',
        '-map', '[vout]', '-map', '[aout]',
        '-t', str(showcase_dur),
        '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4000k', '-maxrate', '4500k', '-bufsize', '8000k',
        '-g', '60', '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
        str(showcase_mp4)
    ]
    subprocess.run(cmd_showcase, check=True)
    
    # 4. Unificar o Bloco
    bloco_concat_txt = job_dir / f"bloco_{num}_concat.txt"
    bloco_parts = []
    
    if num == 1:
        # Vinheta Abertura (10s) -> Apresentadora Flow (14.5s) -> Intro Receita (80.5s) -> Showcase (710s) -> Chamada Grade (85s)
        norm_open = job_dir / "open_norm.mp4"
        subprocess.run([
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-i', str(OPENING_VINHETA),
            '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30',
            '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4000k', '-maxrate', '4500k', '-bufsize', '8000k',
            '-g', '60', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
            str(norm_open)
        ], check=True)
        bloco_parts.append(norm_open)
        bloco_parts.append(PRESENTER_INTRO)
        bloco_parts.append(intro_mp4)
        bloco_parts.append(showcase_mp4)
        bloco_parts.append(CHAMADA_GRADE)
    elif num in [2, 3]:
        bloco_parts.append(intro_mp4)
        bloco_parts.append(showcase_mp4)
        bloco_parts.append(CHAMADA_GRADE)
    else:
        norm_close = job_dir / "close_norm.mp4"
        subprocess.run([
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-i', str(CLOSING_VINHETA),
            '-vf', 'scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30',
            '-c:v', 'libx264', '-preset', 'veryfast', '-b:v', '4000k', '-maxrate', '4500k', '-bufsize', '8000k',
            '-g', '60', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2',
            str(norm_close)
        ], check=True)
        bloco_parts.append(intro_mp4)
        bloco_parts.append(showcase_mp4)
        bloco_parts.append(norm_close)
        
    lines = [f"file '{p.resolve()}'" for p in bloco_parts]
    bloco_concat_txt.write_text("\\n".join(lines) + "\\n", encoding='utf-8')
    
    bloco_final_mp4 = OUTPUT_DIR / f"sabor_bloco_{num}_15m.mp4"
    print(f"  -> Concat do Bloco {num} final (15 min)...")
    subprocess.run([
        'ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
        '-f', 'concat', '-safe', '0', '-i', str(bloco_concat_txt),
        '-c', 'copy',
        '-movflags', '+faststart',
        str(bloco_final_mp4)
    ], check=True)
    dur = probe_duration(bloco_final_mp4)
    print(f"  -> Bloco {num} concluido: {dur:.2f}s ({dur/60:.2f} min)")
    block_segments.append(bloco_final_mp4)

# 5. Master Final 60m
print("=== CONCATENANDO OS 4 BLOCOS NO MASTER DEFINITIVO DE 60 MINUTOS ===")
master_concat_txt = OUTPUT_DIR / "sabor_master_60m_concat.txt"
lines = [f"file '{b.resolve()}'" for b in block_segments]
master_concat_txt.write_text("\\n".join(lines) + "\\n", encoding='utf-8')

tmp_master = MASTER_OUTPUT.with_suffix('.tmp.mp4')
subprocess.run([
    'ffmpeg', '-nostdin', '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'concat', '-safe', '0', '-i', str(master_concat_txt),
    '-c', 'copy',
    '-movflags', '+faststart',
    str(tmp_master)
], check=True)
os.replace(tmp_master, MASTER_OUTPUT)

total_dur = probe_duration(MASTER_OUTPUT)
size_mb = MASTER_OUTPUT.stat().st_size / (1024*1024)
print(f"SUCESSO TOTAL! Master 60 Minutos pronto: {total_dur:.2f}s, {size_mb:.2f} MB")
EOF
chmod +x /home/opc/gsa-ai/bin/assemble-gsa-sabor-definitive-60m.py
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
