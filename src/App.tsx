import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Toaster } from 'react-hot-toast';
import { AdminNotificationProvider } from './hooks/useAdminNotifications';
import { logService } from './lib/logService';
import { useAutoLogout } from './hooks/useAutoLogout';
import { sessionService, type ClientPersonType } from './lib/sessionService';
import { validateProviderSessionAccess } from './lib/providerSessionAccess';
import { ClientNotificationProvider } from './hooks/useClientNotifications';
import { ProviderNotificationProvider } from './hooks/useProviderNotifications';
import { ProviderRouteGuard } from './pages/Prestador/ProviderRouteGuard';
import { FullscreenPrompt } from './components/ui/FullscreenPrompt';
import { WhatsAppButton } from './components/ui/WhatsAppButton';
import { AdvertisingSlot } from './components/ads/AdvertisingSlot';
import { FileViewerProvider } from './contexts/FileViewerContext';
import { useAppLocation } from './routing/useAppLocation';
import { resolveLegacyRoute } from './routing/legacyRouteResolver';
import { routes } from './routing/routeCatalog';
import { navigate, replace } from './routing/navigationService';
import { isRouteAllowed } from './routing/routeSecurity';
import { readSafeReturnTo } from './routing/safeReturnTo';
import { defaultAdminPath } from './security/collaboratorAccess';
import { supabase } from './lib/supabase';
import { clientOperationalWrite } from './lib/clientOperationalWrite';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AffiliateTrackingBridge } from './components/AffiliateTrackingBridge';

const PENDING_STORE_CHECKOUT_KEY = 'gsa_pending_store_checkout';
const PENDING_STORE_COUPONS_KEY = 'gsa_pending_store_coupons';
const GUEST_ACTIVATED_STORE_COUPONS_KEY = 'gsa_guest_activated_store_coupons';

async function migrateGuestCartToAccount(clientId: string): Promise<boolean> {
  const rawCart = localStorage.getItem(PENDING_STORE_CHECKOUT_KEY);
  if (!rawCart) return false;

  let parsed: any;
  try { parsed = JSON.parse(rawCart); } catch { return false; }

  const pendingItems: Array<{ item_id: string; tipo: string; quantidade: number; prazo_meses?: number }> =
    Array.isArray(parsed?.items) ? parsed.items : [];
  if (pendingItems.length === 0) {
    localStorage.removeItem(PENDING_STORE_CHECKOUT_KEY);
    return false;
  }

  let migrated = false;
  try {
    await Promise.all(pendingItems.map(async (item) => {
      if (!item?.item_id || !item?.tipo) return;

      const quantidade = Math.max(1, Number(item.quantidade || 1));
      const prazoMeses = item.prazo_meses ? Number(item.prazo_meses) : undefined;

      const insertData: any = { cliente_id: clientId, item_id: item.item_id, tipo: item.tipo, quantidade, updated_at: new Date().toISOString() };
      if (prazoMeses) insertData.prazo_meses = prazoMeses;
      await clientOperationalWrite(clientId, 'loja_carrinhos', 'insert', insertData);
      migrated = true;
    }));

    const rawCoupons = localStorage.getItem(PENDING_STORE_COUPONS_KEY);
    const parsedCoupons = rawCoupons ? JSON.parse(rawCoupons) : null;
    const couponIds: string[] = Array.isArray(parsedCoupons?.activatedCouponIds) ? parsedCoupons.activatedCouponIds : [];
    for (const cupomId of couponIds) {
      if (!cupomId) continue;
      try { await clientOperationalWrite(clientId, 'cupons_ativados', 'insert', { cliente_id: clientId, cupom_id: cupomId }); } catch { /* ignore duplicate */ }
    }

    if (migrated) {
      localStorage.removeItem(PENDING_STORE_CHECKOUT_KEY);
      localStorage.removeItem(PENDING_STORE_COUPONS_KEY);
      localStorage.removeItem(GUEST_ACTIVATED_STORE_COUPONS_KEY);
    }
    return migrated;
  } catch (err) {
    console.error('[App] Erro ao migrar carrinho do visitante:', err);
    return false;
  }
}



const queryClient = new QueryClient();

