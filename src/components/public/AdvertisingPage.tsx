import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  Copy,
  LayoutGrid,
  Megaphone,
  MonitorSmartphone,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { routes } from '../../routing/routeCatalog';
import type { AdvertisingFormat } from '../../types/advertising';
import { validarCNPJ, validarCPF } from '../../utils/cpfValidator';
import { copyToClipboard } from '../../lib/utils';
import { AdvertisingSlot } from '../ads/AdvertisingSlot';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';

const FORMATS: Array<{ id: AdvertisingFormat; title: string; description: string }> = [
  { id: 'responsive_banner', title: 'Banner responsivo', description: 'Faixa horizontal adaptada ao celular e ao computador.' },
  { id: 'sponsored_card', title: 'Card patrocinado', description: 'Anúncio integrado às vitrines e listagens.' },
  { id: 'rectangle', title: 'Retângulo ou lateral', description: 'Bloco visual para áreas de destaque.' },
  { id: 'hero', title: 'Destaque principal', description: 'Campanha premium em área nobre.' },
  { id: 'inline_video', title: 'Vídeo no conteúdo', description: 'Vídeo responsivo com controles.' },
  { id: 'section_sponsorship', title: 'Patrocínio de seção', description: 'Marca associada a uma página ou módulo.' },
  { id: 'sponsored_content', title: 'Conteúdo patrocinado', description: 'Publicação dedicada à campanha.' },
  { id: 'lightbox', title: 'Lightbox controlado', description: 'Formato especial com fechamento imediato.' },
];

const PLACEMENTS = [
  { code: 'HOME_BANNER_TOP', label: 'Home — banner superior' },
  { code: 'HOME_INLINE_01', label: 'Home — dentro do conteúdo' },
  { code: 'HOME_LIGHTBOX', label: 'Home — lightbox controlado' },
  { code: 'SITE_STICKY_BOTTOM', label: 'Site inteiro — banner inferior' },
  { code: 'MARKETPLACE_SPONSORED_CARD', label: 'Marketplace — card patrocinado' },
  { code: 'CLASSIFIEDS_BANNER_TOP', label: 'Classificados — banner superior' },
  { code: 'ADS_PUBLIC_SHOWCASE', label: 'Página pública de anunciantes' },
];

const INITIAL_FORM = {
  company_name: '',
  document: '',
  company_size: '',
  segment: '',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  website: '',
  objective: '',
  desired_formats: [] as AdvertisingFormat[],
  desired_pages: [] as string[],
  devices: ['desktop', 'mobile'] as string[],
  desired_start_date: '',
  desired_end_date: '',
  intended_budget: '',
  needs_creative_service: false,
  notes: '',
  website_confirmation: '',
};

interface AdvertisingPageProps {
  mode?: 'showcase' | 'advertise';
  onBack: () => void;
  onLogin?: () => void;
}

function todayLocal() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isValidDocument(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits.length === 11 ? validarCPF(digits) : digits.length === 14 && validarCNPJ(digits);
}

function normalizeWebsite(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https:\/\//i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^https?:\/\//i, '')}`;
}

function errorMessage(error: unknown) {
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'Não foi possível enviar a solicitação. Nenhum protocolo foi criado.';
}

