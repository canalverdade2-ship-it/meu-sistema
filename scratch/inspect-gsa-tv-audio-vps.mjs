import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const creds=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const key=creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!key) throw new Error('Chave SSH ausente.');
const remote=`set -euo pipefail
echo '--- containers ---'
sudo docker ps --filter 'name=gsa-tv' --format '{{.Names}}|{{.Status}}|{{.Ports}}'
echo '--- ffplayout logs audio/errors ---'
sudo docker logs --tail 500 gsa-tv-ffplayout 2>&1 | grep -Ei 'audio|aac|sample|loud|clip|error|warn|ffmpeg' | tail -120 || true
echo '--- config files ---'
sudo find /opt/gsa-tv/config/ffplayout -maxdepth 2 -type f -printf '%p\n' 2>/dev/null | sort
echo '--- audio-related config ---'
sudo grep -RniE 'audio|volume|loud|sample|aac|filter|normalize|gain|bitrate|stream' /opt/gsa-tv/config/ffplayout 2>/dev/null | head -180 || true
echo '--- processes ---'
sudo docker top gsa-tv-ffplayout -eo pid,args 2>/dev/null | head -40 || true
echo '--- media inventory ---'
sudo find /opt/gsa-tv/cache/media /opt/gsa-tv/fallback -maxdepth 3 -type f \( -iname '*.mp4' -o -iname '*.mkv' -o -iname '*.ts' \) -printf '%p\n' 2>/dev/null | head -30
`;
const result=spawnSync('C:/Windows/System32/OpenSSH/ssh.exe',['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'],{input:remote,encoding:'utf8',timeout:45000,maxBuffer:4*1024*1024});
if(result.status!==0){process.stderr.write(result.stderr||result.stdout);process.exit(result.status||1)}
process.stdout.write(result.stdout);
