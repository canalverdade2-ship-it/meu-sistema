import { runSshScript } from './ssh2-run.mjs';
const remote=String.raw`ls -ld /opt /opt/gsa-tv 2>&1 || true
ls -ld /opt/gsa-tv/n8n /opt/gsa-tv/n8n/workflows /opt/gsa-tv/n8n-bridge 2>&1 || true
findmnt -T /opt/gsa-tv 2>/dev/null || true
id opc 2>/dev/null || true
getent group opc 2>/dev/null || true
`;
const r=await runSshScript(remote,30000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
