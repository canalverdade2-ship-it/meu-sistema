import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolveLegacyRoute } from '../src/routing/legacyRouteResolver';
import { routes } from '../src/routing/routeCatalog';
import { matchRoute } from '../src/routing/routeMatcher';

const read = (path: string) => readFileSync(path, 'utf8');

const migration = read('supabase/migrations/20260721210100_create_advertising_foundation.sql');
const gateway = read('supabase/functions/gsa-public-advertising/index.ts');
const gatewayTest = read('supabase/functions/gsa-public-advertising/index_test.ts');
const publicPage = read('src/components/public/AdvertisingPage.tsx');
const adminModule = read('src/components/admin/AdvertisingAdminModule.tsx');
const routeCatalog = read('src/routing/routeCatalog.ts');
const routeMatcher = read('src/routing/routeMatcher.ts');
const adminAccess = read('src/routing/adminAccess.ts');
const adminPanel = read('src/pages/AdminPanel.tsx');
const home = read('src/pages/Home.tsx');
const advertiserAccess = read('src/lib/advertiserAccess.ts');
const advertiserAdminGateway = read('supabase/functions/gsa-advertiser-admin/index.ts');

assert.equal(existsSync('src/types/advertising.ts'), true, 'Tipos do domínio de anúncios devem existir');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gsa_advertisers/, 'Cadastro de anunciantes deve existir');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gsa_ad_placements/, 'Inventário de posições deve existir');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gsa_ad_requests/, 'Solicitações devem ser persistidas');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gsa_ad_proposal_versions/, 'Propostas precisam ser versionadas');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gsa_ad_campaigns/, 'Campanhas devem existir');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gsa_ad_creatives/, 'Criativos devem existir');
assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.gsa_ad_daily_metrics/, 'Métricas agregadas devem existir');
assert.match(migration, /REVOKE ALL ON FUNCTION public\.gsa_public_submit_advertising_request\(jsonb\) FROM PUBLIC, anon, authenticated/, 'Solicitação pública deve passar pelo gateway');
assert.match(migration, /gsa_admin_has_module\('anuncios'\)/, 'Acesso administrativo deve exigir o módulo anúncios');
assert.match(migration, /HOME_LIGHTBOX/, 'Posição especial deve nascer desabilitada por regras de campanha e inventário');
assert.doesNotMatch(migration, /GRANT EXECUTE ON FUNCTION public\.gsa_public_submit_advertising_request\(jsonb\) TO anon/, 'Anon não pode executar a RPC interna');

assert.match(gateway, /gsa_auth_rate_limit_check/, 'Gateway deve aplicar rate limiting');
assert.match(gateway, /configuredOrigins\(\)/, 'Gateway deve aplicar CORS por allowlist');
assert.match(gateway, /gsa_public_submit_advertising_request/, 'Gateway deve encaminhar para a RPC protegida');
assert.match(gateway, /website_confirmation/, 'Gateway deve aplicar honeypot');
assert.match(gateway, /started_at/, 'Gateway deve rejeitar formulário automatizado rápido');
assert.doesNotMatch(gatewayTest, /from\s+['"]https?:\/\//, 'Testes Deno não devem depender de módulos remotos');

assert.match(publicPage, /Quero anunciar/, 'Página pública deve possuir CTA comercial');
assert.match(publicPage, /gsa-public-advertising/, 'Formulário deve usar a Edge Function');
assert.match(publicPage, /gsa_public_list_active_ads/, 'Vitrine deve carregar apenas campanhas elegíveis');
assert.match(publicPage, /Proposta antes do pagamento/, 'Fluxo comercial deve estar explicado');
assert.match(publicPage, /fechamento imediato/, 'Lightbox não pode bloquear o fechamento');
assert.doesNotMatch(publicPage, /\.rpc\('gsa_public_submit_advertising_request'/, 'Navegador não pode chamar a RPC interna diretamente');

assert.match(adminModule, /gsa_admin_(?:list_ad_requests|advertising_overview)/, 'Administrativo deve usar dados reais da operação');
assert.match(adminModule, /gsa_admin_update_ad_request_status/, 'Administrativo deve atualizar o fluxo por RPC segura');
assert.match(adminAccess, /\| 'anuncios'/, 'Anúncios deve ser uma permissão administrativa independente');
assert.match(adminPanel, /AdvertisingAdminModule/, 'Painel administrativo deve renderizar o módulo');
assert.match(routeCatalog, /ads: \(\) => '\/anuncios'/, 'Rota pública de anúncios deve existir');
assert.match(routeCatalog, /advertise: \(\) => '\/anuncie'/, 'Rota de captação deve existir');
assert.match(routeCatalog, /ads: \(\) => '\/admin\/anuncios'/, 'Rota administrativa deve existir');
assert.match(routeMatcher, /module: 'ads'/, 'Roteador deve reconhecer a vitrine de anúncios');
assert.match(routeMatcher, /module: 'advertise'/, 'Roteador deve reconhecer a captação de anunciantes');
assert.match(home, /AdvertisingPage/, 'Home deve carregar a página de anúncios sob demanda');
assert.equal(routes.login.advertiser(), '/anuncios/login', 'Login do anunciante deve usar a rota padronizada');
assert.equal(routes.advertiser.root(), '/anuncios/login', 'Portal do anunciante deve abrir pela rota de login padronizada');
assert.deepEqual(
  { area: matchRoute('/anuncios/login', '', '').area, module: matchRoute('/anuncios/login', '', '').module },
  { area: 'advertiser', module: 'login' },
  'Roteador deve reconhecer /anuncios/login como acesso do anunciante',
);
assert.equal(resolveLegacyRoute('/anunciante', ''), '/anuncios/login', 'Rota antiga do anunciante deve ser redirecionada');
assert.match(advertiserAccess, /routes\.login\.advertiser\(\)/, 'Link mágico deve retornar para a nova rota');
assert.match(advertiserAdminGateway, /\/anuncios\/login/, 'Convite administrativo deve retornar para a nova rota');

console.log('Fundação do módulo GSA Anúncios validada com sucesso.');
