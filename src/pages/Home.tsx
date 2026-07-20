import { useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { GSAEnterpriseHome } from '../components/public/GSAEnterpriseHome';
import { SystemsPage } from '../components/public/SystemsPage';
import { LoginHub } from '../components/public/LoginHub';
import { ClientAccessModal, type ClientAccessMode } from '../components/auth/ClientAccessModal';
import { RestrictedAccessModal, type RestrictedTab } from '../components/auth/RestrictedAccessModal';
import {
  publicProducts,
  publicServices,
  servicePackages,
  type Audience,
  type PublicPage,
} from '../data/publicServiceCatalog';

interface HomeProps {
  onLoginClient: (id: string, isRecovery?: boolean) => void;
  onLoginAdmin: (adminDetails: { type: 'admin' | 'colaborador'; id?: string; modulos?: string[] }) => void;
  onLoginPrestador: (id: string) => void;
  onGuestStore?: () => void;
  initialPublicPage?: PublicPage;
  onPublicPageChange?: (page: PublicPage) => void;
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
  onPublicPageChange,
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
    window.history.replaceState({}, document.title, window.location.pathname);
  }, []);

  useEffect(() => {
    const handleOpenLogin = () => openClient('login');
    window.addEventListener('open-client-login', handleOpenLogin);
    return () => window.removeEventListener('open-client-login', handleOpenLogin);
  }, []);

  const changePublicPage = (page: PublicPage) => {
    setPublicPage(page);
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
