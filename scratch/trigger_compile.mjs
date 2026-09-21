import { execSync } from 'child_process';
const script = `cat << 'EOF' | node
const http = require('http');
const data = JSON.stringify({ job_type: 'compile_playlist' });
const options = {
  hostname: '127.0.0.1',
  port: 9202,
  path: '/automation/jobs',
  method: 'POST',
  headers: {
    'Authorization': 'Bearer e54c08df5a3b42c2967395833b9c7104b3c9e0cb5e0f6c67f8277e5ea2895b0b',
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};
const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, body));
});
req.on('error', error => console.error(error));
req.write(data);
req.end();
EOF
`;
import fs from 'fs';
fs.writeFileSync('scratch/run_trigger.sh', script);
execSync('node scratch/vps-exec.mjs -f scratch/run_trigger.sh', { stdio: 'inherit' });
