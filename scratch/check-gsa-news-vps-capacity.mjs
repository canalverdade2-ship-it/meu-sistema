import { runSshScript } from './ssh2-run.mjs';
const result = await runSshScript(String.raw`
free -h
echo LOAD
uptime
echo OOM
sudo dmesg -T | tail -n 80 | grep -Ei 'oom|killed process|out of memory' | tail -n 10 || true
`, 30000);
process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
