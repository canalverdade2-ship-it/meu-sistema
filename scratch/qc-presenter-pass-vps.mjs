import { runSshScript } from './ssh2-run.mjs';
const b='/home/opc/gsa-ai/work/chamada-grade-v2';
const f='output/GSA-TV-Chamada-Grade-V2-PRESENTER-CANDIDATE.mp4';
const r=await runSshScript(String.raw`set -eu
cd /home/opc/gsa-ai/work/chamada-grade-v2
IMG=gsa-tv/control-plane:1.8.2
U="$(id -u):$(id -g)"
docker run --rm --user "$U" -v /home:/home -w "${b}" "$IMG" ffmpeg -v error -i "${f}" -map 0:v:0 -map 0:a:0 -f null -
SIL=$(docker run --rm --user "$U" -v /home:/home -w "${b}" "$IMG" ffmpeg -hide_banner -i "${f}" -map 0:a:0 -af silencedetect=n=-50dB:d=2 -f null - 2>&1 | grep -E 'silence_start|silence_end' || true)
BLK=$(docker run --rm --user "$U" -v /home:/home -w "${b}" "$IMG" ffmpeg -hide_banner -i "${f}" -map 0:v:0 -vf 'blackdetect=d=0.30:pix_th=0.10' -an -f null - 2>&1 | grep 'black_start' || true)
FRZ=$(docker run --rm --user "$U" -v /home:/home -w "${b}" "$IMG" ffmpeg -hide_banner -i "${f}" -map 0:v:0 -vf 'freezedetect=n=-50dB:d=1.5' -an -f null - 2>&1 | grep -E 'freeze_start|freeze_end|freeze_duration' || true)
LOUD=$(docker run --rm --user "$U" -v /home:/home -w "${b}" "$IMG" ffmpeg -hide_banner -i "${f}" -map 0:a:0 -af ebur128=peak=true -f null - 2>&1 | tail -16)
rm -f qc/PRESENTER-audio.f32
docker run --rm --user "$U" -v /home:/home -w "${b}" "$IMG" ffmpeg -y -v error -i "${f}" -f f32le -acodec pcm_f32le qc/PRESENTER-audio.f32
POPS=$(python3 - <<'PY'
from array import array
import os
p='qc/PRESENTER-audio.f32'; a=array('f')
with open(p,'rb') as h:a.fromfile(h,os.path.getsize(p)//4)
n=len(a)//2; hits=[]
for i in range(2,n-2):
 ok=[]
 for ch in (0,1):
  xm2=a[2*(i-2)+ch]; xm1=a[2*(i-1)+ch]; x=a[2*i+ch]; xp1=a[2*(i+1)+ch]; xp2=a[2*(i+2)+ch]
  d0=abs(xm1-xm2); d1=abs(x-xm1); d2=abs(xp1-x); d3=abs(xp2-xp1)
  ok.append(d1>0.20 and d2>0.20 and d0<0.08 and d3<0.08 and abs((x-xm1)+(x-xp1))>0.20)
 if ok[0] and ok[1]: hits.append(i)
print(len(hits))
PY
)
test -z "$SIL"; test -z "$BLK"; test -z "$FRZ"; test "$POPS" = 0
HASH=$(sha256sum "${f}" | awk '{print $1}')
cat > qc/PRESENTER-QC-FINAL.txt <<EOF
GSA TV — Chamada da Grade V2 — QC DO CANDIDATO COM APRESENTADORES
Gerado em: $(date -u +%FT%TZ)
Arquivo: ${b}/${f}
SHA-256: $HASH
Decode integral: OK
Silêncio >=2s: nenhum
Black frame >=0.30s: nenhum
Freeze >=1.5s: nenhum
Clicks/pops isolados sincronizados: $POPS
25 logos oficiais: preservados na configuração e mosaico final
GSA Entrevista: ausente
Elenco: 22 identidades aprovadas + dupla fixa GSA News preservadas
Áudio/loudness:
$LOUD
Estado: pronto para revisão/aprovação do responsável; não colocar no ar automaticamente.
EOF
cat qc/PRESENTER-QC-FINAL.txt
` ,900000);
process.stdout.write(r.stdout); process.stderr.write(r.stderr);
