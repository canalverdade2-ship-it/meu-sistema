import { execSync } from 'child_process';
import fs from 'fs';

const bashScript = `#!/bin/bash
MODE=$1
TOKEN="e54c08df5a3b42c2967395833b9c7104b3c9e0cb5e0f6c67f8277e5ea2895b0b"
URL="http://127.0.0.1:9210/v1"

if [ "$MODE" = "signoff" ]; then
    echo "Encerrando transmissao (signoff)..."
    # The playlist handles the 23:50 slot, we ensure mode is program
    curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"mode":"program"}' "$URL/ensure"
elif [ "$MODE" = "stop" ]; then
    echo "Parando RTMP (stop)..."
    curl -s -X POST -H "Authorization: Bearer $TOKEN" "$URL/stop"
elif [ "$MODE" = "start" ]; then
    echo "Iniciando RTMP (start)..."
    curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"mode":"program"}' "$URL/ensure"
else
    echo "Usage: \\$0 {signoff|stop|start}"
    exit 1
fi
`;

const b64 = Buffer.from(bashScript).toString('base64');

const installer = `cat << 'EOF' | sudo bash
mkdir -p /opt/gsa-tv/bin
echo "${b64}" | base64 -d > /opt/gsa-tv/bin/gsa-tv-night-controller.sh
chmod +x /opt/gsa-tv/bin/gsa-tv-night-controller.sh

cat > /etc/systemd/system/gsa-tv-signoff.service << 'SRV1'
[Unit]
Description=GSA TV Signoff

[Service]
Type=oneshot
ExecStart=/opt/gsa-tv/bin/gsa-tv-night-controller.sh signoff
SRV1

cat > /etc/systemd/system/gsa-tv-signoff.timer << 'TMR1'
[Unit]
Description=GSA TV Signoff Timer

[Timer]
OnCalendar=*-*-* 23:50:00 America/Sao_Paulo
Persistent=true

[Install]
WantedBy=timers.target
TMR1

cat > /etc/systemd/system/gsa-tv-night-stop.service << 'SRV2'
[Unit]
Description=GSA TV Night Stop

[Service]
Type=oneshot
ExecStart=/opt/gsa-tv/bin/gsa-tv-night-controller.sh stop
SRV2

cat > /etc/systemd/system/gsa-tv-night-stop.timer << 'TMR2'
[Unit]
Description=GSA TV Night Stop Timer

[Timer]
OnCalendar=*-*-* 23:59:00 America/Sao_Paulo
Persistent=true

[Install]
WantedBy=timers.target
TMR2

cat > /etc/systemd/system/gsa-tv-morning-start.service << 'SRV3'
[Unit]
Description=GSA TV Morning Start

[Service]
Type=oneshot
ExecStart=/opt/gsa-tv/bin/gsa-tv-night-controller.sh start
SRV3

cat > /etc/systemd/system/gsa-tv-morning-start.timer << 'TMR3'
[Unit]
Description=GSA TV Morning Start Timer

[Timer]
OnCalendar=*-*-* 06:00:00 America/Sao_Paulo
Persistent=true

[Install]
WantedBy=timers.target
TMR3

systemctl daemon-reload
systemctl enable --now gsa-tv-signoff.timer
systemctl enable --now gsa-tv-night-stop.timer
systemctl enable --now gsa-tv-morning-start.timer
echo "Timers enabled."
EOF
`;

fs.writeFileSync('scratch/deploy_night_controller.sh', installer);
execSync('node scratch/vps-exec.mjs -f scratch/deploy_night_controller.sh', { stdio: 'inherit' });
