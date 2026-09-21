#!/usr/bin/env bash
echo "=== /opt breakdown ==="
sudo du -h --max-depth=2 /opt 2>/dev/null | sort -rh | head -n 25

echo "=== /var breakdown ==="
sudo du -h --max-depth=2 /var 2>/dev/null | sort -rh | head -n 25

echo "=== /opt/gsa-tv breakdown ==="
sudo du -h --max-depth=2 /opt/gsa-tv 2>/dev/null | sort -rh | head -n 25
