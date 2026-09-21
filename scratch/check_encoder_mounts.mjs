import { runSshScript } from './ssh2-run.mjs';

const cmd = `
docker inspect gsa-tv-encoder-engine --format '{{json .Mounts}}' | jq .
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
