import { runSshScript } from './ssh2-run.mjs';
const src=process.argv[2], dst=process.argv[3]; if(!src||!dst)throw Error('src dst');
const r=await runSshScript(`docker cp '${src}' gsa-ai-browser:'${dst}'\ndocker exec gsa-ai-browser ls -l '${dst}'`);
process.stdout.write(r.stdout);process.stderr.write(r.stderr);
