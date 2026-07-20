import React, { useEffect } from 'react';
import { MarketplaceHome } from './MarketplaceHome';
import { StoreHub } from '../StoreHub';
import { TravelPackagesPage } from './TravelPackagesPage';
import { ClassifiedsHubPage } from './ClassifiedsHubPage';

// Roteamento
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

import { ClassifiedDetailPage } from './classifieds/ClassifiedDetailPage';
import { RealEstateMarketplacePage } from './classifieds/RealEstateMarketplacePage';
import { VehiclesMarketplacePage } from './classifieds/VehiclesMarketplacePage';
import { GeneralClassifiedsPage } from './classifieds/GeneralClassifiedsPage';
import { MyClassifiedsPage } from './classifieds/MyClassifiedsPage';
import { CreateListingWizard } from './classifieds/CreateListingWizard';
import { MyNegotiationsPage } from './classifieds/MyNegotiationsPage';
import { ProtectionMarketplace } from './protection/ProtectionMarketplace';



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
  onNavigate,
  onBackToSite,
  onRequireAuth
}: MarketplaceGSAStoreProps) {
  const route = useAppLocation();

  // Caso esteja utilizando no modo embutido dentro de ClientPortal com onNavigate customizado,
  // mantemos a URL sincronizada delegando a navegação.
  const handleNavigate = (path: string) => {
    if (onNavigate) {
      // Mapear rota de volta para parâmetros legados para que o ClientPortal receba
      const segments = path.split('/').filter(Boolean);
      const isLojapath = segments.includes('loja');
      const moduleName = 'gsa_store';
      
      let tabName = 'home';
      if (isLojapath) {
        // Ex: /marketplace/loja/produtos -> segmentos[1] é loja, segmentos[2] é produtos
        tabName = segments[2] ? `loja-${segments[2]}` : 'loja';
      } else if (segments.includes('pacotes-viagem')) {
        tabName = 'pacotes-viagem';
      } else if (segments.includes('classificados')) {
        tabName = 'classificados';
      } else if (segments.includes('saude')) {
        tabName = 'saude';
      } else if (segments.includes('seguros')) {
        tabName = 'seguros';
      }

      onNavigate(moduleName, tabName, segments[3]);
    } else {
      navigate(path);
    }
  };

  const handleSelectModule = (section: 'produtos-assinaturas' | 'pacotes-viagem' | 'classificados' | 'saude' | 'seguros') => {
    if (section === 'produtos-assinaturas') {
      handleNavigate(routes.marketplace.store.root());
    } else if (section === 'pacotes-viagem') {
      navigate(routes.marketplace.travelPackages.ofertas());
    } else if (section === 'classificados') {
      handleNavigate(routes.marketplace.classifieds.root());
    } else if (section === 'saude') {
      navigate(routes.marketplace.saude.root());
    } else if (section === 'seguros') {
      navigate(routes.marketplace.seguros.root());
    }
  };

  const handleBackToHome = () => {
    if (route.submodule === 'classificados') {
      handleNavigate(routes.marketplace.classifieds.root());
    } else {
      handleNavigate(routes.marketplace.menu());
    }
  };

  // Determinar a seção com base na rota atual reativa do useAppLocation
  const currentSubmodule = route.submodule;
  const currentModule = route.module;

  if (currentModule === 'saude' || currentModule === 'seguros') {
    return (
      <ProtectionMarketplace
        domain={currentModule}
        submodule={currentSubmodule}
        itemId={route.itemId}
        clientId={clientId}
        onRequireAuth={onRequireAuth}
        onBackToMarketplace={() => navigate(routes.marketplace.menu())}
      />
    );
  }

  // Renderização condicional com base no estado reativo da rota
  if (currentModule === 'pacotes-viagem') {
    if (currentSubmodule === 'ofertas') {
      return <TravelOffersLandingPage onBack={handleBackToHome} isPublic={!clientId} />;
    }
    if (currentSubmodule === 'ofertas-nacionais') {
      return <TravelCategoryPage category="nacional" onBack={() => handleNavigate(routes.marketplace.travelPackages.ofertas())} />;
    }
    if (currentSubmodule === 'ofertas-internacionais') {
      return <TravelCategoryPage category="internacional" onBack={() => handleNavigate(routes.marketplace.travelPackages.ofertas())} />;
    }
    if (currentSubmodule === 'ofertas-excursoes') {
      return <TravelCategoryPage category="excursao" onBack={() => handleNavigate(routes.marketplace.travelPackages.ofertas())} />;
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
         if (onRequireAuth) onRequireAuth();
         return null;
      }
      if (route.itemId) {
        return <TravelReservationPage transacaoId={route.itemId} clientId={clientId} onBack={() => handleNavigate(routes.marketplace.travelPackages.minhasViagens())} />;
      }
      return <MyTripsPage clientId={clientId} onBack={handleBackToHome} />;
    }
    if (currentSubmodule === 'minhas-propostas') {
      if (!clientId) {
         if (onRequireAuth) onRequireAuth();
         return null;
      }
      return <TravelProposalsPage clientId={clientId} onBack={handleBackToHome} />;
    }
    return (
      <TravelHubMenu 
        clientId={clientId} 
        onBackToMarketplace={handleBackToHome} 
        onRequireAuth={() => onRequireAuth?.()} 
      />
    );
  }
  
  if (currentModule === 'classificados') {
    if (currentSubmodule === 'imoveis') {
      if (route.itemId) {
        return <ClassifiedDetailPage slug={route.itemId} clientId={clientId} onBack={() => handleNavigate(routes.marketplace.classifieds.imoveis())} />;
      }
      return <RealEstateMarketplacePage onBack={() => handleNavigate(routes.marketplace.classifieds.root())} />;
    }
    if (currentSubmodule === 'veiculos') {
      if (route.itemId) {
        return <ClassifiedDetailPage slug={route.itemId} clientId={clientId} onBack={() => handleNavigate(routes.marketplace.classifieds.veiculos())} />;
      }
      return <VehiclesMarketplacePage onBack={() => handleNavigate(routes.marketplace.classifieds.root())} />;
    }
    if (currentSubmodule === 'geral') {
      if (route.itemId) {
        return <ClassifiedDetailPage slug={route.itemId} clientId={clientId} onBack={() => handleNavigate(routes.marketplace.classifieds.geral())} />;
      }
      return <GeneralClassifiedsPage onBack={() => handleNavigate(routes.marketplace.classifieds.root())} />;
    }
    if (currentSubmodule === 'meus-anuncios') {
      if (!clientId) {
         if (onRequireAuth) onRequireAuth();
         return null;
      }
      return <MyClassifiedsPage clientId={clientId} />;
    }
    if (currentSubmodule === 'anunciar') {
      if (!clientId) {
         if (onRequireAuth) onRequireAuth();
         return null;
      }
      return <CreateListingWizard clientId={clientId} onBack={() => handleNavigate(routes.marketplace.classifieds.root())} />;
    }
    if (currentSubmodule === 'negociacoes') {
      if (!clientId) {
         if (onRequireAuth) onRequireAuth();
         return null;
      }
      return <MyNegotiationsPage clientId={clientId} />;
    }
    // Fallback para a Home dos Classificados
    return <ClassifiedsHubPage onBack={handleBackToHome} isPublic={!clientId} />;
  }

  
  if (currentSubmodule?.startsWith('loja')) {
    // Ex: loja, loja-produtos, loja-assinaturas
    const tabMapped = currentSubmodule.replace('loja-', '');
    return (
      <StoreHub
        clientId={clientId}
        onNavigate={(mod, tab, itemId) => {
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
        onBackToMarketplace={handleBackToHome}
      />
    );
  }

  // Por padrão, a Home de Módulos (Produtos e Assinaturas, Viagens, Classificados) é renderizada em /marketplace
  return (
    <MarketplaceHome
      onSelectModule={handleSelectModule}
      onBackToSite={onBackToSite || (() => handleNavigate(routes.public.home()))}
      isPublic={!clientId}
    />
  );
}

export default MarketplaceGSAStore;
