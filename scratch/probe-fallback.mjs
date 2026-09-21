import { runSshScript } from './ssh2-run.mjs';

const cmd = `
ffprobe -v error -show_entries stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels -show_entries format=duration -of json /opt/gsa-tv/cache/media/1/program-masters/gsa-tv-fallback-1080p30.mp4
`;

try {
  const res = await runSshScript(cmd, 30000);
  console.log(res.stdout);
  if (res.stderr) console.error('STDERR:', res.stderr);
} catch (e) {
  console.error('ERROR:', e);
}
