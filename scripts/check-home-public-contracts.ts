import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PUBLIC_PROJECT_TYPES } from '../src/data/publicProjectTypes';
import { sanitizeInternalReturnTo } from '../src/routing/safeReturnTo';

const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260720215500_fix_public_home_contracts.sql');
const referralMigration = read('supabase/migrations/20260720215530_minimize_public_referral_lookup.sql');
const budgetGuard = read('supabase/migrations/20260720215600_guard_legacy_budget_permissions.sql');
const enterpriseHome = read('src/components/public/GSAEnterpriseHome.tsx');
const clientModal = read('src/components/auth/ClientAccessModal.tsx');
const app = read('src/App.tsx');
const home = read('src/pages/Home.tsx');

for (const projectType of PUBLIC_PROJECT_TYPES) {
  assert.match(migration, new RegExp(`WHEN '${projectType.value}'`), `SQL precisa aceitar ${projectType.value}`);
  assert.match(enterpriseHome, /PUBLIC_PROJECT_TYPES\.map/, 'Frontend deve renderizar o catálogo canônico de tipos');
}

assert.doesNotMatch(migration, /upper\(v_token\)\s*=\s*'BEMVINDO'/i, 'Código legado não pode liberar cadastro');
assert.doesNotMatch(migration, /gsa_recuperar_senha_cliente|recover_client/, 'A correção da Home não pode alterar a recuperação em andamento');
assert.match(migration, /v_default_active AND upper\(v_token\)/, 'Código público depende da configuração ativa');
assert.match(migration, /v_email text := lower\(trim\(coalesce\(v_payload->>'email', ''\)\)\);/, 'Declaração do e-mail do prestador deve ter sintaxe válida');
assert.match(migration, /Cadastro nao concluido\. Verifique os dados ou procure o suporte\./, 'Duplicidades devem usar mensagem genérica');
assert.doesNotMatch(referralMigration, /indicacao_id|indicado_nome|whatsapp_indicado'\s*,/, 'Consulta pública final não deve retornar identificadores ou dados pessoais');
assert.doesNotMatch(clientModal, /fullReferral\.indicacao_id|fullReferral\.indicado_nome|fullReferral\.whatsapp_indicado|id: data\.indicacao_id/, 'Frontend não deve depender de dados internos da indicação');
assert.match(budgetGuard, /gsa_public_create_enterprise_budget_v2\(jsonb\)/, 'Permissões devem reconhecer a rotina protegida v2');
assert.match(budgetGuard, /REVOKE ALL ON FUNCTION public\.gsa_public_create_enterprise_budget\(jsonb\)/, 'Função legada deve ser fechada antes da decisão de compatibilidade');
assert.match(budgetGuard, /IF to_regprocedure\('public\.gsa_public_create_enterprise_budget_v2\(jsonb\)'\) IS NULL/, 'Acesso público legado só pode existir antes da v2');

assert.match(enterpriseHome, /minLength=\{20\}/, 'Descrição do orçamento deve validar mínimo no navegador');
assert.match(enterpriseHome, /maxLength=\{5000\}/, 'Descrição do orçamento deve validar máximo no navegador');
assert.match(enterpriseHome, /sessionStorage\.setItem\('gsa_pending_service_request'/, 'Solicitação pendente deve ficar limitada à aba');
assert.match(app, /lazy\(\(\) => import\('\.\/pages\/SecureAdminPanel'\)/, 'Painel administrativo seguro deve ser carregado sob demanda');
assert.match(app, /default: module\.MarketplaceGSAStore/, 'Marketplace deve mapear a exportação nomeada no carregamento lazy');
assert.match(app, /readSafeReturnTo/, 'Redirecionamentos após login devem ser validados');
assert.match(home, /params\.delete\('msg'\)/, 'Home deve remover somente o parâmetro de revogação');

assert.equal(sanitizeInternalReturnTo('%2Fcliente%2Fdashboard', ['/cliente']), '/cliente/dashboard');
assert.equal(sanitizeInternalReturnTo('/admin/dashboard', ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo(`https:${'//'}example.invalid`, ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo(`/${'/'}example.invalid`, ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo('%E0%A4%A', ['/cliente']), null);

console.log('Contratos públicos da Home validados com sucesso.');
