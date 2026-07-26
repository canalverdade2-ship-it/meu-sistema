import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { BriefcaseBusiness, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GSAEnterpriseHomeFinal } from '../components/public/GSAEnterpriseHomeFinal';
import { LoginHub } from '../components/public/LoginHub';
import { ClientAccessModalWithReturn as ClientAccessModal, type ClientAccessMode } from '../components/auth/ClientAccessModalWithReturn';
import {
  getServicePackageSlug,
  type Audience,
  type IconItem,
  type PublicPage,
  type ServicePackage,
} from '../data/publicServiceCatalog';
import { usePublicPageMetadata } from '../hooks/usePublicPageMetadata';
import { fetchPublicServiceCatalog } from '../lib/serviceCatalog';
import type { ClientPersonType } from '../lib/sessionService';

const SystemsPageFinal = lazy(() => import('../components/public/SystemsPageFinal').then((module) => ({ default: module.SystemsPageFinal })));
const AdvertisingPage = lazy(() => import('../components/public/AdvertisingPage').then((module) => ({ default: module.AdvertisingPage })));

interface HomeProps {
  onLoginClient: (id: string, isRecovery?: boolean, personType?: ClientPersonType) => void;
  onGuestStore?: () => void;
  initialPublicPage?: PublicPage;
  initialServiceSlug?: string;
  initialPartnerSlug?: string;
  onPublicPageChange?: (page: PublicPage) => void;
  onServiceDetailChange?: (slug: string | null) => void;
  onPartnerDetailChange?: (slug: string | null) => void;
  onLoginPage?: () => void;
  onPersonalLoginPage?: () => void;
  onBusinessLoginPage?: () => void;
  onProviderPage?: () => void;
  onSupplierPage?: () => void;
  onRestrictedLoginPage?: () => void;
  loginOnly?: boolean;
  onBackHome?: () => void;
}

function PublicPageLoading() {
  return <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm font-bold text-white/70" role="status">Carregando página...</div>;
}

export function Home({
  onLoginClient,
  onGuestStore,
  initialPublicPage = 'home',
  initialServiceSlug,
  initialPartnerSlug,
  onPublicPageChange,
  onServiceDetailChange,
  onPartnerDetailChange,
  onLoginPage,
  onPersonalLoginPage,
  onBusinessLoginPage,
  onProviderPage,
  onSupplierPage,
  onRestrictedLoginPage,
  loginOnly = false,
  onBackHome,
}: HomeProps) {
  const [publicPage, setPublicPage] = useState<PublicPage>(initialPublicPage);
  const [publicAudience, setPublicAudience] = useState<Audience>('PF');
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientMode, setClientMode] = useState<ClientAccessMode>('login');
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

  const handlePublicLogin = onLoginPage ?? (() => openClient('login'));
  const modalPersonType: ClientPersonType = new URLSearchParams(window.location.search).get('type') === 'pj' ? 'pj' : 'pf';

  return (
    <>
      {loginOnly ? (
        <LoginHub
          onBack={onBackHome}
          onPersonalAccess={onPersonalLoginPage ?? (() => openClient('login'))}
          onBusinessAccess={onBusinessLoginPage ?? (() => openClient('login'))}
          onProviderAccess={onProviderPage}
          onSupplierAccess={onSupplierPage}
          onRestrictedAccess={onRestrictedLoginPage}
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
          onAdminLogin={onRestrictedLoginPage ?? handlePublicLogin}
        />
      )}

      <ClientAccessModal isOpen={clientModalOpen} initialMode={clientMode} initialPersonType={modalPersonType} onClose={() => setClientModalOpen(false)} onLoginClient={onLoginClient} />
    </>
  );
}
