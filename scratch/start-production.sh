#!/bin/bash
LOG="/opt/gsa-tv/runtime/production/2026-09-15-execution.log"
nohup sudo --preserve-env=PATH python3 /opt/gsa-tv/bin/night-production.py --force >> "$LOG" 2>&1 &
echo "Started PID: $!"
echo "Log: $LOG"
