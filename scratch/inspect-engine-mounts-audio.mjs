import { runSshScript } from './ssh2-run.mjs';
const result=await runSshScript(`sudo docker inspect gsa-tv-encoder-engine --format '{{json .Mounts}}'; echo; sudo docker exec gsa-tv-encoder-engine sh -lc 'ls -lh /tmp | tail; ls -lh /runtime/hls | tail'`,20000);process.stdout.write(result.stdout||'');
