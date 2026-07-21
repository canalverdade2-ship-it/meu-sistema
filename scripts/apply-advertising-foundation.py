from pathlib import Path
import json


def replace_exact(path: str, old: str, new: str, count: int | None = None) -> None:
    file = Path(path)
    text = file.read_text(encoding='utf-8')
    occurrences = text.count(old)
    expected = count if count is not None else 1
    if occurrences != expected:
        raise SystemExit(f'{path}: esperado {expected} ocorrência(s), encontrado {occurrences}')
    file.write_text(text.replace(old, new, expected), encoding='utf-8')


replace_exact(
    'src/data/publicServiceCatalog.ts',
    "export type PublicPage = 'home' | 'services' | 'systems' | 'partners';",
    "export type PublicPage = 'home' | 'services' | 'systems' | 'partners' | 'ads' | 'advertise';",
)

replace_exact(
    'src/routing/routeCatalog.ts',
    "    partners: () => '/parceiros',\n    partner: (slug: string) => `/parceiros/${slug}`,",
    "    partners: () => '/parceiros',\n    partner: (slug: string) => `/parceiros/${slug}`,\n    ads: () => '/anuncios',\n    advertise: () => '/anuncie',",
)
replace_exact(
    'src/routing/routeCatalog.ts',
    "    partners: () => '/admin/parceiros',\n    clients: () => '/admin/cadastros/clientes',",
    "    partners: () => '/admin/parceiros',\n    ads: () => '/admin/anuncios',\n    adRequest: (id: string) => `/admin/anuncios/solicitacoes/${id}`,\n    clients: () => '/admin/cadastros/clientes',",
)

replace_exact(
    'src/routing/routeMatcher.ts',
    "  if (normalizedPath === '/parceiros' || normalizedPath.startsWith('/parceiros/')) {\n    area = 'public';\n    module = 'partners';\n    if (segments[1]) itemId = segments[1];\n    return { pathname, search, hash, area, module, itemId, query };\n  }",
    "  if (normalizedPath === '/parceiros' || normalizedPath.startsWith('/parceiros/')) {\n    area = 'public';\n    module = 'partners';\n    if (segments[1]) itemId = segments[1];\n    return { pathname, search, hash, area, module, itemId, query };\n  }\n  if (normalizedPath === '/anuncios') {\n    return { pathname, search, hash, area: 'public', module: 'ads', query };\n  }\n  if (normalizedPath === '/anuncie') {\n    return { pathname, search, hash, area: 'public', module: 'advertise', query };\n  }",
)

replace_exact(
    'src/pages/Home.tsx',
    "const SystemsPageFinal = lazy(() => import('../components/public/SystemsPageFinal').then((module) => ({ default: module.SystemsPageFinal })));",
    "const SystemsPageFinal = lazy(() => import('../components/public/SystemsPageFinal').then((module) => ({ default: module.SystemsPageFinal })));\nconst AdvertisingPage = lazy(() => import('../components/public/AdvertisingPage').then((module) => ({ default: module.AdvertisingPage })));",
)
replace_exact(
    'src/pages/Home.tsx',
    "      ) : (\n        <GSAEnterpriseHomeFinal",
    "      ) : publicPage === 'ads' || publicPage === 'advertise' ? (\n        <Suspense fallback={<PublicPageLoading />}>\n          <AdvertisingPage mode={publicPage === 'advertise' ? 'advertise' : 'showcase'} onBack={() => changePublicPage('home')} onLogin={handlePublicLogin} />\n        </Suspense>\n      ) : (\n        <GSAEnterpriseHomeFinal",
)

replace_exact(
    'src/App.tsx',
    "  const publicPage = route.module === 'services'\n    ? 'services'\n    : route.module === 'systems'\n      ? 'systems'\n      : route.module === 'partners'\n        ? 'partners'\n        : 'home';",
    "  const publicPage = route.module === 'services'\n    ? 'services'\n    : route.module === 'systems'\n      ? 'systems'\n      : route.module === 'partners'\n        ? 'partners'\n        : route.module === 'ads'\n          ? 'ads'\n          : route.module === 'advertise'\n            ? 'advertise'\n            : 'home';",
)
replace_exact(
    'src/App.tsx',
    "                      : page === 'partners'\n                        ? routes.public.partners()\n                        : routes.public.systems(),",
    "                      : page === 'partners'\n                        ? routes.public.partners()\n                        : page === 'ads'\n                          ? routes.public.ads()\n                          : page === 'advertise'\n                            ? routes.public.advertise()\n                            : routes.public.systems(),",
    2,
)

replace_exact(
    'src/routing/adminAccess.ts',
    "  | 'parceiros'\n  | 'catalogo'",
    "  | 'parceiros'\n  | 'anuncios'\n  | 'catalogo'",
)
replace_exact(
    'src/routing/adminAccess.ts',
    "  'parceiros',\n  'catalogo',",
    "  'parceiros',\n  'anuncios',\n  'catalogo',",
)
replace_exact(
    'src/routing/adminAccess.ts',
    "    case 'parceiros': return parts('admin', 'parceiros', tab, itemId);\n    case 'catalogo':",
    "    case 'parceiros': return parts('admin', 'parceiros', tab, itemId);\n    case 'anuncios': return parts('admin', 'anuncios', tab, itemId);\n    case 'catalogo':",
)

