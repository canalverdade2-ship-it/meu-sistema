import { runSshScript } from './ssh2-run.mjs';

const script = `
const fs = require('fs'), cp = require('child_process');

const REPL_DIR = '/home/opc/gsa-ai/work/identity-flow-20260907/replacements';
const FILES = [
  'business-opening-repl.mp4',
  'news-noite-opening-repl.mp4',
  'motor-opening-repl.mp4',
  'agro-opening-repl.mp4',
  'em-fe-closing-repl.mp4',
  'bem-viver-closing-repl.mp4',
  'sabor-opening-repl.mp4',
  'esportes-closing-repl.mp4',
  'hora-opening-repl-2.mp4'
];

const results = [];

for (const file of FILES) {
  const filePath = \`\${REPL_DIR}/\${file}\`;
  const cmd = \`sudo docker run --rm --user 0:0 -v /home:/home -v /opt:/opt gsa-tv/control-plane:1.8.7 ffprobe -v error -show_format -show_streams -print_format json "\${filePath}"\`;
  const stdout = cp.execSync(cmd, { encoding: 'utf8' });
  const data = JSON.parse(stdout);

  const vStream = data.streams.find(s => s.codec_type === 'video');
  const aStream = data.streams.find(s => s.codec_type === 'audio');

  const duration = parseFloat(data.format.duration);
  const vCodec = vStream?.codec_name;
  const width = vStream?.width;
  const height = vStream?.height;
  const fps = vStream?.r_frame_rate;
  const aCodec = aStream?.codec_name;
  const aSampleRate = aStream?.sample_rate;
  const aChannels = aStream?.channels;

  const technicalPass = (
    vCodec === 'h264' &&
    ((width === 1920 && height === 1080) || (width === 1280 && height === 720)) &&
    (fps === '30/1' || fps === '24/1' || fps === '30000/1001' || fps === '24000/1001') &&
    duration >= 7.9 && duration <= 12.5
  );

  results.push({
    file,
    duration,
    video: {
      codec: vCodec,
      resolution: \`\${width}x\${height}\`,
      fps,
      pix_fmt: vStream?.pix_fmt
    },
    audio: aStream ? {
      codec: aCodec,
      sample_rate: aSampleRate,
      channels: aChannels
    } : 'no_audio',
    technicalPass
  });
}

console.log(JSON.stringify(results, null, 2));
fs.writeFileSync('/home/opc/gsa-ai/work/identity-flow-20260907/qc-ffprobe-results.json', JSON.stringify(results, null, 2));
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
