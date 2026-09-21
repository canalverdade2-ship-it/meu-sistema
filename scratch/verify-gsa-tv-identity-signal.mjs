import { runSshScript } from './ssh2-run.mjs';

const remote = String.raw`set -euo pipefail
for i in $(seq 1 45); do
  if pgrep -af ffmpeg | grep -q 'rtmp.*youtube'; then break; fi
  sleep 2
done
echo RELAY
pgrep -af ffmpeg | grep 'rtmp.*youtube' | sed -E 's#(live2/)[^ ]+#\1[PROTECTED]#g' | head -1
echo IDENTITY_INPUT
pgrep -af ffmpeg | grep 'rtmp.*youtube' | grep -o '/media/1/identity/gsa-tv-logo-transparent.png' | head -1
echo FILES
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of compact /media/1/identity/gsa-tv-continuity-720p30.mp4
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.6.7 ffprobe -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of compact /media/1/filler/gsa-tv-filler-600.mp4
echo METRICS
curl -fsS http://127.0.0.1:9204/metrics | grep -E '^gsa_tv_(up|control_plane_up|ffplayout_up|hls_up|signal_expected|black_detected|silence_detected|freeze_detected) '
`;

const result = await runSshScript(remote, 120000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
