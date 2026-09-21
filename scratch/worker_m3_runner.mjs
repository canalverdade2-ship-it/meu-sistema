import fs from 'node:fs';
import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const filePath = process.argv[2] || 'scratch/worker_m3_task.sh';
  const script = fs.readFileSync(filePath, 'utf8');
  console.log(`[Worker M3] Running remote script: ${filePath}...`);
  try {
    const r = await runSshScript(script, 600000);
    if (r.stdout) process.stdout.write(r.stdout);
    if (r.stderr) process.stderr.write(r.stderr);
    console.log(`\n[Worker M3] Script finished successfully.`);
  } catch (err) {
    console.error(`\n[Worker M3] Execution Error:`, err.message);
    if (err.stdout) console.log('STDOUT:', err.stdout);
    if (err.stderr) console.error('STDERR:', err.stderr);
    process.exit(1);
  }
}

main();
