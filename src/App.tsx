import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Home } from './pages/Home';
import { Toaster } from 'react-hot-toast';
import { AdminNotificationProvider } from './hooks/useAdminNotifications';
import { logService } from './lib/logService';
import { useAutoLogout } from './hooks/useAutoLogout';
import { sessionService } from './lib/sessionService';
import { ClientNotificationProvider } from './hooks/useClientNotifications';
import { ProviderNotificationProvider } from './hooks/useProviderNotifications';
import { FullscreenPrompt } from './components/ui/FullscreenPrompt';
import { WhatsAppButton } from './components/ui/WhatsAppButton';
import { FileViewerProvider } from './contexts/FileViewerContext';

// Roteamento
import { useAppLocation } from './routing/useAppLocation';
import { resolveLegacyRoute } from './routing/legacyRouteResolver';
import { routes } from './routing/routeCatalog';
import { navigate, replace } from './routing/navigationService';
import { isRouteAllowed } from './routing/routeSecurity';
import { readSafeReturnTo } from './routing/safeReturnTo';

const queryClient = new QueryClient();

const AdminPanel = lazy(() => import('./pages/AdminPanel').then((module) => ({ default: module.AdminPanel })));
const ClientPortal = lazy(() => import('./pages/ClientPortal').then((module) => ({ default: module.ClientPortal })));
const PrestadorDashboard = lazy(() => import('./pages/Prestador/PrestadorDashboard').then((module) => ({ default: module.PrestadorDashboard })));
const MarketplaceGSAStore = lazy(() => import('./components/client/marketplace/MarketplaceGSAStore'));

function RouteLoading() {
  return <div className="flex min-h-[50vh] items-center justify-center bg-neutral-50 text-sm font-semibold text-neutral-600" role="status">Carregando ambiente...</div>;
}

