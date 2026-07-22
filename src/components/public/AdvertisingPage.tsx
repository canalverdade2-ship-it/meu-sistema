import { FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, BarChart3, CalendarDays, Image, LayoutGrid, Megaphone, MonitorSmartphone, PlaySquare, Send, ShieldCheck } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { routes } from '../../routing/routeCatalog';
import type { AdvertisingFormat } from '../../types/advertising';
import { validarCNPJ, validarCPF } from '../../utils/cpfValidator';
import { AdvertisingSlot } from '../ads/AdvertisingSlot';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';

const FORMATS: Array<{ id: AdvertisingFormat; title: string; description: string; icon: typeof Image }> = [
  { id: 'responsive_banner', title: 'Banner responsivo', description: 'Faixa horizontal para topo, conteúdo ou rodapé, adaptada ao celular.', icon: Image },
  { id: 'sponsored_card', title: 'Card patrocinado', description: 'Anúncio integrado às vitrines e listagens do site.', icon: LayoutGrid },
  { id: 'rectangle', title: 'Retângulo ou lateral', description: 'Bloco visual para colunas auxiliares e áreas de destaque.', icon: MonitorSmartphone },
  { id: 'hero', title: 'Destaque principal', description: 'Campanha premium em área nobre de uma página.', icon: Megaphone },
  { id: 'inline_video', title: 'Vídeo no conteúdo', description: 'Vídeo responsivo, iniciado sem som e com controles.', icon: PlaySquare },
  { id: 'section_sponsorship', title: 'Patrocínio de seção', description: 'Marca associada a um módulo ou página específica.', icon: BadgeCheck },
  { id: 'sponsored_content', title: 'Conteúdo patrocinado', description: 'Página ou publicação dedicada à campanha.', icon: BarChart3 },
  { id: 'lightbox', title: 'Lightbox controlado', description: 'Formato especial, com fechamento imediato e frequência limitada.', icon: ShieldCheck },
];

const PLACEMENTS = [
  { code: 'HOME_BANNER_TOP', label: 'Home — banner superior' },
  { code: 'HOME_INLINE_01', label: 'Home — card dentro do conteúdo' },
  { code: 'HOME_LIGHTBOX', label: 'Home — lightbox controlado' },
  { code: 'SITE_STICKY_BOTTOM', label: 'Site inteiro — banner inferior' },
  { code: 'MARKETPLACE_SPONSORED_CARD', label: 'Marketplace — card patrocinado' },
  { code: 'CLASSIFIEDS_BANNER_TOP', label: 'Classificados — banner superior' },
  { code: 'ADS_PUBLIC_SHOWCASE', label: 'Página pública de anunciantes' },
];

const INITIAL_FORM = {
  company_name: '', document: '', company_size: '', segment: '', contact_name: '', contact_email: '', contact_phone: '', website: '',
  objective: '', desired_formats: [] as AdvertisingFormat[], desired_pages: [] as string[], devices: ['desktop', 'mobile'],
  desired_start_date: '', desired_end_date: '', intended_budget: '', needs_creative_service: false, notes: '', website_confirmation: '',
};

function maskDocument(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

function isDocumentValid(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 ? validarCPF(digits) : digits.length === 14 && validarCNPJ(digits);
}

function localIsoDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function daysBetween(start: string, end: string) {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000);
}

interface AdvertisingPageProps {
  mode?: 'showcase' | 'advertise';
  onBack: () => void;
  onLogin?: () => void;
}

