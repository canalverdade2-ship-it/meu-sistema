import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = process.argv[2];
  if (!script) {
    console.error('Usage: node worker_m3_exec.mjs "<script>"');
    process.exit(1);
  }
  try {
    const r = await runSshScript(script, 300000);
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
  } catch (err) {
    console.error('Execution Error:', err.message);
    if (err.stdout) console.log('STDOUT:', err.stdout);
    if (err.stderr) console.error('STDERR:', err.stderr);
    process.exit(1);
  }
}

main();
