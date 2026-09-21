#!/usr/bin/env bash
set -e
echo "=== LIST OF ALL MEDIA DIRECTORIES IN /opt/gsa-tv/cache/media/1 ==="
du -sh /opt/gsa-tv/cache/media/1/*

echo "=== CHECKING /home/opc/gsa-ai/ ==="
ls -la /home/opc/gsa-ai/work 2>/dev/null || true
ls -la /home/opc/gsa-ai/editions 2>/dev/null || true
du -sh /home/opc/gsa-ai/work /home/opc/gsa-ai/editions 2>/dev/null || true

echo "=== CHECKING /opt/gsa-tv/cache/media/1/productions ==="
du -sh /opt/gsa-tv/cache/media/1/productions/* 2>/dev/null || true
find /opt/gsa-tv/cache/media/1/productions -maxdepth 3 -ls 2>/dev/null || true

echo "=== CHECKING /opt/gsa-tv/cache/media/1/nature ==="
du -sh /opt/gsa-tv/cache/media/1/nature 2>/dev/null || true
ls -la /opt/gsa-tv/cache/media/1/nature/* 2>/dev/null || true

echo "=== CHECKING /opt/gsa-tv/cache/media/1/gsa-em-fe-10min ==="
du -sh /opt/gsa-tv/cache/media/1/gsa-em-fe-10min 2>/dev/null || true
ls -la /opt/gsa-tv/cache/media/1/gsa-em-fe-10min 2>/dev/null || true
