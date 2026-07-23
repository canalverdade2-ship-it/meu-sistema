import { useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  Calculator,
  Code2,
  Home as HomeIcon,
  LogIn,
  Menu,
  Palette,
  ShoppingBag,
  X,
} from 'lucide-react';
import { LogoGSA } from '../../ui/LogoGSA';
import { navigate } from '../../../routing/navigationService';
import type { PublicPage } from '../../../data/publicServiceCatalog';

export type PublicHeaderPage = PublicPage | 'brand-journey' | 'marketplace';

interface PublicHeaderProps {
  currentPage?: PublicHeaderPage;
  onNavigatePage?: (page: PublicPage) => void;
  onGuestStore?: () => void;
  onClientLogin: () => void;
}

interface HeaderNavLink {
  id: PublicHeaderPage;
  label: string;
  href: string;
  icon: typeof HomeIcon;
}

const NAV_LINKS: HeaderNavLink[] = [
  { id: 'home', label: 'Início', href: '/', icon: HomeIcon },
  { id: 'services', label: 'Serviços e Assinaturas', href: '/servicos-e-assinaturas', icon: BriefcaseBusiness },
  { id: 'marketplace', label: 'Marketplace GSA', href: '/marketplace', icon: ShoppingBag },
  { id: 'systems', label: 'Sites e Sistemas', href: '/criacao-de-site-e-sistemas', icon: Code2 },
  { id: 'brand-journey', label: 'Construção de Marca', href: '/empresa-do-zero-ao-digital', icon: Palette },
  { id: 'free-tools', label: 'Serviços Gratuitos', href: '/servicos-gratuitos', icon: Calculator },
];

export function PublicHeader({
  currentPage = 'home',
  onNavigatePage,
  onGuestStore,
  onClientLogin,
}: PublicHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isHeaderVisible = currentPage !== 'home' || isScrolled;

  const handleLinkClick = (link: HeaderNavLink) => {
    setMobileMenuOpen(false);

    if (link.id === 'marketplace') {
      if (onGuestStore) {
        onGuestStore();
      } else {
        navigate('/marketplace');
      }
      return;
    }

    if (link.id === 'brand-journey') {
      navigate('/empresa-do-zero-ao-digital');
      return;
    }

    const publicPageId = link.id as PublicPage;
    if (onNavigatePage) {
      onNavigatePage(publicPageId);
    }
    navigate(link.href);
  };

  const isSolidBar = isScrolled || currentPage !== 'home';

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[90] transition-all duration-300 ${
        isSolidBar
          ? 'border-b border-white/10 bg-[#080c12]/95 py-3 shadow-xl backdrop-blur-xl'
          : 'border-transparent bg-transparent py-5'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <button
          type="button"
          onClick={() => handleLinkClick(NAV_LINKS[0])}
          aria-label="Ir para a página inicial"
          className="flex items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
        >
          <LogoGSA size="md" variant="light" />
        </button>

        {/* Links de navegação desktop (exibidos apenas ao navegar para as páginas internas) */}
        {currentPage !== 'home' && (
          <nav aria-label="Navegação principal desktop" className="hidden lg:flex items-center gap-1 xl:gap-2">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = currentPage === link.id;

              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleLinkClick(link)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] ${
                    isActive
                      ? 'border border-[#d8bd73]/40 bg-[#d8bd73]/15 text-[#d8bd73] shadow-sm'
                      : 'text-white/75 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#d8bd73]' : 'text-white/60'}`} />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        )}

        {/* Ações à direita */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClientLogin}
            className="inline-flex items-center gap-2 rounded-lg border border-[#d8bd73]/50 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-[#d8bd73] transition hover:bg-[#d8bd73]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
          >
            <LogIn className="h-4 w-4" />
            <span>Login</span>
          </button>

          {/* Botão menu mobile (exibido apenas em páginas internas) */}
          {currentPage !== 'home' && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
              className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Menu mobile expansível */}
      {mobileMenuOpen && currentPage !== 'home' && (
        <div className="border-t border-white/10 bg-[#080c12] px-4 pb-5 pt-3 lg:hidden shadow-2xl animate-in slide-in-from-top duration-200">
          <nav aria-label="Navegação principal mobile" className="flex flex-col gap-1.5">
            {NAV_LINKS.map((link) => {
              const Icon = link.icon;
              const isActive = currentPage === link.id;

              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleLinkClick(link)}
                  className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-xs font-bold transition text-left ${
                    isActive
                      ? 'border border-[#d8bd73]/40 bg-[#d8bd73]/15 text-[#d8bd73]'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-[#d8bd73]' : 'text-white/60'}`} />
                  <span>{link.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
