import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { routes } from '../src/routing/routeCatalog';
import { matchRoute } from '../src/routing/routeMatcher';

const root = process.cwd();

async function read(path: string) {
  return readFile(resolve(root, path), 'utf8');
}

const marketplaceRouter = await read('src/components/client/marketplace/protection/ProtectionMarketplace.tsx');
const insuranceMarketplace = await read('src/components/client/marketplace/protection/InsuranceDirectQuoteMarketplace.tsx');
const healthMarketplace = await read('src/components/client/marketplace/protection/ProtectionMarketplaceLegacy.tsx');
const adminRouter = await read('src/components/admin/ProtectionAdminModule.tsx');
const insuranceAdmin = await read('src/components/admin/InsuranceProtectionAdminModule.tsx');
const healthAdmin = await read('src/components/admin/ProtectionAdminModuleLegacy.tsx');
const migration = await read('supabase/migrations/20260724200000_protection_direct_quote_cleanup.sql');

for (const marker of [
  "props.domain === 'seguros'",
  '<InsuranceDirectQuoteMarketplace',
  '<LegacyProtectionMarketplace',
  'domain="saude"',
]) {
  assert.ok(marketplaceRouter.includes(marker), `Roteador público sem isolamento de domínio: ${marker}`);
}

for (const marker of [
  'actionLabel="Solicitar cotação"',
  'initialCategory={legacyCategoryKey}',
  'Modalidade selecionada',
  "origem: 'marketplace_categoria'",
  'Escolher outra categoria',
]) {
  assert.ok(insuranceMarketplace.includes(marker), `GSA Seguros sem o contrato de cotação direta: ${marker}`);
}

for (const obsolete of [
  'seguros_ofertas_publicas',
  "params.get('oferta')",
  'oferta_slug',
]) {
  assert.ok(!insuranceMarketplace.includes(obsolete), `Referência obsoleta ainda presente no novo GSA Seguros: ${obsolete}`);
}

for (const marker of [
  'gsa_public_listar_planos_saude',
  'saude_planos_publicos',
  'actionLabel="Ver opções"',
  "submodule.startsWith('planos-')",
  '<Catalog domain={domain}',
]) {
  assert.ok(healthMarketplace.includes(marker), `Catálogo original do GSA Saúde não foi preservado: ${marker}`);
}

for (const marker of [
  "props.domain === 'seguros'",
  '<InsuranceProtectionAdminModule',
  '<LegacyProtectionAdminModule',
  'domain="saude"',
]) {
  assert.ok(adminRouter.includes(marker), `Roteador administrativo sem isolamento de domínio: ${marker}`);
}

assert.ok(healthAdmin.includes("| 'produtos'"), 'O cadastro de produtos do GSA Saúde deixou de existir.');
assert.ok(healthAdmin.includes("tab: 'produtos'"), 'A aba de produtos do GSA Saúde não foi preservada.');
assert.ok(healthAdmin.includes("label: 'Produtos'"), 'O painel de produtos do GSA Saúde não foi preservado.');
assert.ok(!insuranceAdmin.includes("| 'produtos'"), 'O tipo de aba do GSA Seguros ainda inclui produtos.');
assert.ok(!insuranceAdmin.includes("tab: 'produtos'"), 'O GSA Seguros ainda renderiza cartão de produtos.');
assert.ok(!insuranceAdmin.includes("label: 'Produtos'"), 'O GSA Seguros ainda expõe o catálogo.');
assert.ok(!insuranceAdmin.includes('produto_id'), 'A proposta de Seguros ainda depende de produto cadastrado.');
assert.ok(insuranceAdmin.includes("p_kind: 'parceiro'"), 'A manutenção de parceiros de Seguros deve continuar ativa.');

for (const marker of [
  'Somente o GSA Seguros deixa de funcionar como catálogo interno.',
  'DROP VIEW IF EXISTS public.seguros_ofertas_publicas CASCADE',
  'ALTER TABLE IF EXISTS public.seguros_propostas DROP COLUMN IF EXISTS produto_id',
  "WHEN 'saude_produtos'",
  "WHEN 'seguros_cotacoes'",
  "v_kind = 'produto' AND v_domain = 'saude'",
  "v_kind = 'produto' AND v_domain = 'seguros'",
  'gsa_client_seguros_criar_cotacao',
]) {
  assert.ok(migration.includes(marker), `Migração sem o contrato: ${marker}`);
}

for (const forbidden of [
  'DROP VIEW IF EXISTS public.saude_planos_publicos CASCADE',
  'ALTER TABLE IF EXISTS public.saude_propostas DROP COLUMN IF EXISTS produto_id',
  'ALTER TABLE IF EXISTS public.saude_contratos DROP COLUMN IF EXISTS produto_id',
  "p.proname = 'gsa_client_saude_criar_cotacao'",
  "'saude_produtos',\n    'saude_planos'",
]) {
  assert.ok(!migration.includes(forbidden), `A migration ainda altera destrutivamente o GSA Saúde: ${forbidden}`);
}

assert.ok(!migration.includes("WHEN 'seguros_produtos'"), 'A API administrativa ainda permite listar produtos de Seguros.');

const healthRoute = matchRoute(routes.marketplace.saude.odontologico(), '', '');
assert.equal(healthRoute.area, 'marketplace');
assert.equal(healthRoute.module, 'saude');
assert.equal(healthRoute.submodule, 'planos-odontologico');
assert.equal(healthRoute.itemId, undefined);

const insuranceRoute = matchRoute(`${routes.marketplace.seguros.cotacao()}/residencial`, '', '');
assert.equal(insuranceRoute.area, 'marketplace');
assert.equal(insuranceRoute.module, 'seguros');
assert.equal(insuranceRoute.submodule, 'cotacao');
assert.equal(insuranceRoute.itemId, 'residencial');

const travelRoute = matchRoute(routes.marketplace.travelPackages.ofertasNacionais(), '', '');
assert.equal(travelRoute.area, 'marketplace');
assert.equal(travelRoute.module, 'pacotes-viagem');
assert.equal(travelRoute.submodule, 'ofertas-nacionais');
assert.ok(routes.marketplace.travelPackages.pacote('recife').endsWith('/ofertas/recife'));

console.log('GSA Seguros em cotação direta; catálogos de Saúde e Viagens preservados.');
