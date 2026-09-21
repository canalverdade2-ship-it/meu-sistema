#!/usr/bin/env bash
set -euo pipefail
BASE=/home/opc/gsa-ai/work/chamada-grade-v2
IMG=gsa-tv/control-plane:1.8.2
UIDGID="$(id -u):$(id -g)"
IN=output/gsa-tv-chamada-grade-v2-visual-FINAL-CANDIDATE.mp4
OUT=output/gsa-tv-chamada-grade-v2-visual-PRESENTER-CANDIDATE.mp4
MASTER=output/GSA-TV-Chamada-Grade-V2-PRESENTER-CANDIDATE.mp4
cd "$BASE"

docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$IMG" ffmpeg -y -hide_banner -loglevel warning \
 -i "$IN" \
 -loop 1 -t 5 -i assets/presenter-panels/jornalismo.png \
 -loop 1 -t 12 -i assets/presenter-panels/futuro.png \
 -loop 1 -t 12 -i assets/presenter-panels/vida.png \
 -loop 1 -t 9 -i assets/presenter-panels/fe.png \
 -loop 1 -t 6.5 -i assets/presenter-panels/entretenimento-a.png \
 -loop 1 -t 6.3 -i assets/presenter-panels/entretenimento-b.png \
 -filter_complex "\
[1:v]scale=1920:1080,format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=4.5:d=0.5:alpha=1,setpts=PTS-STARTPTS+16/TB[p1];\
[2:v]scale=1920:1080,format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=11.5:d=0.5:alpha=1,setpts=PTS-STARTPTS+24/TB[p2];\
[3:v]scale=1920:1080,format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=11.5:d=0.5:alpha=1,setpts=PTS-STARTPTS+39/TB[p3];\
[4:v]scale=1920:1080,format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=8.5:d=0.5:alpha=1,setpts=PTS-STARTPTS+54/TB[p4];\
[5:v]scale=1920:1080,format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=6:d=0.5:alpha=1,setpts=PTS-STARTPTS+65/TB[p5];\
[6:v]scale=1920:1080,format=rgba,fade=t=in:st=0:d=0.45:alpha=1,fade=t=out:st=5.8:d=0.5:alpha=1,setpts=PTS-STARTPTS+71.5/TB[p6];\
[0:v][p1]overlay=eof_action=pass:enable='between(t,16,21)'[v1];\
[v1][p2]overlay=eof_action=pass:enable='between(t,24,36)'[v2];\
[v2][p3]overlay=eof_action=pass:enable='between(t,39,51)'[v3];\
[v3][p4]overlay=eof_action=pass:enable='between(t,54,63)'[v4];\
[v4][p5]overlay=eof_action=pass:enable='between(t,65,71.5)'[v5];\
[v5][p6]overlay=eof_action=pass:enable='between(t,71.5,77.8)'[vout]" \
 -map '[vout]' -an -c:v libx264 -preset medium -crf 17 -pix_fmt yuv420p -r 30 -t 85 -movflags +faststart "$OUT"

docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$IMG" ffmpeg -y -hide_banner -loglevel warning \
 -i "$OUT" -i audio/master-v2.1.wav -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -ar 48000 -ac 2 -t 85 -movflags +faststart "$MASTER"

docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$IMG" ffmpeg -v error -i "$MASTER" -f null -
rm -f qc/PRESENTER-contact-2p5s.jpg
docker run --rm --user "$UIDGID" -v /home:/home -w "$BASE" "$IMG" ffmpeg -y -hide_banner -loglevel error -i "$MASTER" \
 -vf "fps=1/2.5,scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:black,tile=6x6:padding=2:margin=2" \
 -frames:v 1 -q:v 3 -update 1 qc/PRESENTER-contact-2p5s.jpg
sha256sum "$MASTER" "$OUT" > qc/PRESENTER-hashes.txt
echo PRESENTER_PASS_OK
