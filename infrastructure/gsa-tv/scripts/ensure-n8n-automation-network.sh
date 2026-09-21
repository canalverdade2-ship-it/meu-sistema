#!/usr/bin/env bash
set -euo pipefail
NETWORK="${GSA_TV_AUTOMATION_NETWORK:-gsa-tv-automation-net}"
SUBNET="${GSA_TV_AUTOMATION_SUBNET:-172.30.250.0/29}"
GATEWAY="${GSA_TV_AUTOMATION_GATEWAY:-172.30.250.1}"
N8N_CONTAINER="${GSA_TV_N8N_CONTAINER:-n8n}"
N8N_IP="${GSA_TV_N8N_IP:-172.30.250.2}"

if ! docker network inspect "$NETWORK" >/dev/null 2>&1; then
  docker network create --driver bridge --subnet "$SUBNET" --gateway "$GATEWAY" "$NETWORK" >/dev/null
fi

if ! docker inspect "$N8N_CONTAINER" >/dev/null 2>&1; then
  echo "n8n container not found: $N8N_CONTAINER" >&2
  exit 1
fi

current="$(docker inspect "$N8N_CONTAINER" --format "{{with index .NetworkSettings.Networks \"$NETWORK\"}}{{.IPAddress}}{{end}}")"
if [[ -z "$current" ]]; then
  docker network connect --ip "$N8N_IP" "$NETWORK" "$N8N_CONTAINER"
elif [[ "$current" != "$N8N_IP" ]]; then
  echo "unexpected n8n IP on $NETWORK: $current" >&2
  exit 1
fi

echo "$NETWORK:$N8N_IP"
