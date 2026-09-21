import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -Eeuo pipefail
sudo chmod 0600 /etc/nginx/ssl/api.147-15-43-141.nip.io.key /etc/nginx/ssl/api.key
for port in 3001 9999 4000 5000 5680 6379; do
  sudo firewall-cmd --permanent --remove-port="\${port}/tcp" >/dev/null || true
done
sudo firewall-cmd --reload >/dev/null
if ! sudo grep -q 'max-size:' /opt/gsa-tv/encoder-engine/compose.yml; then
  sudo cp /opt/gsa-tv/encoder-engine/compose.yml /opt/gsa-tv/encoder-engine/compose.yml.pre-hardening
  sudo sed -i '/    healthcheck:/i\    logging:\n      driver: json-file\n      options:\n        max-size: 10m\n        max-file: "5"' /opt/gsa-tv/encoder-engine/compose.yml
fi
sudo docker compose -f /opt/gsa-tv/encoder-engine/compose.yml config --quiet
echo 'firewall:'
sudo firewall-cmd --list-ports
echo 'permissions:'
sudo stat -c '%a %U:%G %n' /etc/nginx/ssl/*.key /opt/gsa-tv/control-plane/secrets/ffplayout-admin-password /opt/gsa-tv/watchdog/secrets/ffplayout-admin-password
echo 'engine-compose-log-rotation:'
sudo grep -A5 -B1 'logging:' /opt/gsa-tv/encoder-engine/compose.yml
`, 180000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
