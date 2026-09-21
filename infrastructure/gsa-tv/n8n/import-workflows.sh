#!/usr/bin/env bash
set -euo pipefail
N8N_CONTAINER="${N8N_CONTAINER:-n8n}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKFLOW_DIR="${GSA_TV_N8N_WORKFLOW_DIR:-${SCRIPT_DIR}/workflows}"
REMOTE_DIR="/tmp/gsa-tv-workflows-import"

test -d "$WORKFLOW_DIR"
docker inspect "$N8N_CONTAINER" >/dev/null
docker exec "$N8N_CONTAINER" sh -lc "rm -rf '$REMOTE_DIR' && mkdir -p '$REMOTE_DIR'"
docker cp "$WORKFLOW_DIR/." "$N8N_CONTAINER:$REMOTE_DIR/"

for file in "$WORKFLOW_DIR"/*.json; do
  base="$(basename "$file")"
  name="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1],encoding="utf-8"))["name"])' "$file")"
  docker exec "$N8N_CONTAINER" n8n import:workflow --input="$REMOTE_DIR/$base"
  workflow_id="$(docker exec "$N8N_CONTAINER" n8n list:workflow 2>/dev/null | awk -F'|' -v n="$name" '$2==n&&!f{id=$1;f=1}END{if(f)print id}')"
  test -n "$workflow_id"
  docker exec "$N8N_CONTAINER" n8n publish:workflow --id="$workflow_id"
  echo "updated|$workflow_id|$name"
done
