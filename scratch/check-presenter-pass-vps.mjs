import { runSshScript } from './ssh2-run.mjs';
const b='/home/opc/gsa-ai/work/chamada-grade-v2';
const result=await runSshScript(`set -eu\ncd '${b}'\nls -lh output/*PRESENTER* qc/PRESENTER-contact-2p5s.jpg\nsha256sum output/GSA-TV-Chamada-Grade-V2-PRESENTER-CANDIDATE.mp4 output/gsa-tv-chamada-grade-v2-visual-PRESENTER-CANDIDATE.mp4 | tee qc/PRESENTER-hashes.txt\ndocker run --rm --user \"$(id -u):$(id -g)\" -v /home:/home -w '${b}' gsa-tv/control-plane:1.8.2 ffprobe -v error -show_entries format=duration,size,bit_rate -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate,channels -of json output/GSA-TV-Chamada-Grade-V2-PRESENTER-CANDIDATE.mp4`);
process.stdout.write(result.stdout); process.stderr.write(result.stderr);
