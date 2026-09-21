#!/usr/bin/env bash
set -e
echo "=== SUBDIRECTORIES OF /opt/gsa-tv/cache/media/1/ ==="
find /opt/gsa-tv/cache/media/1/ -maxdepth 2 -type d

echo "=== MEDIA SUMMARY BY SUBDIRECTORY ==="
for dir in /opt/gsa-tv/cache/media/1/*; do
  if [ -d "$dir" ]; then
    echo "--- $dir ---"
    du -sh "$dir"
    ls -la "$dir"
  fi
done
