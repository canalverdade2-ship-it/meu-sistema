import { execFileSync, spawnSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';

if (
  process.env.GITHUB_ACTIONS !== 'true'
  || process.env.GITHUB_HEAD_REF !== BRANCH
  || process.env.GITHUB_WORKFLOW !== 'Production Integrity'
) {
  console.log('[merge-build] Captura reservada ao workflow Production Integrity.');
  process.exit(0);
}

const mergeSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const result = spawnSync('npm', ['run', 'build'], {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
  env: process.env,
});
const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
const tail = combined.slice(-30000);

console.log('=== BEGIN PR MERGE BUILD DIAGNOSTIC ===');
console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  workflow: process.env.GITHUB_WORKFLOW,
  merge_sha: mergeSha,
  head_sha: process.env.GITHUB_SHA || null,
  status: result.status,
  signal: result.signal,
  error: result.error ? String(result.error.stack || result.error) : null,
}, null, 2));
console.log(tail);
console.log('=== END PR MERGE BUILD DIAGNOSTIC ===');

// A captura é informativa. O resultado real do build continuará sendo validado
// no passo dedicado do workflow depois das demais verificações.
process.exit(0);
