from pathlib import Path
import json


def replace_exact(path: str, old: str, new: str, count: int = 1) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    occurrences = text.count(old)
    if occurrences != count:
        raise SystemExit(f'{path}: esperado {count} ocorrência(s), encontrado {occurrences}: {old[:80]}')
    file.write_text(text.replace(old, new, count), encoding='utf-8')


replace_exact(
    'src/routing/routeCatalog.ts',
    "    provider: () => '/login/prestador',\n    recoverPassword: () => '/login/cliente/recuperar-senha',",
    "    provider: () => '/login/prestador',\n    advertiser: () => '/anunciante',\n    recoverPassword: () => '/login/cliente/recuperar-senha',",
)

replace_exact(
    'src/routing/routeCatalog.ts',
    "  // Administrativo\n  admin: {",
    "  // Portal do Anunciante\n  advertiser: {\n    root: () => '/anunciante',\n    proposals: () => '/anunciante/propostas',\n    campaigns: () => '/anunciante/campanhas',\n    creatives: () => '/anunciante/criativos',\n    finance: () => '/anunciante/financeiro',\n    reports: () => '/anunciante/relatorios',\n  },\n  // Administrativo\n  admin: {",
)

replace_exact(
    'src/routing/routeMatcher.ts',
    "  // 5. PAINEL ADMINISTRATIVO\n  if (segments[0] === 'admin') {",
    "  // 5. PORTAL DO ANUNCIANTE\n  if (segments[0] === 'anunciante') {\n    area = 'advertiser';\n    module = segments[1] || 'dashboard';\n    if (segments[2]) itemId = segments[2];\n    return { pathname, search, hash, area, module, itemId, query };\n  }\n\n  // 6. PAINEL ADMINISTRATIVO\n  if (segments[0] === 'admin') {",
)

replace_exact(
    'src/routing/routeMatcher.ts',
    "  // 6. PORTAL DO PRESTADOR",
    "  // 7. PORTAL DO PRESTADOR",
)

replace_exact(
    'src/App.tsx',
    "import { WhatsAppButton } from './components/ui/WhatsAppButton';",
    "import { WhatsAppButton } from './components/ui/WhatsAppButton';\nimport { AdvertisingSlot } from './components/ads/AdvertisingSlot';",
)

replace_exact(
    'src/App.tsx',
    "const PrestadorDashboard = lazy(() => import('./pages/Prestador/PrestadorDashboard').then((module) => ({ default: module.PrestadorDashboard })));",
    "const PrestadorDashboard = lazy(() => import('./pages/Prestador/PrestadorDashboard').then((module) => ({ default: module.PrestadorDashboard })));\nconst AdvertiserPortal = lazy(() => import('./pages/AdvertiserPortal').then((module) => ({ default: module.AdvertiserPortal })));",
)

replace_exact(
    'src/App.tsx',
    "            {activeView === 'provider' && session.prestadorId && (\n              <ProviderNotificationProvider prestadorId={session.prestadorId}>",
    "            {activeView === 'advertiser' && <AdvertiserPortal />}\n\n            {activeView === 'provider' && session.prestadorId && (\n              <ProviderNotificationProvider prestadorId={session.prestadorId}>",
)

replace_exact(
    'src/App.tsx',
    "          {isSessionActive && <FullscreenPrompt />}",
    "          {['public', 'marketplace', 'client'].includes(activeView) && <AdvertisingSlot placementCode=\"SITE_STICKY_BOTTOM\" variant=\"sticky\" />}\n          {isSessionActive && <FullscreenPrompt />}",
)

replace_exact(
    'src/components/public/AdvertisingPage.tsx',
    "            {onLogin && <button onClick={onLogin} className=\"hidden rounded-full px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 sm:block\">Acessar portal</button>}",
    "            <a href=\"/anunciante\" className=\"hidden rounded-full px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 sm:block\">Portal do anunciante</a>",
)

package_path = Path('package.json')
package_data = json.loads(package_path.read_text(encoding='utf-8'))
package_data['scripts']['test:advertising-complete'] = 'tsx scripts/check-advertising-completion.ts'
package_path.write_text(json.dumps(package_data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('Integração final do portal e da veiculação aplicada com sucesso.')
