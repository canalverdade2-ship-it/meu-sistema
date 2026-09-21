import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(`set -u
sudo pstree -ap 3330621 || true
sudo ls -la /proc/3330621/fd 2>/dev/null || true
sudo cat /proc/3330621/wchan 2>/dev/null || true
sudo find /opt/gsa-tv/backups/full -maxdepth 2 -printf '%TY-%Tm-%Td %TH:%TM:%TS %s %p\\n' 2>/dev/null | sort | tail -n 60
sudo docker ps --format '{{.ID}} {{.Names}} {{.Image}} {{.Status}}' | tail -n 30
sudo journalctl -u gsa-tv-backup.service --since '5 days ago' --no-pager -n 160 || true
`,180000);
process.stdout.write(result.stdout); if(result.stderr) process.stderr.write(result.stderr);
