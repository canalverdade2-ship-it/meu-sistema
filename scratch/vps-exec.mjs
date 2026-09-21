import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

let cmd = process.argv.slice(2).join(' ');
if (process.argv[2] === '-f') {
  const filePath = process.argv.slice(3).join(' ');
  cmd = fs.readFileSync(filePath, 'utf8');
} else if (!cmd) {
  cmd = fs.readFileSync(0, 'utf8');
}

if (!cmd.trim()) {
  console.error('Usage: node scratch/vps-exec.mjs <command> OR node scratch/vps-exec.mjs -f <script-file>');
  process.exit(1);
}

cmd = cmd.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

try {
  const res = await runSshScript(cmd, 1800000);
  if (res.stdout) process.stdout.write(res.stdout);
  if (res.stderr) process.stderr.write(res.stderr);
} catch (err) {
  console.error('Error executing SSH command:', err.message);
  if (err.stdout) process.stdout.write(err.stdout);
  if (err.stderr) process.stderr.write(err.stderr);
  process.exit(err.code || 1);
}
