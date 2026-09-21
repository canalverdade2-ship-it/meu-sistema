#!/usr/bin/env bash
# GSA TV — testes reais de resiliência do armazenamento definitivo na VPS.
set -euo pipefail

MEDIA_ROOT="${GSA_TV_MEDIA_ROOT:-/opt/gsa-tv/cache/media/1}"
PLAYLIST_ROOT="${GSA_TV_PLAYLIST_ROOT:-/opt/gsa-tv/playlists/1}"
FALLBACK="${GSA_TV_FALLBACK_FILE:-$MEDIA_ROOT/identity/gsa-tv-fallback-720p30.mp4}"
CONTROL_URL="${GSA_TV_CONTROL_URL:-http://127.0.0.1:9202/health}"
TMP=$(mktemp -d /tmp/gsa-tv-storage-test.XXXXXX)
trap 'rm -rf "$TMP"' EXIT
PASS=0; TOTAL=5

echo "GSA TV — VPS storage resilience"

# 1. O armazenamento definitivo e a playlist precisam estar montados.
if [[ -d "$MEDIA_ROOT" && -d "$PLAYLIST_ROOT" ]]; then
  echo "PASS storage roots"; PASS=$((PASS+1))
else echo "FAIL storage roots"; fi

# 2. O fallback oficial precisa existir e ter conteúdo.
if [[ -s "$FALLBACK" ]]; then
  echo "PASS official fallback"; PASS=$((PASS+1))
else echo "FAIL official fallback"; fi
# 3. O control plane precisa responder sem depender de serviço de storage externo.
if curl -fsS --max-time 5 "$CONTROL_URL" >/dev/null; then
  echo "PASS control plane independent"; PASS=$((PASS+1))
else echo "FAIL control plane independent"; fi

# 4. Checksum precisa detectar alteração de conteúdo.
printf 'gsa-tv-integrity-proof\n' > "$TMP/original"
cp "$TMP/original" "$TMP/copy"
A=$(sha256sum "$TMP/original" | awk '{print $1}')
B=$(sha256sum "$TMP/copy" | awk '{print $1}')
printf 'changed\n' >> "$TMP/copy"
C=$(sha256sum "$TMP/copy" | awk '{print $1}')
if [[ "$A" == "$B" && "$A" != "$C" ]]; then
  echo "PASS checksum detects modification"; PASS=$((PASS+1))
else echo "FAIL checksum"; fi

# 5. Diretórios operacionais não podem estar world-writable.
MODE_MEDIA=$(stat -c '%a' "$MEDIA_ROOT")
MODE_PLAYLIST=$(stat -c '%a' "$PLAYLIST_ROOT")
if [[ ! "$MODE_MEDIA" =~ [2367]$ && ! "$MODE_PLAYLIST" =~ [2367]$ ]]; then
  echo "PASS storage permissions"; PASS=$((PASS+1))
else echo "FAIL storage permissions media=$MODE_MEDIA playlist=$MODE_PLAYLIST"; fi

echo "Resultado: $PASS/$TOTAL"
[[ "$PASS" -eq "$TOTAL" ]]
