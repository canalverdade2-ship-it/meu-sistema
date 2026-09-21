#!/usr/bin/env bash
set -euo pipefail

echo "=== [R3] Deploy do script gsa-broll-pexels.sh para a VPS ==="

SCRIPT_PATH="/opt/gsa-tv/bin/gsa-broll-pexels.sh"
BROLL_DIR="/opt/gsa-tv/cache/media/1/broll/biblico/raw"

# Grava o script Python wrapper como o arquivo canonico .sh
cat > "$SCRIPT_PATH" << 'SCRIPT_EOF'
#!/usr/bin/env bash
# gsa-broll-pexels.sh — wrapper que chama o downloader Python
exec python3 /opt/gsa-tv/bin/gsa-broll-pexels.py "$@"
SCRIPT_EOF
chmod +x "$SCRIPT_PATH"

# Grava o script Python
cat > /opt/gsa-tv/bin/gsa-broll-pexels.py << 'PYEOF'
#!/usr/bin/env python3
"""
gsa-broll-pexels.py
Downloads biblical b-roll from Internet Archive (public domain / CC).
Validates with ffprobe. No Gemini API or Google AI.
"""
import subprocess, urllib.request, urllib.parse, json, os, sys, shutil

BROLL_DIR = "/opt/gsa-tv/cache/media/1/broll/biblico/raw"
MIN_VIDEOS = 3

os.makedirs(BROLL_DIR, exist_ok=True)
print(f"[GSA B-Roll] Destino: {BROLL_DIR}")

def fetch_json(url, timeout=30):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'GSA-TV-BRoll/1.0'})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read())
    except Exception as e:
        print(f"[FETCH ERR] {url}: {e}")
        return {}

def validate_mp4(path):
    size = os.path.getsize(path) if os.path.exists(path) else 0
    if size < 100_000:
        print(f"[INVALIDO] muito pequeno ({size} bytes): {os.path.basename(path)}")
        os.remove(path)
        return False
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-select_streams', 'v:0',
             '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', path],
            capture_output=True, text=True, timeout=30)
        codec = result.stdout.strip()
        if codec:
            print(f"[OK] {os.path.basename(path)} ({size:,} bytes, codec={codec})")
            return True
        else:
            print(f"[INVALIDO] sem stream de video: {os.path.basename(path)}")
            os.remove(path)
            return False
    except Exception as e:
        print(f"[FFPROBE ERR] {path}: {e}")
        if os.path.exists(path): os.remove(path)
        return False

def download_file(url, outpath):
    print(f"[DL] {url}")
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'GSA-TV-BRoll/1.0'})
        with urllib.request.urlopen(req, timeout=300) as r, open(outpath, 'wb') as f:
            shutil.copyfileobj(r, f)
        return True
    except Exception as e:
        print(f"[DL ERR] {url}: {e}")
        if os.path.exists(outpath): os.remove(outpath)
        return False

def search_archive(query, downloaded):
    base = "https://archive.org/advancedsearch.php"
    params = f"q={urllib.parse.quote(query)}&fl[]=identifier&sort[]=downloads+desc&rows=20&output=json"
    print(f"\n[GSA B-Roll] Busca: {query[:60]}")
    data = fetch_json(f"{base}?{params}")
    docs = data.get('response', {}).get('docs', [])
    print(f"[GSA B-Roll] {len(docs)} resultados")

    for doc in docs:
        if downloaded >= MIN_VIDEOS:
            break
        ident = doc.get('identifier', '')
        if not ident:
            continue
        files_data = fetch_json(f"https://archive.org/metadata/{ident}/files", timeout=15)
        mp4_file = None
        for f in files_data.get('result', []):
            name = f.get('name', '')
            size = int(f.get('size', '0') or 0)
            if name.lower().endswith('.mp4') and size > 1_000_000:
                mp4_file = name
                break
        if mp4_file:
            safe_id = ident.replace('/', '_')
            outfile = os.path.join(BROLL_DIR, f"{safe_id}.mp4")
            if os.path.exists(outfile) and validate_mp4(outfile):
                downloaded += 1
                continue
            url = f"https://archive.org/download/{ident}/{mp4_file}"
            if download_file(url, outfile) and validate_mp4(outfile):
                downloaded += 1
                print(f"[GSA B-Roll] Progresso: {downloaded}/{MIN_VIDEOS}")
    return downloaded

# Conta arquivos existentes validos (exceto archive_video.mp4 original)
downloaded = 0
for fname in os.listdir(BROLL_DIR):
    if not fname.endswith('.mp4'):
        continue
    p = os.path.join(BROLL_DIR, fname)
    if fname == 'archive_video.mp4':
        # Valida o existente
        if validate_mp4(p):
            downloaded += 1
            print(f"[EXISTENTE] {fname}")
    else:
        if os.path.exists(p) and validate_mp4(p):
            downloaded += 1
            print(f"[EXISTENTE] {fname}")

if downloaded < MIN_VIDEOS:
    downloaded = search_archive("subject:ancient AND subject:israel AND mediatype:movies", downloaded)
if downloaded < MIN_VIDEOS:
    downloaded = search_archive("subject:holy AND subject:bible AND mediatype:movies", downloaded)
if downloaded < MIN_VIDEOS:
    downloaded = search_archive("desert holy land ancient documentary mediatype:movies", downloaded)
if downloaded < MIN_VIDEOS:
    downloaded = search_archive("jerusalem documentary biblical mediatype:movies", downloaded)

print("\n=== RESULTADO FINAL ===")
print(f"Videos validos: {downloaded}")
print()

files = sorted(f for f in os.listdir(BROLL_DIR) if f.endswith('.mp4'))
for fname in files:
    p = os.path.join(BROLL_DIR, fname)
    size = os.path.getsize(p)
    print(f"  {fname}: {size:,} bytes")

print("\n=== Validacao ffprobe ===")
for fname in files:
    p = os.path.join(BROLL_DIR, fname)
    try:
        result = subprocess.run(
            ['ffprobe', '-v', 'quiet', '-print_format', 'json', '-show_streams', p],
            capture_output=True, text=True, timeout=30)
        data = json.loads(result.stdout)
        vs = [s for s in data.get('streams', []) if s.get('codec_type') == 'video']
        if vs:
            v = vs[0]
            dur = round(float(v.get('duration', 0)), 1)
            print(f"  {fname}: codec={v.get('codec_name','?')} dur={dur}s res={v.get('width','?')}x{v.get('height','?')}")
        else:
            print(f"  {fname}: NO_VIDEO_STREAM")
    except Exception as e:
        print(f"  {fname}: FFPROBE_ERROR ({e})")

if downloaded >= MIN_VIDEOS:
    print(f"\n[GSA B-Roll] SUCESSO: {downloaded} videos biblicos validos")
    sys.exit(0)
else:
    print(f"\n[GSA B-Roll] ATENCAO: apenas {downloaded}/{MIN_VIDEOS} videos")
    sys.exit(1)
PYEOF

chmod +x /opt/gsa-tv/bin/gsa-broll-pexels.py

echo ""
echo "Scripts instalados:"
ls -la /opt/gsa-tv/bin/gsa-broll-pexels.*

echo ""
echo "=== Executando downloader ==="
python3 /opt/gsa-tv/bin/gsa-broll-pexels.py
