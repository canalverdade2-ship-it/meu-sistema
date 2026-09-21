import {runSshScript} from './ssh2-run.mjs';
const script=process.argv.slice(2).join(' ');
if(!script) throw new Error('remote command required');
const result=await runSshScript(script, 900000);
process.stdout.write(result.stdout);
process.stderr.write(result.stderr);
