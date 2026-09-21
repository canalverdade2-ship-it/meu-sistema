#!/usr/bin/env bash
echo "=== HOST TOOLS ==="
which edge-tts || true
python3 -c "import edge_tts; print('edge_tts installed on host')" 2>/dev/null || echo "no edge_tts on host"

echo "=== CONTAINER TOOLS ==="
docker exec -i gsa-tv-control-plane which edge-tts || true
docker exec -i gsa-tv-control-plane python3 -c "import edge_tts; print('edge_tts installed in container')" 2>/dev/null || echo "no edge_tts in container"
