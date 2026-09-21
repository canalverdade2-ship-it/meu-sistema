sudo chmod 775 /opt/gsa-tv/runtime
sudo touch /opt/gsa-tv/runtime/gsa-tv-live-ticker.txt /opt/gsa-tv/runtime/gsa-tv-ticker.txt
sudo chmod 666 /opt/gsa-tv/runtime/gsa-tv-*.txt 2>/dev/null || true

sudo cp /tmp/gsa-live-ticker.mjs /opt/gsa-tv/bin/gsa-live-ticker.mjs
sudo chown opc:opc /opt/gsa-tv/bin/gsa-live-ticker.mjs
sudo chmod 755 /opt/gsa-tv/bin/gsa-live-ticker.mjs

cat << 'EOF' | sudo tee /etc/systemd/system/gsa-live-ticker.service > /dev/null
[Unit]
Description=GSA TV Live Ticker Dinâmico de Cotações e Notícias
After=network.target docker.service

[Service]
Type=oneshot
User=opc
Group=docker
ExecStart=/opt/gsa-tv/bin/gsa-live-ticker.mjs
StandardOutput=journal
StandardError=journal
EOF

cat << 'EOF' | sudo tee /etc/systemd/system/gsa-live-ticker.timer > /dev/null
[Unit]
Description=Timer do Live Ticker Dinâmico GSA TV (a cada 60 segundos)

[Timer]
OnBootSec=1min
OnUnitActiveSec=60s
AccuracySec=1s

[Install]
WantedBy=timers.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now gsa-live-ticker.timer
sudo systemctl start gsa-live-ticker.service
sudo systemctl status gsa-live-ticker.service --no-pager
systemctl list-timers gsa-live-ticker.timer --no-pager
