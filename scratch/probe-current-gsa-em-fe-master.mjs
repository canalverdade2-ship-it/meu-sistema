import fs from 'node:fs';
import {Client} from 'ssh2';
import {readInfraKey,runSshScript} from './ssh2-run.mjs';
const remote='/opt/gsa-tv/cache/media/1/gsa-em-fe-10min/gsa-em-fe-15h-10min-master.mp4';
const sh=String.raw`set -euo pipefail
f='${remote}'
echo '=== FFPROBE ==='
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.7.2 ffprobe -v error -show_format -show_streams -of json /media/1/gsa-em-fe-10min/gsa-em-fe-15h-10min-master.mp4
echo '=== AUDIO EBU R128 ==='
sudo docker run --rm -v /opt/gsa-tv/cache/media:/media gsa-tv/control-plane:1.7.2 ffmpeg -hide_banner -nostdin -i /media/1/gsa-em-fe-10min/gsa-em-fe-15h-10min-master.mp4 -vn -af ebur128=peak=true -f null - 2>&1 | tail -20
sudo mkdir -p /tmp/gsa-em-fe-audit
sudo chmod 0777 /tmp/gsa-em-fe-audit
for t in 5 120 300 500; do sudo docker run --rm -v /opt/gsa-tv/cache/media:/media -v /tmp/gsa-em-fe-audit:/out gsa-tv/control-plane:1.7.2 ffmpeg -hide_banner -loglevel error -ss "$t" -i /media/1/gsa-em-fe-10min/gsa-em-fe-15h-10min-master.mp4 -frames:v 1 -q:v 2 "/out/frame-$t.jpg"; done
sudo chmod 644 /tmp/gsa-em-fe-audit/*.jpg
sha256sum /tmp/gsa-em-fe-audit/*.jpg
`;
const r=await runSshScript(sh,120000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
await new Promise((resolve,reject)=>{const c=new Client();c.on('ready',()=>c.sftp((e,s)=>{if(e)return reject(e);let n=0;for(const t of [5,120,300,500])s.fastGet(`/tmp/gsa-em-fe-audit/frame-${t}.jpg`,`scratch/gsa-em-fe-frame-${t}.jpg`,err=>{if(err){c.end();reject(err);return;}if(++n===4){c.end();resolve();}});}));c.on('error',reject);c.connect({host:'147.15.43.141',port:22,username:'opc',privateKey:readInfraKey(),readyTimeout:15000});});
console.log('frames_downloaded');
