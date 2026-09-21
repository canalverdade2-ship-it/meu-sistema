import { runSshScript } from './ssh2-run.mjs';

const script = `
sudo docker logs --tail 30 gsa-tv-ffplayout
`;

const res = await runSshScript(script);
console.log(res.stdout);
