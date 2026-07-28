import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';

const BRANCH = 'audit/full-system-remediation-20260727';
const SCRIPT_PATH = 'scripts/test-modern-exceljs-fork.mjs';
const PACKAGE_PATH = 'package.json';
const OLD_REPORT_PATH = 'audit-control/npm-audit-exceljs-alias.json';
const REPORT_PATH = 'audit-control/modern-exceljs-validation.json';
const CANDIDATE = 'exceljs@npm:@excel.js/exceljs@0.9.0';

if (process.env.GITHUB_ACTIONS !== 'true' || process.env.GITHUB_HEAD_REF !== BRANCH) {
  console.log('[modern-exceljs] Fora do PR de auditoria; nenhuma escrita realizada.');
  process.exit(0);
}

const git = (...args) => execFileSync('git', args, { stdio: 'inherit' });
git('fetch', 'origin', BRANCH);
git('checkout', '-B', BRANCH, `origin/${BRANCH}`);

execFileSync('npm', ['install', CANDIDATE, '--save', '--ignore-scripts'], { stdio: 'inherit' });

const audit = spawnSync('npm', ['audit', '--audit-level=high', '--json'], {
  encoding: 'utf8',
  maxBuffer: 30 * 1024 * 1024,
});
let auditPayload;
try {
  auditPayload = JSON.parse(audit.stdout || '{}');
} catch {
  auditPayload = { parse_error: true, stdout: audit.stdout || '', stderr: audit.stderr || '' };
}

let smoke = { success: false, buffer_bytes: 0, error: null };
try {
  const module = await import('exceljs');
  const ExcelJS = module.default || module;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'GSA HUB Audit';
  const worksheet = workbook.addWorksheet('Auditoria');
  worksheet.mergeCells('A1:C1');
  worksheet.getCell('A1').value = 'GSA HUB';
  worksheet.getCell('A1').font = { bold: true, size: 18, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B1828' } };
  worksheet.getRow(2).values = ['Item', 'Quantidade', 'Valor'];
  worksheet.getCell('C3').numFmt = 'R$ #,##0.00';
  worksheet.addRow(['Teste', 2, 99.9]);
  worksheet.autoFilter = { from: 'A2', to: 'C2' };
  worksheet.views = [{ state: 'frozen', ySplit: 2 }];
  const buffer = await workbook.xlsx.writeBuffer();
  const bytes = buffer?.byteLength ?? buffer?.length ?? 0;
  if (bytes < 1000) throw new Error(`Buffer XLSX inesperadamente pequeno: ${bytes} bytes.`);
  smoke = { success: true, buffer_bytes: bytes, error: null };
} catch (error) {
  smoke = { success: false, buffer_bytes: 0, error: String(error?.stack || error) };
}

mkdirSync('audit-control', { recursive: true });
writeFileSync(REPORT_PATH, `${JSON.stringify({
  validated_at: new Date().toISOString(),
  candidate: CANDIDATE,
  audit_exit_code: audit.status,
  audit: auditPayload,
  workbook_smoke_test: smoke,
}, null, 2)}\n`, 'utf8');

const packageJson = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
packageJson.scripts.lint = 'tsc --noEmit && node scripts/audit-production-real.mjs --enforce';
writeFileSync(PACKAGE_PATH, `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8');
if (existsSync(OLD_REPORT_PATH)) rmSync(OLD_REPORT_PATH);
if (existsSync(SCRIPT_PATH)) rmSync(SCRIPT_PATH);

git('diff', '--check');
git('config', 'user.name', 'github-actions[bot]');
git('config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com');
git('add', PACKAGE_PATH, 'package-lock.json', REPORT_PATH, OLD_REPORT_PATH, SCRIPT_PATH);
try {
  execFileSync('git', ['diff', '--cached', '--quiet']);
  console.log('[modern-exceljs] Candidato já registrado.');
  process.exit(0);
} catch {
  // Há alterações staged.
}

git('commit', '-m', 'test(security): validar fork moderno do exportador Excel');
git('reset', '--hard', 'HEAD');
for (let attempt = 1; attempt <= 5; attempt += 1) {
  try {
    git('fetch', 'origin', BRANCH);
    git('rebase', `origin/${BRANCH}`);
    git('push', 'origin', `HEAD:${BRANCH}`);
    console.log('[modern-exceljs] Resultado persistido.');
    process.exit(0);
  } catch (error) {
    console.error(`[modern-exceljs] Tentativa ${attempt} de 5 não concluiu o push.`);
    try { git('rebase', '--abort'); } catch { /* sem rebase ativo */ }
    if (attempt === 5) throw error;
  }
}
