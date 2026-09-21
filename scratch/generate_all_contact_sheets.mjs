import { runSshScript } from './ssh2-run.mjs';

const script = `
const fs = require('fs'), cp = require('child_process');

const REPL_DIR = '/home/opc/gsa-ai/work/identity-flow-20260907/replacements';
const QC_DIR = '/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen';

const PIECES = [
  { slug: 'gsa-business', kind: 'opening', file: 'business-opening-repl.mp4' },
  { slug: 'gsa-news-noite', kind: 'opening', file: 'news-noite-opening-repl.mp4' },
  { slug: 'gsa-motor', kind: 'opening', file: 'motor-opening-repl.mp4' },
  { slug: 'gsa-agro', kind: 'opening', file: 'agro-opening-repl.mp4' },
  { slug: 'gsa-em-fe', kind: 'closing', file: 'em-fe-closing-repl.mp4' },
  { slug: 'gsa-bem-viver', kind: 'closing', file: 'bem-viver-closing-repl.mp4' },
  { slug: 'gsa-sabor', kind: 'opening', file: 'sabor-opening-repl.mp4' },
  { slug: 'gsa-esportes', kind: 'closing', file: 'esportes-closing-repl.mp4' },
  { slug: 'gsa-hora-da-palavra', kind: 'opening', file: 'hora-opening-repl-2.mp4' }
];

cp.execSync(\`mkdir -p "\${QC_DIR}"\`);

const results = [];

for (const p of PIECES) {
  const videoPath = \`\${REPL_DIR}/\${p.file}\`;
  const outJpg = \`\${QC_DIR}/\${p.slug}-\${p.kind}-qc.jpg\`;

  console.log(\`Generating contact sheet for \${p.slug} (\${p.kind})...\`);

  const cmd = \`sudo docker run --rm --user 0:0 -v /home:/home -v /opt:/opt gsa-tv/control-plane:1.8.7 ffmpeg -y \\
    -ss 1 -i "\${videoPath}" \\
    -ss 5 -i "\${videoPath}" \\
    -ss 7.5 -i "\${videoPath}" \\
    -filter_complex "[0:v]scale=640:360[v0];[1:v]scale=640:360[v1];[2:v]scale=640:360[v2];[v0][v1][v2]hstack=inputs=3[out]" \\
    -map "[out]" -frames:v 1 -update 1 "\${outJpg}"\`;

  cp.execSync(cmd, { stdio: 'inherit' });
  const stat = fs.statSync(outJpg);
  console.log(\`Created \${outJpg} (\${stat.size} bytes)\`);
  results.push({
    slug: p.slug,
    kind: p.kind,
    file: p.file,
    contactSheet: outJpg,
    size: stat.size
  });
}

console.log('\\nAll contact sheets generated:');
console.log(JSON.stringify(results, null, 2));
fs.writeFileSync(\`\${QC_DIR}/contact-sheets-manifest.json\`, JSON.stringify(results, null, 2));
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 60000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
