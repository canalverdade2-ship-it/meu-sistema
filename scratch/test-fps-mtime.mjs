import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    python3 -c '
import os, time, re

playlist = "/opt/gsa-tv/runtime/hls/program.m3u8"
samples = []
print("Collecting 4 playlist updates (each ~2s)...")
last_seq = None
for _ in range(30):
    if os.path.exists(playlist):
        mtime = os.path.getmtime(playlist)
        with open(playlist) as f:
            content = f.read()
        m = re.search(r"#EXT-X-MEDIA-SEQUENCE:(\d+)", content)
        if m:
            seq = int(m.group(1))
            if seq != last_seq:
                samples.append((time.time(), mtime, seq))
                last_seq = seq
                print(f"Sample: wall={samples[-1][0]:.3f}, mtime={mtime:.3f}, seq={seq}")
                if len(samples) >= 5:
                    break
    time.sleep(0.5)

if len(samples) >= 2:
    wall_dt = samples[-1][0] - samples[0][0]
    mtime_dt = samples[-1][1] - samples[0][1]
    dseq = samples[-1][2] - samples[0][2]
    print(f"dseq = {dseq}")
    print(f"FPS by wall time: {(dseq * 60.0) / wall_dt:.3f}")
    print(f"FPS by mtime:     {(dseq * 60.0) / mtime_dt:.3f}")
'
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
