import { MarketplaceHome } from './MarketplaceHome';
import { EcommerceHome } from '../store/EcommerceHome';
import { ProductPage } from '../store/ProductPage';
import { OrderSuccessPage } from '../store/OrderSuccessPage';
import { CheckoutPage } from '../store/CheckoutPage';
import { PurchasesPage } from '../store/PurchasesPage';
import { WishlistPage } from '../store/WishlistPage';
import { VaquinhaPublicPage } from '../store/VaquinhaPublicPage';
import { StoreHub } from '../StoreHub';
import { ClientGSAStore } from '../ClientGSAStore';
import { EcommerceHeader } from '../store/EcommerceHeader';
import { BlogHome } from '../store/BlogHome';
import { BlogPostPage } from '../store/BlogPostPage';
import { ClassifiedsHubPage } from './ClassifiedsHubPage';
import { useAppLocation } from '../../../routing/useAppLocation';
import { routes } from '../../../routing/routeCatalog';
import { navigate } from '../../../routing/navigationService';

import { TravelHubMenu } from './travel/TravelHubMenu';
import { TravelOffersLandingPage } from './travel/TravelOffersLandingPage';
import { TravelCategoryPage } from './travel/TravelCategoryPage';
import { TravelPackageDetailPage } from './travel/TravelPackageDetailPage';
import { TravelQuoteRequestPage } from './travel/TravelQuoteRequestPage';
import { TravelReservationPage } from './travel/TravelReservationPage';
import { MyTripsPage } from './travel/MyTripsPage';
import { TravelProposalsPage } from './travel/TravelProposalsPage';
import { TravelCancellationsPage } from './travel/TravelCancellationsPage';
import { TravelSupportPage } from './travel/TravelSupportPage';

import { ClassifiedDetailPage } from './classifieds/ClassifiedDetailPage';
import { RealEstateMarketplacePage } from './classifieds/RealEstateMarketplacePage';
import { VehiclesMarketplacePage } from './classifieds/VehiclesMarketplacePage';
import { GeneralClassifiedsPage } from './classifieds/GeneralClassifiedsPage';
import { MyClassifiedsPage } from './classifieds/MyClassifiedsPage';
import { CreateListingWizard } from './classifieds/CreateListingWizard';
import { MyNegotiationsPage } from './classifieds/MyNegotiationsPage';
import { ClassifiedsClientDashboard } from './classifieds/ClassifiedsClientDashboard';
import { MyClassifiedSalesPage } from './classifieds/MyClassifiedSalesPage';
import { MyClassifiedCommissionsPage } from './classifieds/MyClassifiedCommissionsPage';
import { HealthMarketplaceLandingPage } from './protection/HealthMarketplaceLandingPage';
import { InsuranceMarketplaceLandingPage } from './protection/InsuranceMarketplaceLandingPage';
import { ProtectionMarketplace } from './protection/ProtectionMarketplace';
import { PublicVIPPresentationPage } from '../../public/PublicVIPPresentationPage';

interface MarketplaceGSAStoreProps {
  clientId?: string;
  initialTab?: string;
  initialItemId?: string;
  onNavigate?: (module: string, tab?: string, itemId?: string) => void;
  onBackToSite?: () => void;
  onRequireAuth?: () => void;
}

