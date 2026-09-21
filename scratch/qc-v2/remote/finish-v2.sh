#!/usr/bin/env bash
set -euo pipefail
BASE=/home/opc/gsa-ai/work/chamada-grade-v2
IMG=gsa-tv/render-engine:0.2.2
FFIMG=gsa-tv/control-plane:1.8.2
UIDGID="$(id -u):$(id -g)"
CH="$BASE/qc/chunks-v2"
LOG="$BASE/qc/finish-v2.log"
mkdir -p "$CH" "$BASE/output" "$BASE/qc"
exec > >(tee -a "$LOG") 2>&1
echo "=== GSA V2 FINAL PIPELINE $(date -u +%FT%TZ) ==="

render_chunk(){
  local name="$1" range="$2"
  local out="$CH/$name.mp4"
  [ -s "$out" ] && { echo "SKIP $name already exists"; return 0; }
  for attempt in 1 2 3; do
    echo "RENDER $name range=$range attempt=$attempt"
    rm -f "$BASE/qc/v2-motion-test.mp4"
    if docker run --rm -e GSA_JOB_DIR="$BASE" -e GSA_TEST_RANGE="$range" \
      -v /home:/home "$IMG"; then
      mv "$BASE/qc/v2-motion-test.mp4" "$out"
      echo "DONE $name $(stat -c%s "$out") bytes"
      return 0
    fi
    echo "RETRY $name"
  done
  echo "FAILED $name" >&2; return 1
}
render_chunk vida-38-42 1140:1259
render_chunk vida-42-46 1260:1379
render_chunk vida-46-50 1380:1499
render_chunk vida-50-53 1500:1589
render_chunk ent-65-69 1950:2069
render_chunk ent-69-73 2070:2189
render_chunk ent-73-77 2190:2309
render_chunk ent-77-81 2310:2429
render_chunk ent-81-85 2430:2549

