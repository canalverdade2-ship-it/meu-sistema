import { runSshScript } from './ssh2-run.mjs';

const result = await runSshScript(`set -u
for id in RqX4IJXdbGQ soeRG2L70ys; do
  body=$(curl -LfsS --max-time 15 -A 'Mozilla/5.0' "https://www.youtube.com/watch?v=$id" || true)
  title=$(printf '%s' "$body" | grep -o '"title":"[^"]*"' | head -n 1 | cut -c1-180)
  live_now=$(printf '%s' "$body" | grep -o '"isLiveNow":[a-z]*' | sort -u | tr '\n' ',')
  offline=$(printf '%s' "$body" | grep -o 'LIVE_STREAM_OFFLINE' | head -n 1)
  playability=$(printf '%s' "$body" | grep -o '"status":"[A-Z_]*"' | sort -u | head -n 5 | tr '\n' ',')
  bytes=$(printf '%s' "$body" | wc -c)
  [ -n "$offline" ] || offline=no
  echo "$id|bytes=$bytes|$live_now|offline=$offline|$playability|$title"
done
`, 30000);
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
