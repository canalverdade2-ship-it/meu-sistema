import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    echo "=== PROCESS GUARDIAN SCRIPT ==="
    cat /opt/gsa-tv/bin/gsa-process-guardian.sh || true

    echo "=== PROCESS GUARDIAN SERVICE ==="
    cat /etc/systemd/system/gsa-process-guardian.service || true

    echo "=== PROCESS GUARDIAN TIMER ==="
    cat /etc/systemd/system/gsa-process-guardian.timer || true

    echo "=== TIMER STATUS ==="
    systemctl status gsa-process-guardian.timer --no-pager || true

    echo "=== SERVICE STATUS ==="
    systemctl status gsa-process-guardian.service --no-pager || true

    echo "=== RECENT GUARDIAN LOGS ==="
    tail -n 25 /var/log/gsa-process-guardian.log || true
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