export function AdvertisingPage({ mode = 'showcase', onBack, onLogin }: AdvertisingPageProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const today = localIsoDate();

  useEffect(() => {
    if (mode !== 'advertise') return;
    window.requestAnimationFrame(() => document.getElementById('formulario-anunciante')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [mode]);

  const toggleArray = (field: 'desired_formats' | 'desired_pages' | 'devices', value: string) => {
    setForm((current) => {
      const values = current[field] as string[];
      return { ...current, [field]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!isDocumentValid(form.document)) {
      setDocumentError('Informe um CPF ou CNPJ válido, incluindo os dígitos verificadores.');
      document.getElementById('advertising-document')?.focus();
      return;
    }
    if (form.desired_formats.length === 0 || form.desired_pages.length === 0 || form.devices.length === 0) {
      toast.error('Selecione pelo menos um formato, uma posição e um dispositivo.');
      return;
    }
    if (!privacyAccepted) {
      toast.error('Leia e aceite o aviso de privacidade para enviar a solicitação.');
      return;
    }
    if (form.desired_start_date && form.desired_start_date < today) {
      toast.error('A data de início precisa ser hoje ou uma data futura.');
      return;
    }
    if (form.desired_end_date && !form.desired_start_date) {
      toast.error('Selecione a data de início antes da data de fim.');
      return;
    }
    if (form.desired_start_date && form.desired_end_date) {
      const durationDays = daysBetween(form.desired_start_date, form.desired_end_date);
      if (durationDays < 0) {
        toast.error('A data de fim não pode ser anterior à data de início.');
        return;
      }
      if (durationDays > 366) {
        toast.error('O período solicitado pode ter no máximo 366 dias.');
        return;
      }
    }
    setSubmitting(true);
    setProtocol(null);
    try {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; protocol: string }>('gsa-public-advertising', {
        body: {
          ...form,
          intended_budget: Number(form.intended_budget),
          started_at: startedAt,
          source_metadata: {
            pathname: window.location.pathname,
            referrer: document.referrer || null,
            utm_source: new URLSearchParams(window.location.search).get('utm_source'),
          },
        },
      });
      if (error || !data?.success || !data.protocol) throw error || new Error('A solicitação não retornou protocolo.');
      setProtocol(data.protocol);
      setForm(INITIAL_FORM);
      setStartedAt(new Date().toISOString());
      setPrivacyAccepted(false);
      setDocumentError('');
      toast.success('Solicitação enviada para análise.');
    } catch (error) {
      console.error('Falha ao enviar solicitação de anúncio:', error);
      toast.error('Não foi possível enviar a solicitação agora. Revise os dados ou tente novamente mais tarde.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <button onClick={onBack} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-white/70 transition hover:bg-white/10 hover:text-white"><ArrowLeft className="h-4 w-4" /> Voltar</button>
          <div className="flex items-center gap-3">
            <a href={routes.login.advertiser()} className="hidden rounded-full px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 sm:block">Portal do anunciante</a>
            <a href="#formulario-anunciante" className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-black text-neutral-950 transition hover:bg-amber-300">Quero anunciar</a>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden px-5 py-20 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.22),transparent_38%),radial-gradient(circle_at_bottom_left,rgba(99,102,241,0.18),transparent_35%)]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-amber-200"><Megaphone className="h-4 w-4" /> GSA Anúncios</span>
          <h1 className="mt-7 text-4xl font-black tracking-tight sm:text-6xl">Sua empresa nos lugares certos, com controle e transparência.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-white/65">Escolha formatos, páginas, dispositivos, período e investimento. A equipe GSA analisa a solicitação, envia uma proposta e acompanha a campanha do início ao relatório final.</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3 text-sm font-bold text-white/70">
            <span className="rounded-full border border-white/10 px-4 py-2">Proposta antes do pagamento</span>
            <span className="rounded-full border border-white/10 px-4 py-2">Agendamento automático</span>
            <span className="rounded-full border border-white/10 px-4 py-2">Métricas auditáveis</span>
          </div>
        </div>
      </section>

      <section className="border-y border-white/10 bg-white/[0.03] px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 max-w-2xl"><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Formatos disponíveis</p><h2 className="mt-3 text-3xl font-black">Escolha como sua marca será apresentada</h2></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {FORMATS.map(({ id, title, description, icon: Icon }) => <article key={id} className="rounded-3xl border border-white/10 bg-white/[0.04] p-6"><Icon className="h-7 w-7 text-amber-300" /><h3 className="mt-5 font-black">{title}</h3><p className="mt-2 text-sm leading-relaxed text-white/55">{description}</p></article>)}
          </div>
        </div>
      </section>

      {mode === 'showcase' && <section className="px-5 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Campanhas publicadas</p><h2 className="mt-3 text-3xl font-black">Conheça quem anuncia com a GSA</h2></div><span className="text-sm text-white/45">Somente campanhas pagas e aprovadas são exibidas.</span></div>
          <AdvertisingSlot
            placementCode="ADS_PUBLIC_SHOWCASE"
            variant="showcase"
            className="mx-auto mt-8 max-w-2xl text-left"
            loadingFallback={<div className="mt-8 rounded-3xl border border-white/10 p-10 text-center text-white/50" role="status">Carregando campanha...</div>}
            emptyFallback={<div className="mt-8 rounded-3xl border border-dashed border-white/15 bg-white/[0.02] p-10 text-center"><Megaphone className="mx-auto h-8 w-8 text-amber-300" /><h3 className="mt-4 text-xl font-black">Primeiros espaços em contratação</h3><p className="mx-auto mt-2 max-w-xl text-sm text-white/55">A vitrine publicará somente campanhas aprovadas. Envie sua solicitação para participar da primeira seleção.</p></div>}
          />
        </div>
      </section>}

      <section id="formulario-anunciante" className="scroll-mt-20 border-t border-white/10 bg-neutral-900 px-5 py-16">
        <form onSubmit={submit} className="mx-auto max-w-5xl rounded-[2rem] border border-white/10 bg-neutral-950 p-5 shadow-2xl sm:p-10">
          <div className="mb-8"><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">Solicitação inicial</p><h2 className="mt-3 text-3xl font-black">Conte-nos como deseja anunciar</h2><p className="mt-3 text-sm leading-relaxed text-white/55">Este formulário não gera cobrança. A equipe analisará disponibilidade, regras e investimento antes de enviar uma proposta.</p></div>
          {protocol && <div className="mb-8 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5" role="status"><p className="font-black text-emerald-200">Solicitação recebida</p><p className="mt-1 text-sm text-emerald-100/70">Guarde o protocolo <strong className="text-white">{protocol}</strong>.</p></div>}

          <div className="grid gap-5 md:grid-cols-2">
            <label className="text-sm font-bold">Empresa<input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /></label>
            <label className="text-sm font-bold" htmlFor="advertising-document">CPF ou CNPJ<input id="advertising-document" required inputMode="numeric" autoComplete="off" maxLength={18} placeholder="000.000.000-00 ou 00.000.000/0000-00" value={form.document} onChange={(e) => { const document = maskDocument(e.target.value); setForm({ ...form, document }); if (!document || isDocumentValid(document)) setDocumentError(''); }} onBlur={() => setDocumentError(form.document && !isDocumentValid(form.document) ? 'Informe um CPF ou CNPJ válido, incluindo os dígitos verificadores.' : '')} aria-invalid={Boolean(documentError)} aria-describedby="advertising-document-help" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /><span id="advertising-document-help" className={`mt-1.5 block text-xs ${documentError ? 'text-red-300' : 'text-white/45'}`}>{documentError || 'O documento é validado antes do envio e usado para identificar a empresa ou o responsável.'}</span></label>
            <label className="text-sm font-bold">Porte<select required value={form.company_size} onChange={(e) => setForm({ ...form, company_size: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 outline-none focus:border-amber-300"><option value="">Selecione</option><option value="autonomo">Profissional autônomo</option><option value="mei">MEI</option><option value="micro">Microempresa</option><option value="pequena">Pequena empresa</option><option value="media">Média empresa</option><option value="grande">Grande empresa</option></select></label>
            <label className="text-sm font-bold">Segmento<input required value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /></label>
            <label className="text-sm font-bold">Responsável<input required autoComplete="name" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /></label>
            <label className="text-sm font-bold">E-mail<input required type="email" autoComplete="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /></label>
            <label className="text-sm font-bold">Telefone<input required inputMode="tel" autoComplete="tel" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /></label>
            <label className="text-sm font-bold">Site HTTPS, quando houver<input type="url" placeholder="https://" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /></label>
          </div>

          <label className="mt-5 block text-sm font-bold">Objetivo da campanha<input required value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Ex.: divulgar promoção, gerar contatos ou apresentar um serviço" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /></label>

          <fieldset className="mt-8"><legend className="font-black">Formatos desejados</legend><div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{FORMATS.map((item) => <label key={item.id} className={`cursor-pointer rounded-2xl border p-4 text-sm transition ${form.desired_formats.includes(item.id) ? 'border-amber-300 bg-amber-300/10' : 'border-white/10 bg-white/[0.03]'}`}><input type="checkbox" className="sr-only" checked={form.desired_formats.includes(item.id)} onChange={() => toggleArray('desired_formats', item.id)} /><span className="font-bold">{item.title}</span></label>)}</div></fieldset>
          <fieldset className="mt-8"><legend className="font-black">Páginas e posições</legend><div className="mt-3 grid gap-3 sm:grid-cols-2">{PLACEMENTS.map((item) => <label key={item.code} className={`cursor-pointer rounded-2xl border p-4 text-sm transition ${form.desired_pages.includes(item.code) ? 'border-amber-300 bg-amber-300/10' : 'border-white/10 bg-white/[0.03]'}`}><input type="checkbox" className="mr-3" checked={form.desired_pages.includes(item.code)} onChange={() => toggleArray('desired_pages', item.code)} />{item.label}</label>)}</div></fieldset>
          <fieldset className="mt-8"><legend className="font-black">Dispositivos</legend><div className="mt-3 flex flex-wrap gap-3">{[['desktop','Desktop'],['tablet','Tablet'],['mobile','Celular']].map(([id,label]) => <label key={id} className="rounded-full border border-white/10 px-4 py-2 text-sm"><input type="checkbox" className="mr-2" checked={form.devices.includes(id)} onChange={() => toggleArray('devices', id)} />{label}</label>)}</div></fieldset>

          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <label className="text-sm font-bold">Início desejado<input type="date" min={today} value={form.desired_start_date} onChange={(e) => setForm({ ...form, desired_start_date: e.target.value, desired_end_date: form.desired_end_date && form.desired_end_date < e.target.value ? '' : form.desired_end_date })} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3" /></label>
            <label className="text-sm font-bold">Fim desejado<input type="date" min={form.desired_start_date || today} disabled={!form.desired_start_date} value={form.desired_end_date} onChange={(e) => setForm({ ...form, desired_end_date: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-900 px-4 py-3 disabled:cursor-not-allowed disabled:opacity-50" /><span className="mt-1.5 block text-xs font-normal text-white/45">Selecione primeiro o início. Período máximo: 366 dias.</span></label>
            <label className="text-sm font-bold">Investimento pretendido<input required type="number" min="1" step="0.01" value={form.intended_budget} onChange={(e) => setForm({ ...form, intended_budget: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3" /></label>
          </div>
          <label className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm"><input type="checkbox" className="mt-1" checked={form.needs_creative_service} onChange={(e) => setForm({ ...form, needs_creative_service: e.target.checked })} /><span><strong>Preciso que a GSA produza o criativo.</strong><span className="mt-1 block text-white/50">A produção será calculada separadamente na proposta.</span></span></label>
          <label className="mt-5 block text-sm font-bold">Observações<textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={5} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 outline-none focus:border-amber-300" /></label>
          <label className="sr-only" aria-hidden="true">Não preencher<input tabIndex={-1} autoComplete="off" value={form.website_confirmation} onChange={(e) => setForm({ ...form, website_confirmation: e.target.value })} /></label>

          <label className="mt-6 flex items-start gap-3 rounded-2xl border border-white/10 p-4 text-sm leading-relaxed">
            <input required type="checkbox" className="mt-1" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} />
            <span>Li o <button type="button" onClick={() => setPrivacyOpen(true)} className="font-black text-amber-300 underline decoration-amber-300/50 underline-offset-2 hover:text-amber-200">aviso de privacidade</button> e autorizo o uso dos dados informados para analisar esta solicitação e entrar em contato sobre a proposta.</span>
          </label>

          <div className="mt-8 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between"><p className="max-w-2xl text-xs leading-relaxed text-white/45">Nenhuma campanha é ativada sem proposta aceita, pagamento confirmado e criativo aprovado.</p><button disabled={submitting} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-amber-400 px-6 py-3 font-black text-neutral-950 disabled:opacity-50"><Send className="h-4 w-4" />{submitting ? 'Enviando...' : 'Enviar para análise'}</button></div>
        </form>
      </section>

      <footer className="px-5 py-8 text-center text-xs text-white/35"><CalendarDays className="mx-auto mb-2 h-4 w-4" /> Campanhas são ativadas e encerradas automaticamente de acordo com a proposta aprovada.</footer>
      <PrivacyPolicyDialog isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </main>
  );
}
