import { runSshScript } from './ssh2-run.mjs';

const script = `
tail -n 60 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md
`;

const res = await runSshScript(script);
console.log(res.stdout);
