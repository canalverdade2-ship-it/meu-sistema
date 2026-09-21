#!/bin/bash
echo "=== FILLER ==="
ls -la /opt/gsa-tv/cache/media/1/filler/
echo "=== SPECIALS ==="
ls -la /opt/gsa-tv/cache/media/1/specials/
echo "=== GSA-EM-FE-10MIN ==="
ls -la /opt/gsa-tv/cache/media/1/gsa-em-fe-10min/
echo "=== AUDIO ==="
ls -la /opt/gsa-tv/cache/media/1/audio/
find /opt/gsa-tv/cache/media/1/audio/ -maxdepth 3
echo "=== EDITORIAL ==="
ls -la /opt/gsa-tv/cache/media/1/editorial/
echo "=== IDENTITY ==="
ls -la /opt/gsa-tv/cache/media/1/identity/
exit 0
