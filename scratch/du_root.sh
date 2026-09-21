#!/usr/bin/env bash
sudo du -h --max-depth=1 / 2>/dev/null | sort -rh | head -n 25
