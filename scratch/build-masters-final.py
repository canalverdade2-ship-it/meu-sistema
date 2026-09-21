#!/usr/bin/env python3
import os
import sys
import shutil
import json
import hashlib
import subprocess
from datetime import datetime

BASE = "/home/opc/gsa-ai/work/identity-flow-20260907"
MASTERS_V1 = os.path.join(BASE, "masters-v1")
REPLACEMENTS = os.path.join(BASE, "replacements")
MASTERS_FINAL = os.path.join(BASE, "masters-final")

os.makedirs(MASTERS_FINAL, exist_ok=True)

# 25 programs definition
PROGRAMS = [
    {"slug": "gsa-agro", "name": "GSA Agro"},
    {"slug": "gsa-bem-viver", "name": "GSA Bem Viver"},
    {"slug": "gsa-business", "name": "GSA Business"},
    {"slug": "gsa-cidadania", "name": "GSA Cidadania"},
    {"slug": "gsa-cinema", "name": "GSA Cinema"},
    {"slug": "gsa-desenhos", "name": "GSA Desenhos"},
    {"slug": "gsa-destinos", "name": "GSA Destinos"},
    {"slug": "gsa-em-fe", "name": "GSA Em Fé"},
    {"slug": "gsa-esportes", "name": "GSA Esportes"},
    {"slug": "gsa-historias-da-biblia", "name": "GSA Histórias da Bíblia"},
    {"slug": "gsa-hora-da-palavra", "name": "GSA Hora da Palavra"},
    {"slug": "gsa-manha-news", "name": "GSA Manhã News"},
    {"slug": "gsa-meio-dia-news", "name": "GSA Meio Dia News"},
    {"slug": "gsa-mercado", "name": "GSA Mercado"},
    {"slug": "gsa-misterios", "name": "GSA Mistérios"},
    {"slug": "gsa-motor", "name": "GSA Motor"},
    {"slug": "gsa-mundo", "name": "GSA Mundo"},
    {"slug": "gsa-music", "name": "GSA Music"},
    {"slug": "gsa-news-noite", "name": "GSA News Noite"},
    {"slug": "gsa-planeta-terra", "name": "GSA Planeta Terra"},
    {"slug": "gsa-sabor", "name": "GSA Sabor"},
    {"slug": "gsa-sessao-pipoca", "name": "GSA Sessão Pipoca"},
    {"slug": "gsa-ta-na-rede", "name": "GSA Tá na Rede"},
    {"slug": "gsa-tech", "name": "GSA Tech"},
    {"slug": "gsa-tempo", "name": "GSA Tempo"},
]

# The 9 approved replacements mapping:
# (slug, piece_type) -> replacement_filename
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

print(f"=== Starting Masters Final Package Assembly ===")
print(f"Total programs: {len(PROGRAMS)}")
print(f"Expected pieces: {len(PROGRAMS) * 2}")

items_to_process = []
for prog in sorted(PROGRAMS, key=lambda p: p["slug"]):
    slug = prog["slug"]
    name = prog["name"]
    for piece_type in ["opening", "closing"]:
        target_filename = f"{slug}-{piece_type}.mp4"
        target_path = os.path.join(MASTERS_FINAL, target_filename)
        
        if (slug, piece_type) in REPLACED:
            source_type = "regenerated"
            source_file = os.path.join(REPLACEMENTS, REPLACED[(slug, piece_type)])
            approved_at = "2026-09-08T03:39:58Z"
        else:
            source_type = "original"
            source_file = os.path.join(MASTERS_V1, target_filename)
            approved_at = "2026-09-07T15:28:00Z"
            
        items_to_process.append({
            "program": name,
            "slug": slug,
            "piece_type": piece_type,
            "source_type": source_type,
            "source_file": source_file,
            "target_filename": target_filename,
            "target_path": target_path,
            "approved_at": approved_at
        })

print(f"Total items planned: {len(items_to_process)}")
orig_count = sum(1 for i in items_to_process if i["source_type"] == "original")
regen_count = sum(1 for i in items_to_process if i["source_type"] == "regenerated")
print(f"Originals to copy: {orig_count}")
print(f"Regenerated to scale: {regen_count}")

# Process originals first
for i, item in enumerate(items_to_process, 1):
    if item["source_type"] == "original":
        if not os.path.exists(item["source_file"]):
            raise RuntimeError(f"Source file not found: {item['source_file']}")
        shutil.copy2(item["source_file"], item["target_path"])
        print(f"[{i:02d}/50] COPIED ORIGINAL: {item['target_filename']}")

