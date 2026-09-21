import { execSync } from 'child_process';
import fs from 'fs';
const appPatched = fs.readFileSync('scratch/app_patched.js');
const base64Str = appPatched.toString('base64');
const script = `cat << 'EOF' | sudo node
const fs = require('fs');
const content = Buffer.from(\`${base64Str}\`, 'base64').toString('utf8');
fs.writeFileSync('/opt/gsa-tv/control-plane/src/app.js', content, 'utf8');
console.log('App patched on VPS');
EOF
`;
fs.writeFileSync('scratch/push_payload.sh', script);
execSync('node scratch/vps-exec.mjs -f scratch/push_payload.sh', { stdio: 'inherit' });
