import {runSshScript} from './ssh2-run.mjs';
const r=await runSshScript(`set -euo pipefail
SRC=/opt/gsa-tv/encoder-engine/src/app.js
sudo cp -a "$SRC" /opt/gsa-tv/audit-archive/encoder-engine-app.pre-pipe-$(date +%Y%m%d%H%M%S).js
sudo python3 - <<'PY'
from pathlib import Path
p=Path('/opt/gsa-tv/encoder-engine/src/app.js')
s=p.read_text()
s=s.replace(
'''function spawnTracked(kind, args) {
  const proc = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });''',
'''function wireProducer(proc = producer) {
  if (!alive(proc) || !alive(outer) || !proc.stdout || !outer.stdin) return;
  proc.stdout.unpipe();
  proc.stdout.pipe(outer.stdin, { end: false });
}
function spawnTracked(kind, args) {
  const stdio = kind === "outer" ? ["pipe", "ignore", "pipe"] : kind === "producer" ? ["ignore", "pipe", "pipe"] : ["ignore", "ignore", "pipe"];
  const proc = spawn("ffmpeg", args, { stdio });
  if (proc.stdin) proc.stdin.on("error", () => {});
  if (proc.stdout) proc.stdout.on("error", () => {});''')
s=s.replace(
'''            outer = spawnTracked("outer", lastOuterArgs);
            log("warn", "transport_restarted", { pid: outer.pid });''',
'''            outer = spawnTracked("outer", lastOuterArgs);
            wireProducer();
            log("warn", "transport_restarted", { pid: outer.pid });''')
s=s.replace(
'''  producer = spawnTracked("producer", fallbackProducerArgs());
  log("warn", "fallback_started", { pid: producer.pid });''',
'''  producer = spawnTracked("producer", fallbackProducerArgs());
  wireProducer();
  log("warn", "fallback_started", { pid: producer.pid });''')
s=s.replace(
'''  producer = spawnTracked("producer", lastProducerArgs);
  log("info", "desired_producer_retry", { pid: producer.pid });''',
'''  producer = spawnTracked("producer", lastProducerArgs);
  wireProducer();
  log("info", "desired_producer_retry", { pid: producer.pid });''')
s=s.replace(
'''  const destination = "[f=mpegts:mpegts_flags=+resend_headers+initial_discontinuity]udp://127.0.0.1:" + UDP_PORT + "?pkt_size=1316&buffer_size=16777216|[f=hls:hls_time=2:hls_list_size=5:hls_flags=delete_segments:hls_segment_filename=/runtime/hls/program_%03d.ts]/runtime/hls/program.m3u8";''',
'''  const destination = "[f=mpegts:mpegts_flags=+resend_headers+initial_discontinuity]pipe:1|[f=hls:hls_time=2:hls_list_size=5:hls_flags=delete_segments:hls_segment_filename=/runtime/hls/program_%03d.ts]/runtime/hls/program.m3u8";''')
s=s.replace(
'''    "-fflags", "+genpts+discardcorrupt", 
    "-thread_queue_size", "4096", "-i", \`udp://127.0.0.1:\${UDP_PORT}?fifo_size=10000000&overrun_nonfatal=1&buffer_size=16777216\`,''',
'''    "-fflags", "+genpts+discardcorrupt",
    "-thread_queue_size", "4096", "-i", "pipe:0",''')
s=s.replace(
'''    outer = spawnTracked("outer", outerArgs); outerFingerprint = nextOuter; transportRestarted = true;
    await new Promise((resolve) => setTimeout(resolve, 350));''',
'''    outer = spawnTracked("outer", outerArgs); outerFingerprint = nextOuter; transportRestarted = true;
    wireProducer();
    await new Promise((resolve) => setTimeout(resolve, 350));''')
s=s.replace(
'''    producer = spawnTracked("producer", producerArgs); producerFingerprint = nextProducer; producerRestarted = true;
  }''',
'''    producer = spawnTracked("producer", producerArgs); producerFingerprint = nextProducer; producerRestarted = true;
    wireProducer();
  }''')
required=['pipe:1','"-i", "pipe:0"','function wireProducer','proc.stdout.pipe(outer.stdin']
if not all(x in s for x in required): raise SystemExit('pipe transformation incomplete')
if 'udp://127.0.0.1:' in s: raise SystemExit('UDP relay remains')
p.write_text(s)
PY
node --check "$SRC"
sudo find /opt/gsa-tv/encoder-engine/src -maxdepth 1 -type f -name '*.bak*' -exec mv -t /opt/gsa-tv/audit-archive {} + 2>/dev/null || true
sudo docker build --no-cache -q -t gsa-tv/encoder-engine:1.1.0 /opt/gsa-tv/encoder-engine >/dev/null
sudo docker run --rm --entrypoint node gsa-tv/encoder-engine:1.1.0 --check /app/src/app.js
echo ENGINE_PIPE_BUILD_PASS
sudo grep -nE 'wireProducer|pipe:0|pipe:1' "$SRC"
`,360000);process.stdout.write(r.stdout);if(r.stderr)process.stderr.write(r.stderr);
