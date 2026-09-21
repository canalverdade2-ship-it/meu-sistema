import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
FILE=/media/1/normalized/media-836c5fe7-e994-455c-bfa4-76b5a803d94c-720p30.mp4
echo '=== probe ==='
sudo docker exec gsa-tv-encoder-engine ffprobe -v error -show_entries stream=index,codec_type,codec_name,sample_rate,channels,channel_layout,bit_rate,duration:format=duration,size,bit_rate -of json "$FILE"
echo '=== full-file audio levels ==='
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -i "$FILE" -map 0:a:0 -af 'astats=metadata=0:reset=0' -f null - 2>&1 | grep -E 'Peak level dB|RMS level dB|Peak count|Flat factor|Number of samples|DC offset' | tail -n 30
echo '=== clipping detector ==='
sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostdin -i "$FILE" -map 0:a:0 -af 'aselect=gt(abs(val(CHANNEL)),0.98),astats=metadata=0:reset=0' -f null - 2>&1 | tail -n 40 || true
echo '=== database source record ==='
DBURL=$(sudo docker inspect gsa-tv-encoder-engine --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}')
echo "select id,name,type,state,metadata from public.gsa_tv_live_sources where id='836c5fe7-e994-455c-bfa4-76b5a803d94c';" | sudo docker run --rm -i --network host postgres:15-alpine psql -At "$DBURL" | head -c 4000
echo
`,180000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
