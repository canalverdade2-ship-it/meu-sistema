import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -u
echo '=== compose dependencies and obsolete settings ==='
sudo grep -RInE 'depends_on|healthcheck|encoder-engine|ENCODER_UDP|UDP_PORT|12345|control-plane:|watchdog:' /opt/gsa-tv --include='compose*.yml' --include='docker-compose*.yml' 2>/dev/null | head -n 240 || true
echo '=== backup scripts coverage ==='
for f in /opt/gsa-tv/backup/gsa-tv-backup-full.sh /usr/local/sbin/backup-gsa; do
  if sudo test -f "$f"; then echo "FILE=$f"; sudo grep -nE 'control-plane|encoder-engine|watchdog|compose|runtime|systemd|guard|backup|tar|docker' "$f" | head -n 240; fi
done
echo '=== recent backup artifacts ==='
sudo find /opt/gsa-tv/backup /home/opc -maxdepth 3 -type f -printf '%TY-%Tm-%Td %TH:%TM %s %p\n' 2>/dev/null | grep -Ei 'backup|manifest|tar.gz' | sort -r | head -n 60
echo '=== systemd encoder guards ==='
sudo systemctl list-unit-files 2>/dev/null | grep -Ei 'gsa|encoder|stream' || true
sudo grep -RInE 'encoder-engine|rtmp|ffmpeg|control-plane' /etc/systemd/system /usr/local/sbin 2>/dev/null | head -n 200 || true
echo '=== public/runtime HLS exact freshness ==='
date +%s
for f in /opt/gsa-tv/runtime/hls/program.m3u8 /opt/gsa-tv/runtime/hls/program_129.ts /opt/gsa-tv/runtime/hls/program_130.ts /opt/gsa-tv/runtime/hls/program_131.ts /opt/gsa-tv/runtime/hls/program_132.ts /opt/gsa-tv/runtime/hls/program_133.ts; do sudo stat -c '%Y %y %s %n' "$f" 2>/dev/null || true; done
echo '=== current process ownership, no command args ==='
sudo docker top gsa-tv-encoder-engine -eo pid,ppid,user,stat,lstart,etime,pcpu,pmem,rss,comm
`,240000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
