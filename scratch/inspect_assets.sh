sudo bash -s << 'EOF'
echo "=== IDENTITY FILES ==="
find /opt/gsa-tv/cache/media/1/identity -maxdepth 3 -type f -exec ls -lh {} +

echo ""
echo "=== FILLER FILES ==="
ls -lh /opt/gsa-tv/cache/media/1/filler/

echo ""
echo "=== FALLBACK FILES ==="
ls -lh /opt/gsa-tv/fallback/

echo ""
echo "=== PROGRAM MASTERS ==="
ls -lh /opt/gsa-tv/cache/media/1/program-masters/

echo ""
echo "=== LIVE BADGE ==="
cat /opt/gsa-tv/runtime/gsa-tv-live-badge.txt
echo ""

echo "=== CHAMADAS IN /opt/gsa-tv/cache/media/1/ ==="
ls -lh /opt/gsa-tv/cache/media/1/media-gsa-chamada* /opt/gsa-tv/cache/media/1/GSA-TV-CHAMADA* /opt/gsa-tv/cache/media/1/media-7d79a725* 2>/dev/null

echo ""
echo "=== DUPLICATE OR LOOSE IN /opt/gsa-tv/cache/media/ ==="
ls -lh /opt/gsa-tv/cache/media/

echo ""
echo "=== INCOMING ==="
ls -lh /opt/gsa-tv/cache/media/1/incoming/

echo ""
echo "=== PRODUCTION & LIVE-RECORDINGS ==="
ls -lh /opt/gsa-tv/cache/media/1/production/
ls -lh /opt/gsa-tv/cache/media/1/live-recordings/

echo ""
echo "=== /home/opc/gsa-ai/work/ AND /home/opc/gsa-ai/editions/ ==="
ls -lh /home/opc/gsa-ai/work/ 2>/dev/null || echo "work not found"
ls -lh /home/opc/gsa-ai/editions/ 2>/dev/null || echo "editions not found"
EOF
