import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchRoute } from '../src/routing/routeMatcher';
import { isRouteAllowed } from '../src/routing/routeSecurity';

const read = (path: string) => readFileSync(path, 'utf8');
const loginHub = read('src/components/public/LoginHub.tsx');
const loginPage = read('src/pages/ClientLoginPage.tsx');
const app = read('src/App.tsx');
const businessDashboard = read('src/components/business/BusinessDashboard.tsx');

assert.match(loginHub, /Área do Cliente Pessoa Física — PF/, 'O seletor deve identificar claramente o acesso PF.');
assert.match(loginHub, /Área do Cliente Empresa — PJ/, 'O seletor deve identificar claramente o acesso PJ.');
assert.doesNotMatch(loginPage, /<Modal|AccessibleDialog/, 'As páginas exclusivas de login não podem voltar a usar modal.');
assert.match(loginPage, /resolveAuthenticatedClientPersonType/, 'O login deve confirmar o tipo real da conta autenticada.');
assert.match(app, /portalVariant="business"/, 'O aplicativo deve montar o shell empresarial na área PJ.');
assert.match(businessDashboard, /GSA HUB Empresas/, 'O dashboard empresarial deve preservar a identidade exclusiva.');

const personalLogin = matchRoute('/login/pessoa-fisica', '', '');
assert.equal(personalLogin.area, 'login');
assert.equal(personalLogin.module, 'pessoa-fisica');

const businessRecovery = matchRoute('/login/empresa/recuperar-senha', '', '');
assert.equal(businessRecovery.area, 'login');
assert.equal(businessRecovery.module, 'empresa');
assert.equal(businessRecovery.submodule, 'recuperar-senha');

const businessOperation = matchRoute('/empresa/operacoes/orcamentos/operacao-1', '', '');
assert.equal(businessOperation.area, 'business');
assert.equal(businessOperation.module, 'servicos_assinaturas');
assert.equal(businessOperation.submodule, 'orcamentos');
assert.equal(businessOperation.itemId, 'operacao-1');

assert.equal(isRouteAllowed('business', { clientId: 'cliente-pj', clientPersonType: 'pj' }), true);
assert.equal(isRouteAllowed('business', { clientId: 'cliente-pf', clientPersonType: 'pf' }), false);
assert.equal(isRouteAllowed('client', { clientId: 'cliente-pj', clientPersonType: 'pj' }), false);
assert.equal(isRouteAllowed('client', { clientId: 'cliente-pf', clientPersonType: 'pf' }), true);

console.log('Separação dos portais PF e PJ validada com sucesso.');
