#!/usr/bin/env bash
set -euo pipefail

BROLL_DIR="/opt/gsa-tv/cache/media/1/broll/biblico/raw"
SCRIPT_PATH="/opt/gsa-tv/bin/gsa-broll-pexels.sh"
MIN_VIDEOS=3
DOWNLOADED=0

mkdir -p "$BROLL_DIR"

echo "[GSA B-Roll] Categoria: biblico"
echo "[GSA B-Roll] Destino: $BROLL_DIR"
echo "[GSA B-Roll] Script instalado em: $SCRIPT_PATH"

validate_mp4() {
  local f="$1"
  local size
  size=$(stat -c%s "$f" 2>/dev/null || echo 0)
  if [[ "$size" -lt 100000 ]]; then
    echo "[FALHA] $f muito pequeno ($size bytes)"
    rm -f "$f"
    return 1
  fi
  local codec
  codec=$(ffprobe -v quiet -select_streams v:0 \
    -show_entries stream=codec_name -of csv=p=0 "$f" 2>/dev/null | head -1 || true)
  if [[ -n "$codec" ]]; then
    echo "[OK] $f ($size bytes, codec=$codec)"
    return 0
  else
    echo "[INVALIDO] $f sem stream de video"
    rm -f "$f"
    return 1
  fi
}

search_and_download() {
  local query="$1"
  echo ""
  echo "[GSA B-Roll] Buscando: $query"
  local search_json
  search_json=$(curl -fsSL --max-time 30 \
    "https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier&sort[]=downloads+desc&rows=20&output=json" \
    2>/dev/null || echo '{"response":{"docs":[]}}')

  local identifiers
  identifiers=$(python3 - <<PYEOF
import json, sys
try:
    data = json.loads("""$search_json""")
    docs = data.get('response', {}).get('docs', [])
    for d in docs[:20]:
        if 'identifier' in d:
            print(d['identifier'])
except:
    pass
PYEOF
2>/dev/null || true)

  for IDENT in $identifiers; do
    [[ $DOWNLOADED -ge $MIN_VIDEOS ]] && return 0
    [[ -z "$IDENT" ]] && continue

    local files_json
    files_json=$(curl -fsSL --max-time 15 "https://archive.org/metadata/$IDENT/files" 2>/dev/null \
      || echo '{"result":[]}')

    local mp4_name
    mp4_name=$(python3 - <<PYEOF2
import json
try:
    data = json.loads("""$files_json""")
    for f in data.get('result', []):
        n = f.get('name', '')
        sz = int(f.get('size', '0') or 0)
        if n.lower().endswith('.mp4') and sz > 1000000:
            print(n)
            break
except:
    pass
PYEOF2
2>/dev/null || true)

    if [[ -n "$mp4_name" ]]; then
      local safe_id="${IDENT//\//_}"
      local outfile="$BROLL_DIR/${safe_id}.mp4"
      if [[ -f "$outfile" ]]; then
        validate_mp4 "$outfile" && DOWNLOADED=$((DOWNLOADED+1)) && continue
      fi
      local dl_url="https://archive.org/download/$IDENT/$mp4_name"
      echo "[GSA B-Roll] Download: $dl_url"
      if curl -fsSL --max-time 300 -o "$outfile" "$dl_url" 2>/dev/null \
         && validate_mp4 "$outfile"; then
        DOWNLOADED=$((DOWNLOADED+1))
        echo "[GSA B-Roll] Progresso: $DOWNLOADED/$MIN_VIDEOS"
      fi
    fi
  done
}

# Busca 1: conteudo biblico historico
search_and_download "subject%3Aancient+AND+subject%3Aisrael+AND+mediatype%3Amovies"

# Busca 2: se ainda faltam
if [[ $DOWNLOADED -lt $MIN_VIDEOS ]]; then
  search_and_download "subject%3Aholy+AND+subject%3Abible+AND+mediatype%3Amovies"
fi

# Busca 3: deserto antigo
if [[ $DOWNLOADED -lt $MIN_VIDEOS ]]; then
  search_and_download "subject%3Aterrestrial%3Adesert+AND+mediatype%3Amovies"
fi

# Busca 4: lista curada
if [[ $DOWNLOADED -lt $MIN_VIDEOS ]]; then
  echo ""
  echo "[GSA B-Roll] Tentando items curados..."
  for CID in "TheLifeOfChristInArt" "TheBible1959" "BibleStoriesOldTestament" "JerusalemHolyLand" "DesertSunset"; do
    [[ $DOWNLOADED -ge $MIN_VIDEOS ]] && break
    files_json=$(curl -fsSL --max-time 15 "https://archive.org/metadata/$CID/files" 2>/dev/null || echo '{"result":[]}')
    mp4_name=$(python3 - <<PYEOF3
import json
try:
    data = json.loads("""$files_json""")
    for f in data.get('result', []):
        n=f.get('name',''); sz=int(f.get('size','0') or 0)
        if n.lower().endswith('.mp4') and sz>500000:
            print(n); break
except: pass
PYEOF3
2>/dev/null || true)
    if [[ -n "$mp4_name" ]]; then
      OUT="$BROLL_DIR/${CID}.mp4"
      URL="https://archive.org/download/$CID/$mp4_name"
      curl -fsSL --max-time 300 -o "$OUT" "$URL" 2>/dev/null \
        && validate_mp4 "$OUT" && DOWNLOADED=$((DOWNLOADED+1)) || true
    fi
  done
fi

echo ""
echo "=== RESULTADO FINAL ==="
echo "Videos validos: $DOWNLOADED"
ls -lah "$BROLL_DIR/"

echo ""
echo "=== Validacao ffprobe ==="
for f in "$BROLL_DIR"/*.mp4; do
  [[ -f "$f" ]] || continue
  codec=$(ffprobe -v quiet -select_streams v:0 \
    -show_entries stream=codec_name,duration -of csv=p=0 "$f" 2>/dev/null | head -1 || echo "error")
  echo "  $(basename "$f"): $codec"
done

if [[ $DOWNLOADED -ge $MIN_VIDEOS ]]; then
  echo "[GSA B-Roll] SUCESSO: $DOWNLOADED videos validos"
  exit 0
else
  echo "[GSA B-Roll] ATENCAO: apenas $DOWNLOADED videos"
  exit 1
fi
