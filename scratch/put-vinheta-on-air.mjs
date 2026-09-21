import { runSshScript } from './ssh2-run.mjs';

const remoteScript = `
cat << 'EOF' > /tmp/play-vinheta-now.py
import json, urllib.request, datetime

PLAYLIST_PATH = '/opt/gsa-tv/playlists/1/2026-09-11.json'
VINHETA_PATH = '/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4'
VINHETA_DUR = 40.0

with open(PLAYLIST_PATH, 'r', encoding='utf-8') as f:
    playlist = json.load(f)

# Hora atual BRT
now_utc = datetime.datetime.now(datetime.timezone.utc)
now_brt = now_utc.astimezone(datetime.timezone(datetime.timedelta(hours=-3)))
now_sec = now_brt.hour * 3600 + now_brt.minute * 60 + now_brt.second

print(f"[VinhetaLoop] Hora atual BRT: {now_brt.strftime('%H:%M:%S')} ({now_sec}s)")

items = []
accumulated = 0.0

for it in playlist['program']:
    dur = float(it['duration'])
    if accumulated + dur < now_sec - 5:
        items.append(it)
        accumulated += dur
    else:
        break

remaining = 86400.0 - accumulated
print(f"[VinhetaLoop] Preenchendo {remaining:.2f}s com a nova vinheta oficial de {VINHETA_DUR}s...")

while remaining > 0:
    chunk = min(remaining, VINHETA_DUR)
    items.append({
        "in": 0,
        "out": round(chunk, 3),
        "duration": round(chunk, 3),
        "source": VINHETA_PATH,
        "title": "GSA TV — Nova Vinheta Oficial do Canal"
    })
    remaining -= chunk
    accumulated += chunk

playlist['program'] = items

with open(PLAYLIST_PATH, 'w', encoding='utf-8') as f:
    json.dump(playlist, f, ensure_ascii=False, indent=2)

print(f"[VinhetaLoop] Playlist salva. Total itens: {len(items)}, Duracao: {accumulated:.2f}s")

# ffplayout API update
with open('/opt/gsa-tv/control-plane/secrets/ffplayout-admin-password') as f:
    pw = f.read().strip()

login_req = urllib.request.Request(
    'http://127.0.0.1:8787/auth/login',
    data=json.dumps({"username": "admin", "password": pw}).encode(),
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(login_req) as resp:
    token = json.loads(resp.read().decode())['access']

req = urllib.request.Request(
    'http://127.0.0.1:8787/api/playlist/1',
    data=json.dumps(playlist).encode('utf-8'),
    headers={
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    },
    method='POST'
)
with urllib.request.urlopen(req) as resp:
    print("[VinhetaLoop] API update:", resp.read().decode())

restart_req = urllib.request.Request(
    'http://127.0.0.1:8787/api/control/1/process',
    data=json.dumps({"command": "restart"}).encode(),
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)
with urllib.request.urlopen(restart_req) as resp:
    print("[VinhetaLoop] API restart:", resp.read().decode())

print("[VinhetaLoop] Nova Vinheta Oficial do Canal colocada no ar com sucesso!")
EOF
python3 /tmp/play-vinheta-now.py
`;

const res = await runSshScript(remoteScript, 30000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
