import { execFileSync, spawnSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const CANDIDATE = '@redoper1/xlsx-js-style@1.2.4';

if (
  process.env.GITHUB_ACTIONS !== 'true'
  || process.env.GITHUB_HEAD_REF !== BRANCH
  || process.env.GITHUB_WORKFLOW !== 'Production Integrity'
) {
  console.log('[xlsx-style-candidate] Teste reservado ao workflow Production Integrity.');
  process.exit(0);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    encoding: 'utf8',
    maxBuffer: 40 * 1024 * 1024,
    env: process.env,
    ...options,
  });
}

let result = {
  candidate: CANDIDATE,
  install_status: null,
  audit_status: null,
  audit: null,
  smoke_success: false,
  smoke_bytes: 0,
  error: null,
};

try {
  const remove = run('npm', ['uninstall', 'exceljs', '--ignore-scripts']);
  if (remove.status !== 0) throw new Error(remove.stderr || remove.stdout || 'Falha ao remover ExcelJS no teste.');

  const install = run('npm', ['install', CANDIDATE, '--save', '--ignore-scripts']);
  result.install_status = install.status;
  if (install.status !== 0) throw new Error(install.stderr || install.stdout || 'Falha ao instalar o candidato.');

  const audit = run('npm', ['audit', '--audit-level=high', '--json']);
  result.audit_status = audit.status;
  try {
    result.audit = JSON.parse(audit.stdout || '{}');
  } catch {
    result.audit = { stdout: audit.stdout || '', stderr: audit.stderr || '' };
  }

  const smoke = run('node', ['--input-type=module', '-e', `
    import * as Module from '@redoper1/xlsx-js-style';
    const XLSX = Module.default || Module;
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.aoa_to_sheet([
      [{ v: 'GSA HUB', t: 's', s: { font: { bold: true, sz: 18, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '0B1828' } } } }],
      ['Item', 'Quantidade', 'Valor'],
      ['Teste', 2, 99.9],
    ]);
    worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }];
    worksheet['C3'].z = 'R$ #,##0.00';
    worksheet['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Auditoria');
    const output = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer', cellStyles: true, compression: true });
    const bytes = output?.byteLength || output?.length || 0;
    if (bytes < 1000) throw new Error('XLSX gerado é inválido ou pequeno demais: ' + bytes);
    process.stdout.write(String(bytes));
  `]);
  if (smoke.status !== 0) throw new Error(smoke.stderr || smoke.stdout || 'Falha no smoke test XLSX.');
  result.smoke_success = true;
  result.smoke_bytes = Number(smoke.stdout.trim()) || 0;
} catch (error) {
  result.error = String(error?.stack || error);
} finally {
  console.log('=== BEGIN XLSX STYLE CANDIDATE DIAGNOSTIC ===');
  console.log(JSON.stringify(result, null, 2));
  console.log('=== END XLSX STYLE CANDIDATE DIAGNOSTIC ===');

  execFileSync('git', ['reset', '--hard', 'HEAD'], { stdio: 'inherit' });
  execFileSync('npm', ['ci', '--ignore-scripts'], { stdio: 'inherit' });
}

if (result.error || result.install_status !== 0 || result.audit_status !== 0 || !result.smoke_success) {
  throw new Error('O candidato XLSX não cumpriu todos os critérios de segurança e funcionamento.');
}
