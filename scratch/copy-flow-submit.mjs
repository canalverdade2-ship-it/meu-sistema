import fs from 'fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const res = await runSshScript('base64 -w 0 /tmp/flow_after_submit.png');
  const buffer = Buffer.from(res.stdout.trim(), 'base64');
  fs.writeFileSync('public/cast/flow_after_submit.png', buffer);
  console.log('Saved flow_after_submit.png:', buffer.length, 'bytes');
}

main().catch(console.error);
