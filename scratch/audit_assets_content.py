#!/usr/bin/env python3
import os
import json
import subprocess
import glob

def probe(path):
    if not os.path.exists(path):
        return {"exists": False, "path": path}
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration,size,bit_rate:stream=codec_name,width,height,r_frame_rate,sample_rate,channels",
            "-of", "json", path
        ]
        out = subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT)
        data = json.loads(out)
        streams = data.get("streams", [])
        fmt = data.get("format", {})
        v = next((s for s in streams if "width" in s), {})
        a = next((s for s in streams if "channels" in s), {})
        return {
            "exists": True,
            "path": path,
            "size_mb": round(os.path.getsize(path) / (1024*1024), 2),
            "duration_s": round(float(fmt.get("duration", 0)), 2),
            "video": f"{v.get('codec_name')} {v.get('width')}x{v.get('height')} @ {v.get('r_frame_rate')}fps",
            "audio": f"{a.get('codec_name')} {a.get('sample_rate')}Hz {a.get('channels')}ch",
        }
    except subprocess.CalledProcessError as e:
        return {"exists": True, "path": path, "error": e.output.strip()}
    except Exception as e:
        return {"exists": True, "path": path, "error": str(e)}

print("=== 1. AUDIT VINHETA MASTER OFICIAL 40S ===")
vinheta_candidates = glob.glob("/home/opc/gsa-ai/work/**/vinheta*.mp4", recursive=True) + \
                     glob.glob("/opt/gsa-tv/cache/media/1/identity/**/*.mp4", recursive=True) + \
                     glob.glob("/home/opc/gsa-ai/work/vinheta-flow-40s/*.mp4")
for p in sorted(set(vinheta_candidates)):
    print(json.dumps(probe(p), indent=2))

print("\n=== 2. AUDIT FALLBACK & CONTINUITY ===")
fallback_candidates = [
    "/opt/gsa-tv/fallback/gsa-tv-fallback-720p30.mp4",
    "/opt/gsa-tv/cache/media/1/identity/gsa-tv-fallback-720p30.mp4",
    "/opt/gsa-tv/cache/media/1/identity/gsa-tv-continuity-720p30.mp4"
]
for p in fallback_candidates:
    print(json.dumps(probe(p), indent=2))

print("\n=== 3. AUDIT FILLER ===")
filler_candidates = glob.glob("/opt/gsa-tv/cache/media/1/filler/*") + glob.glob("/media/1/filler/*")
for p in sorted(set(filler_candidates)):
    print(json.dumps(probe(p), indent=2))

print("\n=== 4. AUDIT GSA MANHÃ NEWS ===")
news_candidates = glob.glob("/home/opc/gsa-ai/work/**/gsa*news*.mp4", recursive=True) + \
                  glob.glob("/opt/gsa-tv/cache/media/1/**/gsa*news*.mp4", recursive=True) + \
                  glob.glob("/home/opc/gsa-ai/work/daily-automation*/*.mp4")
for p in sorted(set(news_candidates)):
    print(json.dumps(probe(p), indent=2))

print("\n=== 5. AUDIT GSA HISTÓRIAS DA BÍBLIA & SALOMÃO ===")
bible_candidates = glob.glob("/home/opc/gsa-ai/work/**/*biblia*.mp4", recursive=True) + \
                   glob.glob("/home/opc/gsa-ai/work/**/*salomao*.mp4", recursive=True) + \
                   glob.glob("/home/opc/gsa-ai/work/**/*prodigo*.mp4", recursive=True) + \
                   glob.glob("/opt/gsa-tv/cache/media/1/**/*filho-prodigo*.mp4", recursive=True)
for p in sorted(set(bible_candidates)):
    print(json.dumps(probe(p), indent=2))

print("\n=== 6. AUDIT SESSÃO PIPOCA / MOVIES ===")
movie_candidates = glob.glob("/opt/gsa-tv/cache/media/1/movies/**/*", recursive=True) + \
                   glob.glob("/opt/gsa-tv/cache/media/1/**/pipoca*", recursive=True) + \
                   glob.glob("/home/opc/gsa-ai/work/**/movie*", recursive=True)
for p in sorted(set(movie_candidates)):
    if os.path.isfile(p):
        print(json.dumps(probe(p), indent=2))
if not movie_candidates:
    print("Nenhum arquivo de filme encontrado em /opt/gsa-tv/cache/media/1/ ou em work/")
