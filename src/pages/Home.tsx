import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GSAEnterpriseHome } from '../components/public/GSAEnterpriseHome';
import { SystemsPage } from '../components/public/SystemsPage';
import { LoginHub } from '../components/public/LoginHub';
import { ClientAccessModal, type ClientAccessMode } from '../components/auth/ClientAccessModal';
import { RestrictedAccessModal, type RestrictedTab } from '../components/auth/RestrictedAccessModal';
import {
  getServicePackageSlug,
  publicProducts,
  publicServices,
  servicePackages,
  type Audience,
  type PublicPage,
} from '../data/publicServiceCatalog';
import { usePublicPageMetadata } from '../hooks/usePublicPageMetadata';

interface HomeProps {
  onLoginClient: (id: string, isRecovery?: boolean) => void;
  onLoginAdmin: (adminDetails: { type: 'admin' | 'colaborador'; id?: string; nome?: string; modulos?: string[] }) => void;
  onLoginPrestador: (id: string) => void;
  onGuestStore?: () => void;
  initialPublicPage?: PublicPage;
  initialServiceSlug?: string;
  initialPartnerSlug?: string;
  onPublicPageChange?: (page: PublicPage) => void;
  onServiceDetailChange?: (slug: string | null) => void;
  onPartnerDetailChange?: (slug: string | null) => void;
  onLoginPage?: () => void;
  loginOnly?: boolean;
  onBackHome?: () => void;
}

export function Home({
  onLoginClient,
  onLoginAdmin,
  onLoginPrestador,
  onGuestStore,
  initialPublicPage = 'home',
  initialServiceSlug,
  initialPartnerSlug,
  onPublicPageChange,
  onServiceDetailChange,
  onPartnerDetailChange,
  onLoginPage,
  loginOnly = false,
  onBackHome,
}: HomeProps) {
  const [publicPage, setPublicPage] = useState<PublicPage>(initialPublicPage);
  const [publicAudience, setPublicAudience] = useState<Audience>('PF');
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientMode, setClientMode] = useState<ClientAccessMode>('login');
  const [restrictedModalOpen, setRestrictedModalOpen] = useState(false);
  const [restrictedTab, setRestrictedTab] = useState<RestrictedTab>('prestador');

  const selectedPackage = useMemo(() => (
    initialServiceSlug
      ? servicePackages.find((item) => getServicePackageSlug(item) === initialServiceSlug) || null
      : null
  ), [initialServiceSlug]);

  usePublicPageMetadata(loginOnly ? 'home' : publicPage, selectedPackage, loginOnly);

  useEffect(() => {
    setPublicPage(initialPublicPage);
  }, [initialPublicPage]);

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
        <SystemsPage
          onBack={() => changePublicPage('home')}
          onLogin={handlePublicLogin}
        />
      ) : (
        <GSAEnterpriseHome
          publicPage={publicPage}
          setPublicPage={changePublicPage}
          publicAudience={publicAudience}
          setPublicAudience={setPublicAudience}
          servicePackages={servicePackages}
          publicProducts={publicProducts}
          publicServices={publicServices}
          initialServiceSlug={initialServiceSlug}
          initialPartnerSlug={initialPartnerSlug}
          onServiceDetailChange={onServiceDetailChange}
          onPartnerDetailChange={onPartnerDetailChange}
          onGuestStore={onGuestStore}
          onClientLogin={handlePublicLogin}
          onAdminLogin={() => openRestricted('gestao')}
        />
      )}

      <ClientAccessModal
        isOpen={clientModalOpen}
        initialMode={clientMode}
        onClose={() => setClientModalOpen(false)}
        onLoginClient={onLoginClient}
      />

      <RestrictedAccessModal
        isOpen={restrictedModalOpen}
        initialTab={restrictedTab}
        onClose={() => setRestrictedModalOpen(false)}
        onLoginAdmin={onLoginAdmin}
        onLoginPrestador={onLoginPrestador}
      />
    </>
  );
}
