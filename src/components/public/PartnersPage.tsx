import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Clock3,
  ExternalLink,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { getPublicPartner, listPublicPartners } from '../../features/partners/service';
import { PARTNER_MODE_LABELS, type Partner } from '../../features/partners/types';
import { PartnerApplicationModal } from './PartnerApplicationModal';
import '../../partners.css';

interface PartnersPageProps {
  selectedSlug?: string;
  onSelectPartner: (slug: string | null) => void;
  onBack: () => void;
}

function safeExternalUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function buildAddress(partner: Partner): string {
  return [
    [partner.street, partner.number].filter(Boolean).join(', '),
    partner.complement,
    partner.neighborhood,
    [partner.city, partner.state].filter(Boolean).join(' - '),
    partner.zip_code,
  ].filter(Boolean).join(' · ');
}

function locationLabel(partner: Partner): string {
  return [partner.city, partner.state].filter(Boolean).join(' — ');
}

function PartnerVisual({ partner, detail = false }: { partner: Partner; detail?: boolean }) {
  const source = partner.cover_url || partner.logo_url;

  return (
    <div className={`partner-visual ${detail ? 'partner-visual--detail' : ''}`}>
      {source ? (
        <img
          src={source}
          alt={`Apresentação de ${partner.name}`}
          className={partner.cover_url ? 'partner-visual__cover' : 'partner-visual__logo-only'}
          loading={detail ? 'eager' : 'lazy'}
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="partner-visual__fallback" aria-hidden="true">
          <Building2 />
          <span>{partner.name.slice(0, 2).toUpperCase()}</span>
        </div>
      )}

      {partner.logo_url && partner.cover_url && (
        <div className="partner-visual__logo">
          <img src={partner.logo_url} alt={`Logotipo de ${partner.name}`} loading="lazy" referrerPolicy="no-referrer" />
        </div>
      )}

      {partner.featured && (
        <span className="partner-featured-label">
          <ShieldCheck aria-hidden="true" />
          Destaque da rede
        </span>
      )}
    </div>
  );
}

