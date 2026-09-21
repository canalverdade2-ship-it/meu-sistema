import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
body=$(mktemp)
trap 'rm -f "$body"' EXIT
curl -LfsS --max-time 20 -A 'Mozilla/5.0' 'https://www.youtube.com/watch?v=soeRG2L70ys' > "$body" || true
for p in isLiveNow isLiveContent isLive liveBroadcastDetails startTimestamp endTimestamp LIVE_STREAM_OFFLINE videoDetails playabilityStatus; do
  echo "--- $p"
  grep -o ".\\{0,80\\}$p.\\{0,160\\}" "$body" | head -n 4 || true
done
`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
