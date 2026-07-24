import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GSAEnterpriseHomeFinal } from '../components/public/GSAEnterpriseHomeFinal';
import { LoginHub } from '../components/public/LoginHub';
import { ClientAccessModal, type ClientAccessMode } from '../components/auth/ClientAccessModal';
import { RestrictedAccessModal, type RestrictedTab } from '../components/auth/RestrictedAccessModal';
import {
  getServicePackageSlug,
  type Audience,
  type IconItem,
  type PublicPage,
  type ServicePackage,
} from '../data/publicServiceCatalog';
import { usePublicPageMetadata } from '../hooks/usePublicPageMetadata';
import { fetchPublicServiceCatalog } from '../lib/serviceCatalog';

const SystemsPageFinal = lazy(() => import('../components/public/SystemsPageFinal').then((module) => ({ default: module.SystemsPageFinal })));
const AdvertisingPage = lazy(() => import('../components/public/AdvertisingPage').then((module) => ({ default: module.AdvertisingPage })));

interface HomeProps {
  onLoginClient: (id: string, isRecovery?: boolean) => void;
  onLoginAdmin: (adminDetails: { type: 'admin' | 'colaborador'; id?: string; nome?: string; modulos?: string[] }) => void;
  onLoginPrestador: (id: string) => void;
  onSupplierAccess: () => void;
  onGuestStore?: () => void;
  initialPublicPage?: PublicPage;
  initialServiceSlug?: string;
  initialPartnerSlug?: string;
  onPublicPageChange?: (page: PublicPage) => void;
  onServiceDetailChange?: (slug: string | null) => void;
  onPartnerDetailChange?: (slug: string | null) => void;
  onLoginPage?: () => void;
  loginOnly?: boolean;
  initialRestrictedTab?: RestrictedTab;
  onBackHome?: () => void;
}

function PublicPageLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm font-bold text-white/70" role="status">Carregando página...</div>;
}

export function Home({
  onLoginClient,
  onLoginAdmin,
  onLoginPrestador,
  onSupplierAccess,
  onGuestStore,
  initialPublicPage = 'home',
  initialServiceSlug,
  initialPartnerSlug,
  onPublicPageChange,
  onServiceDetailChange,
  onPartnerDetailChange,
  onLoginPage,
  loginOnly = false,
  initialRestrictedTab,
  onBackHome,
}: HomeProps) {
  const [publicPage, setPublicPage] = useState<PublicPage>(initialPublicPage);
  const [publicAudience, setPublicAudience] = useState<Audience>('PF');
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientMode, setClientMode] = useState<ClientAccessMode>('login');
  const [restrictedModalOpen, setRestrictedModalOpen] = useState(false);
  const [restrictedTab, setRestrictedTab] = useState<RestrictedTab>('prestador');
  const [managedPackages, setManagedPackages] = useState<ServicePackage[]>([]);
  const [managedServices, setManagedServices] = useState<IconItem[]>([]);

  const selectedPackage = useMemo(() => (
    initialServiceSlug
      ? managedPackages.find((item) => getServicePackageSlug(item) === initialServiceSlug) || null
      : null
  ), [initialServiceSlug, managedPackages]);

  usePublicPageMetadata(loginOnly ? 'home' : publicPage, selectedPackage, loginOnly);

  useEffect(() => {
    setPublicPage(initialPublicPage);
  }, [initialPublicPage]);

  useEffect(() => {
    if (!loginOnly || !initialRestrictedTab) return;
    setRestrictedTab(initialRestrictedTab);
    setRestrictedModalOpen(true);
  }, [initialRestrictedTab, loginOnly]);

  useEffect(() => {
    if (!loginOnly) return;
    const mode = new URLSearchParams(window.location.search).get('mode');
    if (mode !== 'login' && mode !== 'register') return;
    setClientMode(mode);
    setClientModalOpen(true);
  }, [loginOnly]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('msg') !== 'revoked') return;

    toast.error('Seu acesso foi encerrado pelo administrador. Entre em contato com o suporte.', {
      duration: 10000,
      position: 'top-center',
      icon: <ShieldAlert className="h-5 w-5 text-red-600" />,
    });

    params.delete('msg');
    const nextSearch = params.toString();
    const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, []);

  useEffect(() => {
    const handleOpenLogin = () => openClient('login');
    window.addEventListener('open-client-login', handleOpenLogin);
    return () => window.removeEventListener('open-client-login', handleOpenLogin);
  }, []);

  useEffect(() => {
    let active = true;
    fetchPublicServiceCatalog().then((catalog) => {
      if (!active) return;
      setManagedPackages(catalog.packages.map((item) => ({
        id: item.id,
        code: item.code,
        audience: item.audience,
        title: item.title,
        subtitle: item.subtitle,
        description: item.description,
        services: item.services,
      })));
      setManagedServices(catalog.services.map((item) => ({
        icon: BriefcaseBusiness,
        title: item.title,
        text: item.description,
      })));
    }).catch(() => {
      setManagedPackages([]);
      setManagedServices([]);
    });
    return () => { active = false; };
  }, []);

  const changePublicPage = (page: PublicPage) => {
    setPublicPage(page);
    if (page !== 'services') onServiceDetailChange?.(null);
    if (page !== 'partners') onPartnerDetailChange?.(null);
    onPublicPageChange?.(page);
  };

  const openClient = (mode: ClientAccessMode) => {
    setClientMode(mode);
    setClientModalOpen(true);
  };

  const openRestricted = (tab: RestrictedTab) => {
    setRestrictedTab(tab);
    setRestrictedModalOpen(true);
  };

  const handlePublicLogin = onLoginPage ?? (() => openClient('login'));

  return (
    <>
      {loginOnly ? (
        <LoginHub
          onBack={onBackHome}
          onClientLogin={() => openClient('login')}
          onClientRegister={() => openClient('register')}
          onRestrictedAccess={() => openRestricted('prestador')}
        />
      ) : publicPage === 'systems' ? (
        <Suspense fallback={<PublicPageLoading />}>
          <SystemsPageFinal onBack={() => changePublicPage('home')} onLogin={handlePublicLogin} />
        </Suspense>
      ) : publicPage === 'ads' || publicPage === 'advertise' ? (
        <Suspense fallback={<PublicPageLoading />}>
          <AdvertisingPage mode={publicPage === 'advertise' ? 'advertise' : 'showcase'} onBack={() => changePublicPage('home')} onLogin={handlePublicLogin} />
        </Suspense>
      ) : (
        <GSAEnterpriseHomeFinal
          publicPage={publicPage}
          setPublicPage={changePublicPage}
          publicAudience={publicAudience}
          setPublicAudience={setPublicAudience}
          servicePackages={managedPackages}
          publicServices={managedServices}
          initialServiceSlug={initialServiceSlug}
          initialPartnerSlug={initialPartnerSlug}
          onServiceDetailChange={onServiceDetailChange}
          onPartnerDetailChange={onPartnerDetailChange}
          onGuestStore={onGuestStore}
          onClientLogin={handlePublicLogin}
          onAdminLogin={() => openRestricted('gestao')}
        />
      )}

      <ClientAccessModal isOpen={clientModalOpen} initialMode={clientMode} onClose={() => setClientModalOpen(false)} onLoginClient={onLoginClient} />
      <RestrictedAccessModal isOpen={restrictedModalOpen} initialTab={restrictedTab} onClose={() => setRestrictedModalOpen(false)} onLoginAdmin={onLoginAdmin} onLoginPrestador={onLoginPrestador} />
    </>
  );
}
