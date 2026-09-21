import { useEffect, useMemo, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { LogoGSA } from '../ui/LogoGSA';
import { AccessibleDialog } from '../ui/AccessibleDialog';
import { PartnerApplicationPage } from './PartnerApplicationPage';
import { PartnersPage } from './PartnersPage';
import { PrivacyPolicyPage } from './PrivacyPolicyPage';
import { FreeToolsExperiencePage } from './FreeToolsExperiencePage';
import { PublicFooter } from './final/PublicFooter';
import { PublicHomeLanding } from './final/PublicHomeLanding';
import { PublicServicesPage } from './final/PublicServicesPage';
import { RequestChannelDialog, ServiceDetailsDialog, type ServicePackageRequest } from './final/PublicServiceDialogs';
import { PublicHeader } from './final/PublicHeader';
import './final/PublicHomePlan3.css';
import {
  getServicePackageSlug,
  type Audience,
  type IconItem,
  type PublicPage,
  type ServicePackage,
} from '../../data/publicServiceCatalog';
import { supabase } from '../../lib/supabase';

const WHATSAPP_NUMBER = '5511920857756';
const CONTACT_EMAIL = 'gsa.doc.adm@gmail.com';

interface GSAEnterpriseHomeFinalProps {
  publicPage: PublicPage;
  setPublicPage: (page: PublicPage) => void;
  publicAudience: Audience;
  setPublicAudience: (audience: Audience) => void;
  servicePackages: ServicePackage[];
  publicServices: IconItem[];
  initialServiceSlug?: string;
  initialPartnerSlug?: string;
  onServiceDetailChange?: (slug: string | null) => void;
  onPartnerDetailChange?: (slug: string | null) => void;
  onGuestStore?: () => void;
  onClientLogin: () => void;
  onAdminLogin: () => void;
}

export function GSAEnterpriseHomeFinal(props: GSAEnterpriseHomeFinalProps) {
  const reduceMotion = useReducedMotion();
  const [showIntro, setShowIntro] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null);
  const [requestPackage, setRequestPackage] = useState<ServicePackageRequest | null>(null);

  const filteredPackages = useMemo(
    () => props.servicePackages.filter((item) => item.audience === props.publicAudience || item.audience === 'AMBOS'),
    [props.publicAudience, props.servicePackages],
  );

  useEffect(() => {
    if (props.publicPage !== 'services' || !props.initialServiceSlug) {
      if (!props.initialServiceSlug) setSelectedPackage(null);
      return;
    }
    const item = props.servicePackages.find((service) => getServicePackageSlug(service) === props.initialServiceSlug) || null;
    setSelectedPackage(item);
    if (item && item.audience !== 'AMBOS') props.setPublicAudience(item.audience);
  }, [props.initialServiceSlug, props.publicPage, props.servicePackages, props.setPublicAudience]);

  useEffect(() => {
    if (reduceMotion || window.innerWidth >= 768 || localStorage.getItem('gsa_intro_seen')) return;
    setShowIntro(true);
    const timer = window.setTimeout(() => dismissIntro(), 1200);
    return () => window.clearTimeout(timer);
  }, [reduceMotion]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  }, [props.publicPage, props.initialPartnerSlug, reduceMotion]);

  const dismissIntro = () => {
    setShowIntro(false);
    localStorage.setItem('gsa_intro_seen', 'true');
  };

  const openWhatsApp = (message: string) => {
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const handleWhatsAppRequest = (item: ServicePackageRequest) => {
    setRequestPackage(null);
    const servicesListText = item.isFullPackage
      ? `• Pacote Completo (${item.selectedServices.map((s) => s.name).join(', ')})`
      : item.selectedServices.map((s) => `• ${s.name}`).join('\n');

    const message = [
      '#SOLICITACAO_SERVICO_GSA',
      'Olá! Gostaria de solicitar atendimento para serviços GSA HUB:',
      '',
      `📦 *Pacote:* ${item.package.title}`,
      `🆔 *Pacote ID:* ${item.package.id}`,
      `👤 *Perfil:* ${item.package.audience === 'PJ' ? 'Empresas (PJ)' : 'Pessoa Física (PF)'}`,
      '🛠️ *Serviços Solicitados:*',
      servicesListText,
      '',
      'Gostaria de dar andamento na minha solicitação pelo WhatsApp.',
    ].join('\n');

    openWhatsApp(message);
  };

  const handleEmailRequest = (item: ServicePackageRequest) => {
    setRequestPackage(null);
    const servicesListText = item.isFullPackage
      ? `Pacote Completo: ${item.selectedServices.map((s) => s.name).join(', ')}`
      : item.selectedServices.map((s) => `- ${s.name}`).join('\n');

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
      `Atendimento - ${item.package.title}`
    )}&body=${encodeURIComponent(
      `Olá!\n\nSolicito atendimento para o pacote ${item.package.title}.\n\nServiços Selecionados:\n${servicesListText}\n\nDescrição do pacote: ${item.package.description}`
    )}`;
  };

  const checkSessionAndProceed = async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const hasLocalSession = window.localStorage.getItem('_gsa_session') || window.sessionStorage.getItem('_gsa_session');
      
      if (data.session || hasLocalSession) {
        window.location.href = '/cliente';
      } else {
        props.onClientLogin();
      }
    } catch (err) {
      props.onClientLogin();
    }
  };

  const requestViaPortal = (item: ServicePackageRequest) => {
    const pendingRequest = JSON.stringify({
      itemType: 'package',
      itemId: item.package.id,
      title: item.package.title,
      description: item.package.description,
      services: item.selectedServices,
      isFullPackage: item.isFullPackage,
      source: 'public_services',
      createdAt: new Date().toISOString(),
    });
    sessionStorage.setItem('gsa_pending_service_request', pendingRequest);
    localStorage.setItem('gsa_pending_service_request', pendingRequest);
    setRequestPackage(null);
    setSelectedPackage(null);
    
    checkSessionAndProceed();
  };

  const isPartnerApplication = props.publicPage === 'partners' && props.initialPartnerSlug === 'solicitar';

  return (
    <div className="gsa-home-plan-3 min-h-screen bg-[#f4f1ea] text-neutral-950">
      <AccessibleDialog isOpen={showIntro} onClose={dismissIntro} ariaLabel="Introdução GSA" zIndexClassName="z-[100]" overlayClassName="items-center justify-center bg-[#050608] px-6 text-center md:hidden" panelClassName="max-w-lg bg-transparent text-center text-white shadow-none">
        <LogoGSA size="xl" variant="light" />
        <h1 className="mt-6 text-5xl font-serif tracking-[0.14em] text-[#d8bd73]">GSA HUB</h1>
        <p className="mt-3 text-sm uppercase tracking-[0.24em] text-white/65">Soluções Digitais</p>
        <button type="button" data-dialog-autofocus onClick={dismissIntro} className="mt-10 rounded-full border border-white/25 px-5 py-2 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">Pular introdução</button>
      </AccessibleDialog>

      {!isPartnerApplication && <PublicHeader currentPage={props.publicPage} onNavigatePage={props.setPublicPage} onGuestStore={props.onGuestStore} onClientLogin={props.onClientLogin} />}

      {props.publicPage === 'home' && <PublicHomeLanding reduceMotion={Boolean(reduceMotion)} setPublicPage={props.setPublicPage} onGuestStore={props.onGuestStore} />}
      {props.publicPage === 'services' && <PublicServicesPage audience={props.publicAudience} setAudience={props.setPublicAudience} packages={filteredPackages} publicServices={props.publicServices} onBack={() => props.setPublicPage('home')} onSelect={(item) => { setSelectedPackage(item); props.onServiceDetailChange?.(getServicePackageSlug(item)); }} />}
      {props.publicPage === 'privacy' && <PrivacyPolicyPage />}
      {props.publicPage === 'free-tools' && <FreeToolsExperiencePage onBack={() => props.setPublicPage('home')} onServices={() => props.setPublicPage('services')} onClientLogin={props.onClientLogin} />}
      {props.publicPage === 'partners' && (
        isPartnerApplication
          ? <PartnerApplicationPage onBack={() => props.onPartnerDetailChange?.(null)} />
          : <PartnersPage selectedSlug={props.initialPartnerSlug} onSelectPartner={(slug) => props.onPartnerDetailChange?.(slug)} onBack={() => props.setPublicPage('home')} />
      )}

      {!isPartnerApplication && <PublicFooter setPublicPage={props.setPublicPage} onGuestStore={props.onGuestStore} onAdminLogin={props.onAdminLogin} />}
      <ServiceDetailsDialog
        selectedPackage={selectedPackage}
        onClose={() => {
          setSelectedPackage(null);
          props.onServiceDetailChange?.(null);
        }}
        onInterest={(requestData) => {
          setSelectedPackage(null);
          props.onServiceDetailChange?.(null);
          setRequestPackage(requestData);
        }}
      />
      <RequestChannelDialog
        requestData={requestPackage}
        onClose={() => setRequestPackage(null)}
        onWhatsApp={handleWhatsAppRequest}
        onEmail={handleEmailRequest}
        onPortal={requestViaPortal}
      />
    </div>
  );
}

