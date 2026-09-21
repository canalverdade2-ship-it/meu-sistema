#!/usr/bin/env bash
set -e
python3 - << 'PYEOF'
import os, glob

base = '/opt/gsa-tv/cache/media/1'

# 1. Protected definitions:
# - Identity & Graphics: /opt/gsa-tv/cache/media/1/identity/*
# - Fillers & Continuity: /opt/gsa-tv/cache/media/1/filler/*
# - Fixed station assets: official vinhetas, institutional chamadas, aberturas/encerramentos
# - Active scheduled masters:
#   gsa-manha-news-20260909-30m.mp4
#   gsa-historias-da-biblia-o-filho-prodigo-30m.mp4
# - Playlists 09 and 10 references

protected_exact = {
    # Active scheduled masters
    '/opt/gsa-tv/cache/media/1/program-masters/gsa-manha-news-20260909-30m.mp4',
    '/opt/gsa-tv/cache/media/1/program-masters/gsa-historias-da-biblia-o-filho-prodigo-30m.mp4',
    # Program masters that may be part of catalog or schedule
    '/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-master.mp4',
    '/opt/gsa-tv/cache/media/1/program-masters/gsa-agro-teste-completo-agora.mp4',
    # Institutional chamadas
    '/opt/gsa-tv/cache/media/1/GSA-TV-CHAMADA-OFICIAL-GRADE-AUDIO-CLEAN.mp4',
    '/opt/gsa-tv/cache/media/1/media-7d79a725-8a7e-4605-9ec1-84e446c0c579.mp4',
    '/opt/gsa-tv/cache/media/1/media-gsa-chamada-grade-v2-85s-broadcast-safe-v3-aac-20260907.mp4',
    '/opt/gsa-tv/cache/media/1/media-gsa-chamada-grade-v2-85s-final-20260907.mp4',
    '/opt/gsa-tv/cache/media/1/media-gsa-chamada-grade-v2-85s-broadcast-safe-20260907.mov',
    '/opt/gsa-tv/cache/media/1/media-gsa-chamada-grade-v2-85s-broadcast-safe-v2-20260907.mov',
    # Live clock
    '/opt/gsa-tv/cache/media/1/live_clock.txt',
}

protected_prefixes = [
    '/opt/gsa-tv/cache/media/1/identity',
    '/opt/gsa-tv/cache/media/1/filler',
    '/opt/gsa-tv/cache/media/1/thumbnails',
]

def is_protected(path):
    if path in protected_exact:
        return True
    for prefix in protected_prefixes:
        if path.startswith(prefix):
            return True
    return False

all_files = []
for root, dirs, files in os.walk(base):
    for f in files:
        full = os.path.join(root, f)
        all_files.append(full)

keep = []
delete = []

for p in all_files:
    if is_protected(p):
        keep.append(p)
    else:
        delete.append(p)

keep_bytes = sum(os.path.getsize(f) for f in keep)
del_bytes = sum(os.path.getsize(f) for f in delete)

print(f"Total files in {base}: {len(all_files)}")
print(f"KEEP files: {len(keep)} ({keep_bytes / 1e9:.2f} GB)")
print(f"DELETE candidate files: {len(delete)} ({del_bytes / 1e9:.2f} GB)")

print("\n--- SAMPLE TO KEEP ---")
for f in keep[:15]:
    print("KEEP:", f, f"({os.path.getsize(f)/1e6:.1f} MB)")

print("\n--- DELETE CANDIDATES BREAKDOWN BY SUBDIR ---")
del_by_dir = {}
for f in delete:
    d = os.path.dirname(f)
    # group by top subfolder
    sub = d.replace(base, '').strip('/').split('/')[0] if d != base else 'root'
    del_by_dir[sub] = del_by_dir.get(sub, 0) + os.path.getsize(f)

for sub, size in sorted(del_by_dir.items(), key=lambda x: x[1], reverse=True):
    print(f"  {sub}: {size / 1e9:.2f} GB")

PYEOF