# Process regenerated next (scale 720p 24fps -> 1080p 30fps lanczos, AAC 48k stereo)
for i, item in enumerate(items_to_process, 1):
    if item["source_type"] == "regenerated":
        if not os.path.exists(item["source_file"]):
            raise RuntimeError(f"Source file not found: {item['source_file']}")
        print(f"[{i:02d}/50] TRANSLATING REGENERATED: {item['source_file']} -> {item['target_filename']}")
        cmd = [
            "docker", "run", "--rm", "--user", "0:0",
            "-v", "/home:/home", "-v", "/opt:/opt",
            "gsa-tv/control-plane:1.8.7",
            "ffmpeg", "-y", "-i", item["source_file"],
            "-vf", "scale=1920:1080:flags=lanczos,fps=30",
            "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
            "-c:a", "aac", "-b:a", "384k", "-ar", "48000", "-ac", "2",
            "-movflags", "+faststart",
            item["target_path"]
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if res.returncode != 0:
            print(f"ERROR scaling {item['target_filename']}:\n{res.stderr[-1000:]}")
            sys.exit(1)
        print(f"[{i:02d}/50] COMPLETED SCALING: {item['target_filename']}")

# Validate all 50 files with ffprobe
print("\n=== Running FFprobe Technical Validation on all 50 masters ===")
validation_records = []
manifest_list = []

for i, item in enumerate(items_to_process, 1):
    target_path = item["target_path"]
    if not os.path.exists(target_path):
        raise RuntimeError(f"Missing master file: {target_path}")
    
    cmd = [
        "docker", "run", "--rm", "--user", "0:0",
        "-v", "/home:/home", "-v", "/opt:/opt",
        "gsa-tv/control-plane:1.8.7",
        "ffprobe", "-v", "error",
        "-show_entries", "stream=codec_type,codec_name,width,height,r_frame_rate,sample_rate,channels",
        "-of", "json", target_path
    ]
    res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"FFprobe failed on {target_path}: {res.stderr}")
    
    probe_data = json.loads(res.stdout)
    streams = probe_data.get("streams", [])
    video = [s for s in streams if s.get("codec_type") == "video"]
    audio = [s for s in streams if s.get("codec_type") == "audio"]
    
    if not video:
        raise RuntimeError(f"No video stream in {target_path}")
    if not audio:
        raise RuntimeError(f"No audio stream in {target_path}")
    
    v = video[0]
    a = audio[0]
    
    width = v.get("width")
    height = v.get("height")
    r_frame_rate = v.get("r_frame_rate")
    v_codec = v.get("codec_name")
    
    a_codec = a.get("codec_name")
    sample_rate = int(a.get("sample_rate", 0))
    channels = int(a.get("channels", 0))
    
    # Validation checks
    valid = (
        width == 1920 and
        height == 1080 and
        r_frame_rate in ["30/1", "30"] and
        v_codec == "h264" and
        a_codec == "aac" and
        sample_rate == 48000 and
        channels == 2
    )
    
    if not valid:
        raise RuntimeError(
            f"Validation FAILED for {item['target_filename']}: "
            f"W={width}, H={height}, FPS={r_frame_rate}, V={v_codec}, "
            f"A={a_codec}, SR={sample_rate}, CH={channels}"
        )
    
    # Calculate sha256
    hasher = hashlib.sha256()
    with open(target_path, "rb") as f:
        while chunk := f.read(65536):
            hasher.update(chunk)
    sha256 = hasher.hexdigest()
    file_size = os.path.getsize(target_path)
    
    record = {
        "program": item["program"],
        "slug": item["slug"],
        "piece_type": item["piece_type"],
        "source": item["source_type"],
        "filename": item["target_filename"],
        "size_bytes": file_size,
        "width": width,
        "height": height,
        "fps": r_frame_rate,
        "sample_rate": sample_rate,
        "channels": channels,
        "sha256": sha256,
        "approved_at": item["approved_at"]
    }
    validation_records.append(record)
    
    # Item strictly for manifest.json
    manifest_item = {
        "program": item["program"],
        "piece_type": item["piece_type"],
        "source": item["source_type"],
        "sha256": sha256,
        "approved_at": item["approved_at"]
    }
    manifest_list.append(manifest_item)
    
    print(f"[{i:02d}/50] PASS: {item['target_filename']} | {width}x{height} @ {r_frame_rate} | AAC {sample_rate}Hz {channels}ch | SHA256: {sha256[:12]}...")

# Write manifest.json
manifest_path = os.path.join(MASTERS_FINAL, "manifest.json")
with open(manifest_path, "w", encoding="utf-8") as f:
    json.dump(manifest_list, f, indent=2, ensure_ascii=False)
print(f"\nManifest successfully written to: {manifest_path} ({len(manifest_list)} items)")

# Save full validation report
report_path = os.path.join(MASTERS_FINAL, "validation-full.json")
with open(report_path, "w", encoding="utf-8") as f:
    json.dump(validation_records, f, indent=2, ensure_ascii=False)
print(f"Detailed validation saved to: {report_path}")

print("\n=== All 50 masters successfully created, transcoded, and validated! ===")
