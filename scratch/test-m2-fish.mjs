import { runSshScript } from './ssh2-run.mjs';

const pyScript = `python3 - << 'EOF'
import base64, json, os, subprocess, time
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import requests

VAULT_PATH = Path('/home/opc/gsa-ai/secrets/fish-production.enc.json')
BASE = Path('/home/opc/gsa-program-builder')
IMAGE = 'gsa-tv/control-plane:1.7.9'

def load_fish_api_key() -> str:
    if not VAULT_PATH.is_file():
        raise FileNotFoundError(f'Cofre ausente: {VAULT_PATH}')
    hex_key = os.environ.get('GSA_TV_SECRET_KEY')
    if not hex_key:
        proc = subprocess.run(
            ['sudo', 'docker', 'exec', 'gsa-tv-control-plane', 'printenv', 'GSA_TV_SECRET_KEY'],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True
        )
        hex_key = proc.stdout.strip()
    key_bytes = bytes.fromhex(hex_key)
    vault_data = json.loads(VAULT_PATH.read_text(encoding='utf-8'))
    def b64url_decode(s: str) -> bytes:
        return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))
    nonce = b64url_decode(vault_data['nonce'])
    ciphertext = b64url_decode(vault_data['ciphertext'])
    aad = vault_data['aad'].encode('utf-8')
    aesgcm = AESGCM(key_bytes)
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, aad)
    decrypted_json = json.loads(decrypted_bytes.decode('utf-8'))
    return decrypted_json['api_key']

def docker_prefix(cpus='1.0'):
    return ['nice', '-n', '15', 'ionice', '-c', '3', 'docker', 'run', '--rm', '-i',
            '--cpus', str(cpus), '--cpu-shares', '128', '--user', '1000:1000', '-v', '/opt:/opt', '-v', '/home:/home',
            '-v', '/tmp:/tmp', '-w', str(BASE), IMAGE]

def run_tool(tool, args, cpus='1.0'):
    cmd = docker_prefix(cpus) + [tool] + list(args)
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

api_key = load_fish_api_key()
print('API key loaded.')

voice = "5c8a9b5d0b2549c7ada853529199ebe5"
model = "s2.1-pro-free"

for kind, text in [('presenting', 'Estamos apresentando GSA Agro.'), ('return', 'Estamos de volta GSA Agro.')]:
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'model': model
    }
    payload = {
        'text': text,
        'reference_id': voice,
        'format': 'mp3',
        'normalize': True,
        'latency': 'normal',
        'prosody': {'speed': 1.0, 'volume': 0, 'normalize_loudness': True}
    }
    t0 = time.time()
    resp = requests.post('https://api.fish.audio/v1/tts', headers=headers, json=payload, timeout=30)
    t1 = time.time()
    print(f'{kind}: HTTP {resp.status_code}, time {t1-t0:.2f}s, size {len(resp.content)} bytes')
    assert resp.status_code == 200

    raw_mp3 = Path(f'/tmp/test_agro_{kind}_raw.mp3')
    raw_mp3.write_bytes(resp.content)

    out_wav = Path(f'/tmp/test_agro_{kind}_conformed_5s.wav')
    filter_graph = (
        "[0:a]adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,"
        "afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]"
    )
    args = [
        '-y', '-i', str(raw_mp3),
        '-filter_complex', filter_graph,
        '-map', '[a]',
        '-ac', '2',
        '-ar', '48000',
        '-c:a', 'pcm_s16le',
        str(out_wav)
    ]
    p = run_tool('ffmpeg', args)
    print(f'{kind}: FFmpeg exit {p.returncode}, wav size {out_wav.stat().st_size} bytes')
    p_probe = run_tool('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=sample_rate,channels', '-of', 'json', str(out_wav)], cpus='0.5')
    print(f'{kind}: Probe: {p_probe.stdout.strip()}')


EOF
`;

async function main() {
  const r = await runSshScript(pyScript);
  console.log('STDOUT:\n' + r.stdout);
  console.log('STDERR:\n' + r.stderr);
}

main().catch(console.error);