const SecureAdminPanel = lazy(() => import('./pages/SecureAdminPanel').then((module) => ({ default: module.SecureAdminPanel })));
const ClientPortal = lazy(() => import('./pages/ClientPortal').then((module) => ({ default: module.ClientPortal })));
const ClientLoginPage = lazy(() => import('./pages/ClientLoginPage').then((module) => ({ default: module.ClientLoginPage })));
const BusinessRegistrationPage = lazy(() => import('./pages/BusinessRegistrationPage').then((module) => ({ default: module.BusinessRegistrationPage })));
const RestrictedAccessHubPage = lazy(() => import('./pages/RestrictedAccessHubPage').then((module) => ({ default: module.RestrictedAccessHubPage })));
const ProviderAccessPage = lazy(() => import('./pages/ProviderAccessPage').then((module) => ({ default: module.ProviderAccessPage })));
const ProviderLandingPage = lazy(() => import('./pages/Prestador/ProviderLandingPage').then((module) => ({ default: module.ProviderLandingPage })));
const PrestadorDashboard = lazy(() => import('./pages/Prestador/PrestadorDashboard').then((module) => ({ default: module.PrestadorDashboard })));
const FornecedorDashboard = lazy(() => import('./pages/Fornecedor/FornecedorDashboard').then((module) => ({ default: module.FornecedorDashboard })));
const FornecedorAccessPage = lazy(() => import('./pages/Fornecedor/FornecedorAccessPage').then((module) => ({ default: module.FornecedorAccessPage })));
const FornecedorLandingPage = lazy(() => import('./pages/Fornecedor/FornecedorLandingPage').then((module) => ({ default: module.FornecedorLandingPage })));
const AdvertiserPortal = lazy(() => import('./pages/AdvertiserPortal').then((module) => ({ default: module.AdvertiserPortal })));
const MarketplaceGSAStore = lazy(() => import('./components/client/marketplace/MarketplaceGSAStore').then((module) => ({ default: module.MarketplaceGSAStore })));
const AffiliatePublicPage = lazy(() => import('./components/public/AffiliatePublicPage').then((module) => ({ default: module.AffiliatePublicPage })));
const AffiliateAccessPage = lazy(() => import('./pages/Afiliado/AffiliateAccessPage').then((module) => ({ default: module.AffiliateAccessPage })));
const AfiliadoDashboard = lazy(() => import('./pages/Afiliado/AfiliadoDashboard').then((module) => ({ default: module.AfiliadoDashboard })));
const CareersLandingPage = lazy(() => import('./pages/Careers/CareersLandingPage').then((module) => ({ default: module.CareersLandingPage })));
const CareersAccessPage = lazy(() => import('./pages/Careers/CareersAccessPage').then((module) => ({ default: module.CareersAccessPage })));

function RouteLoading() {
  return <div className="flex min-h-[50vh] items-center justify-center bg-neutral-50 text-sm font-semibold text-neutral-600" role="status">Carregando ambiente...</div>;
}

