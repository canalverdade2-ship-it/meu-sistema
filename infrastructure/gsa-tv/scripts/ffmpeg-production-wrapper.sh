#!/usr/bin/env bash
set -euo pipefail
# Preserve the existing CPU isolation and tag only this factory's render containers.
args=(run --rm --net host --cpuset-cpus 2,3 --cpus 1.5 --cpu-shares 128 --blkio-weight 100 --label gsa.role=render)
if [[ "${GSA_PRODUCTION_OWNER:-}" == night-factory ]]; then
  args+=(--label gsa.production.owner=night-factory)
fi
args+=(--user "$(id -u):$(id -g)" --group-add 986 -v /opt:/opt -v /home:/home -v /tmp:/tmp)
# Forward stdin only for an explicit media pipe, so ordinary invocations cannot
# consume the remaining commands of their caller's shell script.
previous=''
for value in "$@"; do
  if [[ "$previous" == -i && ( "$value" == - || "$value" == pipe:0 || "$value" == pipe: || "$value" == /dev/stdin ) ]]; then
    args+=(-i)
    break
  fi
  previous="$value"
done
if [[ "$PWD" != / && "$PWD" != /opt && "$PWD" != /home && "$PWD" != /tmp ]]; then
  args+=(-v "$PWD:$PWD")
fi
exec docker "${args[@]}" -w "$PWD" gsa-tv/control-plane:1.8.7 ffmpeg -nostdin "$@"