export function AdvertisingPage({ mode = 'showcase', onBack, onLogin }: AdvertisingPageProps) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const today = todayLocal();

  useEffect(() => {
    if (mode === 'advertise') {
      window.requestAnimationFrame(() => {
        document.getElementById('formulario-anunciante')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [mode]);

  const toggle = (field: 'desired_formats' | 'desired_pages' | 'devices', value: string) => {
    setForm((current) => {
      const values = current[field] as string[];
      return { ...current, [field]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.company_name.trim().length < 2) return toast.error('Informe o nome ou razão social.');
    if (!isValidDocument(form.document)) return toast.error('Informe um CPF ou CNPJ válido.');
    if (!form.company_size) return toast.error('Selecione o porte da empresa.');
    if (form.segment.trim().length < 2) return toast.error('Informe o segmento.');
    if (form.contact_name.trim().length < 2) return toast.error('Informe o responsável pelo contato.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())) return toast.error('Informe um e-mail válido.');
    if (form.contact_phone.replace(/\D/g, '').length < 10) return toast.error('Informe telefone com DDD.');
    if (form.objective.trim().length < 3) return toast.error('Informe o objetivo da campanha.');
    if (!form.desired_formats.length) return toast.error('Selecione ao menos um formato.');
    if (!form.desired_pages.length) return toast.error('Selecione ao menos uma posição.');
    if (!form.devices.length) return toast.error('Selecione ao menos um dispositivo.');
    const budget = Number(form.intended_budget);
    if (!Number.isFinite(budget) || budget <= 0) return toast.error('Informe um investimento válido.');
    if (!privacyAccepted) return toast.error('Aceite a política de privacidade para continuar.');
    if (form.desired_start_date && form.desired_start_date < today) return toast.error('A data inicial deve ser atual ou futura.');
    if (form.desired_end_date && !form.desired_start_date) return toast.error('Informe a data inicial antes da final.');
    if (form.desired_start_date && form.desired_end_date && form.desired_end_date < form.desired_start_date) {
      return toast.error('A data final não pode ser anterior à inicial.');
    }

    const elapsed = Date.now() - Date.parse(startedAt);
    if (elapsed < 2500) await new Promise((resolve) => window.setTimeout(resolve, 2500 - elapsed));

    setSubmitting(true);
    setProtocol(null);
    try {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; protocol?: string; error?: string }>('gsa-public-advertising', {
        body: {
          company_name: form.company_name.trim(),
          document: form.document,
          company_size: form.company_size,
          segment: form.segment.trim(),
          contact_name: form.contact_name.trim(),
          contact_email: form.contact_email.trim().toLowerCase(),
          contact_phone: form.contact_phone,
          website: normalizeWebsite(form.website),
          objective: form.objective.trim(),
          desired_formats: form.desired_formats,
          desired_pages: form.desired_pages,
          devices: form.devices,
          desired_start_date: form.desired_start_date,
          desired_end_date: form.desired_end_date,
          intended_budget: budget,
          needs_creative_service: form.needs_creative_service,
          notes: form.notes.trim().slice(0, 2000),
          website_confirmation: form.website_confirmation,
          started_at: startedAt,
          source_metadata: {
            pathname: window.location.pathname,
            referrer: document.referrer || '',
            utm_source: new URLSearchParams(window.location.search).get('utm_source') || '',
          },
        },
      });
      if (error || !data?.success || !data.protocol) {
        throw error || new Error(data?.error || 'O servidor não confirmou a gravação da solicitação.');
      }
      setProtocol(data.protocol);
      setForm(INITIAL_FORM);
      setPrivacyAccepted(false);
      setStartedAt(new Date().toISOString());
      toast.success('Solicitação gravada com sucesso no sistema GSA.');
    } catch (error) {
      console.error('Falha ao enviar solicitação de anúncio:', error);
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <button type="button" onClick={onBack} className="flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-white/70 hover:bg-white/10">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onLogin} className="hidden rounded-full px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 sm:block">
              Portal do anunciante
            </button>
            <a href="#formulario-anunciante" className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-black text-neutral-950">Quero anunciar</a>
          </div>
        </div>
      </header>

      <section className="border-b border-white/10 px-5 py-20 text-center">
        <div className="mx-auto max-w-5xl">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-300/30 bg-amber-300/10 px-4 py-2 text-xs font-black uppercase tracking-[.22em] text-amber-200">
            <Megaphone className="h-4 w-4" /> GSA Anúncios
          </span>
          <h1 className="mt-7 text-4xl font-black tracking-tight sm:text-6xl">Sua empresa nos lugares certos, com controle e transparência.</h1>
          <p className="mx-auto mt-6 max-w-3xl text-lg text-white/65">Solicitação, proposta, pagamento, criativo, veiculação e relatório final em um único fluxo conectado.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm font-bold text-white/70">
            <span className="rounded-full border border-white/10 px-4 py-2">Proposta antes do pagamento</span>
            <span className="rounded-full border border-white/10 px-4 py-2">Agendamento automático</span>
            <span className="rounded-full border border-white/10 px-4 py-2">Métricas verificáveis</span>
          </div>
        </div>
      </section>

      <section className="px-5 py-14">
        <div className="mx-auto grid max-w-6xl gap-5 md:grid-cols-3">
          {[
            { icon: LayoutGrid, title: 'Inventário organizado', text: 'Posições, formatos, dispositivos e períodos controlados.' },
            { icon: ShieldCheck, title: 'Fluxo protegido', text: 'A publicação depende de pagamento confirmado e criativo aprovado.' },
            { icon: BarChart3, title: 'Relatório completo', text: 'Impressões, visualizações, cliques e eventos de vídeo.' },
          ].map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
              <Icon className="h-6 w-6 text-amber-300" />
              <h2 className="mt-4 font-black">{title}</h2>
              <p className="mt-2 text-sm text-white/60">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-5 pb-10">
        <div className="mx-auto max-w-6xl rounded-3xl border border-white/10 bg-black/30 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-black"><BadgeCheck className="h-5 w-5 text-amber-300" /> Vitrine de campanhas ativas</div>
          <AdvertisingSlot placementCode="ADS_PUBLIC_SHOWCASE" className="min-h-28" />
        </div>
      </section>

      <section id="formulario-anunciante" className="px-5 py-16">
        <form onSubmit={submit} className="mx-auto max-w-5xl space-y-8 rounded-[2rem] border border-white/10 bg-neutral-900 p-6 shadow-2xl sm:p-10">
          <div>
            <h2 className="text-2xl font-black">Solicitar proposta de anúncio</h2>
            <p className="mt-2 text-sm text-white/60">O protocolo só será exibido depois que o banco confirmar a gravação.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <input required value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} placeholder="Empresa / Razão Social" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
            <input required value={form.document} onChange={(e) => setForm({ ...form, document: e.target.value })} placeholder="CPF ou CNPJ" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
            <select required value={form.company_size} onChange={(e) => setForm({ ...form, company_size: e.target.value })} className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3">
              <option value="">Porte da empresa</option><option value="autonomo">Autônomo</option><option value="mei">MEI</option><option value="micro">Microempresa</option><option value="pequena">Pequena</option><option value="media">Média</option><option value="grande">Grande</option>
            </select>
            <input required value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} placeholder="Segmento" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
            <input required value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} placeholder="Responsável pelo contato" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
            <input required type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} placeholder="E-mail" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
            <input required value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} placeholder="Telefone / WhatsApp" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
            <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="Site (opcional)" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
          </div>

          <textarea required value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="Objetivo da campanha" rows={3} className="w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />

          <fieldset>
            <legend className="mb-3 font-black">Formatos desejados</legend>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FORMATS.map((item) => (
                <label key={item.id} className={`cursor-pointer rounded-2xl border p-4 ${form.desired_formats.includes(item.id) ? 'border-amber-400 bg-amber-400/10' : 'border-white/10'}`}>
                  <input type="checkbox" className="sr-only" checked={form.desired_formats.includes(item.id)} onChange={() => toggle('desired_formats', item.id)} />
                  <span className="font-bold">{item.title}</span><span className="mt-1 block text-xs text-white/50">{item.description}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 font-black">Posições</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {PLACEMENTS.map((item) => (
                <label key={item.code} className="flex items-center gap-3 rounded-xl border border-white/10 p-3 text-sm">
                  <input type="checkbox" checked={form.desired_pages.includes(item.code)} onChange={() => toggle('desired_pages', item.code)} /> {item.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-3 font-black">Dispositivos</legend>
            <div className="flex flex-wrap gap-3">
              {['desktop', 'tablet', 'mobile'].map((device) => (
                <label key={device} className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm"><input type="checkbox" checked={form.devices.includes(device)} onChange={() => toggle('devices', device)} /><MonitorSmartphone className="h-4 w-4" />{device}</label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-3">
            <input type="date" min={today} value={form.desired_start_date} onChange={(e) => setForm({ ...form, desired_start_date: e.target.value })} className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
            <input type="date" min={form.desired_start_date || today} value={form.desired_end_date} onChange={(e) => setForm({ ...form, desired_end_date: e.target.value })} className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
            <input required type="number" min="1" step="0.01" value={form.intended_budget} onChange={(e) => setForm({ ...form, intended_budget: e.target.value })} placeholder="Investimento pretendido" className="rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4"><input type="checkbox" checked={form.needs_creative_service} onChange={(e) => setForm({ ...form, needs_creative_service: e.target.checked })} /><span><strong>Preciso que a GSA crie a arte</strong><small className="block text-white/50">O serviço será detalhado na proposta.</small></span></label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Observações" rows={3} className="w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3" />
          <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website_confirmation} onChange={(e) => setForm({ ...form, website_confirmation: e.target.value })} className="hidden" />

          <label className="flex items-start gap-3 text-sm text-white/70"><input type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} /><span>Li e aceito a <button type="button" onClick={() => setPrivacyOpen(true)} className="font-bold text-amber-300 underline">política de privacidade</button>.</span></label>

          <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-amber-400 px-5 py-4 font-black text-neutral-950 disabled:opacity-50"><Send className="h-5 w-5" />{submitting ? 'Gravando no sistema...' : 'Enviar solicitação'}</button>

          {protocol && (
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
              <div className="flex items-center gap-2 font-black text-emerald-300"><CheckCircle2 className="h-5 w-5" /> Solicitação confirmada</div>
              <p className="mt-2 text-sm text-white/70">Guarde o protocolo para acompanhar o processo:</p>
              <div className="mt-3 flex items-center justify-between rounded-xl bg-black/30 px-4 py-3 font-mono font-black"><span>{protocol}</span><button type="button" onClick={() => void copyToClipboard(protocol)} aria-label="Copiar protocolo"><Copy className="h-4 w-4" /></button></div>
              <a href={`${routes.login.advertiser()}?protocolo=${encodeURIComponent(protocol)}`} className="mt-4 inline-flex rounded-xl bg-white px-4 py-2 text-sm font-black text-neutral-950">Acessar portal do anunciante</a>
            </div>
          )}
        </form>
      </section>

      <PrivacyPolicyDialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </main>
  );
}