export function MarketplaceGSAStore({
  clientId,
  initialTab = 'home',
  initialItemId,
  onBackToSite,
  onRequireAuth,
}: MarketplaceGSAStoreProps) {
  const route = useAppLocation();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const handleSelectModule = (
    section: 'produtos-assinaturas' | 'pacotes-viagem' | 'classificados' | 'saude' | 'seguros',
  ) => {
    if (section === 'produtos-assinaturas') {
      handleNavigate(routes.marketplace.store.root());
    } else if (section === 'pacotes-viagem') {
      handleNavigate(routes.marketplace.travelPackages.root());
    } else if (section === 'classificados') {
      handleNavigate(routes.marketplace.classifieds.root());
    } else if (section === 'saude') {
      handleNavigate(routes.marketplace.saude.root());
    } else if (section === 'seguros') {
      handleNavigate(routes.marketplace.seguros.root());
    }
  };

  const backToMarketplace = () => handleNavigate(routes.marketplace.menu());
  const backToTravelHub = () => handleNavigate(routes.marketplace.travelPackages.root());

  const currentSubmodule = route.submodule;
  const currentModule = route.module;

  if (currentModule === 'saude') {
    if (!currentSubmodule || currentSubmodule === 'home') {
      return (
        <HealthMarketplaceLandingPage
          clientId={clientId}
          onRequireAuth={onRequireAuth}
          onBackToMarketplace={backToMarketplace}
        />
      );
    }

    return (
      <ProtectionMarketplace
        domain="saude"
        submodule={currentSubmodule}
        itemId={route.itemId}
        clientId={clientId}
        onRequireAuth={onRequireAuth}
        onBackToMarketplace={backToMarketplace}
      />
    );
  }

  if (currentModule === 'seguros') {
    if (!currentSubmodule || currentSubmodule === 'home') {
      return (
        <InsuranceMarketplaceLandingPage
          clientId={clientId}
          onRequireAuth={onRequireAuth}
          onBackToMarketplace={backToMarketplace}
        />
      );
    }

    return (
      <ProtectionMarketplace
        domain="seguros"
        submodule={currentSubmodule}
        itemId={route.itemId}
        clientId={clientId}
        onRequireAuth={onRequireAuth}
        onBackToMarketplace={backToMarketplace}
      />
    );
  }

  if (currentModule === 'pacotes-viagem') {
    if (currentSubmodule === 'ofertas') {
      return <TravelOffersLandingPage onBack={backToTravelHub} isPublic={!clientId} />;
    }
    if (currentSubmodule === 'ofertas-nacionais') {
      return (
        <TravelCategoryPage
          category="nacional"
          onBack={() => handleNavigate(routes.marketplace.travelPackages.ofertas())}
        />
      );
    }
    if (currentSubmodule === 'ofertas-internacionais') {
      return (
        <TravelCategoryPage
          category="internacional"
          onBack={() => handleNavigate(routes.marketplace.travelPackages.ofertas())}
        />
      );
    }
    if (currentSubmodule === 'ofertas-excursoes') {
      return (
        <TravelCategoryPage
          category="excursao"
          onBack={() => handleNavigate(routes.marketplace.travelPackages.ofertas())}
        />
      );
    }
    if (currentSubmodule === 'pacote-detalhe' && route.itemId) {
      return (
        <TravelPackageDetailPage
          slug={route.itemId}
          clientId={clientId}
          onRequireAuth={onRequireAuth}
          onBack={() => handleNavigate(routes.marketplace.travelPackages.ofertas())}
        />
      );
    }
    if (currentSubmodule === 'orcamento') {
      return (
        <TravelQuoteRequestPage
          clientId={clientId}
          onRequireAuth={onRequireAuth}
          onBack={() => handleNavigate(routes.marketplace.travelPackages.ofertas())}
        />
      );
    }
    if (currentSubmodule === 'minhas-viagens') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      if (route.itemId) {
        return (
          <TravelReservationPage
            transacaoId={route.itemId}
            clientId={clientId}
            onBack={() => handleNavigate(routes.marketplace.travelPackages.minhasViagens())}
          />
        );
      }
      return <MyTripsPage clientId={clientId} onBack={backToTravelHub} />;
    }
    if (currentSubmodule === 'minhas-propostas') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      return <TravelProposalsPage clientId={clientId} onBack={backToTravelHub} />;
    }
    if (currentSubmodule === 'documentos') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      return <MyTripsPage clientId={clientId} onBack={backToTravelHub} />;
    }
    if (currentSubmodule === 'cancelamentos') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      return <TravelCancellationsPage clientId={clientId} onBack={backToTravelHub} />;
    }
    if (currentSubmodule === 'suporte') {
      return <TravelSupportPage clientId={clientId} onBack={backToTravelHub} />;
    }

    return (
      <TravelHubMenu
        clientId={clientId}
        onBackToMarketplace={backToMarketplace}
        onRequireAuth={() => onRequireAuth?.()}
      />
    );
  }

  if (currentModule === 'classificados') {
    if (!currentSubmodule || currentSubmodule === 'home') {
      if (clientId) {
        return <ClassifiedsClientDashboard clientId={clientId} onBack={backToMarketplace} />;
      }
      return <ClassifiedsHubPage onBack={backToMarketplace} isPublic />;
    }

    if (currentSubmodule === 'imoveis') {
      if (route.itemId) {
        return (
          <ClassifiedDetailPage
            slug={route.itemId}
            clientId={clientId}
            onBack={() => handleNavigate(routes.marketplace.classifieds.imoveis())}
          />
        );
      }
      return <RealEstateMarketplacePage onBack={() => handleNavigate(routes.marketplace.classifieds.root())} />;
    }
    if (currentSubmodule === 'veiculos') {
      if (route.itemId) {
        return (
          <ClassifiedDetailPage
            slug={route.itemId}
            clientId={clientId}
            onBack={() => handleNavigate(routes.marketplace.classifieds.veiculos())}
          />
        );
      }
      return <VehiclesMarketplacePage onBack={() => handleNavigate(routes.marketplace.classifieds.root())} />;
    }
    if (currentSubmodule === 'geral') {
      if (route.itemId) {
        return (
          <ClassifiedDetailPage
            slug={route.itemId}
            clientId={clientId}
            onBack={() => handleNavigate(routes.marketplace.classifieds.geral())}
          />
        );
      }
      return <GeneralClassifiedsPage onBack={() => handleNavigate(routes.marketplace.classifieds.root())} />;
    }
    if (currentSubmodule === 'meus-anuncios') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      return <MyClassifiedsPage clientId={clientId} />;
    }
    if (currentSubmodule === 'anunciar') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      return <CreateListingWizard clientId={clientId} onBack={() => handleNavigate(routes.marketplace.classifieds.root())} />;
    }
    if (currentSubmodule === 'negociacoes') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      return <MyNegotiationsPage clientId={clientId} />;
    }
    if (currentSubmodule === 'minhas-vendas') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      return <MyClassifiedSalesPage clientId={clientId} />;
    }
    if (currentSubmodule === 'comissoes') {
      if (!clientId) {
        onRequireAuth?.();
        return null;
      }
      return <MyClassifiedCommissionsPage clientId={clientId} />;
    }

    if (clientId) {
      return <ClassifiedsClientDashboard clientId={clientId} onBack={backToMarketplace} />;
    }
    return <ClassifiedsHubPage onBack={backToMarketplace} isPublic />;
  }

  if (currentSubmodule?.startsWith('loja')) {
    const tabMapped = currentSubmodule.replace('loja-', '');
    
    // Se for rota de um produto específico, renderiza a ProductPage
    const targetProductId = route.itemId || initialItemId;
    if (['loja-produtos', 'loja-produto'].includes(currentSubmodule) && targetProductId) {
      return (
        <ProductPage 
          productId={targetProductId} 
          clientId={clientId} 
          onRequireAuth={onRequireAuth} 
        />
      );
    }
    
    // Se for rota de checkout da loja (Página Completa e Dedicada)
    if (currentSubmodule === 'loja-checkout') {
      return (
        <CheckoutPage 
          clientId={clientId} 
          onRequireAuth={onRequireAuth} 
          onBack={() => handleNavigate(routes.marketplace.store.products())} 
        />
      );
    }

    // Se for rota de pedido confirmado
    if (currentSubmodule === 'loja-pedido-confirmado') {
      return <OrderSuccessPage />;
    }

    // Se for rota de compras da loja (Página Completa e Dedicada de Minhas Compras)
    if (currentSubmodule === 'loja-compras') {
      return (
        <PurchasesPage 
          clientId={clientId}
          onRequireAuth={onRequireAuth}
          initialOrderId={route.itemId || (route.query?.orderId as string)}
        />
      );
    }

    // Se for rota de wishlist
    if (currentSubmodule === 'loja-wishlist') {
      return <WishlistPage clientId={clientId} onRequireAuth={onRequireAuth} />;
    }

    // Se for rota de blog
    if (currentSubmodule === 'loja-blog') {
      if (route.itemId) {
        return <BlogPostPage postId={route.itemId} clientId={clientId} />;
      }
      return <BlogHome clientId={clientId} />;
    }

    // Se for rota de apresentação pública do Programa VIP
    if (currentSubmodule === 'loja-programa-vip' || currentSubmodule === 'loja-vip') {
      return (
        <PublicVIPPresentationPage 
          clientId={clientId}
          onBack={() => handleNavigate(routes.marketplace.store.root())}
        />
      );
    }

    // Se for rota de Vaquinha de Presente Coletivo
    if (currentSubmodule === 'loja-vaquinha' || currentSubmodule === 'loja-vaquinhas') {
      const targetVaquinhaCode = route.itemId || (route.query?.id as string) || (route.query?.vaquinha_id as string) || '';
      return (
        <div className="min-h-screen bg-[#f8f9fa]">
          <EcommerceHeader 
            clientId={clientId}
            onOpenCart={() => handleNavigate(routes.marketplace.store.products() + '?modal=carrinho')}
            onRequireAuth={onRequireAuth}
          />
          <VaquinhaPublicPage 
            vaquinhaIdOrCode={targetVaquinhaCode}
            clientId={clientId}
            onRequireAuth={onRequireAuth}
          />
        </div>
      );
    }

    // Se for rota de catálogo da loja de produtos ou assinaturas
    if (currentSubmodule === 'loja-produtos' || currentSubmodule === 'loja-assinaturas') {
      return (
        <div className="min-h-screen bg-[#f8f9fa]">
          <EcommerceHeader 
            clientId={clientId}
            onOpenCart={() => handleNavigate(routes.marketplace.store.products() + '?modal=carrinho')}
            onRequireAuth={onRequireAuth}
          />
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            <ClientGSAStore 
              clientId={clientId}
              onRequireAuth={onRequireAuth}
              onBack={() => handleNavigate(routes.marketplace.root())}
            />
          </main>
        </div>
      );
    }

    return (
      <StoreHub
        clientId={clientId}
        onNavigate={(_module, tab, itemId) => {
          if (tab === 'produtos' || tab === 'loja-produtos') {
            handleNavigate(routes.marketplace.store.product(itemId || ''));
          } else if (tab === 'assinaturas' || tab === 'loja-assinaturas') {
            handleNavigate(routes.marketplace.store.subscription(itemId || ''));
          }
        }}
        initialTab={tabMapped === 'loja' ? 'hub' : tabMapped}
        initialItemId={initialItemId || route.itemId}
        onRequireAuth={onRequireAuth}
        onBackToSite={() => handleNavigate(routes.marketplace.root())}
        onBackToMarketplace={backToMarketplace}
      />
    );
  }

  return (
    <EcommerceHome
      clientId={clientId}
      onRequireAuth={onRequireAuth}
      onOpenCart={() => handleNavigate(routes.marketplace.store.products() + '?modal=carrinho')}
    />

  );
}

export default MarketplaceGSAStore;
