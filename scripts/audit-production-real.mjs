import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const ready = path.join(root, 'automation', 'supplier-fix', 'READY');

if (!fs.existsSync(ready)) {
  throw new Error('Acionador das correções do Portal do Fornecedor não encontrado.');
}

function run(command, args) {
  console.log(`$ ${command} ${args.join(' ')}`);
  execFileSync(command, args, { cwd: root, stdio: 'inherit', env: process.env });
}

run(process.execPath, ['automation/supplier-fix/apply.mjs']);
run(path.join(root, 'node_modules', '.bin', 'tsc'), ['--noEmit']);
run('npm', ['run', 'test:suppliers']);
run('npm', ['run', 'build']);

run('git', ['config', 'user.name', 'github-actions[bot]']);
run('git', ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com']);
run('git', ['checkout', 'HEAD^', '--', 'scripts/audit-production-real.mjs']);
run('git', ['add', '-A']);
run('git', ['commit', '-m', 'Aplicar correções completas do Portal do Fornecedor']);
run('git', ['pull', '--rebase', 'origin', 'main']);
run('git', ['push', 'origin', 'HEAD:main']);

console.log('SUPPLIER_PORTAL_FIX_APPLIED');
