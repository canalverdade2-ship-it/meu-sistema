import { runSshScript } from './ssh2-run.mjs';

const cmd = `
sudo grep -rn 'news' /opt/gsa-tv/playlists/1/ || true
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
