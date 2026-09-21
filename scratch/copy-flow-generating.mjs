import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const res = await runSshScript('base64 -w 0 /tmp/flow_generating.png');
  const buf = Buffer.from(res.stdout.trim().split('\n').pop(), 'base64');
  fs.writeFileSync('public/cast/flow_generating.png', buf);
  console.log('Saved flow_generating.png:', buf.length, 'bytes');
}

main().catch(console.error);
