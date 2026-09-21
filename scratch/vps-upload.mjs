import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const localFile = process.argv[2];
const remoteFile = process.argv[3];
const makeExec = process.argv[4] === '--exec';

if (!localFile || !remoteFile) {
  console.error('Usage: node scratch/vps-upload.mjs <localPath> <remotePath> [--exec]');
  process.exit(1);
}

const content = fs.readFileSync(localFile);
const b64 = content.toString('base64');

// Chunk into 64KB lines to avoid any argument length limits
const chunkSize = 60000;
const chunks = [];
for (let i = 0; i < b64.length; i += chunkSize) {
  chunks.push(b64.slice(i, i + chunkSize));
}

let script = `cat << 'EOF' | base64 -d > "${remoteFile}"\n`;
script += chunks.join('\n') + '\nEOF\n';
if (makeExec) {
  script += `chmod +x "${remoteFile}"\n`;
}

try {
  const res = await runSshScript(script, 120000);
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
  console.log(`Uploaded ${localFile} -> ${remoteFile} successfully!`);
} catch (err) {
  console.error('Error uploading file:', err.message);
  process.exit(1);
}
