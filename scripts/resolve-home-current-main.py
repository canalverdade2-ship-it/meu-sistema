from pathlib import Path
import re

app_path = Path('src/App.tsx')
app = app_path.read_text()
app = app.replace("import { useState, useEffect } from 'react';", "import { lazy, Suspense, useEffect, useState } from 'react';")
for line in [
    "import { SecureAdminPanel } from './pages/SecureAdminPanel';\n",
    "import { ClientPortal } from './pages/ClientPortal';\n",
    "import { PrestadorDashboard } from './pages/Prestador/PrestadorDashboard';\n",
    "import { MarketplaceGSAStore } from './components/client/marketplace/MarketplaceGSAStore';\n",
]:
    app = app.replace(line, '')

route_marker = "import { isRouteAllowed } from './routing/routeSecurity';\n"
assert route_marker in app
if "safeReturnTo" not in app:
    app = app.replace(route_marker, route_marker + "import { readSafeReturnTo } from './routing/safeReturnTo';\n")

query_marker = "const queryClient = new QueryClient();\n"
lazy_block = """
const SecureAdminPanel = lazy(() => import('./pages/SecureAdminPanel').then((module) => ({ default: module.SecureAdminPanel })));
const ClientPortal = lazy(() => import('./pages/ClientPortal').then((module) => ({ default: module.ClientPortal })));
const PrestadorDashboard = lazy(() => import('./pages/Prestador/PrestadorDashboard').then((module) => ({ default: module.PrestadorDashboard })));
const MarketplaceGSAStore = lazy(() => import('./components/client/marketplace/MarketplaceGSAStore').then((module) => ({ default: module.MarketplaceGSAStore })));

function RouteLoading() {
  return <div className="flex min-h-[50vh] items-center justify-center bg-neutral-50 text-sm font-semibold text-neutral-600" role="status">Carregando ambiente...</div>;
}
"""
assert query_marker in app
if "function RouteLoading()" not in app:
    app = app.replace(query_marker, query_marker + lazy_block)

client_pattern = re.compile(r"  const handleLoginClient = \(clientId: string, isRecovery: boolean = false\) => \{.*?\n  \};\n\n  const handleLoginAdmin", re.S)
client_replacement = """  const handleLoginClient = (clientId: string, isRecovery: boolean = false) => {
    setSession({ clientId });
    const returnTo = readSafeReturnTo(window.location.search, ['/cliente', '/marketplace']);
    if (isRecovery) replace('/cliente/perfil?modal=alterar-senha&origem=recuperacao');
    else replace(returnTo || routes.client.dashboard());
  };

  const handleLoginAdmin"""
app, count = client_pattern.subn(client_replacement, app, count=1)
assert count == 1

admin_pattern = re.compile(r"  const handleLoginAdmin = \(adminDetails: \{ type: 'admin' \| 'colaborador', id\?: string, nome\?: string, modulos\?: string\[\] \}\) => \{.*?\n  \};\n\n  const handleLoginPrestador", re.S)
admin_replacement = """  const handleLoginAdmin = (adminDetails: { type: 'admin' | 'colaborador', id?: string, nome?: string, modulos?: string[] }) => {
    setSession({
      adminAuth: true,
      adminType: adminDetails.type,
      colaboradorId: adminDetails.id,
      colaboradorNome: adminDetails.nome,
      colaboradorModulos: adminDetails.modulos,
    });
    const returnTo = readSafeReturnTo(window.location.search, ['/admin']);
    replace(returnTo || defaultAdminPath(adminDetails.type, adminDetails.modulos || []));
  };

  const handleLoginPrestador"""
app, count = admin_pattern.subn(admin_replacement, app, count=1)
assert count == 1

provider_pattern = re.compile(r"  const handleLoginPrestador = \(prestadorId: string\) => \{.*?\n  \};", re.S)
provider_replacement = """  const handleLoginPrestador = (prestadorId: string) => {
    setSession({ prestadorId });
    const returnTo = readSafeReturnTo(window.location.search, ['/prestador']);
    replace(returnTo || routes.provider.dashboard());
  };"""
app, count = provider_pattern.subn(provider_replacement, app, count=1)
assert count == 1

public_page = "              initialPublicPage={route.module === 'services' ? 'services' : route.module === 'systems' ? 'systems' : 'home'}\n"
assert public_page in app
if 'initialServiceSlug=' not in app:
    app = app.replace(
        public_page,
        public_page + "              initialServiceSlug={route.module === 'services' ? route.itemId : undefined}\n              onServiceDetailChange={(slug) => navigate(slug ? routes.public.serviceDetail(slug) : routes.public.services())}\n",
        1,
    )

div_marker = '        <div className="min-h-screen bg-[#f8f7f5] font-sans text-neutral-900">'
assert div_marker in app
if '<Suspense fallback={<RouteLoading />}>' not in app:
    app = app.replace(div_marker, div_marker + '\n          <Suspense fallback={<RouteLoading />}>', 1)
    floating_marker = '          {/* Elementos flutuantes adicionais */}'
    assert floating_marker in app
    app = app.replace(floating_marker, '          </Suspense>\n\n' + floating_marker, 1)
app_path.write_text(app)

modal_path = Path('src/components/auth/RestrictedAccessModal.tsx')
modal = modal_path.read_text()
modal = modal.replace(
    "onLoginAdmin: (details: { type: 'admin' | 'colaborador'; id?: string; modulos?: string[] }) => void;",
    "onLoginAdmin: (details: { type: 'admin' | 'colaborador'; id?: string; nome?: string; modulos?: string[] }) => void;",
)
modal = modal.replace(
    "onLoginAdmin({ type: 'colaborador', id: data.id, modulos: data.modulos || [] });",
    "onLoginAdmin({ type: 'colaborador', id: data.id, nome: data.nome, modulos: data.modulos || [] });",
)
modal_path.write_text(modal)
