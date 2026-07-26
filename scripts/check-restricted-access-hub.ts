import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routes } from '../src/routing/routeCatalog';
import { matchRoute } from '../src/routing/routeMatcher';

const read = (path: string) => readFileSync(path, 'utf8');
const loginHub = read('src/components/public/LoginHub.tsx');
const restrictedHub = read('src/pages/RestrictedAccessHubPage.tsx');
const app = read('src/App.tsx');

assert.match(loginHub, /Acesso Restrito/, 'O seletor principal deve exibir o acesso restrito.');
assert.match(loginHub, /onClick=\{onRestrictedAccess\}/, 'O botão deve executar a navegação para o gateway restrito.');
assert.doesNotMatch(restrictedHub, /<Modal|RestrictedAccessModal/, 'O gateway restrito deve ser uma página exclusiva.');

for (const profile of ['Prestador GSA', 'Colaborador GSA', 'Gestão GSA', 'Fornecedor GSA']) {
  assert.match(restrictedHub, new RegExp(profile), `O gateway deve exibir o perfil ${profile}.`);
}

assert.match(app, /route\.module === 'acesso-restrito'/, 'O aplicativo deve montar a página exclusiva de acessos restritos.');
assert.match(app, /routes\.login\.restricted\(\)/, 'O botão principal deve navegar para a rota canônica do gateway.');
assert.match(app, /routes\.login\.provider\(\)/, 'O perfil de prestador deve abrir o login correspondente.');
assert.match(app, /routes\.login\.collaborator\(\)/, 'O perfil de colaborador deve abrir o login correspondente.');
assert.match(app, /routes\.login\.admin\(\)/, 'O perfil de gestão deve abrir o login correspondente.');
assert.match(app, /routes\.login\.supplier\(\)/, 'O perfil de fornecedor deve abrir o login correspondente.');

assert.equal(routes.login.restricted(), '/login/acesso-restrito');
assert.equal(routes.login.provider(), '/login/prestador');
assert.equal(routes.login.collaborator(), '/login/colaborador');
assert.equal(routes.login.admin(), '/login/admin');
assert.equal(routes.login.supplier(), '/fornecedor/login');

const gatewayRoute = matchRoute('/login/acesso-restrito', '', '');
assert.equal(gatewayRoute.area, 'login');
assert.equal(gatewayRoute.module, 'acesso-restrito');

for (const [path, module] of [
  ['/login/prestador', 'prestador'],
  ['/login/colaborador', 'colaborador'],
  ['/login/admin', 'admin'],
] as const) {
  const route = matchRoute(path, '', '');
  assert.equal(route.area, 'login');
  assert.equal(route.module, module);
}

const supplierRoute = matchRoute('/fornecedor/login', '', '');
assert.equal(supplierRoute.area, 'supplier');
assert.equal(supplierRoute.module, 'login');

console.log('Gateway de acessos restritos validado com sucesso.');
