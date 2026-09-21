import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -Eeuo pipefail
echo '=== HLS PROBE ==='
sudo docker exec gsa-tv-control-plane ffprobe -v error -show_entries stream=index,codec_type,codec_name,sample_rate,channels,width,height,r_frame_rate -of json /runtime/hls/program.m3u8
echo '=== AUDIO LEVELS 12S ==='
sudo docker exec gsa-tv-control-plane ffmpeg -hide_banner -nostdin -t 12 -i /runtime/hls/program.m3u8 -vn -af astats=metadata=1:reset=1 -f null - 2>&1 | grep -E 'Peak level dB|RMS level dB|Number of NaNs|Number of Infs' | tail -n 12
echo '=== ONE PUBLISHER ==='
count=$(sudo ps -eo args | grep -Ec '[f]fmpeg.*(rtmp|RTMP)')
echo "$count"
[[ "$count" == 1 ]]
echo '=== ENGINE/WATCHDOG ==='
curl -fsS http://127.0.0.1:9210/health; echo
curl -fsS http://127.0.0.1:9204/health; echo
DB_URL=$(sudo awk -F= '$1=="DATABASE_URL"{sub(/^DATABASE_URL=/,"");print;exit}' /opt/gsa-tv/control-plane/.env)
psql "$DB_URL" -X -P pager=off -c "select sampled_at,signal_state,video_ok,audio_ok,black_frame,silence,freeze,details from public.gsa_tv_watchdog_samples order by sampled_at desc limit 5"
`,180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
