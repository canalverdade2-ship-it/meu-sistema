import { runSshScript } from './ssh2-run.mjs';
const sh=`set -e
sudo rm -f /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/*.mp3
sudo chmod 0777 /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered
for f in /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/dry/*.mp3; do
  n=$(basename "$f")
  sudo docker exec gsa-tv-ffplayout ffmpeg -y -hide_banner -loglevel error \
    -i "/media/1/identity/program-bumpers-2026-09-05/dry/$n" \
    -f lavfi -i "sine=frequency=110:duration=7,volume=0.045" \
    -f lavfi -i "sine=frequency=165:duration=7,volume=0.025" \
    -f lavfi -i "sine=frequency=247:duration=7,volume=0.018" \
    -filter_complex "[1:a][2:a][3:a]amix=inputs=3:normalize=0,afade=t=in:st=0:d=0.25,afade=t=out:st=5.2:d=1.8[bed];[0:a]adelay=250|250,volume=1.18[vox];[bed][vox]amix=inputs=2:duration=longest:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]" \
    -map "[a]" -ac 2 -ar 48000 -b:a 192k "/media/1/identity/program-bumpers-2026-09-05/mastered/$n"
done
sudo cp /opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered/*.mp3 /home/opc/gsa-ai/qc/program-bumpers-2026-09-05/
sudo chown -R opc:opc /home/opc/gsa-ai/qc/program-bumpers-2026-09-05
echo MASTERED=$(find /home/opc/gsa-ai/qc/program-bumpers-2026-09-05 -maxdepth 1 -name '*.mp3'|wc -l)
`;
const r=await runSshScript(sh,600000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
