#!/usr/bin/env bash
python3 - <<'EOF'
import edge_tts, inspect
print("edge_tts file:", edge_tts.__file__)
import aiohttp
print("aiohttp file:", aiohttp.__file__)
EOF
