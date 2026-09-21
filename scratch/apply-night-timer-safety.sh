set -eu
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for unit in gsa-tv-signoff gsa-tv-night-stop gsa-tv-morning-start; do
  sudo systemctl is-enabled "$unit.timer"
  sudo install -d -m 755 "/etc/systemd/system/$unit.timer.d"
  target="/etc/systemd/system/$unit.timer.d/90-gsa-window-safety.conf"
  if sudo test -f "$target"; then sudo cp -p "$target" "$target.bak-$stamp"; fi
  sudo install -m 644 /home/opc/gsa-ai/work/gsa-night-timer-safety.conf "$target"
done
sudo systemctl daemon-reload
for unit in gsa-tv-signoff gsa-tv-night-stop gsa-tv-morning-start; do
  sudo systemctl restart "$unit.timer"
  sudo systemctl show "$unit.timer" -p ActiveState -p AccuracyUSec -p RandomizedDelayUSec -p Persistent -p NextElapseUSecRealtime -p LastTriggerUSec
done
