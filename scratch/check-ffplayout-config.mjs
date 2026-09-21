import { runSshScript } from './ssh2-run.mjs';

const script = `
ls -la /opt/gsa-tv/config/ffplayout/
cat /opt/gsa-tv/config/ffplayout/ffplayout.conf 2>/dev/null || cat /opt/gsa-tv/config/ffplayout/ffplayout.toml 2>/dev/null || cat /opt/gsa-tv/config/ffplayout/ffplayout.yaml 2>/dev/null || true
`;

const res = await runSshScript(script);
console.log(res.stdout);
