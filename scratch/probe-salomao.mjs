import { runSshScript } from './ssh2-run.mjs';

const cmd = `
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate -of csv=p=0 "/opt/gsa-tv/cache/media/1/program-masters/salomao-intro-1080p30.mp4"
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels -of csv=p=0 "/opt/gsa-tv/cache/media/1/program-masters/salomao-intro-1080p30.mp4"
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
