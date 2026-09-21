import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    python3 -c '
import re
row = "1521969 oracle-+  20   0 1527164 220424  42520 R 176.5   0.9 134:30.18 ffmpeg"
m = re.match(r"^\\s*(\\d+)\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+\\S+\\s+([\\d.]+)", row)
if m:
    print(f"group 1 (pid): {m.group(1)}")
    print(f"group 2 (matched as cpu): {m.group(2)}")
else:
    print("NO MATCH")
'
  `;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