export function PartnersPage({ selectedSlug, onSelectPartner, onBack }: PartnersPageProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [applicationOpen, setApplicationOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    document.body.classList.add('gsa-public-partners');
    return () => document.body.classList.remove('gsa-public-partners');
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [selectedSlug]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);

    const load = async () => {
      try {
        if (selectedSlug) {
          const partner = await getPublicPartner(selectedSlug);
          if (!cancelled) {
            setSelectedPartner(partner);
            setPartners([]);
          }
        } else {
          const rows = await listPublicPartners();
          if (!cancelled) {
            setPartners(rows);
            setSelectedPartner(null);
          }
        }
      } catch (error) {
        console.error('Erro ao carregar parceiros:', error);
        if (!cancelled) {
          setPartners([]);
          setSelectedPartner(null);
          setLoadError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [reloadKey, selectedSlug]);

  const categories = useMemo(() => [
    'Todas',
    ...Array.from(new Set<string>(partners.map((partner) => partner.category).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  ], [partners]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return partners.filter((partner) => {
      const matchesCategory = category === 'Todas' || partner.category === category;
      const haystack = [
        partner.name,
        partner.category,
        partner.short_description,
        partner.city,
        partner.state,
        ...(partner.services || []),
        ...(partner.products || []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [category, partners, search]);

  const featuredPartners = useMemo(() => filtered.filter((partner) => partner.featured), [filtered]);
  const regularPartners = useMemo(() => filtered.filter((partner) => !partner.featured), [filtered]);
  const regionCount = useMemo(() => new Set(
    partners.flatMap((partner) => partner.service_regions || []).map((region) => region.trim().toLocaleLowerCase('pt-BR')).filter(Boolean),
  ).size, [partners]);

  if (selectedSlug) {
    if (loading) return <PartnersLoading detail />;

    if (loadError) {
      return (
        <PartnersFailure
          title="Não foi possível carregar este perfil"
          description="A conexão com o diretório de parceiros falhou. Tente novamente ou retorne para a listagem."
          onRetry={() => setReloadKey((current) => current + 1)}
          onBack={() => onSelectPartner(null)}
        />
      );
    }

    if (!selectedPartner) {
      return (
        <main className="partners-page partners-state-page">
          <div className="partners-state-panel">
            <Building2 aria-hidden="true" />
            <p className="partners-kicker">Diretório institucional</p>
            <h1>Parceiro não encontrado</h1>
            <p>Este perfil não está disponível ou deixou de fazer parte da área pública.</p>
            <button type="button" onClick={() => onSelectPartner(null)} className="partner-primary-button">
              <ArrowLeft aria-hidden="true" />
              Voltar aos parceiros
            </button>
          </div>
        </main>
      );
    }

    return <PartnerDetail partner={selectedPartner} onBack={() => onSelectPartner(null)} />;
  }

  return (
    <>
      <main className="partners-page">
        <section className="partners-hero">
          <div className="partners-hero__grid" aria-hidden="true" />
          <div className="partners-container partners-hero__content">
            <button type="button" onClick={onBack} className="partner-back-link">
              <ArrowLeft aria-hidden="true" />
              Voltar à página inicial
            </button>

            <div className="partners-hero__layout">
              <div className="partners-hero__copy">
                <p className="partners-kicker">Rede institucional GSA HUB</p>
                <h1>Parcerias que ampliam capacidade, confiança e alcance.</h1>
                <p className="partners-hero__lead">
                  Um diretório selecionado de empresas, profissionais e organizações que complementam o ecossistema GSA com atuação responsável, especialidades reais e canais públicos de atendimento.
                </p>
              </div>

              <aside className="partners-hero__statement" aria-label="Princípios da rede de parceiros">
                <p>Uma parceria só entra nesta vitrine após análise administrativa.</p>
                <div><span>01</span><strong>Identificação</strong></div>
                <div><span>02</span><strong>Análise</strong></div>
                <div><span>03</span><strong>Publicação</strong></div>
              </aside>
            </div>

            <dl className="partners-hero__metrics">
              <div><dt>Rede ativa</dt><dd>{loading ? '—' : String(partners.length).padStart(2, '0')}</dd></div>
              <div><dt>Áreas representadas</dt><dd>{loading ? '—' : String(Math.max(categories.length - 1, 0)).padStart(2, '0')}</dd></div>
              <div><dt>Regiões declaradas</dt><dd>{loading ? '—' : String(regionCount).padStart(2, '0')}</dd></div>
            </dl>
          </div>
        </section>

        <section className="partners-directory" aria-labelledby="partners-directory-title">
          <div className="partners-container">
            <header className="partners-section-heading">
              <div>
                <p className="partners-kicker partners-kicker--dark">Diretório público</p>
                <h2 id="partners-directory-title">Encontre a parceria certa para a sua necessidade.</h2>
              </div>
              <p>Consulte por nome, área de atuação, serviço, produto ou localidade. Cada perfil apresenta informações fornecidas e aprovadas para publicação.</p>
            </header>

            <div className="partners-toolbar">
              <label className="partners-search">
                <Search aria-hidden="true" />
                <span className="sr-only">Pesquisar parceiros</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por empresa, serviço ou cidade" />
                {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar pesquisa"><X aria-hidden="true" /></button>}
              </label>

              <label className="partners-category-select">
                <span>Área de atuação</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
            </div>

            <div className="partners-category-tabs" role="group" aria-label="Filtrar por categoria">
              {categories.map((item) => (
                <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={category === item ? 'is-active' : ''}>{item}</button>
              ))}
            </div>

            <div className="partners-results-line">
              <span>{loading ? 'Atualizando diretório' : `${filtered.length} ${filtered.length === 1 ? 'parceiro disponível' : 'parceiros disponíveis'}`}</span>
              {(search || category !== 'Todas') && <button type="button" onClick={() => { setSearch(''); setCategory('Todas'); }}>Limpar filtros</button>}
            </div>

            {loading ? (
              <PartnersLoading compact />
            ) : loadError ? (
              <PartnersFailure title="O diretório não pôde ser carregado" description="Não foi possível consultar os parceiros neste momento. Nenhum dado foi substituído por conteúdo de exemplo." onRetry={() => setReloadKey((current) => current + 1)} />
            ) : filtered.length === 0 ? (
              <div className="partners-empty-state">
                <Search aria-hidden="true" />
                <h3>Nenhum parceiro corresponde aos filtros</h3>
                <p>Revise o termo pesquisado ou consulte todas as áreas de atuação.</p>
                <button type="button" onClick={() => { setSearch(''); setCategory('Todas'); }} className="partner-secondary-button">Mostrar todo o diretório</button>
              </div>
            ) : (
              <div className="partners-list">
                {featuredPartners.map((partner, index) => <PartnerDirectoryItem key={partner.id} partner={partner} index={index + 1} featured onOpen={() => onSelectPartner(partner.slug)} />)}
                {regularPartners.map((partner, index) => <PartnerDirectoryItem key={partner.id} partner={partner} index={featuredPartners.length + index + 1} onOpen={() => onSelectPartner(partner.slug)} />)}
              </div>
            )}
          </div>
        </section>

        <section className="partners-application" aria-labelledby="partners-application-title">
          <div className="partners-container partners-application__layout">
            <div className="partners-application__copy">
              <p className="partners-kicker">Parcerias institucionais</p>
              <h2 id="partners-application-title">Sua empresa pode integrar esta rede.</h2>
              <p>Apresente sua atuação, estrutura e canais de atendimento. A solicitação é enviada diretamente ao painel administrativo para análise e só se torna pública após aprovação.</p>
              <button type="button" onClick={() => setApplicationOpen(true)} className="partner-gold-button">Seja nosso parceiro<ArrowRight aria-hidden="true" /></button>
            </div>

            <ol className="partners-application__process">
              <li><span>01</span><div><strong>Cadastre a empresa</strong><p>Dados cadastrais, responsável, contatos e endereço.</p></div></li>
              <li><span>02</span><div><strong>Apresente a atuação</strong><p>Serviços, produtos, regiões atendidas e materiais visuais.</p></div></li>
              <li><span>03</span><div><strong>Acompanhe pelo protocolo</strong><p>O envio recebe identificação oficial e permanece com status Em análise.</p></div></li>
            </ol>
          </div>
        </section>
      </main>

      <PartnerApplicationModal open={applicationOpen} onClose={() => setApplicationOpen(false)} />
    </>
  );
}

function PartnerDirectoryItem({ partner, index, featured = false, onOpen }: { key?: string | number; partner: Partner; index: number; featured?: boolean; onOpen: () => void }) {
  return (
    <article className={`partner-directory-item ${featured ? 'partner-directory-item--featured' : ''}`}>
      <div className="partner-directory-item__index">{String(index).padStart(2, '0')}</div>
      <PartnerVisual partner={partner} />
      <div className="partner-directory-item__content">
        <div className="partner-directory-item__meta">
          <span>{partner.category}</span>
          {locationLabel(partner) && <span><MapPin aria-hidden="true" />{locationLabel(partner)}</span>}
        </div>
        <h3>{partner.name}</h3>
        <p>{partner.short_description}</p>
        <div className="partner-directory-item__services">{(partner.services || []).slice(0, 4).map((service) => <span key={service}><Check aria-hidden="true" />{service}</span>)}</div>
        <div className="partner-directory-item__footer">
          <span>{PARTNER_MODE_LABELS[partner.service_mode]}</span>
          <button type="button" onClick={onOpen}>Conhecer parceiro<ArrowRight aria-hidden="true" /></button>
        </div>
      </div>
    </article>
  );
}

function PartnerDetail({ partner, onBack }: { partner: Partner; onBack: () => void }) {
  const address = buildAddress(partner);
  const website = safeExternalUrl(partner.website);
  const instagram = safeExternalUrl(partner.instagram);
  const linkedin = safeExternalUrl(partner.linkedin);
  const maps = safeExternalUrl(partner.maps_url);
  const whatsappDigits = partner.whatsapp?.replace(/\D/g, '');

  return (
    <main className="partners-page partners-detail-page">
      <section className="partners-detail-hero">
        <div className="partners-container">
          <button type="button" onClick={onBack} className="partner-back-link"><ArrowLeft aria-hidden="true" />Todos os parceiros</button>
          <div className="partners-detail-hero__layout">
            <PartnerVisual partner={partner} detail />
            <div className="partners-detail-hero__copy">
              <p className="partners-kicker">{partner.category}</p>
              <h1>{partner.name}</h1>
              <p>{partner.description || partner.short_description}</p>
              <div className="partners-detail-hero__facts">
                <span><Users aria-hidden="true" />{PARTNER_MODE_LABELS[partner.service_mode]}</span>
                {locationLabel(partner) && <span><MapPin aria-hidden="true" />{locationLabel(partner)}</span>}
                {partner.business_hours && <span><Clock3 aria-hidden="true" />{partner.business_hours}</span>}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="partners-detail-content">
        <div className="partners-container partners-detail-content__layout">
          <div className="partners-detail-main">
            {partner.services.length > 0 && (
              <section className="partner-detail-section">
                <header><span>01</span><div><p>Capacidade de atendimento</p><h2>Serviços e especialidades</h2></div></header>
                <div className="partner-detail-service-list">{partner.services.map((service) => <div key={service}><Check aria-hidden="true" /><span>{service}</span></div>)}</div>
              </section>
            )}
            {partner.products.length > 0 && (
              <section className="partner-detail-section">
                <header><span>02</span><div><p>Portfólio declarado</p><h2>Produtos e soluções</h2></div></header>
                <div className="partner-detail-product-list">{partner.products.map((product) => <span key={product}>{product}</span>)}</div>
              </section>
            )}
            {partner.service_regions.length > 0 && (
              <section className="partner-detail-section">
                <header><span>03</span><div><p>Abrangência</p><h2>Regiões atendidas</h2></div></header>
                <div className="partner-detail-regions">{partner.service_regions.map((region) => <span key={region}><MapPin aria-hidden="true" />{region}</span>)}</div>
              </section>
            )}
            {partner.benefits && (
              <section className="partner-benefit-panel">
                <p>Condição informada para clientes GSA</p><h2>Benefício da parceria</h2><div>{partner.benefits}</div>
              </section>
            )}
          </div>

          <aside className="partner-contact-panel">
            <p className="partners-kicker">Canais públicos</p>
            <h2>Informações de contato</h2>
            <p className="partner-contact-panel__intro">Fale diretamente com o parceiro pelos dados publicados no cadastro aprovado.</p>
            <div className="partner-contact-panel__facts">
              {address && <div><MapPin aria-hidden="true" /><span>{address}</span></div>}
              {partner.business_hours && <div><Clock3 aria-hidden="true" /><span>{partner.business_hours}</span></div>}
              <div><Users aria-hidden="true" /><span>{PARTNER_MODE_LABELS[partner.service_mode]}</span></div>
            </div>
            <div className="partner-contact-panel__actions">
              {whatsappDigits && <a href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Encontrei a ${partner.name} pela página de parceiros da GSA HUB e gostaria de mais informações.`)}`} target="_blank" rel="noopener noreferrer" className="is-primary"><MessageCircle aria-hidden="true" />Conversar pelo WhatsApp</a>}
              {partner.phone && <a href={`tel:${partner.phone.replace(/[^\d+]/g, '')}`}><Phone aria-hidden="true" />Ligar para o parceiro</a>}
              {partner.email && <a href={`mailto:${partner.email}`}><Mail aria-hidden="true" />Enviar e-mail</a>}
              {maps && <a href={maps} target="_blank" rel="noopener noreferrer"><MapPin aria-hidden="true" />Abrir localização<ExternalLink aria-hidden="true" /></a>}
            </div>
            {(website || instagram || linkedin) && (
              <div className="partner-contact-panel__social">
                <p>Presença digital</p>
                {website && <SocialLink href={website} label="Site oficial"><Globe2 aria-hidden="true" /></SocialLink>}
                {instagram && <SocialLink href={instagram} label="Instagram"><Instagram aria-hidden="true" /></SocialLink>}
                {linkedin && <SocialLink href={linkedin} label="LinkedIn"><Linkedin aria-hidden="true" /></SocialLink>}
              </div>
            )}
          </aside>
        </div>
      </section>
    </main>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer">{children}<span>{label}</span><ExternalLink aria-hidden="true" /></a>;
}

function PartnersFailure({ title, description, onRetry, onBack }: { title: string; description: string; onRetry: () => void; onBack?: () => void }) {
  return (
    <div className="partners-failure" role="alert">
      <AlertTriangle aria-hidden="true" />
      <div><h3>{title}</h3><p>{description}</p><div><button type="button" onClick={onRetry} className="partner-primary-button"><RefreshCw aria-hidden="true" />Tentar novamente</button>{onBack && <button type="button" onClick={onBack} className="partner-secondary-button"><ArrowLeft aria-hidden="true" />Voltar</button>}</div></div>
    </div>
  );
}

function PartnersLoading({ compact = false, detail = false }: { compact?: boolean; detail?: boolean }) {
  return (
    <div className={`partners-loading ${compact ? 'partners-loading--compact' : ''} ${detail ? 'partners-loading--detail' : ''}`} role="status">
      <div className="partners-loading__bar" /><div className="partners-loading__body"><span /><span /><span /></div><span className="sr-only">Carregando parceiros</span>
    </div>
  );
}
