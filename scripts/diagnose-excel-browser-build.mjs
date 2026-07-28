import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const BRANCH = 'audit/full-system-remediation-20260727';

if (
  process.env.GITHUB_ACTIONS !== 'true'
  || process.env.GITHUB_HEAD_REF !== BRANCH
  || process.env.GITHUB_WORKFLOW !== 'Production Integrity'
) {
  console.log('[excel-browser-build] Diagnóstico reservado ao workflow Production Integrity.');
  process.exit(0);
}

function listFiles(root, prefix = '') {
  if (!existsSync(root)) return [`${root} (não encontrado)`];
  const output = [];
  for (const name of readdirSync(root).sort()) {
    const path = join(root, name);
    const relative = prefix ? `${prefix}/${name}` : name;
    const stat = statSync(path);
    output.push(stat.isDirectory() ? `${relative}/` : `${relative} (${stat.size} bytes)`);
    if (stat.isDirectory() && prefix.split('/').length < 2) output.push(...listFiles(path, relative));
  }
  return output;
}

const mergeSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const packageInfo = existsSync('node_modules/exceljs/package.json')
  ? JSON.parse(execFileSync('node', ['-e', "process.stdout.write(JSON.stringify(require('./node_modules/exceljs/package.json'), null, 2))"], { encoding: 'utf8' }))
  : null;
const distFiles = listFiles('node_modules/exceljs/dist');
const result = spawnSync('npm', ['run', 'build'], {
  encoding: 'utf8',
  maxBuffer: 60 * 1024 * 1024,
  env: process.env,
});
const combined = `${result.stdout || ''}\n${result.stderr || ''}`;

console.log('=== BEGIN EXCEL BROWSER BUILD DIAGNOSTIC ===');
console.log(JSON.stringify({
  generated_at: new Date().toISOString(),
  merge_sha: mergeSha,
  status: result.status,
  signal: result.signal,
  error: result.error ? String(result.error.stack || result.error) : null,
  package: packageInfo ? {
    name: packageInfo.name,
    version: packageInfo.version,
    main: packageInfo.main,
    module: packageInfo.module,
    browser: packageInfo.browser,
    exports: packageInfo.exports,
  } : null,
  dist_files: distFiles,
}, null, 2));
console.log(combined.slice(-40000));
console.log('=== END EXCEL BROWSER BUILD DIAGNOSTIC ===');
process.exit(0);
