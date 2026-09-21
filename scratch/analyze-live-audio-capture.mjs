import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`sudo docker exec gsa-tv-encoder-engine ffmpeg -hide_banner -nostats -i /tmp/gsa-news-live-audio-30s.wav -af "astats=metadata=1:reset=0,ebur128=peak=true" -f null - 2>&1 | grep -E 'Integrated loudness|I:|True peak|Peak level dB|RMS level dB|Number of NaNs|Number of Infs|Number of denormals' | tail -n 30`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
