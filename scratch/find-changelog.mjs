import { runSshScript } from './ssh2-run.mjs';

const script = `
find / -name "GSA_TV_MEMORY_CHANGELOG.md" 2>/dev/null
`;

const res = await runSshScript(script);
console.log(res.stdout);
