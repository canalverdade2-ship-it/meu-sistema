import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

const remote = '/home/opc/gsa-ai/assets/brand/gsa-program-logos-board-32-candidate-2026-09-04.png';
const result = await runSshScript(`base64 -w0 '${remote}'`, 60000);
const local = new URL('./gsa-program-logos-board-32-candidate-2026-09-04.png', import.meta.url);
fs.writeFileSync(local, Buffer.from(result.stdout.trim(), 'base64'));
console.log(JSON.stringify({ path: decodeURIComponent(local.pathname).replace(/^\/(.:)/, '$1'), bytes: fs.statSync(local).size }));
