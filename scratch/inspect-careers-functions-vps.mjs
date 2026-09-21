import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
const creds=fs.readFileSync(new URL('../CREDENCIAIS_SISTEMA_GSA.md',import.meta.url),'utf8');
const key=creds.match(/Chave Privada:\*\*\s*([^\r\n]+)/i)?.[1]?.trim();
if(!key) throw new Error('Chave ausente');
const remote=`set -e
sudo find /opt /home /srv -maxdepth 6 -type d -name gsa-transactional-email 2>/dev/null | head -10
sudo docker ps -a --format '{{.Names}}|{{.Image}}|{{.Status}}' | grep -Ei 'function|edge|kong|postgrest|supabase' || true
sudo systemctl list-units --type=service --all --no-pager | grep -Ei 'function|edge|supabase' || true`;
const ssh=spawnSync('C:/Windows/System32/OpenSSH/ssh.exe',['-o','BatchMode=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=12','-i',key,'opc@147.15.43.141','bash','-s'],{input:remote,encoding:'utf8',timeout:30000});
console.log(ssh.stdout); if(ssh.stderr) console.error(ssh.stderr); process.exit(ssh.status??1);
