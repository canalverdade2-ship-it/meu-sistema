import { runSshScript } from '../../scratch/ssh2-run.mjs';

async function main() {
  const script = `
echo "=== VPS DATE / TIME ==="
date
date -u
python3 -c "import datetime as dt; from zoneinfo import ZoneInfo; tz = ZoneInfo('America/Sao_Paulo'); print('America/Sao_Paulo:', dt.datetime.now(tz))"

echo "=== CHECK RUNNING NIGHT-PRODUCTION ==="
ps -ef | grep night-production

echo "=== CHECK CRON OR SYSTEMD FOR NIGHT PRODUCTION ==="
crontab -l 2>/dev/null || true
sudo crontab -l 2>/dev/null || true
systemctl list-timers 2>/dev/null | grep -i gsa || true
systemctl list-units 2>/dev/null | grep -i -E "gsa|night|prod" || true

echo "=== CHECK 2026-09-14 vs 2026-09-15 FILES IN RUNTIME ==="
ls -lat /opt/gsa-tv/runtime/production/
`;

  try {
    const res = await runSshScript(script);
    console.log(res.stdout);
    if (res.stderr) console.error("STDERR:", res.stderr);
  } catch (err) {
    console.error("ERROR:", err);
  }
}

main();