export default function App() {
  const route = useAppLocation();
  const [session, setSession] = useState<{
    clientId?: string;
    clientPersonType?: ClientPersonType;
    adminAuth?: boolean;
    adminType?: 'admin' | 'colaborador';
    colaboradorId?: string;
    colaboradorNome?: string;
    colaboradorModulos?: string[];
    prestadorId?: string;
    fornecedorId?: string;
  }>({});
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const isSessionActive = !!(session.clientId || session.adminAuth || session.prestadorId || session.fornecedorId);

  const handleLoginClient = (clientId: string, isRecovery: boolean = false, personType?: ClientPersonType) => {
    const resolvedType = personType || (route.area === 'business' ? 'pj' : 'pf');
    sessionService.setClientPersonType(resolvedType);
    setSession({ clientId, clientPersonType: resolvedType });
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    if (isRecovery) {
      const targetProfile = resolvedType === 'pj' ? routes.business.profile() : routes.client.perfil();
      replace(`${targetProfile}?modal=alterar-senha&origem=recuperacao`);
    } else if (returnTo) {
      replace(decodeURIComponent(returnTo));
    } else {
      replace(resolvedType === 'pj' ? routes.business.dashboard() : routes.client.dashboard());
    }
  };

  const handleLoginAdmin = (adminDetails: { type: 'admin' | 'colaborador'; id?: string; nome?: string; modulos?: string[] }) => {
    localStorage.setItem('adminType', adminDetails.type);
    if (adminDetails.id) localStorage.setItem('colaboradorId', adminDetails.id);
    else localStorage.removeItem('colaboradorId');
    if (adminDetails.nome) localStorage.setItem('colaboradorNome', adminDetails.nome);
    else localStorage.removeItem('colaboradorNome');

    setSession({
      adminAuth: true,
      adminType: adminDetails.type,
      colaboradorId: adminDetails.id,
      colaboradorNome: adminDetails.nome,
      colaboradorModulos: adminDetails.modulos,
    });

    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    if (returnTo) {
      replace(decodeURIComponent(returnTo));
    } else {
      replace(defaultAdminPath(adminDetails.type, adminDetails.modulos || []));
    }
  };

  const handleLoginPrestador = (prestadorId: string) => {
    setSession({ prestadorId });
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    if (returnTo) {
      replace(decodeURIComponent(returnTo));
    } else {
      replace(routes.provider.dashboard());
    }
  };

  const handleLoginFornecedor = (fornecedorId: string) => {
    setSession({ fornecedorId });
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    if (returnTo) {
      replace(decodeURIComponent(returnTo));
    } else {
      replace(routes.supplier.dashboard());
    }
  };

  const handleLoginAfiliado = (clientId: string) => {
    sessionService.setClientPersonType('pf');
    setSession({ clientId, clientPersonType: 'pf' });
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('returnTo');
    if (returnTo) {
      replace(decodeURIComponent(returnTo));
    } else {
      replace('/afiliados/dashboard');
    }
  };

  const handleLogout = async () => {
    try {
      await sessionService.endSession();
    } catch {
      // Falha silenciosa no logout
    }
    setSession({});
    localStorage.removeItem('adminType');
    localStorage.removeItem('colaboradorId');
    localStorage.removeItem('colaboradorNome');
    replace(routes.home.index());
  };

  useEffect(() => {
    const legacyRedirect = resolveLegacyRoute(window.location.pathname, window.location.search);
    if (legacyRedirect) replace(legacyRedirect);
  }, [route.pathname, route.search]);

  useEffect(() => {
    const restore = async () => {
      try {
        const restored = await sessionService.restoreSession();
        if (restored) {
          if (restored.atorTipo === 'cliente') {
            const restoredPersonType = restored.clientPersonType === 'pj' || restored.clientPersonType === 'pf'
              ? restored.clientPersonType
              : await sessionService.resolveAuthenticatedClientPersonType(restored.atorId);
            const clientPersonType: ClientPersonType = restoredPersonType || (route.area === 'business' ? 'pj' : 'pf');
            sessionService.setClientPersonType(clientPersonType);
            setSession({ clientId: restored.atorId, clientPersonType });

            const recoveryProfile = clientPersonType === 'pj' ? routes.business.profile() : routes.client.perfil();
            if (restored.precisa_trocar_senha && window.location.pathname !== recoveryProfile) {
              replace(`${recoveryProfile}?modal=alterar-senha&origem=recuperacao`);
            } else if ((route.area === 'public' && route.module === 'affiliates' && ['login', 'acesso', 'cadastro'].includes(route.itemId || '')) || (route.area === 'login' && route.module === 'afiliado')) {
              replace('/afiliados/dashboard');
            } else if (clientPersonType === 'pj' && route.area === 'client') {
              replace(routes.business.dashboard());
            } else if (clientPersonType === 'pf' && route.area === 'business') {
              replace(routes.client.dashboard());
            } else if (route.area === 'login') {
              const returnTo = route.query.returnTo;
              if (returnTo) {
                replace(decodeURIComponent(returnTo));
              } else {
                replace(clientPersonType === 'pj' ? routes.business.dashboard() : routes.client.dashboard());
              }
            }
          } else if (restored.atorTipo === 'admin' || restored.atorTipo === 'colaborador') {
            setSession({
              adminAuth: true,
              adminType: restored.atorTipo,
              colaboradorId: restored.atorId !== '00000000-0000-0000-0000-000000000000' ? restored.atorId : undefined,
              colaboradorNome: restored.atorNome,
              colaboradorModulos: restored.modulos || [],
            });
            if (route.area === 'login' && ['acesso-restrito', 'admin', 'colaborador'].includes(route.module)) {
              replace(defaultAdminPath(restored.atorTipo, restored.modulos || []));
            }
          } else if (restored.atorTipo === 'prestador') {
            const access = await validateProviderSessionAccess(restored.atorId);
            if (!access) {
              await sessionService.endSession();
              setSession({});
              if (route.area === 'provider' && route.module !== 'home') {
                const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                replace(`${routes.login.provider()}?returnTo=${returnTo}&msg=revoked`);
              }
              return;
            }
            setSession({ prestadorId: access.provider_id });
            if (route.area === 'login' && route.module === 'prestador') {
              replace(routes.provider.dashboard());
            }
          } else if (restored.atorTipo === 'fornecedor') {
            const { data: access, error } = await supabase.rpc('gsa_supplier_session_access_state');
            if (error || !(access as any)?.success) {
              await sessionService.endSession();
              setSession({});
              return;
            }
            setSession({ fornecedorId: (access as any).supplier_id });
            if (window.location.pathname === '/login/fornecedor') replace(routes.supplier.dashboard());
          }
        } else if (
          ['client', 'business', 'admin'].includes(route.area)
          || (route.area === 'provider' && route.module !== 'home')
          || (route.area === 'supplier' && !['home', 'login', 'access'].includes(route.module))
        ) {
          const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
          const loginPath = route.area === 'supplier'
            ? routes.login.supplier()
            : route.area === 'business'
              ? routes.login.business()
              : route.area === 'client'
                ? routes.login.personal()
                : route.area === 'admin'
                  ? routes.login.restricted()
                  : route.area === 'provider'
                    ? routes.login.provider()
                : routes.login.root();
          replace(`${loginPath}?returnTo=${returnTo}`);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        setIsLoadingSession(false);
      }
    };
    restore();
  }, [route.area]);

  const activeView = route.area;
  const isAllowed = isRouteAllowed(route.area, session, route.module, route.submodule);

  useEffect(() => {
    if (!isLoadingSession && !isAllowed) {
      if (route.area === 'admin' && session.adminAuth) {
        replace(defaultAdminPath(session.adminType, session.colaboradorModulos || []));
      } else if (route.area === 'business' && session.clientId && session.clientPersonType === 'pf') {
        replace(routes.client.dashboard());
      } else if (route.area === 'client' && session.clientId && session.clientPersonType === 'pj') {
        replace(routes.business.dashboard());
      } else {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        const loginPath = route.area === 'supplier'
          ? routes.login.supplier()
          : route.area === 'business'
            ? routes.login.business()
            : route.area === 'client'
              ? routes.login.personal()
              : route.area === 'admin'
                ? routes.login.restricted()
                : route.area === 'provider'
                  ? routes.login.provider()
              : routes.login.root();
        replace(`${loginPath}?returnTo=${returnTo}`);
      }
    }
  }, [isLoadingSession, isAllowed, route.area, route.module, route.submodule, session]);

  if (isLoadingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-neutral-50">Carregando sessão...</div>;
  }

  if (!isAllowed) {
    return null;
  }

  const publicPage = route.module === 'services'
    ? 'services'
    : route.module === 'free-tools'
      ? 'free-tools'
    : route.module === 'systems'
      ? 'systems'
      : route.module === 'partners'
        ? 'partners'
        : route.module === 'ads'
          ? 'ads'
          : route.module === 'advertise'
            ? 'advertise'
            : 'home';
  const loginReturnSuffix = route.query.returnTo
    ? `?${new URLSearchParams({ returnTo: route.query.returnTo }).toString()}`
    : '';

  return (
    <FileViewerProvider>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-[#f8f7f5] font-sans text-neutral-900">
          <AffiliateTrackingBridge clientId={session.clientId} />
          <ErrorBoundary>
            <Suspense fallback={<RouteLoading />}>
            {activeView === 'public' && route.module === 'affiliates' && !route.itemId && (
              <AffiliatePublicPage
                onBack={() => navigate(routes.public.home())}
                onLogin={() => navigate('/afiliados/login')}
                onRegister={() => navigate('/afiliados/login?mode=register')}
              />
            )}

            {((activeView === 'public' && route.module === 'affiliates' && ['login', 'acesso', 'cadastro'].includes(route.itemId || '')) || (activeView === 'login' && route.module === 'afiliado')) && (
              session.clientId ? (
                <AfiliadoDashboard
                  clientId={session.clientId}
                  onLogout={handleLogout}
                  activeSubRoute="dashboard"
                />
              ) : (
                <AffiliateAccessPage
                  initialMode={route.itemId === 'cadastro' || route.query.mode === 'register' ? 'register' : 'login'}
                  onLogin={(clientId) => handleLoginAfiliado(clientId || session.clientId || '')}
                  onBack={() => navigate(routes.public.affiliates())}
                />
              )
            )}

            {activeView === 'public' && route.module === 'affiliates' && ['dashboard', 'painel', 'links', 'comissoes', 'saques', 'perfil', 'pontos'].includes(route.itemId || '') && (
              session.clientId ? (
                <AfiliadoDashboard
                  clientId={session.clientId}
                  onLogout={handleLogout}
                  activeSubRoute={route.itemId}
                />
              ) : (
                <AffiliateAccessPage
                  initialMode="login"
                  onLogin={(clientId) => handleLoginAfiliado(clientId)}
                  onBack={() => navigate(routes.public.affiliates())}
                />
              )
            )}

            {activeView === 'public' && ['trabalhe-conosco', 'careers'].includes(route.module) && !['acesso', 'login'].includes(route.itemId || '') && (
              <CareersLandingPage
                onBackToSite={() => navigate(routes.public.home())}
                onAccessPortal={() => navigate(routes.login.careers())}
              />
            )}

            {((activeView === 'public' && ['trabalhe-conosco', 'careers'].includes(route.module) && ['acesso', 'login'].includes(route.itemId || '')) || (activeView === 'login' && route.module === 'careers')) && (
              <CareersAccessPage
                onBackToLanding={() => navigate(routes.public.careers())}
                onBackToSite={() => navigate(routes.public.home())}
              />
            )}

            {activeView === 'public' && !['affiliates', 'trabalhe-conosco', 'careers'].includes(route.module) && (
              <Home
                onLoginClient={handleLoginClient}
                onGuestStore={() => navigate(routes.marketplace.root())}
                initialPublicPage={publicPage}
                initialServiceSlug={route.module === 'services' ? route.itemId : undefined}
                initialPartnerSlug={route.module === 'partners' ? route.itemId : undefined}
                onServiceDetailChange={(slug) => navigate(slug ? routes.public.serviceDetail(slug) : routes.public.services())}
                onPartnerDetailChange={(slug) => navigate(slug ? routes.public.partner(slug) : routes.public.partners())}
                onPublicPageChange={(page) => navigate(
                  page === 'home'
                    ? routes.public.home()
                    : page === 'services'
                      ? routes.public.services()
                      : page === 'free-tools'
                        ? routes.public.freeTools()
                      : page === 'partners'
                        ? routes.public.partners()
                        : page === 'ads'
                          ? routes.public.ads()
                          : page === 'advertise'
                            ? routes.public.advertise()
                            : routes.public.systems(),
                )}
                onLoginPage={() => navigate(routes.login.root())}
                onRestrictedLoginPage={() => navigate(routes.login.restricted())}
              />
            )}

            {activeView === 'login' && ['cliente', 'pessoa-fisica'].includes(route.module) && (
              <ClientLoginPage
                personType="pf"
                initialMode={route.submodule === 'recuperar-senha' || route.query.mode === 'recovery' ? 'recovery' : 'login'}
                onLoginClient={handleLoginClient}
                onBack={() => navigate(`${routes.login.root()}${loginReturnSuffix}`)}
                onSwitchPortal={() => navigate(`${routes.login.business()}${loginReturnSuffix}`)}
                onRegister={() => navigate(`${routes.login.root()}?mode=register&type=pf${loginReturnSuffix ? `&${loginReturnSuffix.replace('?', '')}` : ''}`)}
              />
            )}

            {activeView === 'login' && route.module === 'empresa' && route.submodule !== 'cadastro' && (
              <ClientLoginPage
                personType="pj"
                initialMode={route.submodule === 'recuperar-senha' || route.query.mode === 'recovery' ? 'recovery' : 'login'}
                onLoginClient={handleLoginClient}
                onBack={() => navigate(`${routes.login.root()}${loginReturnSuffix}`)}
                onSwitchPortal={() => navigate(`${routes.login.personal()}${loginReturnSuffix}`)}
                onRegister={() => navigate(`${routes.login.businessRegistration()}${loginReturnSuffix}`)}
              />
            )}

            {activeView === 'login' && route.module === 'empresa' && route.submodule === 'cadastro' && (
              <BusinessRegistrationPage
                onBack={() => navigate(`${routes.login.business()}${loginReturnSuffix}`)}
                onLogin={(cnpj) => {
                  const cnpjQuery = cnpj ? `&cnpj=${encodeURIComponent(cnpj)}` : '';
                  navigate(`${routes.login.business()}?mode=first_access${cnpjQuery}${loginReturnSuffix ? `&${loginReturnSuffix.replace('?', '')}` : ''}`);
                }}
              />
            )}

            {activeView === 'login' && ['acesso-restrito', 'admin', 'colaborador'].includes(route.module) && (
              <RestrictedAccessHubPage
                initialRole={route.module === 'admin' ? 'gestao' : 'colaborador'}
                onBack={() => navigate(`${routes.login.root()}${loginReturnSuffix}`)}
                onLoginAdmin={handleLoginAdmin}
              />
            )}

            {activeView === 'login' && route.module === 'prestador' && (
              <ProviderAccessPage
                initialMode={route.submodule === 'cadastro' || route.query.mode === 'register' ? 'register' : 'login'}
                onBack={() => navigate(`${routes.provider.home()}${loginReturnSuffix}`)}
                onLoginProvider={handleLoginPrestador}
                onModeChange={(mode) => navigate(
                  `${mode === 'register' ? routes.login.providerRegistration() : routes.login.provider()}${loginReturnSuffix}`,
                )}
              />
            )}

            {activeView === 'login' && route.module === 'root' && (
              <Home
                onLoginClient={handleLoginClient}
                onGuestStore={() => navigate(routes.marketplace.root())}
                initialPublicPage="home"
                onPublicPageChange={(page) => navigate(
                  page === 'home'
                    ? routes.public.home()
                    : page === 'services'
                      ? routes.public.services()
                      : page === 'free-tools'
                        ? routes.public.freeTools()
                      : page === 'partners'
                        ? routes.public.partners()
                        : page === 'ads'
                          ? routes.public.ads()
                          : page === 'advertise'
                            ? routes.public.advertise()
                            : routes.public.systems(),
                )}
                loginOnly
                onBackHome={() => navigate(routes.public.home())}
                onPersonalLoginPage={() => navigate(`${routes.login.personal()}${loginReturnSuffix}`)}
                onBusinessLoginPage={() => navigate(`${routes.login.business()}${loginReturnSuffix}`)}
                onProviderPage={() => navigate(`${routes.provider.home()}${loginReturnSuffix}`)}
                onSupplierPage={() => navigate(routes.supplier.home())}
                onRestrictedLoginPage={() => navigate(`${routes.login.restricted()}${loginReturnSuffix}`)}
              />
            )}

            {activeView === 'provider' && route.module === 'home' && !session.prestadorId && (
              <ProviderLandingPage
                onBackToSite={() => navigate(routes.public.home())}
                onLogin={() => navigate(`${routes.login.provider()}${loginReturnSuffix}`)}
                onRegister={() => navigate(`${routes.login.providerRegistration()}${loginReturnSuffix}`)}
              />
            )}

            {activeView === 'supplier' && route.module === 'home' && !session.fornecedorId && (
              <FornecedorLandingPage
                onAccessLogin={() => navigate(routes.supplier.login())}
                onBackToSite={() => navigate(routes.public.home())}
              />
            )}

            {((activeView === 'supplier' && ['login', 'access'].includes(route.module) && !session.fornecedorId) || (activeView === 'login' && route.module === 'fornecedor')) && (
              <FornecedorAccessPage onLogin={handleLoginFornecedor} onBack={() => navigate(routes.supplier.home())} />
            )}

            {activeView === 'marketplace' && !session.clientId && (
              <MarketplaceGSAStore
                clientId=""
                initialTab={route.submodule?.replace('loja-', '') || 'home'}
                initialItemId={route.itemId}
                onNavigate={(mod, tab, itemId) => {
                  const targetTab = tab || 'home';
                  if (targetTab === 'home') navigate(routes.marketplace.root());
                  else if (targetTab === 'menu') navigate(routes.marketplace.menu());
                  else if (targetTab === 'produtos-assinaturas' || targetTab === 'loja') navigate(routes.marketplace.store.root());
                  else if (targetTab === 'produtos' || targetTab === 'loja-produtos') {
                    if (itemId) navigate(routes.marketplace.store.product(itemId));
                    else navigate(routes.marketplace.store.products());
                  } else if (targetTab === 'assinaturas' || targetTab === 'loja-assinaturas') {
                    if (itemId) navigate(routes.marketplace.store.subscription(itemId));
                    else navigate(routes.marketplace.store.subscriptions());
                  } else if (targetTab === 'pacotes-viagem') navigate(routes.marketplace.travelPackages.root());
                  else if (targetTab === 'classificados') navigate(routes.marketplace.classifieds.root());
                  else if (targetTab === 'saude') navigate(routes.marketplace.saude.root());
                  else if (targetTab === 'seguros') navigate(routes.marketplace.seguros.root());
                }}
                onBackToSite={() => navigate(routes.public.home())}
                onRequireAuth={() => {
                  const params = new URLSearchParams(window.location.search);
                  if (!params.has('modal')) {
                    params.set('modal', 'carrinho');
                  }
                  const returnUrl = window.location.pathname + '?' + params.toString();
                  const returnTo = encodeURIComponent(returnUrl);
                  navigate(`${routes.login.root()}?returnTo=${returnTo}`);
                }}
              />
            )}

            {activeView === 'marketplace' && session.clientId && (
              <ClientNotificationProvider clientId={session.clientId}>
                <ClientPortal
                  clientId={session.clientId}
                  onLogout={handleLogout}
                  portalVariant={session.clientPersonType === 'pj' ? 'business' : 'personal'}
                  initialModule="gsa_store"
                  initialStoreTab={route.submodule?.replace('loja-', '') || 'home'}
                  initialStoreItemId={route.itemId}
                />
              </ClientNotificationProvider>
            )}

            {activeView === 'admin' && session.adminAuth && (
              <AdminNotificationProvider>
                <SecureAdminPanel
                  onLogout={handleLogout}
                  adminType={session.adminType || 'admin'}
                  colaboradorId={session.colaboradorId}
                  colaboradorNome={session.colaboradorNome}
                  colaboradorModulos={session.colaboradorModulos || []}
                />
              </AdminNotificationProvider>
            )}

            {activeView === 'client' && session.clientId && (
              <ClientNotificationProvider clientId={session.clientId}>
                <ClientPortal clientId={session.clientId} onLogout={handleLogout} portalVariant="personal" initialModule={route.module} />
              </ClientNotificationProvider>
            )}

            {activeView === 'business' && session.clientId && (
              <ClientNotificationProvider clientId={session.clientId}>
                <ClientPortal clientId={session.clientId} onLogout={handleLogout} portalVariant="business" initialModule={route.module} />
              </ClientNotificationProvider>
            )}

            {activeView === 'advertiser' && <AdvertiserPortal />}

            {activeView === 'provider' && session.prestadorId && (
              <ProviderNotificationProvider prestadorId={session.prestadorId}>
                <ProviderRouteGuard>
                  <PrestadorDashboard prestadorId={session.prestadorId} onLogout={handleLogout} />
                </ProviderRouteGuard>
              </ProviderNotificationProvider>
            )}

            {activeView === 'supplier' && session.fornecedorId && (
              <FornecedorDashboard fornecedorId={session.fornecedorId} onLogout={handleLogout} />
            )}
          </Suspense>
          </ErrorBoundary>

          {['public', 'marketplace', 'client'].includes(activeView) && <AdvertisingSlot placementCode="SITE_STICKY_BOTTOM" variant="sticky" />}
          {isSessionActive && <FullscreenPrompt />}
          {isSessionActive && <WhatsAppButton />}
          <Toaster position="top-right" />
        </div>
      </QueryClientProvider>
    </FileViewerProvider>
  );
}
