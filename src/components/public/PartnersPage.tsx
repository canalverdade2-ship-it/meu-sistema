import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  Instagram,
  Linkedin,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getPublicPartner, listPublicPartners } from '../../features/partners/service';
import { PARTNER_MODE_LABELS, type Partner } from '../../features/partners/types';
import { PartnerApplicationModal } from './PartnerApplicationModal';

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

function PartnerImage({ partner, large = false }: { partner: Partner; large?: boolean }) {
  return (
    <div className={`${large ? 'h-64 sm:h-80' : 'h-52'} relative overflow-hidden bg-slate-900`}>
      {partner.cover_url || partner.logo_url ? (
        <img
          src={partner.cover_url || partner.logo_url || ''}
          alt={`Imagem de ${partner.name}`}
          className={`h-full w-full transition-transform duration-500 group-hover:scale-105 ${partner.cover_url ? 'object-cover' : 'object-contain p-10'}`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-slate-900 text-slate-600">
          <Building2 className={`${large ? 'h-20 w-20' : 'h-14 w-14'}`} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
      {partner.featured && (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-slate-950/80 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-300 backdrop-blur-md shadow-md">
          <ShieldCheck className="h-3.5 w-3.5 text-amber-400" /> Parceiro em destaque
        </span>
      )}
      {partner.logo_url && partner.cover_url && (
        <div className="absolute bottom-3 left-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white p-1.5 shadow-lg">
          <img src={partner.logo_url} alt={`Logo de ${partner.name}`} className="h-full w-full object-contain" loading="lazy" referrerPolicy="no-referrer" />
        </div>
      )}
    </div>
  );
}

export function PartnersPage({ selectedSlug, onSelectPartner, onBack }: PartnersPageProps) {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todas');
  const [applicationOpen, setApplicationOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const load = async () => {
      try {
        if (selectedSlug) {
          const partner = await getPublicPartner(selectedSlug);
          if (!cancelled) setSelectedPartner(partner);
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
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [selectedSlug]);

  const categories = useMemo(() => [
    'Todas',
    ...Array.from(new Set<string>(partners.map((partner) => partner.category).filter((item): item is string => Boolean(item)))).sort((a, b) => a.localeCompare(b, 'pt-BR')),
  ], [partners]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    return partners.filter((partner) => {
      const matchesCategory = category === 'Todas' || partner.category === category;
      const haystack = [partner.name, partner.category, partner.short_description, partner.city, partner.state, ...(partner.services || [])]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('pt-BR');
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [category, partners, search]);

  if (selectedSlug) {
    if (loading) return <PartnersLoading />;
    if (!selectedPartner) {
      return (
        <main className="min-h-[70vh] bg-[#f8fafc] pt-28">
          <div className="mx-auto max-w-3xl px-4 py-16 text-center">
            <Building2 className="mx-auto h-12 w-12 text-slate-400" />
            <h1 className="mt-4 text-2xl font-black text-slate-900">Parceiro não encontrado</h1>
            <p className="mt-2 text-sm text-slate-600">Este perfil não está disponível no momento.</p>
            <button type="button" onClick={() => onSelectPartner(null)} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 font-bold text-white hover:bg-slate-800"><ArrowLeft className="h-4 w-4" /> Voltar aos parceiros</button>
          </div>
        </main>
      );
    }

    const address = buildAddress(selectedPartner);
    const website = safeExternalUrl(selectedPartner.website);
    const instagram = safeExternalUrl(selectedPartner.instagram);
    const linkedin = safeExternalUrl(selectedPartner.linkedin);
    const maps = safeExternalUrl(selectedPartner.maps_url);
    const whatsappDigits = selectedPartner.whatsapp?.replace(/\D/g, '');

    return (
      <main className="min-h-screen bg-[#f8fafc] pb-20 pt-20">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <button type="button" onClick={() => onSelectPartner(null)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"><ArrowLeft className="h-4 w-4" /> Todos os parceiros</button>

          <article className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
            <PartnerImage partner={selectedPartner} large />
            <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.35fr_0.65fr]">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-amber-50 px-3.5 py-1 text-xs font-black uppercase tracking-wider text-amber-900 border border-amber-200">{selectedPartner.category}</span>
                  {selectedPartner.city && <span className="flex items-center gap-1 text-xs font-bold text-slate-500"><MapPin className="h-3.5 w-3.5 text-amber-700" /> {[selectedPartner.city, selectedPartner.state].filter(Boolean).join(' - ')}</span>}
                </div>
                <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{selectedPartner.name}</h1>
                <p className="mt-4 text-base leading-relaxed text-slate-600 sm:text-lg">{selectedPartner.description || selectedPartner.short_description}</p>

                {selectedPartner.services && selectedPartner.services.length > 0 && (
                  <section className="mt-8 border-t border-slate-100 pt-6">
                    <h2 className="text-xl font-black text-slate-900">Serviços e especialidades</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {selectedPartner.services.map((service) => (
                        <div key={service} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm font-bold text-slate-800">
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-amber-700" />
                          <span>{service}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {selectedPartner.products && selectedPartner.products.length > 0 && (
                  <section className="mt-8 border-t border-slate-100 pt-6">
                    <h2 className="text-xl font-black text-slate-900">Produtos e soluções</h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedPartner.products.map((product) => (
                        <span key={product} className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-amber-300">
                          {product}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

                {selectedPartner.benefits && (
                  <section className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
                    <div className="flex items-center gap-2 text-amber-900">
                      <Sparkles className="h-4 w-4 text-amber-700" />
                      <p className="text-xs font-black uppercase tracking-wider">Benefício para clientes GSA</p>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed font-semibold text-amber-950">{selectedPartner.benefits}</p>
                  </section>
                )}
              </div>

              <aside className="h-fit rounded-2xl border border-slate-800 bg-[#0c121e] p-7 text-white shadow-xl">
                <h2 className="text-lg font-black text-amber-400">Informações de contato</h2>
                <div className="mt-5 space-y-4 text-sm text-slate-300">
                  {address && <div className="flex gap-3"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /><span className="text-xs leading-relaxed">{address}</span></div>}
                  {selectedPartner.business_hours && <div className="flex gap-3"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /><span className="text-xs">{selectedPartner.business_hours}</span></div>}
                  <div className="flex gap-3"><Users className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" /><span className="text-xs">{PARTNER_MODE_LABELS[selectedPartner.service_mode]}{selectedPartner.service_regions.length ? ` · ${selectedPartner.service_regions.join(', ')}` : ''}</span></div>
                </div>

                <div className="mt-6 grid gap-2.5">
                  {whatsappDigits && (
                    <a href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Encontrei a ${selectedPartner.name} pela página de parceiros da GSA HUB e gostaria de mais informações.`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 shadow-md transition hover:bg-emerald-400">
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  )}
                  {selectedPartner.phone && (
                    <a href={`tel:${selectedPartner.phone.replace(/[^\d+]/g, '')}`} className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold transition hover:bg-white/10">
                      <Phone className="h-4 w-4 text-amber-400" /> Ligar
                    </a>
                  )}
                  {selectedPartner.email && (
                    <a href={`mailto:${selectedPartner.email}`} className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold transition hover:bg-white/10">
                      <Mail className="h-4 w-4 text-amber-400" /> Enviar e-mail
                    </a>
                  )}
                  {maps && (
                    <a href={maps} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold transition hover:bg-white/10">
                      <MapPin className="h-4 w-4 text-amber-400" /> Ver localização
                    </a>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                  {website && <SocialLink href={website} label="Site"><Globe2 className="h-4 w-4" /></SocialLink>}
                  {instagram && <SocialLink href={instagram} label="Instagram"><Instagram className="h-4 w-4" /></SocialLink>}
                  {linkedin && <SocialLink href={linkedin} label="LinkedIn"><Linkedin className="h-4 w-4" /></SocialLink>}
                </div>
              </aside>
            </div>
          </article>
        </div>
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#f8fafc]">
        {/* ─── HERO HEADER (WARM DARK) ────────────────── */}
        <section className="relative border-b border-slate-800 bg-[#0c121e] pb-16 pt-24 text-white sm:pb-20 sm:pt-28">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <button type="button" onClick={onBack} className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Página inicial
            </button>



            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl">
              Nossos <span className="bg-gradient-to-r from-amber-100 via-amber-300 to-amber-200 bg-clip-text text-transparent">Parceiros</span>
            </h1>

            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Conheça empresas, profissionais e organizações credenciadas que atuam em parceria com a GSA HUB oferecendo produtos, serviços e soluções de excelência.
            </p>


          </div>
        </section>

        {/* ─── FILTERS & DIRECTORY ────────────────────── */}
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
            <div className="flex flex-wrap items-center gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`rounded-xl px-4 py-2 text-xs font-black transition-all ${
                    category === cat
                      ? 'bg-slate-950 text-amber-300 shadow-md'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <span className="text-xs font-bold text-slate-500">
              {filtered.length} {filtered.length === 1 ? 'parceiro encontrado' : 'parceiros encontrados'}
            </span>
          </div>

          {/* ─── CARDS GRID ─────────────────────────────── */}
          {loading ? (
            <PartnersLoading compact />
          ) : filtered.length === 0 ? (
            <div className="mt-10 rounded-3xl border border-slate-200 bg-white p-14 text-center shadow-sm">
              <Building2 className="mx-auto h-12 w-12 text-slate-400" />
              <h2 className="mt-4 text-xl font-black text-slate-900">Nenhum parceiro encontrado</h2>
              <p className="mt-2 text-sm text-slate-500">Altere a busca ou escolha outra categoria para ver resultados.</p>
              <button
                type="button"
                onClick={() => { setSearch(''); setCategory('Todas'); }}
                className="mt-5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white hover:bg-slate-800"
              >
                Limpar pesquisa
              </button>
            </div>
          ) : (
            <div className="mt-8 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((partner) => (
                <article
                  key={partner.id}
                  className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-amber-400/50 hover:shadow-xl"
                >
                  <PartnerImage partner={partner} />
                  <div className="flex flex-1 flex-col justify-between p-6">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-amber-900 border border-amber-200">
                          {partner.category}
                        </span>
                        {partner.city && (
                          <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {[partner.city, partner.state].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>

                      <h2 className="mt-4 text-2xl font-black text-slate-950 transition-colors group-hover:text-amber-800">
                        {partner.name}
                      </h2>

                      <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-slate-600 font-medium">
                        {partner.short_description}
                      </p>

                      {partner.services && partner.services.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {partner.services.slice(0, 3).map((service) => (
                            <span key={service} className="rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                              {service}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
                      <span className="text-xs font-bold text-slate-500">
                        {PARTNER_MODE_LABELS[partner.service_mode]}
                      </span>
                      <button
                        type="button"
                        onClick={() => onSelectPartner(partner.slug)}
                        className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wider text-slate-950 transition-colors group-hover:text-amber-800"
                      >
                        <span>Conhecer parceiro</span>
                        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* ─── CALL TO ACTION BANNER ────────────────────── */}
          <div className="mt-16 overflow-hidden rounded-3xl border border-amber-400/30 bg-[#0c121e] p-8 text-white shadow-2xl sm:p-12">
            <div className="flex flex-col items-center justify-between gap-8 md:flex-row text-center md:text-left">
              <div className="max-w-2xl">

                <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                  Faça parte da nossa rede de parceiros
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                  Preencha o formulário com os dados da empresa, contatos, endereço, serviços e imagens. A solicitação será enviada diretamente ao painel administrativo para análise.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setApplicationOpen(true)}
                className="group inline-flex shrink-0 items-center gap-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 px-7 py-4 text-sm font-black uppercase tracking-wider text-slate-950 shadow-xl transition hover:from-amber-300 hover:to-amber-400 hover:scale-105"
              >
                <ShieldCheck className="h-5 w-5 text-slate-950" />
                <span>Seja nosso parceiro</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <PartnerApplicationModal open={applicationOpen} onClose={() => setApplicationOpen(false)} />
    </>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:bg-white/20 hover:text-white">
      {children}
      {label}
      <ExternalLink className="h-3 w-3 opacity-60" />
    </a>
  );
}

function PartnersLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`${compact ? 'py-16' : 'min-h-[70vh] pt-28'} flex items-center justify-center bg-[#f8fafc]`} role="status">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-amber-400 border-t-transparent" />
      <span className="sr-only">Carregando parceiros</span>
    </div>
  );
}
