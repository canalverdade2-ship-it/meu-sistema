import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sanitizeInternalReturnTo } from '../src/routing/safeReturnTo';

const read = (path: string) => readFileSync(path, 'utf8');
const migration = read('supabase/migrations/20260720215500_fix_public_home_contracts.sql');
const referralMigration = read('supabase/migrations/20260720215530_minimize_public_referral_lookup.sql');
const finalBudgetMigration = read('supabase/migrations/20260721124500_finalize_public_home_budget.sql');
const firstAccessMigration = read('supabase/migrations/20260721125000_disable_unverified_first_access.sql');
const recoveryRateMigration = read('supabase/migrations/20260721125500_prevent_recovery_subject_lockout.sql');
const budgetModal = read('src/components/public/SystemsBudgetModal.tsx');
const budgetGateway = read('supabase/functions/gsa-public-budget/index.ts');
const clientModal = read('src/components/auth/ClientAccessModal.tsx');
const finalHome = read('src/components/public/GSAEnterpriseHomeFinal.tsx');
const privacy = read('src/components/public/PrivacyPolicyDialog.tsx');
const metadata = read('src/hooks/usePublicPageMetadata.ts');
const app = read('src/App.tsx');
const home = read('src/pages/Home.tsx');
const appLocation = read('src/routing/useAppLocation.ts');

assert.doesNotMatch(migration, /upper\(v_token\)\s*=\s*'BEMVINDO'/i, 'Código legado não pode liberar cadastro');
assert.match(migration, /v_default_active AND upper\(v_token\)/, 'Código público depende da configuração ativa');
assert.match(migration, /Cadastro nao concluido\. Verifique os dados ou procure o suporte\./, 'Duplicidades devem usar mensagem genérica');
assert.doesNotMatch(referralMigration, /indicacao_id|indicado_nome|whatsapp_indicado'\s*,/, 'Consulta pública final não deve retornar identificadores ou dados pessoais');
assert.doesNotMatch(clientModal, /fullReferral\.indicacao_id|fullReferral\.indicado_nome|fullReferral\.whatsapp_indicado|id: data\.indicacao_id/, 'Frontend não deve depender de dados internos da indicação');

assert.match(finalBudgetMigration, /WHEN 'integracao' THEN 'Integracao entre sistemas'/, 'A rotina persistente deve aceitar integração');
assert.match(finalBudgetMigration, /v_persisted_protocol := nullif\(v_internal->>'codigo_orcamento'/, 'O protocolo deve vir do orçamento persistido');
assert.match(finalBudgetMigration, /REVOKE ALL ON FUNCTION public\.gsa_public_create_enterprise_budget_v2\(jsonb\) FROM PUBLIC, anon, authenticated/, 'A rotina v2 não pode ser chamada diretamente pelo navegador');
assert.match(finalBudgetMigration, /GRANT EXECUTE ON FUNCTION public\.gsa_public_create_enterprise_budget_v2\(jsonb\) TO service_role/, 'Somente o gateway deve executar a rotina v2');

assert.match(budgetModal, /functions\.invoke<BudgetResponse>\('gsa-public-budget'/, 'O formulário ativo deve usar o gateway Edge');
assert.doesNotMatch(budgetModal, /\.rpc\('gsa_public_create_enterprise_budget_v2'/, 'O navegador não pode chamar a rotina v2 diretamente');
assert.match(budgetModal, /value="integracao"/, 'A opção integração deve continuar disponível');
assert.match(budgetModal, /Protocolo do orçamento/, 'O código exibido deve ser identificado como protocolo persistido');
assert.match(budgetModal, /página de origem, o domínio de referência e parâmetros de campanha/, 'A coleta de metadados deve ser informada ao usuário');
assert.match(budgetGateway, /gsa_auth_rate_limit_check/, 'O gateway deve limitar envios por IP');
assert.match(budgetGateway, /configuredOrigins\(\)/, 'O gateway deve aplicar a lista de origens');
assert.match(budgetGateway, /gsa_public_create_enterprise_budget_v2/, 'O gateway deve encaminhar para a rotina protegida');

assert.match(firstAccessMigration, /gsa_set_pin_and_login/, 'A rotina de primeiro acesso sem OTP deve ser localizada');
assert.match(firstAccessMigration, /PUBLIC, anon, authenticated, service_role/, 'O gateway e os papéis públicos não podem executar primeiro acesso sem OTP');
assert.match(recoveryRateMigration, /p_limit = 4 AND p_window_seconds = 1800 AND p_block_seconds = 7200/, 'O bucket vulnerável da recuperação deve ser neutralizado');
assert.match(recoveryRateMigration, /DELETE FROM public\.gsa_auth_rate_limits WHERE bucket_key = p_bucket_key/, 'Bloqueios antigos por documento devem ser removidos');

assert.match(home, /GSAEnterpriseHomeFinal/, 'A Home deve usar somente a implementação pública final');
assert.doesNotMatch(home, /from '\.\.\/components\/public\/GSAEnterpriseHome'/, 'A implementação pública duplicada não pode entrar no bundle ativo');
assert.match(home, /lazy\(\(\) => import\('\.\.\/components\/public\/SystemsPageFinal'/, 'Sites e Sistemas deve ser carregado sob demanda');
assert.match(finalHome, /PrivacyPolicyDialog/, 'A Home final deve oferecer o aviso de privacidade');
assert.match(privacy, /Não vendemos os dados enviados pelo site/, 'O aviso deve explicar compartilhamento e finalidade');
assert.match(metadata, /setCanonical/, 'O SEO público deve ser controlado por um único hook');
assert.match(metadata, /'@type': 'ProfessionalService'/, 'Sites e Sistemas deve publicar dados estruturados adequados');

assert.match(app, /lazy\(\(\) => import\('\.\/pages\/SecureAdminPanel'\)/, 'Painel administrativo seguro deve ser carregado sob demanda');
assert.match(app, /default: module\.MarketplaceGSAStore/, 'Marketplace deve mapear a exportação nomeada no carregamento lazy');
assert.match(app, /readSafeReturnTo/, 'Redirecionamentos após login devem ser validados');
assert.match(home, /params\.delete\('msg'\)/, 'Home deve remover somente o parâmetro de revogação');
assert.match(appLocation, /safeMatchRoute/, 'O roteamento deve sobreviver a query strings malformadas');
assert.match(appLocation, /catch \(error\)/, 'Falhas de decodificação não podem derrubar a renderização');

assert.equal(sanitizeInternalReturnTo('%2Fcliente%2Fdashboard', ['/cliente']), '/cliente/dashboard');
assert.equal(sanitizeInternalReturnTo('/admin/dashboard', ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo(`https:${'//'}example.invalid`, ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo(`/${'/'}example.invalid`, ['/cliente']), null);
assert.equal(sanitizeInternalReturnTo('%E0%A4%A', ['/cliente']), null);

console.log('Contratos públicos ativos da Home validados com sucesso.');
