import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_PROJECT_TYPES } from '../src/data/publicProjectTypes';
import { sanitizeInternalReturnTo } from '../src/routing/safeReturnTo';

const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260720215500_fix_public_home_contracts.sql');
const enterpriseHome = read('src/components/public/GSAEnterpriseHome.tsx');
const clientModal = read('src/components/auth/ClientAccessModal.tsx');
const app = read('src/App.tsx');
const home = read('src/pages/Home.tsx');

for (const projectType of PUBLIC_PROJECT_TYPES) {
  assert.match(migration, new RegExp(`WHEN '${projectType.value}'`), `SQL precisa aceitar ${projectType.value}`);
  assert.match(enterpriseHome, /PUBLIC_PROJECT_TYPES\.map/, 'Frontend deve renderizar o catálogo canônico de tipos');
}

assert.doesNotMatch(migration, /upper\(v_token\)\s*=\s*'BEMVINDO'/i, 'Código legado não pode liberar cadastro');
assert.match(migration, /v_default_active AND upper\(v_token\)/, 'Código público depende da configuração ativa');
assert.match(migration, /Cadastro nao concluido\. Verifique os dados ou procure o suporte\./, 'Duplicidades devem usar mensagem genérica');
assert.doesNotMatch(migration, /whatsapp_indicado'\s*,\s*v_indicacao\.whatsapp_indicado/, 'Consulta pública não deve retornar telefone indicado');
assert.doesNotMatch(migration, /indicado_nome'\s*,/, 'Consulta pública não deve retornar nome indicado');
assert.doesNotMatch(clientModal, /fullReferral\.indicado_nome|fullReferral\.whatsapp_indicado/, 'Frontend não deve depender de dados pessoais da indicação');

assert.match(enterpriseHome, /minLength=\{20\}/, 'Descrição do orçamento deve validar mínimo no navegador');
assert.match(enterpriseHome, /maxLength=\{5000\}/, 'Descrição do orçamento deve validar máximo no navegador');
assert.match(enterpriseHome, /sessionStorage\.setItem\('gsa_pending_service_request'/, 'Solicitação pendente deve ficar limitada à aba');
assert.match(app, /lazy\(\(\) => import\('\.\/pages\/AdminPanel'\)/, 'Painel administrativo deve ser carregado sob demanda');
assert.match(app, /readSafeReturnTo/, 'Redirecionamentos após login devem ser validados');
assert.match(home, /params\.delete\('msg'\)/, 'Home deve remover somente o parâmetro de revogação');

assert.equal(sanitizeInternalReturnTo('%2Fcliente%2Fdashboard', ['/cliente']), '/cliente/dashboard');
assert.equal(sanitizeInternalReturnTo('/admin/dashboard', ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo(`https:${'//'}example.invalid`, ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo(`/${'/'}example.invalid`, ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo('%E0%A4%A', ['/cliente']), null);

console.log('Contratos públicos da Home validados com sucesso.');
