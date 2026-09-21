#!/usr/bin/env bash
set -euo pipefail
# Compatibility entry point: systemd owns the process and its cleanup policy.
exec systemctl start gsa-tv-night-factory.service