echo '--- CHUNK PROBE ---'
for f in "$CH"/*.mp4; do
  docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" \
    ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f" | tr '\n' ' '
  echo "$(basename "$f")"
done

OLD=output/gsa-tv-chamada-grade-v2-visual.mp4
VIS=output/gsa-tv-chamada-grade-v2-visual-FINAL-CANDIDATE.mp4
rm -f "$BASE/$VIS"
docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -y -hide_banner -loglevel warning \
  -i "$OLD" -i qc/chunks-v2/vida-38-42.mp4 -i qc/chunks-v2/vida-42-46.mp4 \
  -i qc/chunks-v2/vida-46-50.mp4 -i qc/chunks-v2/vida-50-53.mp4 \
  -i qc/chunks-v2/ent-65-69.mp4 -i qc/chunks-v2/ent-69-73.mp4 \
  -i qc/chunks-v2/ent-73-77.mp4 -i qc/chunks-v2/ent-77-81.mp4 -i qc/chunks-v2/ent-81-85.mp4 \
  -filter_complex "[0:v]trim=start=0:end=38,setpts=PTS-STARTPTS[a0]; \
[1:v]setpts=PTS-STARTPTS[a1];[2:v]setpts=PTS-STARTPTS[a2];[3:v]setpts=PTS-STARTPTS[a3];[4:v]setpts=PTS-STARTPTS[a4]; \
[0:v]trim=start=53:end=65,setpts=PTS-STARTPTS[a5]; \
[5:v]setpts=PTS-STARTPTS[a6];[6:v]setpts=PTS-STARTPTS[a7];[7:v]setpts=PTS-STARTPTS[a8];[8:v]setpts=PTS-STARTPTS[a9];[9:v]setpts=PTS-STARTPTS[a10]; \
[a0][a1][a2][a3][a4][a5][a6][a7][a8][a9][a10]concat=n=11:v=1:a=0[outv]" \
  -map '[outv]' -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -r 30 -t 85 -movflags +faststart "$VIS"

MASTER=output/GSA-TV-Chamada-Grade-V2-FINAL-CANDIDATE.mp4
rm -f "$BASE/$MASTER"
docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -y -hide_banner -loglevel warning \
  -i "$VIS" -i audio/master-v2.1.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k \
  -ar 48000 -ac 2 -t 85 -movflags +faststart "$MASTER"

echo '--- PROBE ---'
docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffprobe -v error \
  -show_entries stream=index,codec_name,width,height,pix_fmt,r_frame_rate,sample_rate,channels,duration \
  -show_entries format=duration,size,bit_rate -of json "$MASTER"

echo '--- DECODE ---'
docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -v error -i "$MASTER" -map 0:v:0 -map 0:a:0 -f null -
echo DECODE_OK
echo '--- SILENCE ---'
SIL=$(docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -hide_banner -i "$MASTER" -map 0:a:0 -af silencedetect=n=-50dB:d=2 -f null - 2>&1 | grep -E 'silence_start|silence_end' || true)
[ -z "$SIL" ] || { echo "$SIL"; exit 21; }
echo NONE

echo '--- BLACK ---'
BLK=$(docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -hide_banner -i "$MASTER" -map 0:v:0 -vf 'blackdetect=d=0.30:pix_th=0.10' -an -f null - 2>&1 | grep 'black_start' || true)
[ -z "$BLK" ] || { echo "$BLK"; exit 22; }
echo NONE

echo '--- FREEZE ---'
FRZ=$(docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -hide_banner -i "$MASTER" -map 0:v:0 -vf 'freezedetect=n=-50dB:d=1.5' -an -f null - 2>&1 | grep -E 'freeze_start|freeze_end|freeze_duration' || true)
[ -z "$FRZ" ] || { echo "$FRZ"; exit 23; }
echo NONE

echo '--- LOUDNESS ---'
docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -hide_banner -i "$MASTER" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | tail -16

echo '--- EDITORIAL ---'
python3 - <<'PY'
import json,os
b='/home/opc/gsa-ai/work/chamada-grade-v2'; c=json.load(open(b+'/config.json'))
logos=[x for s in c['sections'] for x in s.get('logos',[])]
assert len(logos)==25 and len(set(logos))==25
assert not [x for x in logos if not os.path.exists(b+'/assets/logos/'+x)]
blob=(json.dumps(c,ensure_ascii=False)+open(b+'/locutions.json').read()).lower()
assert 'gsa entrevista' not in blob
print('LOGOS_25_UNIQUE_OK; GSA_ENTREVISTA_ABSENT')
PY
echo '--- CLICK/POP ---'
docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -y -v error -i "$MASTER" -f f32le -acodec pcm_f32le qc/final-audio.f32
python3 - <<'PY'
from array import array
import os
p='/home/opc/gsa-ai/work/chamada-grade-v2/qc/final-audio.f32'; a=array('f')
with open(p,'rb') as f:a.fromfile(f,os.path.getsize(p)//4)
n=len(a)//2; hits=[]
for i in range(2,n-2):
 ok=[]
 for ch in (0,1):
  xm2=a[2*(i-2)+ch]; xm1=a[2*(i-1)+ch]; x=a[2*i+ch]; xp1=a[2*(i+1)+ch]; xp2=a[2*(i+2)+ch]
  d0=abs(xm1-xm2); d1=abs(x-xm1); d2=abs(xp1-x); d3=abs(xp2-xp1)
  ok.append(d1>0.20 and d2>0.20 and d0<0.08 and d3<0.08 and abs((x-xm1)+(x-xp1))>0.20)
 if ok[0] and ok[1]: hits.append(i)
print('isolated_sync_impulses',len(hits))
if hits: print('times',[round(i/48000,6) for i in hits[:30]]); raise SystemExit(24)
PY

echo '--- CONTACT SHEET ---'
rm -f "$BASE/qc/FINAL-contact-2p5s.jpg"
docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$FFIMG" ffmpeg -y -hide_banner -loglevel error -i "$MASTER" \
 -vf "fps=1/2.5,scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:black,tile=6x6:padding=2:margin=2" \
 -frames:v 1 -q:v 3 -update 1 qc/FINAL-contact-2p5s.jpg
echo '--- HASHES ---'
sha256sum "$BASE/$VIS" "$BASE/$MASTER" "$BASE/audio/master-v2.1.wav" | tee "$BASE/qc/FINAL-hashes.txt"

cat > "$BASE/qc/FINAL-QC-PRELIM.txt" <<EOF
GSA TV — Chamada da Grade V2 — QC PRELIMINAR
Gerado em: $(date -u +%FT%TZ)
Master candidato: $BASE/$MASTER
Visual candidato: $BASE/$VIS
Duração alvo: 85.000 s
Vídeo: H.264, 1920x1080, 30 fps
Áudio: AAC, 48 kHz, estéreo
Decode completo: OK
Silêncio >=2s: nenhum
Black frame >=0.30s: nenhum
Freeze >=1.5s: nenhum
Clicks/pops isolados sincronizados: 0
Logos: 25 totais / 25 únicos / sem ausentes
GSA Entrevista: ausente de config e locuções
Contact sheet: $BASE/qc/FINAL-contact-2p5s.jpg
Observação: promoção a FINAL depende da revisão visual humana desta contact sheet.
EOF

echo "=== PIPELINE PRELIM OK $(date -u +%FT%TZ) ==="
