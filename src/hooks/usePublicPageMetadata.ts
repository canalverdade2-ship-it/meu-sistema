import { useEffect } from 'react';
import type { PublicPage, ServicePackage } from '../data/publicServiceCatalog';

const DEFAULT_TITLE = 'GSA HUB - Soluções Digitais';
const DEFAULT_DESCRIPTION = 'Serviços, assinaturas, marketplace e tecnologia reunidos no GSA HUB.';

function ensureMeta(selector: string, attribute: 'name' | 'property', key: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  return element;
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  ensureMeta(selector, attribute, key).setAttribute('content', content);
}

export function usePublicPageMetadata(
  page: PublicPage,
  selectedPackage: ServicePackage | null,
  loginOnly = false,
) {
  useEffect(() => {
    const title = loginOnly
      ? 'Acesso ao Portal | GSA HUB'
      : selectedPackage
      ? `${selectedPackage.title} | GSA HUB`
      : page === 'services'
        ? 'Serviços e Assinaturas | GSA HUB'
        : page === 'systems'
          ? 'Criação de Sites e Sistemas | GSA HUB'
          : page === 'partners'
            ? 'Parceiros | GSA HUB'
            : DEFAULT_TITLE;

    const description = loginOnly
      ? 'Acesse a área do cliente, prestador ou equipe do GSA HUB.'
      : selectedPackage?.description
      || (page === 'services'
        ? 'Pacotes administrativos, financeiros, veiculares, previdenciários e empresariais do GSA HUB.'
        : page === 'systems'
          ? 'Criação de sites, lojas virtuais, aplicativos, sistemas web e automações sob medida.'
          : page === 'partners'
            ? 'Conheça empresas e profissionais que fazem parte da rede de parceiros da GSA HUB.'
            : DEFAULT_DESCRIPTION);

    const image = new URL('/logo.svg', window.location.origin).toString();
    document.title = title;
    setMeta('name', 'description', description);
    setMeta('property', 'og:title', title);
    setMeta('property', 'og:description', description);
    setMeta('property', 'og:type', selectedPackage ? 'product' : 'website');
    setMeta('property', 'og:image', image);
    setMeta('property', 'og:url', window.location.href);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', title);
    setMeta('name', 'twitter:description', description);
    setMeta('name', 'twitter:image', image);

    const scriptId = 'gsa-public-structured-data';
    let script = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = scriptId;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.text = JSON.stringify(selectedPackage && !loginOnly ? {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: selectedPackage.title,
      description: selectedPackage.description,
      provider: { '@type': 'Organization', name: 'GSA HUB' },
      url: window.location.href,
    } : {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'GSA HUB',
      description,
      url: window.location.origin,
    });
  }, [loginOnly, page, selectedPackage]);
}
