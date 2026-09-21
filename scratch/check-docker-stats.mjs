import { runSshScript } from './ssh2-run.mjs';

const script = `
sudo docker stats --no-stream
`;

const res = await runSshScript(script);
console.log(res.stdout);
