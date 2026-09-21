import { runSshScript } from './ssh2-run.mjs';

const cmd = `
tail -n 80 /tmp/new_media_files.txt
`;

const res = await runSshScript(cmd, 30000);
console.log(res.stdout);
