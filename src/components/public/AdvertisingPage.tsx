import { FormEvent, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Copy,
  FileCheck2,
  Globe2,
  LayoutGrid,
  LockKeyhole,
  Megaphone,
  MonitorSmartphone,
  Send,
  ShieldCheck,
  Target,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { routes } from '../../routing/routeCatalog';
import type { AdvertisingFormat } from '../../types/advertising';
import { validarCNPJ, validarCPF } from '../../utils/cpfValidator';
import { copyToClipboard, maskCNPJ, maskCPF, maskPhone } from '../../lib/utils';
import { AdvertisingSlot } from '../ads/AdvertisingSlot';
import { PrivacyPolicyDialog } from './PrivacyPolicyDialog';
import { PublicHeader } from './final/PublicHeader';

const FORMATS: Array<{ id: AdvertisingFormat; title: string; description: string }> = [
  { id: 'responsive_banner', title: 'Banner responsivo', description: 'Faixa horizontal adaptada ao celular e ao computador.' },
  { id: 'sponsored_card', title: 'Card patrocinado', description: 'Presença integrada às vitrines e listagens do portal.' },
  { id: 'rectangle', title: 'Retângulo ou lateral', description: 'Bloco visual para áreas de leitura e navegação.' },
  { id: 'hero', title: 'Destaque principal', description: 'Campanha premium em uma área de alta visibilidade.' },
  { id: 'inline_video', title: 'Vídeo no conteúdo', description: 'Vídeo responsivo com controles e medição de eventos.' },
  { id: 'section_sponsorship', title: 'Patrocínio de seção', description: 'Marca associada a uma página ou módulo específico.' },
  { id: 'sponsored_content', title: 'Conteúdo patrocinado', description: 'Publicação dedicada à mensagem da campanha.' },
  { id: 'lightbox', title: 'Lightbox controlado', description: 'Formato especial, sempre com fechamento imediato.' },
];

const PLACEMENTS = [
  { code: 'HOME_BANNER_TOP', label: 'Página inicial — banner superior' },
  { code: 'HOME_INLINE_01', label: 'Página inicial — dentro do conteúdo' },
  { code: 'HOME_LIGHTBOX', label: 'Página inicial — exibição especial' },
  { code: 'SITE_STICKY_BOTTOM', label: 'Portal — banner inferior fixo' },
  { code: 'MARKETPLACE_SPONSORED_CARD', label: 'Marketplace — card patrocinado' },
  { code: 'CLASSIFIEDS_BANNER_TOP', label: 'Classificados — banner superior' },
  { code: 'ADS_PUBLIC_SHOWCASE', label: 'Vitrine pública de anunciantes' },
];

const PROCESS = [
  { number: '01', title: 'Solicitação', text: 'Sua empresa informa objetivo, período, formatos e investimento pretendido.' },
  { number: '02', title: 'Análise comercial', text: 'A equipe avalia disponibilidade, adequação da campanha e inventário.' },
  { number: '03', title: 'Proposta', text: 'Você recebe condições, prazo, posições e escopo antes de qualquer pagamento.' },
  { number: '04', title: 'Aprovação', text: 'Pagamento e material criativo são confirmados dentro do fluxo seguro.' },
  { number: '05', title: 'Veiculação', text: 'A campanha é publicada no período contratado e acompanhada por métricas.' },
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

function maskDocument(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  return digits.length <= 11 ? maskCPF(digits) : maskCNPJ(digits);
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

const inputClass =
  'mt-2 w-full rounded-lg border border-[#cfd4d8] bg-white px-3.5 py-3 text-sm text-[#17202a] outline-none transition placeholder:text-[#87919a] focus:border-[#9a7939] focus:ring-2 focus:ring-[#c7a458]/20 disabled:cursor-not-allowed disabled:bg-[#f1f2f3]';

const sectionTitleClass = 'text-lg font-extrabold tracking-[-0.015em] text-[#17202a]';

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

  const scrollToForm = () => {
    document.getElementById('formulario-anunciante')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      window.requestAnimationFrame(() => {
        document.getElementById('confirmacao-anuncio')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    } catch (error) {
      console.error('Falha ao enviar solicitação de anúncio:', error);
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyProtocol = async () => {
    if (!protocol) return;
    const copied = await copyToClipboard(protocol);
    copied ? toast.success('Protocolo copiado.') : toast.error('Não foi possível copiar o protocolo.');
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f4f1ea] text-[#17202a]">
      <PublicHeader currentPage="ads" onClientLogin={onLogin} />

      <section className="relative border-b border-[#d8d0c3] bg-[#eee9df]">
        <div className="absolute inset-x-0 top-0 h-[3px] bg-[#b8903e]" />
        <div className="mx-auto grid min-h-[620px] max-w-7xl items-stretch lg:grid-cols-[1.12fr_0.88fr]">
          <div className="flex flex-col justify-center px-6 py-16 sm:px-10 lg:px-12 lg:py-24 xl:px-16">
            <button
              type="button"
              onClick={onBack}
              className="mb-10 inline-flex w-fit items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#59636d] transition hover:text-[#806128]"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao site
            </button>

            <p className="flex items-center gap-3 text-xs font-extrabold uppercase tracking-[0.2em] text-[#806128]">
              <span className="h-px w-10 bg-[#b8903e]" />
              Publicidade no ecossistema GSA
            </p>
            <h1 className="mt-6 max-w-[13ch] text-4xl font-black leading-[1.02] tracking-[-0.045em] text-[#111820] sm:text-5xl lg:text-6xl">
              Sua marca em um ambiente profissional e relevante.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#59636d] sm:text-lg">
              Planejamos a presença da sua empresa dentro das páginas, vitrines e serviços digitais da GSA, com proposta formal, publicação controlada e acompanhamento do desempenho.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={scrollToForm}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#a98743] bg-[#d6ba72] px-6 py-3 text-sm font-extrabold text-[#17202a] shadow-[0_12px_26px_rgba(92,70,27,0.14)] transition hover:-translate-y-0.5 hover:bg-[#dfc57f]"
              >
                Quero anunciar
                <ArrowRight className="h-4 w-4" />
              </button>
              <a
                href={routes.login.advertiser()}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-[#aeb5ba] bg-white/55 px-6 py-3 text-sm font-bold text-[#26313a] transition hover:border-[#8a6b2f] hover:bg-white"
              >
                <LockKeyhole className="h-4 w-4" />
                Área do anunciante
              </a>
            </div>

            <dl className="mt-11 grid max-w-2xl grid-cols-1 border-y border-[#d4ccbf] sm:grid-cols-3">
              {[
                ['Processo', 'Comercial e documentado'],
                ['Publicação', 'Somente após aprovação'],
                ['Acompanhamento', 'Métricas da campanha'],
              ].map(([term, description], index) => (
                <div key={term} className={`py-4 sm:px-5 ${index === 0 ? 'sm:pl-0' : 'border-t border-[#d4ccbf] sm:border-l sm:border-t-0'}`}>
                  <dt className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#806128]">{term}</dt>
                  <dd className="mt-1 text-sm font-semibold text-[#35414a]">{description}</dd>
                </div>
              ))}
            </dl>
          </div>

          <aside className="relative flex flex-col justify-center overflow-hidden bg-[#10202e] px-6 py-14 text-white sm:px-10 lg:px-12 lg:py-20 xl:px-14">
            <div className="absolute inset-y-0 left-0 w-[3px] bg-[#c7a458]" />
            <div className="relative">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#d7b96e]">Como a contratação funciona</p>
              <h2 className="mt-4 max-w-md text-3xl font-black tracking-[-0.025em]">Um fluxo comercial claro, do primeiro contato ao relatório.</h2>
              <ol className="mt-9 divide-y divide-white/10 border-y border-white/10">
                {PROCESS.map((item) => (
                  <li key={item.number} className="grid grid-cols-[2.75rem_1fr] gap-4 py-4">
                    <span className="pt-0.5 text-xs font-black tracking-[0.12em] text-[#d7b96e]">{item.number}</span>
                    <div>
                      <h3 className="text-sm font-extrabold text-white">{item.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{item.text}</p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-6 flex items-start gap-3 text-xs leading-5 text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#d7b96e]" />
                Proposta antes do pagamento. Nenhuma campanha é publicada sem confirmação financeira e aprovação do material.
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="border-b border-[#d8d0c3] bg-white">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-12 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#806128]">Estrutura comercial</p>
              <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#17202a] sm:text-4xl">Publicidade tratada como operação, não como improviso.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#65707a]">
                A GSA organiza cada campanha com escopo, posição, prazo, criativo e indicadores definidos. Sua empresa sabe o que está contratando e acompanha o que foi entregue.
              </p>
            </div>

            <div className="grid border-t border-[#d7dadd] md:grid-cols-3">
              {[
                { icon: Target, title: 'Planejamento', text: 'Objetivo, público, formato e período alinhados antes da publicação.' },
                { icon: ShieldCheck, title: 'Governança', text: 'Pagamento, aprovação e veiculação registrados no mesmo fluxo.' },
                { icon: BarChart3, title: 'Medição', text: 'Impressões, visualizações, cliques e eventos disponíveis no acompanhamento.' },
              ].map(({ icon: Icon, title, text }, index) => (
                <article key={title} className={`border-b border-[#d7dadd] py-7 md:px-6 ${index > 0 ? 'md:border-l' : 'md:pl-0'}`}>
                  <Icon className="h-5 w-5 text-[#8a6b2f]" />
                  <h3 className="mt-5 text-base font-extrabold text-[#17202a]">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#68737c]">{text}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#f4f1ea]">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-12 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-start lg:gap-16">
            <div className="lg:sticky lg:top-28">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#806128]">Possibilidades de presença</p>
              <h2 className="mt-4 max-w-xl text-3xl font-black tracking-[-0.03em] text-[#17202a] sm:text-4xl">Sua campanha pode ocupar espaços compatíveis com o objetivo da marca.</h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-[#65707a]">
                A disponibilidade é analisada pela equipe comercial. A posição final, o formato e o período constam na proposta enviada para aprovação.
              </p>
              <div className="mt-8 border-l-2 border-[#b8903e] bg-white px-5 py-4 text-sm leading-6 text-[#59636d] shadow-[0_8px_24px_rgba(42,50,57,0.05)]">
                Formatos especiais, incluindo lightbox, seguem regras de frequência e oferecem fechamento imediato ao visitante.
              </div>
            </div>

            <div className="overflow-hidden border border-[#d5d9dc] bg-white shadow-[0_18px_45px_rgba(40,48,55,0.07)]">
              <div className="grid sm:grid-cols-2">
                {PLACEMENTS.map((placement, index) => (
                  <div
                    key={placement.code}
                    className={`flex min-h-20 items-center gap-4 border-[#e0e2e4] px-5 py-4 ${index < PLACEMENTS.length - 2 ? 'border-b' : ''} ${index % 2 === 1 ? 'sm:border-l' : ''}`}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#cbb680] bg-[#f8f3e7] text-[#806128]">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="text-sm font-semibold text-[#35414a]">{placement.label}</span>
                  </div>
                ))}
                <div className="flex min-h-20 items-center gap-4 border-t border-[#e0e2e4] bg-[#10202e] px-5 py-4 text-white sm:border-l sm:border-t-0">
                  <Globe2 className="h-5 w-5 shrink-0 text-[#d7b96e]" />
                  <span className="text-sm font-semibold">Outras posições podem ser avaliadas conforme o projeto.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d8d0c3] bg-[#e9e4da]">
        <div className="mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-12">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#806128]">
                <BadgeCheck className="h-4 w-4" />
                Campanhas em exibição
              </p>
              <h2 className="mt-3 text-2xl font-black tracking-[-0.025em] text-[#17202a]">Vitrine de campanhas ativas</h2>
            </div>
            <p className="max-w-lg text-sm leading-6 text-[#65707a]">Este espaço utiliza o mecanismo real de entrega e exibe somente campanhas elegíveis para a posição.</p>
          </div>
          <div className="border border-[#cfd4d8] bg-white p-4 shadow-[0_14px_35px_rgba(42,50,57,0.06)] sm:p-6">
            <AdvertisingSlot placementCode="ADS_PUBLIC_SHOWCASE" className="min-h-28" />
          </div>
        </div>
      </section>

      <section id="formulario-anunciante" className="scroll-mt-20 bg-[#f4f1ea]">
        <div className="mx-auto max-w-7xl px-6 py-16 sm:px-10 lg:px-12 lg:py-24">
          <div className="mb-10 max-w-3xl">
            <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#806128]">Solicitação comercial</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] text-[#17202a] sm:text-4xl">Conte-nos o que sua empresa pretende divulgar.</h2>
            <p className="mt-5 text-base leading-7 text-[#65707a]">
              O envio não gera cobrança. A equipe analisará as informações e preparará uma proposta conforme a disponibilidade do inventário.
            </p>
          </div>

          <div className="grid overflow-hidden border border-[#cfd4d8] bg-white shadow-[0_28px_70px_rgba(36,44,51,0.10)] lg:grid-cols-[0.34fr_0.66fr]">
            <aside className="bg-[#10202e] px-6 py-8 text-white sm:px-8 lg:px-9 lg:py-10">
              <div className="lg:sticky lg:top-28">
                <Megaphone className="h-7 w-7 text-[#d7b96e]" />
                <h3 className="mt-5 text-2xl font-black tracking-[-0.02em]">Antes de enviar</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">Tenha em mãos os dados da empresa e uma estimativa do período e investimento desejados.</p>

                <ul className="mt-8 divide-y divide-white/10 border-y border-white/10">
                  {[
                    { icon: Building2, text: 'Dados cadastrais da empresa ou profissional' },
                    { icon: Target, text: 'Objetivo principal da campanha' },
                    { icon: CalendarDays, text: 'Período estimado de veiculação' },
                    { icon: LayoutGrid, text: 'Formatos e áreas de interesse' },
                  ].map(({ icon: Icon, text }) => (
                    <li key={text} className="flex items-start gap-3 py-4 text-sm leading-5 text-slate-200">
                      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#d7b96e]" />
                      {text}
                    </li>
                  ))}
                </ul>

                <div className="mt-8 border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                    <FileCheck2 className="h-4 w-4 text-[#d7b96e]" />
                    Registro confirmado
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">O protocolo só é exibido após a confirmação da gravação no banco de dados.</p>
                </div>
              </div>
            </aside>

            <form onSubmit={submit} className="px-5 py-8 sm:px-8 lg:px-10 lg:py-10" noValidate>
              {protocol && (
                <div id="confirmacao-anuncio" className="mb-9 border border-[#8cb89b] bg-[#eef7f1] p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#1f6a3d] text-white">
                      <CheckCircle2 className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-extrabold text-[#174f2e]">Solicitação confirmada</h3>
                      <p className="mt-1 text-sm leading-6 text-[#3f6650]">Guarde o protocolo abaixo. Ele será utilizado para acompanhar a proposta e acessar o portal do anunciante.</p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center justify-between border border-[#b7d2c0] bg-white px-4 py-3 font-mono text-sm font-black text-[#174f2e]">
                          <span className="truncate">{protocol}</span>
                          <button type="button" onClick={() => void handleCopyProtocol()} className="ml-3 shrink-0 text-[#174f2e]" aria-label="Copiar protocolo">
                            <Copy className="h-4 w-4" />
                          </button>
                        </div>
                        <a href={`${routes.login.advertiser()}?protocolo=${encodeURIComponent(protocol)}`} className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#174f2e] px-4 py-3 text-sm font-extrabold text-white transition hover:bg-[#123e24]">
                          Acessar portal
                          <ChevronRight className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-10">
                <section aria-labelledby="dados-empresa">
                  <div className="flex items-start gap-4 border-b border-[#e0e2e4] pb-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe6cf] text-xs font-black text-[#806128]">1</span>
                    <div>
                      <h3 id="dados-empresa" className={sectionTitleClass}>Dados da empresa</h3>
                      <p className="mt-1 text-sm text-[#73808a]">Identificação de quem pretende contratar a campanha.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label className="text-sm font-bold text-[#35414a] sm:col-span-2">
                      Empresa ou razão social <span className="text-[#9b2c2c]">*</span>
                      <input required autoComplete="organization" value={form.company_name} onChange={(event) => setForm({ ...form, company_name: event.target.value })} placeholder="Nome empresarial ou nome profissional" className={inputClass} />
                    </label>
                    <label className="text-sm font-bold text-[#35414a]">
                      CPF ou CNPJ <span className="text-[#9b2c2c]">*</span>
                      <input required inputMode="numeric" autoComplete="off" value={form.document} onChange={(event) => setForm({ ...form, document: maskDocument(event.target.value) })} placeholder="Documento do responsável ou da empresa" className={inputClass} />
                    </label>
                    <label className="text-sm font-bold text-[#35414a]">
                      Porte <span className="text-[#9b2c2c]">*</span>
                      <select required value={form.company_size} onChange={(event) => setForm({ ...form, company_size: event.target.value })} className={inputClass}>
                        <option value="">Selecione</option>
                        <option value="autonomo">Autônomo ou profissional liberal</option>
                        <option value="mei">MEI</option>
                        <option value="micro">Microempresa</option>
                        <option value="pequena">Pequena empresa</option>
                        <option value="media">Média empresa</option>
                        <option value="grande">Grande empresa</option>
                      </select>
                    </label>
                    <label className="text-sm font-bold text-[#35414a]">
                      Segmento de atuação <span className="text-[#9b2c2c]">*</span>
                      <input required value={form.segment} onChange={(event) => setForm({ ...form, segment: event.target.value })} placeholder="Ex.: varejo, saúde, educação" className={inputClass} />
                    </label>
                    <label className="text-sm font-bold text-[#35414a]">
                      Site ou página oficial
                      <input inputMode="url" autoComplete="url" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="www.suaempresa.com.br" className={inputClass} />
                    </label>
                  </div>
                </section>

                <section aria-labelledby="dados-contato">
                  <div className="flex items-start gap-4 border-b border-[#e0e2e4] pb-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe6cf] text-xs font-black text-[#806128]">2</span>
                    <div>
                      <h3 id="dados-contato" className={sectionTitleClass}>Contato comercial</h3>
                      <p className="mt-1 text-sm text-[#73808a]">Pessoa que receberá o retorno e a proposta.</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <label className="text-sm font-bold text-[#35414a] sm:col-span-2">
                      Nome do responsável <span className="text-[#9b2c2c]">*</span>
                      <input required autoComplete="name" value={form.contact_name} onChange={(event) => setForm({ ...form, contact_name: event.target.value })} placeholder="Nome completo" className={inputClass} />
                    </label>
                    <label className="text-sm font-bold text-[#35414a]">
                      E-mail <span className="text-[#9b2c2c]">*</span>
                      <input required type="email" autoComplete="email" value={form.contact_email} onChange={(event) => setForm({ ...form, contact_email: event.target.value })} placeholder="contato@empresa.com.br" className={inputClass} />
                    </label>
                    <label className="text-sm font-bold text-[#35414a]">
                      Telefone ou WhatsApp <span className="text-[#9b2c2c]">*</span>
                      <input required inputMode="tel" autoComplete="tel" value={form.contact_phone} onChange={(event) => setForm({ ...form, contact_phone: maskPhone(event.target.value) })} placeholder="(00) 00000-0000" className={inputClass} />
                    </label>
                  </div>
                </section>

                <section aria-labelledby="planejamento-campanha">
                  <div className="flex items-start gap-4 border-b border-[#e0e2e4] pb-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe6cf] text-xs font-black text-[#806128]">3</span>
                    <div>
                      <h3 id="planejamento-campanha" className={sectionTitleClass}>Planejamento da campanha</h3>
                      <p className="mt-1 text-sm text-[#73808a]">Informações iniciais para análise de viabilidade e orçamento.</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-5">
                    <label className="block text-sm font-bold text-[#35414a]">
                      Objetivo principal <span className="text-[#9b2c2c]">*</span>
                      <textarea required value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} placeholder="Explique o que a empresa deseja divulgar e qual resultado espera alcançar" rows={4} className={inputClass} />
                    </label>

                    <div className="grid gap-5 sm:grid-cols-3">
                      <label className="text-sm font-bold text-[#35414a]">
                        Início desejado
                        <input type="date" min={today} value={form.desired_start_date} onChange={(event) => setForm({ ...form, desired_start_date: event.target.value })} className={inputClass} />
                      </label>
                      <label className="text-sm font-bold text-[#35414a]">
                        Término desejado
                        <input type="date" min={form.desired_start_date || today} value={form.desired_end_date} onChange={(event) => setForm({ ...form, desired_end_date: event.target.value })} className={inputClass} />
                      </label>
                      <label className="text-sm font-bold text-[#35414a]">
                        Investimento estimado <span className="text-[#9b2c2c]">*</span>
                        <div className="relative mt-2">
                          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-[#68737c]">R$</span>
                          <input required type="number" min="1" step="0.01" inputMode="decimal" value={form.intended_budget} onChange={(event) => setForm({ ...form, intended_budget: event.target.value })} placeholder="0,00" className={`${inputClass} mt-0 pl-11`} />
                        </div>
                      </label>
                    </div>

                    <label className={`flex cursor-pointer items-start gap-3 border px-4 py-4 transition ${form.needs_creative_service ? 'border-[#b8903e] bg-[#fbf7ed]' : 'border-[#d6dade] bg-[#fafafa]'}`}>
                      <input type="checkbox" checked={form.needs_creative_service} onChange={(event) => setForm({ ...form, needs_creative_service: event.target.checked })} className="mt-1 h-4 w-4 accent-[#8a6b2f]" />
                      <span>
                        <strong className="block text-sm font-extrabold text-[#35414a]">Preciso que a GSA desenvolva o material criativo</strong>
                        <small className="mt-1 block text-xs leading-5 text-[#73808a]">O serviço de criação será avaliado e detalhado separadamente na proposta.</small>
                      </span>
                    </label>
                  </div>
                </section>

                <section aria-labelledby="distribuicao-campanha">
                  <div className="flex items-start gap-4 border-b border-[#e0e2e4] pb-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#efe6cf] text-xs font-black text-[#806128]">4</span>
                    <div>
                      <h3 id="distribuicao-campanha" className={sectionTitleClass}>Formatos e distribuição</h3>
                      <p className="mt-1 text-sm text-[#73808a]">Selecione as opções de interesse. A disponibilidade será confirmada na proposta.</p>
                    </div>
                  </div>

                  <fieldset className="mt-6">
                    <legend className="text-sm font-extrabold text-[#35414a]">Formatos desejados <span className="text-[#9b2c2c]">*</span></legend>
                    <div className="mt-3 grid border border-[#d6dade] sm:grid-cols-2">
                      {FORMATS.map((item, index) => {
                        const selected = form.desired_formats.includes(item.id);
                        return (
                          <label key={item.id} className={`flex cursor-pointer items-start gap-3 px-4 py-4 transition ${index < FORMATS.length - 2 ? 'border-b border-[#e3e5e7]' : ''} ${index % 2 === 1 ? 'sm:border-l sm:border-[#e3e5e7]' : ''} ${selected ? 'bg-[#fbf7ed]' : 'bg-white hover:bg-[#fafafa]'}`}>
                            <input type="checkbox" className="sr-only" checked={selected} onChange={() => toggle('desired_formats', item.id)} />
                            <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${selected ? 'border-[#8a6b2f] bg-[#8a6b2f] text-white' : 'border-[#aeb5ba] bg-white text-transparent'}`}>
                              <Check className="h-3.5 w-3.5" />
                            </span>
                            <span>
                              <strong className="block text-sm font-extrabold text-[#35414a]">{item.title}</strong>
                              <small className="mt-1 block text-xs leading-5 text-[#73808a]">{item.description}</small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset className="mt-7">
                    <legend className="text-sm font-extrabold text-[#35414a]">Áreas de interesse <span className="text-[#9b2c2c]">*</span></legend>
                    <div className="mt-3 grid gap-x-6 border-y border-[#d6dade] sm:grid-cols-2">
                      {PLACEMENTS.map((item) => (
                        <label key={item.code} className="flex cursor-pointer items-center gap-3 border-b border-[#e3e5e7] py-3 text-sm font-semibold text-[#4f5b64] last:border-b-0">
                          <input type="checkbox" checked={form.desired_pages.includes(item.code)} onChange={() => toggle('desired_pages', item.code)} className="h-4 w-4 accent-[#8a6b2f]" />
                          {item.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <fieldset className="mt-7">
                    <legend className="text-sm font-extrabold text-[#35414a]">Dispositivos <span className="text-[#9b2c2c]">*</span></legend>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[
                        { id: 'desktop', label: 'Computador' },
                        { id: 'tablet', label: 'Tablet' },
                        { id: 'mobile', label: 'Celular' },
                      ].map((device) => {
                        const selected = form.devices.includes(device.id);
                        return (
                          <label key={device.id} className={`flex cursor-pointer items-center gap-2 border px-4 py-2.5 text-sm font-bold transition ${selected ? 'border-[#8a6b2f] bg-[#fbf7ed] text-[#6f5427]' : 'border-[#d6dade] bg-white text-[#59636d]'}`}>
                            <input type="checkbox" className="sr-only" checked={selected} onChange={() => toggle('devices', device.id)} />
                            <MonitorSmartphone className="h-4 w-4" />
                            {device.label}
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <label className="mt-7 block text-sm font-bold text-[#35414a]">
                    Observações adicionais
                    <textarea value={form.notes} maxLength={2000} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Inclua informações relevantes para a análise comercial" rows={4} className={inputClass} />
                    <span className="mt-1.5 block text-right text-xs font-normal text-[#87919a]">{form.notes.length}/2000</span>
                  </label>
                </section>
              </div>

              <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website_confirmation} onChange={(event) => setForm({ ...form, website_confirmation: event.target.value })} className="hidden" />

              <div className="mt-10 border-t border-[#dfe2e4] pt-7">
                <label className="flex items-start gap-3 text-sm leading-6 text-[#59636d]">
                  <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[#8a6b2f]" />
                  <span>
                    Li e aceito a{' '}
                    <button type="button" onClick={() => setPrivacyOpen(true)} className="font-extrabold text-[#806128] underline decoration-[#c7a458] underline-offset-2">
                      política de privacidade
                    </button>{' '}
                    e autorizo o uso dos dados para análise e retorno desta solicitação.
                  </span>
                </label>

                <button type="submit" disabled={submitting} className="mt-6 inline-flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-lg border border-[#a98743] bg-[#d6ba72] px-6 py-4 text-sm font-black text-[#17202a] shadow-[0_12px_26px_rgba(92,70,27,0.14)] transition hover:bg-[#dfc57f] disabled:cursor-not-allowed disabled:opacity-60">
                  {submitting ? <ClipboardCheck className="h-5 w-5 animate-pulse" /> : <Send className="h-5 w-5" />}
                  {submitting ? 'Registrando solicitação...' : 'Enviar para análise comercial'}
                </button>
                <p className="mt-3 text-center text-xs leading-5 text-[#87919a]">O envio não representa contratação nem gera cobrança automática.</p>
              </div>
            </form>
          </div>
        </div>
      </section>

      <section className="border-t border-[#d8d0c3] bg-[#10202e] text-white">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 py-12 sm:px-10 lg:flex-row lg:items-center lg:px-12">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#d7b96e]">Já possui uma proposta?</p>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.02em]">Acompanhe negociação, criativos e resultados no portal do anunciante.</h2>
          </div>
          <a href={routes.login.advertiser()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border border-[#d7b96e] px-5 py-3 text-sm font-extrabold text-[#f2dfaa] transition hover:bg-[#d7b96e] hover:text-[#10202e]">
            Acessar área do anunciante
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </section>

      <footer className="bg-[#0b1723] text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-7 text-xs sm:px-10 md:flex-row md:items-center md:justify-between lg:px-12">
          <p>© {new Date().getFullYear()} GSA HUB. Publicidade com processo, segurança e transparência.</p>
          <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-2 font-bold text-slate-300 transition hover:text-[#d7b96e]">
            Voltar ao site
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </footer>

      <PrivacyPolicyDialog isOpen={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </main>
  );
}
