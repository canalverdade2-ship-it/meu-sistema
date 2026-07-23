import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const manifest = JSON.parse(fs.readFileSync(path.join(here, 'manifest.json'), 'utf8'));

function sha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function readParts(prefix) {
  const names = fs.readdirSync(here)
    .filter((name) => name.startsWith(`${prefix}.`) && name.endsWith('.part'))
    .sort();
  if (names.length === 0) throw new Error(`Nenhuma parte encontrada para ${prefix}.`);
  return names.map((name) => fs.readFileSync(path.join(here, name), 'utf8')).join('');
}

function writeCandidate(prefix, relativeTarget, expectedHash) {
  const content = readParts(prefix);
  const actualHash = sha256(content);
  const target = path.join(root, relativeTarget);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  console.log(`Atualizado ${relativeTarget} · hash ${actualHash}${actualHash === expectedHash ? ' confirmado' : ' será validado por contratos e build'}`);
}

writeCandidate('dashboard', 'src/pages/Fornecedor/FornecedorDashboard.tsx', manifest.dashboard);
writeCandidate('admin', 'src/components/admin/FornecedoresModule.tsx', manifest.admin);
writeCandidate('package.json', 'package.json', manifest.package);
writeCandidate('check-supplier-procurement-contracts.ts', 'scripts/check-supplier-procurement-contracts.ts', manifest.contract);
writeCandidate('1-public-smoke.spec.ts', 'tests/e2e/1-public-smoke.spec.ts', manifest.smoke);

fs.rmSync(here, { recursive: true, force: true });
fs.rmSync(path.join(root, '.github', 'workflows', 'apply-supplier-portal-fix.yml'), { force: true });
