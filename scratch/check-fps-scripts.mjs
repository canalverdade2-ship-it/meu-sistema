import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== LS /opt/gsa-tv/bin/ ==="
ls -la /opt/gsa-tv/bin/ 2>/dev/null || echo "No /opt/gsa-tv/bin"

echo "=== FIND SCRIPTS WITH FPS ==="
grep -rn "fps" /opt/gsa-tv/ 2>/dev/null | head -n 30 || true
`;

const res = await runSshScript(script);
console.log(res.stdout);
