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

const PUBLIC_MOBILE_STYLES = `
  body.gsa-public-systems,
  body.gsa-public-brand {
    overflow-x: hidden;
    overscroll-behavior-x: none;
  }

  body.gsa-public-systems main,
  body.gsa-public-brand main {
    overflow-x: clip;
  }

  body.gsa-public-systems main *,
  body.gsa-public-brand main * {
    min-width: 0;
  }

  body.gsa-public-systems main h1,
  body.gsa-public-systems main h2,
  body.gsa-public-systems main h3,
  body.gsa-public-brand main h1,
  body.gsa-public-brand main h2,
  body.gsa-public-brand main h3,
  body.gsa-public-systems main p,
  body.gsa-public-brand main p {
    overflow-wrap: anywhere;
  }

  body.gsa-public-systems button,
  body.gsa-public-brand button {
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
  }

  body.gsa-public-systems main > section:first-of-type {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    background:
      radial-gradient(circle at 92% 16%, rgba(199, 164, 88, 0.16), transparent 25rem),
      linear-gradient(135deg, #f8f5ee 0%, #f1ece2 52%, #eae2d4 100%) !important;
    border-bottom-color: #d8cfbf !important;
    color: #17202a !important;
  }

  body.gsa-public-systems main > section:first-of-type::before {
    content: '';
    position: absolute;
    inset: 0 0 auto;
    z-index: -1;
    height: 3px;
    background: linear-gradient(90deg, #8a6b2f 0%, #d7b96e 36%, rgba(215, 185, 110, 0) 82%);
  }

  body.gsa-public-systems main > section:first-of-type::after {
    content: '';
    position: absolute;
    z-index: -1;
    right: -10rem;
    bottom: -15rem;
    width: 34rem;
    height: 34rem;
    border: 1px solid rgba(138, 107, 47, 0.12);
    border-radius: 50%;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child {
    position: relative;
    padding-left: 1.5rem;
    border-left: 3px solid #c7a458;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > p:first-child {
    display: inline-flex;
    align-items: center;
    gap: 0.65rem;
    color: #806128 !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > p:first-child::before {
    content: '';
    width: 2.5rem;
    height: 1px;
    background: #b8903e;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child h1 {
    max-width: 13ch;
    color: #111820 !important;
    text-wrap: balance;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > p:nth-of-type(2) {
    max-width: 42rem;
    color: #525e68 !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button:first-child {
    border: 1px solid #c3a052 !important;
    background: linear-gradient(180deg, #dfc57f 0%, #d3b363 100%) !important;
    color: #151b22 !important;
    box-shadow: 0 14px 30px rgba(93, 71, 27, 0.18);
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button:first-child:hover {
    transform: translateY(-1px);
    background: linear-gradient(180deg, #e6cf8f 0%, #d9bc70 100%) !important;
    box-shadow: 0 18px 36px rgba(93, 71, 27, 0.22);
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button:nth-child(2) {
    border-color: #858f98 !important;
    background: rgba(255, 255, 255, 0.55) !important;
    color: #17202a !important;
    box-shadow: 0 8px 22px rgba(35, 45, 54, 0.07);
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button:nth-child(2):hover {
    border-color: #8a6b2f !important;
    background: rgba(255, 255, 255, 0.82) !important;
    color: #6f5427 !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul {
    overflow: hidden;
    border: 1px solid #d8d0c3 !important;
    border-radius: 0.85rem;
    background: rgba(255, 255, 255, 0.48);
    padding: 0 !important;
    box-shadow: 0 12px 30px rgba(43, 50, 56, 0.06);
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul li {
    min-height: 4.6rem;
    align-items: center;
    padding: 1rem 1.1rem;
    color: #59636d !important;
  }

  body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul li + li {
    border-left: 1px solid #ddd5c8;
  }

  body.gsa-public-systems main > section:first-of-type > div > aside {
    position: relative;
    overflow: hidden;
    border-color: rgba(215, 185, 110, 0.32) !important;
    border-radius: 1rem;
    background: linear-gradient(180deg, #132231 0%, #0b1723 100%) !important;
    color: #ffffff !important;
    box-shadow:
      inset 0 3px 0 #d7b96e,
      0 32px 70px rgba(18, 27, 36, 0.22);
  }

  body.gsa-public-systems main > section:first-of-type > div > aside::after {
    content: '';
    position: absolute;
    right: -5rem;
    top: -6rem;
    width: 13rem;
    height: 13rem;
    border: 1px solid rgba(215, 185, 110, 0.14);
    border-radius: 50%;
  }

  @media (max-width: 767px) {
    body.gsa-public-systems main h1,
    body.gsa-public-brand main h1 {
      font-size: clamp(2.15rem, 10.5vw, 3.15rem) !important;
      line-height: 1.04 !important;
      letter-spacing: -0.035em !important;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child h1 {
      max-width: 12.5ch;
      font-size: clamp(2.15rem, 9vw, 2.8rem) !important;
      line-height: 1.02 !important;
      letter-spacing: -0.03em !important;
    }

    body.gsa-public-systems main h2,
    body.gsa-public-brand main h2 {
      font-size: clamp(1.8rem, 8vw, 2.55rem) !important;
      line-height: 1.08 !important;
    }

    body.gsa-public-systems main h3,
    body.gsa-public-brand main h3 {
      line-height: 1.18 !important;
    }

    body.gsa-public-systems main > section:first-of-type > div,
    body.gsa-public-brand main > section:first-of-type > div {
      min-height: auto !important;
      padding-top: 3.25rem !important;
      padding-bottom: 3.25rem !important;
    }

    body.gsa-public-systems main > section:first-of-type > div {
      gap: 2.5rem !important;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child,
    body.gsa-public-brand main > section:first-of-type > div > div:first-child {
      width: 100%;
      max-width: none;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child {
      padding-left: 1rem;
      border-left-width: 2px;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child > p:first-child::before {
      width: 1.6rem;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child > p:nth-of-type(2) {
      font-size: 1rem !important;
      line-height: 1.75 !important;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button,
    body.gsa-public-brand main > section:first-of-type > div > div:first-child > div[class*="flex-col"] > button {
      width: 100%;
      min-height: 50px;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul {
      display: block !important;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul li {
      min-height: 0;
      padding: 0.9rem 1rem;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child > ul li + li {
      border-left: 0;
      border-top: 1px solid #ddd5c8;
    }

    body.gsa-public-systems main > section:first-of-type > div > aside {
      border-radius: 0.85rem;
    }

    body.gsa-public-systems main section,
    body.gsa-public-brand main section {
      scroll-margin-top: 5rem;
    }

    body.gsa-public-systems main details summary,
    body.gsa-public-brand main details summary {
      font-size: 1.05rem !important;
      line-height: 1.35 !important;
    }

    body.gsa-public-systems main [class*="overflow-x-auto"],
    body.gsa-public-brand main [class*="overflow-x-auto"] {
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      overscroll-behavior-inline: contain;
    }

    body.gsa-public-systems main [class*="overflow-x-auto"]::-webkit-scrollbar,
    body.gsa-public-brand main [class*="overflow-x-auto"]::-webkit-scrollbar {
      display: none;
    }

    body.gsa-public-systems footer,
    body.gsa-public-brand footer {
      padding-bottom: max(2rem, env(safe-area-inset-bottom));
    }
  }

  @media (max-width: 420px) {
    body.gsa-public-systems main h1,
    body.gsa-public-brand main h1 {
      font-size: clamp(2rem, 10vw, 2.65rem) !important;
    }

    body.gsa-public-systems main > section:first-of-type > div > div:first-child h1 {
      font-size: clamp(2rem, 8.7vw, 2.45rem) !important;
    }

    body.gsa-public-systems main h2,
    body.gsa-public-brand main h2 {
      font-size: clamp(1.65rem, 8vw, 2.15rem) !important;
    }

    .gsa-public-header-login-label {
      display: none;
    }

    .gsa-public-header-login {
      width: 42px;
      height: 42px;
      padding: 0 !important;
      justify-content: center;
    }
  }
`;

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

  useEffect(() => {
    const bodyClass = currentPage === 'systems'
      ? 'gsa-public-systems'
      : currentPage === 'brand-journey'
        ? 'gsa-public-brand'
        : null;

    document.body.classList.remove('gsa-public-systems', 'gsa-public-brand');
    if (bodyClass) document.body.classList.add(bodyClass);

    return () => {
      if (bodyClass) document.body.classList.remove(bodyClass);
    };
  }, [currentPage]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeMenu = () => setMobileMenuOpen(false);
    window.addEventListener('resize', closeMenu);
    return () => window.removeEventListener('resize', closeMenu);
  }, [mobileMenuOpen]);

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
    <>
      {(currentPage === 'systems' || currentPage === 'brand-journey') && <style>{PUBLIC_MOBILE_STYLES}</style>}
      <header
        className={`fixed inset-x-0 top-0 z-[90] transition-all duration-300 ${
          isSolidBar
            ? 'border-b border-white/10 bg-[#080c12]/95 py-2.5 shadow-xl backdrop-blur-xl sm:py-3'
            : 'border-transparent bg-transparent py-4 sm:py-5'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => handleLinkClick(NAV_LINKS[0])}
            aria-label="Ir para a página inicial"
            className="flex min-w-0 items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
          >
            <LogoGSA size="md" variant="light" />
          </button>

          {currentPage !== 'home' && (
            <nav aria-label="Navegação principal desktop" className="hidden items-center gap-1 lg:flex xl:gap-2">
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

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={onClientLogin}
              aria-label="Acessar área do cliente"
              className="gsa-public-header-login inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#d8bd73]/50 bg-white/5 px-3 py-2 text-xs font-black uppercase tracking-wider text-[#d8bd73] transition hover:bg-[#d8bd73]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] sm:px-4"
            >
              <LogIn className="h-4 w-4" />
              <span className="gsa-public-header-login-label">Login</span>
            </button>

            {currentPage !== 'home' && (
              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                aria-expanded={mobileMenuOpen}
                aria-controls="public-mobile-navigation"
                aria-label={mobileMenuOpen ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] lg:hidden"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        {mobileMenuOpen && currentPage !== 'home' && (
          <div
            id="public-mobile-navigation"
            className="max-h-[calc(100dvh-4.5rem)] overflow-y-auto overscroll-contain border-t border-white/10 bg-[#080c12] px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl animate-in slide-in-from-top duration-200 sm:px-4 lg:hidden"
          >
            <nav aria-label="Navegação principal mobile" className="flex flex-col gap-1.5">
              {NAV_LINKS.map((link) => {
                const Icon = link.icon;
                const isActive = currentPage === link.id;

                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleLinkClick(link)}
                    className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left text-xs font-bold transition ${
                      isActive
                        ? 'border border-[#d8bd73]/40 bg-[#d8bd73]/15 text-[#d8bd73]'
                        : 'text-white/80 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-[#d8bd73]' : 'text-white/60'}`} />
                    <span>{link.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </header>
    </>
  );
}