export default function App() {
  const route = useAppLocation();

  const [session, setSession] = useState<{ 
    clientId?: string; 
    adminAuth?: boolean; 
    adminType?: 'admin' | 'colaborador';
    colaboradorId?: string;
    colaboradorNome?: string;
    colaboradorModulos?: string[];
    prestadorId?: string 
  }>({});

  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const isSessionActive = !!(session.clientId || session.adminAuth || session.prestadorId);

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
            setSession({ clientId: restored.atorId });
            if (restored.precisa_trocar_senha && window.location.pathname !== '/cliente/perfil') {
              replace('/cliente/perfil?modal=alterar-senha&origem=recuperacao');
            }
          } else if (restored.atorTipo === 'admin' || restored.atorTipo === 'colaborador') {
            setSession({ 
              adminAuth: true, 
              adminType: restored.atorTipo, 
              colaboradorId: restored.atorId !== '00000000-0000-0000-0000-000000000000' ? restored.atorId : undefined,
              colaboradorNome: restored.atorNome,
              colaboradorModulos: restored.modulos || [],
            });
          } else if (restored.atorTipo === 'prestador') {
            setSession({ prestadorId: restored.atorId });
          }
        } else if (['client', 'admin', 'provider'].includes(route.area)) {
          const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
          replace(`${routes.login.root()}?returnTo=${returnTo}`);
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      } finally {
        setIsLoadingSession(false);
      }
    };
    restore();
  }, [route.area]);

  useAutoLogout(() => {
    handleLogout(true);
  }, isSessionActive);

  if (isLoadingSession) {
    return <div className="min-h-screen flex items-center justify-center bg-neutral-50">Carregando sessão...</div>;
  }

  const handleLoginClient = (clientId: string, isRecovery: boolean = false) => {
    setSession({ clientId });
    const returnTo = readSafeReturnTo(window.location.search, ['/cliente', '/marketplace']);

    if (isRecovery) {
      replace('/cliente/perfil?modal=alterar-senha&origem=recuperacao');
    } else if (returnTo) {
      replace(returnTo);
    } else {
      replace(routes.client.dashboard());
    }
  };

  const handleLoginAdmin = (adminDetails: { type: 'admin' | 'colaborador', id?: string, nome?: string, modulos?: string[] }) => {
    setSession({ 
      adminAuth: true, 
      adminType: adminDetails.type, 
      colaboradorId: adminDetails.id, 
      colaboradorNome: adminDetails.nome,
      colaboradorModulos: adminDetails.modulos,
    });

    const returnTo = readSafeReturnTo(window.location.search, ['/admin']);
    replace(returnTo || routes.admin.dashboard());
  };

  const handleLoginPrestador = (prestadorId: string) => {
    setSession({ prestadorId });
    const returnTo = readSafeReturnTo(window.location.search, ['/prestador']);
    replace(returnTo || routes.provider.dashboard());
  };

  const handleLogout = async (isAuto = false) => {
    if (session.adminAuth) {
      await logService.logAction({ ator_tipo: session.adminType || 'admin', ator_id: session.colaboradorId, acao: 'LOGOUT', detalhes: isAuto ? 'Logout automático por inatividade (10min)' : 'Logout efetuado com sucesso' });
    } else if (session.clientId) {
      await logService.logAction({ ator_tipo: 'cliente', ator_id: session.clientId, acao: 'LOGOUT', detalhes: isAuto ? 'Logout automático por inatividade (10min)' : 'Logout efetuado com sucesso' });
    } else if (session.prestadorId) {
      await logService.logAction({ ator_tipo: 'prestador', ator_id: session.prestadorId, acao: 'LOGOUT', detalhes: isAuto ? 'Logout automático por inatividade (10min)' : 'Logout efetuado com sucesso' });
    }

    await sessionService.endSession();
    localStorage.removeItem('adminType');
    localStorage.removeItem('colaboradorId');
    localStorage.removeItem('colaboradorNome');
    setSession({});
    replace(routes.public.home());
  };

  const activeView = route.area;

  if (!isRouteAllowed(route.area, session)) {
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    replace(`${routes.login.root()}?returnTo=${returnTo}`);
    return null;
  }

  return (
    <FileViewerProvider>
      <QueryClientProvider client={queryClient}>
        <div className="min-h-screen bg-[#f8f7f5] font-sans text-neutral-900">
          <Suspense fallback={<RouteLoading />}>
            {activeView === 'public' && (
              <Home 
                onLoginClient={handleLoginClient} 
                onLoginAdmin={handleLoginAdmin} 
                onLoginPrestador={handleLoginPrestador} 
                onGuestStore={() => navigate(routes.marketplace.root())}
                initialPublicPage={route.module === 'services' ? 'services' : route.module === 'systems' ? 'systems' : 'home'}
                initialServiceSlug={route.module === 'services' ? route.itemId : undefined}
                onServiceDetailChange={(slug) => navigate(slug ? routes.public.serviceDetail(slug) : routes.public.services())}
                onPublicPageChange={(page) => navigate(page === 'home' ? routes.public.home() : page === 'services' ? routes.public.services() : routes.public.systems())}
                onLoginPage={() => navigate(routes.login.root())}
              />
            )}

            {activeView === 'login' && (
              <Home
                onLoginClient={handleLoginClient}
                onLoginAdmin={handleLoginAdmin}
                onLoginPrestador={handleLoginPrestador}
                onGuestStore={() => navigate(routes.marketplace.root())}
                initialPublicPage="home"
                onPublicPageChange={(page) => navigate(page === 'home' ? routes.public.home() : page === 'services' ? routes.public.services() : routes.public.systems())}
                loginOnly
                onBackHome={() => navigate(routes.public.home())}
              />
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
                }} 
                onBackToSite={() => navigate(routes.public.home())}
                onRequireAuth={() => {
                  const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
                  navigate(`${routes.login.root()}?returnTo=${returnTo}`);
                }} 
              />
            )}

            {activeView === 'marketplace' && session.clientId && (
              <ClientNotificationProvider clientId={session.clientId}>
                <ClientPortal 
                  clientId={session.clientId} 
                  onLogout={handleLogout} 
                  initialModule="gsa_store"
                  initialStoreTab={route.submodule?.replace('loja-', '') || 'home'}
                  initialStoreItemId={route.itemId}
                />
              </ClientNotificationProvider>
            )}

            {activeView === 'admin' && session.adminAuth && (
              <AdminNotificationProvider>
                <AdminPanel 
                  onLogout={handleLogout} 
                  adminType={session.adminType || 'admin'} 
                  colaboradorId={session.colaboradorId} 
                  colaboradorModulos={session.colaboradorModulos || []} 
                />
              </AdminNotificationProvider>
            )}

            {activeView === 'client' && session.clientId && (
              <ClientNotificationProvider clientId={session.clientId}>
                <ClientPortal 
                  clientId={session.clientId} 
                  onLogout={handleLogout} 
                  initialModule={route.module}
                />
              </ClientNotificationProvider>
            )}

            {activeView === 'provider' && session.prestadorId && (
              <ProviderNotificationProvider prestadorId={session.prestadorId}>
                <PrestadorDashboard prestadorId={session.prestadorId} onLogout={handleLogout} />
              </ProviderNotificationProvider>
            )}
          </Suspense>

          {isSessionActive && <FullscreenPrompt />}
          {isSessionActive && <WhatsAppButton />}
          <Toaster position="top-right" />
        </div>
      </QueryClientProvider>
    </FileViewerProvider>
  );
}
