#!/usr/bin/env bash
sudo chmod 755 /opt/gsa-tv/bin/daily-scripts.py
ls -l /opt/gsa-tv/bin/daily-scripts.py
python3 /opt/gsa-tv/bin/daily-scripts.py 2026-09-15
echo "Return code: $?"