replace_exact(
    'src/security/collaboratorAccess.ts',
    "    'parceiros',\n    'operacoes',",
    "    'parceiros',\n    'anuncios',\n    'operacoes',",
)

replace_exact(
    'src/pages/AdminPanel.tsx',
    "  Menu,\n  MessageSquare,",
    "  Menu,\n  Megaphone,\n  MessageSquare,",
)
replace_exact(
    'src/pages/AdminPanel.tsx',
    "import { PartnersAdminModule } from '../components/admin/PartnersAdminModule';",
    "import { PartnersAdminModule } from '../components/admin/PartnersAdminModule';\nimport { AdvertisingAdminModule } from '../components/admin/AdvertisingAdminModule';",
)
replace_exact(
    'src/pages/AdminPanel.tsx',
    "    { id: 'classificados', label: 'Classificados GSA', icon: Tags },",
    "    { id: 'classificados', label: 'Classificados GSA', icon: Tags },\n    { id: 'anuncios', label: 'GSA Anúncios', icon: Megaphone },",
)
replace_exact(
    'src/pages/AdminPanel.tsx',
    "        {normalizedActive === 'classificados' && <ErrorBoundary><ClassifiedsModule initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}",
    "        {normalizedActive === 'classificados' && <ErrorBoundary><ClassifiedsModule initialTab={activeTab} initialItemId={activeItemId} colaboradorId={colaboradorId} colaboradorNome={colaboradorNome} /></ErrorBoundary>}\n        {normalizedActive === 'anuncios' && <ErrorBoundary><AdvertisingAdminModule /></ErrorBoundary>}",
)

replace_exact(
    'src/hooks/usePublicPageMetadata.ts',
    "             : page === 'partners'\n               ? 'Parceiros | GSA HUB'\n               : DEFAULT_TITLE;",
    "             : page === 'partners'\n               ? 'Parceiros | GSA HUB'\n               : page === 'ads'\n                 ? 'Anunciantes | GSA HUB'\n                 : page === 'advertise'\n                   ? 'Anuncie no GSA HUB'\n                   : DEFAULT_TITLE;",
)
replace_exact(
    'src/hooks/usePublicPageMetadata.ts',
    "             : page === 'partners'\n               ? 'Conheça empresas e profissionais que fazem parte da rede de parceiros da GSA HUB.'\n               : DEFAULT_DESCRIPTION);",
    "             : page === 'partners'\n               ? 'Conheça empresas e profissionais que fazem parte da rede de parceiros da GSA HUB.'\n               : page === 'ads'\n                 ? 'Conheça campanhas e empresas anunciantes aprovadas no ecossistema GSA HUB.'\n                 : page === 'advertise'\n                   ? 'Solicite uma proposta para divulgar sua empresa nas páginas e módulos do GSA HUB.'\n                   : DEFAULT_DESCRIPTION);",
)
replace_exact(
    'src/hooks/usePublicPageMetadata.ts',
    "             : page === 'partners'\n               ? window.location.pathname.startsWith('/parceiros/') ? window.location.pathname : '/parceiros'\n               : '/';",
    "             : page === 'partners'\n               ? window.location.pathname.startsWith('/parceiros/') ? window.location.pathname : '/parceiros'\n               : page === 'ads'\n                 ? '/anuncios'\n                 : page === 'advertise'\n                   ? '/anuncie'\n                   : '/';",
)

package_path = Path('package.json')
package_data = json.loads(package_path.read_text(encoding='utf-8'))
package_data['scripts']['test:advertising'] = 'tsx scripts/check-advertising-foundation.ts'
package_path.write_text(json.dumps(package_data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

replace_exact(
    'src/components/public/AdvertisingPage.tsx',
    """    supabase.rpc('gsa_public_list_active_ads', { p_placement_code: 'ADS_PUBLIC_SHOWCASE' })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) console.error('Falha ao carregar anúncios públicos:', error);
        setAds(Array.isArray(data) ? data as PublicAdvertisement[] : []);
      })
      .finally(() => { if (active) setLoadingAds(false); });
""",
    """    const loadAds = async () => {
      try {
        const { data, error } = await supabase.rpc('gsa_public_list_active_ads', { p_placement_code: 'ADS_PUBLIC_SHOWCASE' });
        if (!active) return;
        if (error) console.error('Falha ao carregar anúncios públicos:', error);
        setAds(Array.isArray(data) ? data as PublicAdvertisement[] : []);
      } finally {
        if (active) setLoadingAds(false);
      }
    };
    void loadAds();
""",
)

print('Integração do módulo de anúncios aplicada com sucesso.')
