import { runSshScript } from './ssh2-run.mjs';

const script = `
echo "=== WATCHDOG SRC APP.JS ==="
cat /opt/gsa-tv/watchdog/src/app.js
echo "=== ENCODER-ENGINE SRC ==="
ls -la /opt/gsa-tv/encoder-engine/src/
cat /opt/gsa-tv/encoder-engine/src/*
`;

const res = await runSshScript(script);
console.log(res.stdout);
