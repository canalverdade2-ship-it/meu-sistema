import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
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
  Users,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { getPublicPartner, listPublicPartners } from '../../features/partners/service';
import { PARTNER_MODE_LABELS, type Partner } from '../../features/partners/types';

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
    <div className={`${large ? 'h-64 sm:h-80' : 'h-52'} relative overflow-hidden bg-[#121820]`}>
      {partner.cover_url || partner.logo_url ? (
        <img
          src={partner.cover_url || partner.logo_url || ''}
          alt={`Imagem de ${partner.name}`}
          className={`h-full w-full ${partner.cover_url ? 'object-cover' : 'object-contain p-10'}`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,#223044,#0b1017_70%)] text-[#d8bd73]">
          <Building2 className={`${large ? 'h-24 w-24' : 'h-16 w-16'} opacity-80`} />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
      {partner.featured && (
        <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full border border-[#d8bd73]/45 bg-black/70 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] text-[#f1d98f] backdrop-blur">
          <ShieldCheck className="h-3.5 w-3.5" /> Parceiro em destaque
        </span>
      )}
      {partner.logo_url && partner.cover_url && (
        <div className="absolute bottom-4 left-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-white/20 bg-white p-2 shadow-xl">
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
        if (!cancelled) toast.error('Não foi possível carregar os parceiros neste momento.');
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
      const haystack = [partner.name, partner.category, partner.short_description, partner.city, partner.state, ...partner.services]
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
        <main className="min-h-[70vh] bg-[#f4f1ea] pt-28">
          <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
            <Building2 className="mx-auto h-14 w-14 text-[#8a6e2f]" />
            <h1 className="mt-5 text-3xl font-black">Parceiro não encontrado</h1>
            <p className="mt-3 text-neutral-600">Este perfil não está disponível ou não está mais ativo.</p>
            <button type="button" onClick={() => onSelectPartner(null)} className="mt-8 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-6 py-3 font-bold text-white"><ArrowLeft className="h-4 w-4" /> Voltar aos parceiros</button>
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
      <main className="min-h-screen bg-[#f4f1ea] pt-24">
        <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <button type="button" onClick={() => onSelectPartner(null)} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-bold text-neutral-800 shadow-sm"><ArrowLeft className="h-4 w-4" /> Todos os parceiros</button>

          <article className="mt-7 overflow-hidden rounded-[2rem] border border-neutral-200 bg-white shadow-xl shadow-neutral-900/5">
            <PartnerImage partner={selectedPartner} large />
            <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1.35fr_0.65fr]">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">{selectedPartner.category}</p>
                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">{selectedPartner.name}</h1>
                <p className="mt-5 text-lg leading-8 text-neutral-600">{selectedPartner.description || selectedPartner.short_description}</p>

                {selectedPartner.services.length > 0 && (
                  <section className="mt-9">
                    <h2 className="text-xl font-black">Serviços e especialidades</h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {selectedPartner.services.map((service) => <div key={service} className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm font-semibold text-neutral-700">{service}</div>)}
                    </div>
                  </section>
                )}

                {selectedPartner.products.length > 0 && (
                  <section className="mt-9">
                    <h2 className="text-xl font-black">Produtos e soluções</h2>
                    <div className="mt-4 flex flex-wrap gap-2">{selectedPartner.products.map((product) => <span key={product} className="rounded-full bg-[#142030] px-4 py-2 text-sm font-bold text-white">{product}</span>)}</div>
                  </section>
                )}

                {selectedPartner.benefits && (
                  <section className="mt-9 rounded-2xl border border-[#d8bd73]/45 bg-[#d8bd73]/10 p-6">
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-[#76591e]">Benefício para clientes GSA</p>
                    <p className="mt-3 leading-7 text-neutral-700">{selectedPartner.benefits}</p>
                  </section>
                )}
              </div>

              <aside className="h-fit rounded-2xl bg-neutral-950 p-6 text-white shadow-xl">
                <h2 className="text-lg font-black">Informações de contato</h2>
                <div className="mt-5 space-y-4 text-sm text-white/75">
                  {address && <div className="flex gap-3"><MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#d8bd73]" /><span>{address}</span></div>}
                  {selectedPartner.business_hours && <div className="flex gap-3"><Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-[#d8bd73]" /><span>{selectedPartner.business_hours}</span></div>}
                  <div className="flex gap-3"><Users className="mt-0.5 h-5 w-5 shrink-0 text-[#d8bd73]" /><span>{PARTNER_MODE_LABELS[selectedPartner.service_mode]}{selectedPartner.service_regions.length ? ` · ${selectedPartner.service_regions.join(', ')}` : ''}</span></div>
                </div>

                <div className="mt-6 grid gap-3">
                  {whatsappDigits && <a href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá! Encontrei a ${selectedPartner.name} pela página de parceiros da GSA HUB e gostaria de mais informações.`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25d366] px-4 py-3 font-black text-neutral-950"><MessageCircle className="h-5 w-5" /> WhatsApp</a>}
                  {selectedPartner.phone && <a href={`tel:${selectedPartner.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 font-bold hover:bg-white/10"><Phone className="h-5 w-5" /> Ligar</a>}
                  {selectedPartner.email && <a href={`mailto:${selectedPartner.email}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 font-bold hover:bg-white/10"><Mail className="h-5 w-5" /> Enviar e-mail</a>}
                  {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-3 font-bold hover:bg-white/10"><MapPin className="h-5 w-5" /> Ver localização</a>}
                </div>

                <div className="mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-5">
                  {website && <SocialLink href={website} label="Site"><Globe2 className="h-4 w-4" /></SocialLink>}
                  {instagram && <SocialLink href={instagram} label="Instagram"><Instagram className="h-4 w-4" /></SocialLink>}
                  {linkedin && <SocialLink href={linkedin} label="LinkedIn"><Linkedin className="h-4 w-4" /></SocialLink>}
                </div>
              </aside>
            </div>
          </article>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f1ea] pt-24">
      <section className="relative overflow-hidden bg-neutral-950 py-20 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(216,189,115,0.18),transparent_34%)]" />
        <div className="relative mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <button type="button" onClick={onBack} className="absolute left-4 top-[-2rem] inline-flex items-center gap-2 text-sm font-bold text-white/65 hover:text-white sm:left-6 lg:left-8"><ArrowLeft className="h-4 w-4" /> Página inicial</button>
          <p className="text-xs font-black uppercase tracking-[0.25em] text-[#d8bd73]">Rede de parceiros GSA</p>
          <h1 className="mt-4 text-4xl font-serif font-medium tracking-wide sm:text-6xl">Nossos Parceiros</h1>
          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-white/65 sm:text-lg">Conheça empresas, profissionais e organizações que atuam em parceria com a GSA HUB, oferecendo produtos, serviços e soluções para diferentes necessidades.</p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm md:grid-cols-[1fr_260px]">
          <label className="relative">
            <span className="sr-only">Pesquisar parceiros</span>
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pesquisar por nome, cidade, serviço ou especialidade" className="w-full rounded-xl border border-neutral-200 bg-neutral-50 py-3 pl-12 pr-4 text-sm outline-none transition focus:border-[#8a6e2f] focus:ring-4 focus:ring-[#8a6e2f]/10" />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm font-semibold outline-none focus:border-[#8a6e2f] focus:ring-4 focus:ring-[#8a6e2f]/10">
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>

        {loading ? <PartnersLoading compact /> : filtered.length === 0 ? (
          <div className="py-20 text-center"><Building2 className="mx-auto h-12 w-12 text-neutral-300" /><h2 className="mt-4 text-xl font-black">Nenhum parceiro encontrado</h2><p className="mt-2 text-neutral-500">Altere os filtros ou tente uma nova pesquisa.</p></div>
        ) : (
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((partner) => (
              <article key={partner.id} className="group overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <PartnerImage partner={partner} />
                <div className="p-6">
                  <div className="flex items-center justify-between gap-3"><p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#8a6e2f]">{partner.category}</p><span className="text-xs font-semibold text-neutral-400">{[partner.city, partner.state].filter(Boolean).join(' · ')}</span></div>
                  <h2 className="mt-3 text-2xl font-black">{partner.name}</h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600">{partner.short_description}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-neutral-100 pt-4">
                    <span className="text-xs font-bold text-neutral-500">{PARTNER_MODE_LABELS[partner.service_mode]}</span>
                    <button type="button" onClick={() => onSelectPartner(partner.slug)} className="inline-flex items-center gap-2 text-sm font-black text-[#142030]">Conhecer parceiro <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="mt-14 rounded-[2rem] bg-neutral-950 p-8 text-center text-white sm:p-12">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d8bd73]">Novas conexões</p>
          <h2 className="mt-4 text-3xl font-black">Faça parte da nossa rede de parceiros</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-white/60">Sua empresa deseja ampliar oportunidades e fazer parte do ecossistema GSA? Fale com nossa equipe e conheça as possibilidades de parceria.</p>
          <a href={`https://wa.me/5511920857756?text=${encodeURIComponent('Olá! Gostaria de saber como fazer parte da rede de parceiros da GSA HUB.')}`} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-[#d8bd73] px-6 py-3 font-black text-neutral-950"><MessageCircle className="h-5 w-5" /> Quero ser parceiro</a>
        </div>
      </section>
    </main>
  );
}

function SocialLink({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15">{children}{label}<ExternalLink className="h-3 w-3 opacity-50" /></a>;
}

function PartnersLoading({ compact = false }: { compact?: boolean }) {
  return <div className={`${compact ? 'py-20' : 'min-h-[70vh] pt-28'} flex items-center justify-center bg-[#f4f1ea]`} role="status"><div className="h-10 w-10 animate-spin rounded-full border-4 border-[#d8bd73] border-t-transparent" /><span className="sr-only">Carregando parceiros</span></div>;
}
