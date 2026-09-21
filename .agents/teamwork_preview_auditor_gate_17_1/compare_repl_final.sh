python3 - << 'EOF'
import json
import subprocess
from pathlib import Path

BASE = Path("/home/opc/gsa-ai/work/identity-flow-20260907")
REPLACEMENTS = BASE / "replacements"
MASTERS_FINAL = BASE / "masters-final"

REPLACED = {
    ("gsa-esportes", "closing"): "esportes-closing-repl.mp4",
    ("gsa-hora-da-palavra", "opening"): "hora-opening-repl-2.mp4",
    ("gsa-business", "opening"): "business-opening-repl.mp4",
    ("gsa-news-noite", "opening"): "news-noite-opening-repl.mp4",
    ("gsa-motor", "opening"): "motor-opening-repl.mp4",
    ("gsa-agro", "opening"): "agro-opening-repl.mp4",
    ("gsa-em-fe", "closing"): "em-fe-closing-repl.mp4",
    ("gsa-bem-viver", "closing"): "bem-viver-closing-repl.mp4",
    ("gsa-sabor", "opening"): "sabor-opening-repl.mp4",
}

def probe(p):
    cmd = [
        "docker", "run", "--rm", "--user", "1000:1000",
        "-v", "/home:/home", "-v", "/opt:/opt",
        "gsa-tv/control-plane:1.8.7",
        "ffprobe", "-v", "error",
        "-show_entries", "format=duration:stream=width,height,r_frame_rate,codec_name",
        "-of", "json", str(p)
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    return json.loads(res.stdout)

print(f"{'SLUG-PIECE':<35} | {'REPL (W,H,FPS,DUR)':<30} | {'FINAL (W,H,FPS,DUR)':<30}")
print("-" * 100)

for (slug, piece_type), repl_name in REPLACED.items():
    repl_path = REPLACEMENTS / repl_name
    final_path = MASTERS_FINAL / f"{slug}-{piece_type}.mp4"
    
    repl_info = probe(repl_path)
    final_info = probe(final_path)
    
    repl_v = [s for s in repl_info['streams'] if s.get('codec_name') == 'h264'][0]
    final_v = [s for s in final_info['streams'] if s.get('codec_name') == 'h264'][0]
    
    repl_dur = float(repl_info['format']['duration'])
    final_dur = float(final_info['format']['duration'])
    
    repl_desc = f"{repl_v['width']}x{repl_v['height']} @ {repl_v['r_frame_rate']} ({repl_dur:.2f}s)"
    final_desc = f"{final_v['width']}x{final_v['height']} @ {final_v['r_frame_rate']} ({final_dur:.2f}s)"
    
    key = f"{slug}-{piece_type}"
    print(f"{key:<35} | {repl_desc:<30} | {final_desc:<30}")
EOF
