import { execSync } from 'child_process';
import fs from 'fs';
const command = `node scratch/vps-exec.mjs "cat /opt/gsa-tv/control-plane/src/app.js"`;
const output = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
fs.writeFileSync('scratch/app.js', output, 'utf-8');
console.log('Saved properly');
