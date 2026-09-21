#!/usr/bin/env bash
set -e
echo "=== IDENTITY & FILLER DIRECTORIES ==="
ls -la /opt/gsa-tv/cache/media/1/identity
ls -la /opt/gsa-tv/cache/media/1/identity/vinhetas || true
ls -la /opt/gsa-tv/cache/media/1/filler || true
ls -la /opt/gsa-tv/fallback || true

echo "=== ALL ROOT FILES IN /opt/gsa-tv/cache/media/1/ ==="
ls -lh /opt/gsa-tv/cache/media/1/ | grep -v '^d'

echo "=== NEWS DIRECTORY BREAKDOWN ==="
du -sh /opt/gsa-tv/cache/media/1/news/*
