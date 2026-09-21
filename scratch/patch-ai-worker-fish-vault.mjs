import {runSshScript} from './ssh2-run.mjs';
const py=String.raw`from pathlib import Path
p=Path('/opt/gsa-tv/ai-worker/ai_worker.mjs')
s=p.read_text(encoding='utf-8')
old=[x for x in s.splitlines() if x.startswith('const FISH_API_KEY = ')]
if len(old)!=1: raise SystemExit('unexpected FISH_API_KEY declaration count')
replacement="""const FISH_VAULT_PATH = '/home/opc/gsa-ai/secrets/fish-production.enc.json';
function loadFishApiKey() {
  const v = JSON.parse(fs.readFileSync(FISH_VAULT_PATH, 'utf8'));
  const key = Buffer.from(execSync('sudo docker exec gsa-tv-control-plane printenv GSA_TV_SECRET_KEY', { encoding: 'utf8' }).trim(), 'hex');
  const nonce = Buffer.from(v.nonce, 'base64url');
  const all = Buffer.from(v.ciphertext, 'base64url');
  const tag = all.subarray(-16), body = all.subarray(0, -16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAAD(Buffer.from(v.aad)); decipher.setAuthTag(tag);
  return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8')).api_key;
}
const FISH_API_KEY = loadFishApiKey();"""
s=s.replace(old[0],replacement,1)
if "from 'node:crypto'" not in s and 'from "node:crypto"' not in s:
    lines=s.splitlines()
    lines.insert(0,"import crypto from 'node:crypto';")
    s='\n'.join(lines)+'\n'
p.write_text(s,encoding='utf-8')
print('patched')
`;
const p64=Buffer.from(py).toString('base64');
const sh=String.raw`set -euo pipefail
f=/opt/gsa-tv/ai-worker/ai_worker.mjs
cp "$f" "$f.before-fish-vault-$(date +%Y%m%d-%H%M%S)"
printf '%s' '${p64}'|base64 -d >/tmp/patch-fish-worker.py
python3 /tmp/patch-fish-worker.py
rm -f /tmp/patch-fish-worker.py
node --check "$f"
test "$(grep -c 'sk-fish-' "$f" || true)" = 0
sudo systemctl restart gsa-ai-producer.service
sleep 3
systemctl is-active gsa-ai-producer.service
journalctl -u gsa-ai-producer.service --since '-10 seconds' --no-pager | tail -20 | sed -E 's/sk-fish-[A-Za-z0-9_-]+/[REDACTED]/g'
`;
const r=await runSshScript(sh,90000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
