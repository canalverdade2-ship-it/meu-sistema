import { runSshScript } from './ssh2-run.mjs';

const script = `
sudo docker logs --tail 25 gsa-tv-encoder-engine
sudo docker top gsa-tv-encoder-engine
`;

const res = await runSshScript(script);
console.log(res.stdout);
