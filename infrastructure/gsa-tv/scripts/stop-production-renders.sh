#!/usr/bin/env bash
set -euo pipefail
# No generic ffmpeg kill: touch only containers launched by this factory.
mapfile -t ids < <(docker ps -q --filter label=gsa.production.owner=night-factory)
if ((${#ids[@]})); then
  docker stop --time 10 "${ids[@]}" >/dev/null
fi
