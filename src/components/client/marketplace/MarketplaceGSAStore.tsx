import React from 'react';
import { MarketplaceHome } from './MarketplaceHome';
import { StoreHub } from '../StoreHub';
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

  if (currentModule === 'saude' || currentModule === 'seguros') {
    return (
      <ProtectionMarketplace
        domain={currentModule}
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

    return <ClassifiedsHubPage onBack={backToMarketplace} isPublic={!clientId} />;
  }

  if (currentSubmodule?.startsWith('loja')) {
    const tabMapped = currentSubmodule.replace('loja-', '');
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
    <MarketplaceHome
      onSelectModule={handleSelectModule}
      onBackToSite={onBackToSite || (() => handleNavigate(routes.public.home()))}
      isPublic={!clientId}
    />
  );
}

export default MarketplaceGSAStore;
