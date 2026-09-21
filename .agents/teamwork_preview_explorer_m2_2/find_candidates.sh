#!/bin/bash
echo "=== SEARCHING FOR MATCHING MEDIA FILES ==="
find /opt/gsa-tv /home/opc -type f \( -iname "*fe*" -o -iname "*music*" -o -iname "*louvor*" -o -iname "*pipoca*" -o -iname "*desenho*" -o -iname "*continuidade*" -o -iname "*filler*" \) \( -iname "*.mp4" -o -iname "*.mkv" -o -iname "*.mov" \) 2>/dev/null
