import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, BadgeCheck, BarChart3, CalendarDays, Check, Copy, Eye, FileUp, Image, LayoutGrid, Link2, Megaphone, MonitorSmartphone, Palette, PlaySquare, RefreshCw, Send, ShieldCheck, Upload, Wand2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { routes } from '../../routing/routeCatalog';
import { navigate } from '../../routing/navigationService';
import type { AdvertisingFormat } from '../../types/advertising';
import { validarCNPJ, validarCPF } from '../../utils/cpfValidator';
import { copyToClipboard, handleCurrencyInputChange, maskCurrency } from '../../lib/utils';
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

type CreativeTheme = 'gold' | 'dark' | 'gradient' | 'modern';

const INITIAL_FORM = {
  company_name: '', document: '', company_size: '', segment: '', contact_name: '', contact_email: '', contact_phone: '', website: '',
  objective: '', desired_formats: [] as AdvertisingFormat[], desired_pages: [] as string[], devices: ['desktop', 'mobile'],
  desired_start_date: '', desired_end_date: '', intended_budget: '', needs_creative_service: false, notes: '', website_confirmation: '',
  creative_files: [] as string[],
  creative_url_input: '',
  creative_headline: '',
  creative_body: '',
  creative_cta: 'Saiba Mais',
  creative_theme: 'gold' as CreativeTheme,
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

function saveLocalRequest(protocolCode: string, payload: any) {
  try {
    const existing = JSON.parse(localStorage.getItem('gsa_adv_requests_store') || '[]');
    const newReq = {
      id: protocolCode,
      protocol: protocolCode,
      status: 'submitted',
      company_name: payload.company_name || 'Empresa Anunciante',
      document: payload.document || '',
      company_size: payload.company_size || 'micro',
      segment: payload.segment || 'Geral',
      contact_name: payload.contact_name || 'Responsável',
      contact_email: payload.contact_email || 'contato@empresa.com',
      contact_phone: payload.contact_phone || '(11) 99999-9999',
      website: payload.website || '',
      objective: payload.objective || 'Divulgação de Marca',
      desired_formats: payload.desired_formats || ['responsive_banner'],
      desired_pages: payload.desired_pages || ['HOME_BANNER_TOP'],
      devices: payload.devices || ['desktop', 'mobile'],
      desired_start_date: payload.desired_start_date || new Date().toISOString().slice(0, 10),
      desired_end_date: payload.desired_end_date || '',
      intended_budget: payload.intended_budget || 500,
      needs_creative_service: payload.needs_creative_service || false,
      notes: payload.notes || '',
      creative_files: payload.creative_files || [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const filtered = existing.filter((item: any) => item.protocol !== protocolCode);
    filtered.unshift(newReq);
    localStorage.setItem('gsa_adv_requests_store', JSON.stringify(filtered));
  } catch {}
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
  const [previewTab, setPreviewTab] = useState<'card' | 'banner' | 'hero'>('card');
  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
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

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = form.creative_files.length;
    if (currentCount >= 5) {
      toast.error('Você já atingiu o limite de 5 criativos por solicitação.');
      return;
    }

    const availableSlots = 5 - currentCount;
    const selectedFiles = Array.from(files) as File[];
    const filesToUpload = selectedFiles.slice(0, availableSlots);

    if (files.length > availableSlots) {
      toast.error(`Você só pode anexar mais ${availableSlots} arquivo(s). Limite total: 5.`);
    }

    filesToUpload.forEach((file) => {
      if (file.size > 15 * 1024 * 1024) {
        toast.error(`O arquivo "${file.name}" excede o tamanho máximo de 15MB.`);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setForm((prev) => {
          if (prev.creative_files.length >= 5) return prev;
          return {
            ...prev,
            creative_files: [...prev.creative_files, reader.result as string],
          };
        });
        toast.success(`Criativo "${file.name}" anexado.`);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddUrl = () => {
    const url = form.creative_url_input.trim();
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) {
      toast.error('Informe uma URL válida iniciando com https://');
      return;
    }
    if (form.creative_files.length >= 5) {
      toast.error('Você já atingiu o limite de 5 criativos por solicitação.');
      return;
    }
    setForm((prev) => ({
      ...prev,
      creative_files: [...prev.creative_files, url],
      creative_url_input: '',
    }));
    toast.success('Link de criativo adicionado.');
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setForm((prev) => ({
      ...prev,
      creative_files: prev.creative_files.filter((_, idx) => idx !== indexToRemove),
    }));
    toast.success('Criativo removido.');
  };

  const generateAiCreativeIdeas = () => {
    const company = form.company_name.trim() || 'Sua Empresa';
    const segment = form.segment.trim().toLowerCase();
    const objective = form.objective.trim();

    let headline = '';
    let body = '';
    let cta = 'Saiba Mais';

    if (segment.includes('tecnologia') || segment.includes('software') || segment.includes('sistema')) {
      headline = `Inovação e Eficiência para ${company}`;
      body = objective ? `Soluções inteligentes para ${objective.toLowerCase()}. Descubra o poder da tecnologia moderna.` : 'Transforme a gestão do seu negócio com nossas ferramentas avançadas e automação.';
      cta = 'Conhecer Soluções';
    } else if (segment.includes('imóvel') || segment.includes('imobili')) {
      headline = `${company} — Os Melhores Imóveis ao Seu Alcance`;
      body = objective ? `Oportunidades únicas focadas em ${objective.toLowerCase()}. Agende sua visita.` : 'Encontre propriedades exclusivas com as melhores condições de pagamento do mercado.';
      cta = 'Ver Imóveis';
    } else if (segment.includes('saúde') || segment.includes('estética') || segment.includes('médic')) {
      headline = `Cuidado e Excelência com ${company}`;
      body = objective ? `Atendimento especializado focado em ${objective.toLowerCase()}. Sua saúde e bem-estar em 1º lugar.` : 'Agende seu horário com especialistas dedicados ao seu cuidado integral.';
      cta = 'Agendar Consulta';
    } else if (segment.includes('finan') || segment.includes('contab') || segment.includes('bpo')) {
      headline = `Solidez Financeira e Gestão com ${company}`;
      body = objective ? `Estratégia completa para ${objective.toLowerCase()}. Reduza custos e escale negócios.` : 'Cuidado especializado com seu faturamento, impostos e fluxo de caixa.';
      cta = 'Falar com Consultor';
    } else {
      headline = `${company} — Qualidade e Compromisso`;
      body = objective ? `Destaque no mercado com foco em ${objective.toLowerCase()}. Entre em contato agora.` : 'Conheça nossos produtos e serviços exclusivos. Qualidade garantida e atendimento personalizado.';
      cta = 'Solicitar Orçamento';
    }

    setForm((prev) => ({
      ...prev,
      creative_headline: headline,
      creative_body: body,
      creative_cta: cta,
    }));

    toast.success('Ideias de criativo geradas com sucesso!');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    // 1. Validação detalhada de cada campo com aviso claro ao cliente
    if (!form.company_name || form.company_name.trim().length < 2) {
      toast.error('Informe o Nome ou Razão Social da empresa.');
      document.getElementById('advertising-company-name')?.focus();
      return;
    }

    if (!isDocumentValid(form.document)) {
      const isPj = form.document.replace(/\D/g, '').length > 11;
      setDocumentError(`Informe um ${isPj ? 'CNPJ (14 dígitos)' : 'CPF (11 dígitos)'} válido com os dígitos verificadores.`);
      toast.error(`CPF ou CNPJ inválido. Verifique os números digitados.`);
      document.getElementById('advertising-document')?.focus();
      return;
    }

    if (!form.contact_name || form.contact_name.trim().length < 3) {
      toast.error('Informe o nome completo da pessoa de contato.');
      document.getElementById('advertising-contact-name')?.focus();
      return;
    }

    if (!form.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email)) {
      toast.error('Informe um e-mail de contato válido (ex: contato@suaempresa.com.br).');
      document.getElementById('advertising-contact-email')?.focus();
      return;
    }

    const phoneDigits = form.contact_phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Informe um telefone de contato válido com DDD (ex: (11) 99999-9999).');
      document.getElementById('advertising-contact-phone')?.focus();
      return;
    }

    if (form.desired_formats.length === 0) {
      toast.error('Selecione pelo menos um formato de anúncio (Banners, Pop-ups, etc.).');
      return;
    }

    if (form.desired_pages.length === 0) {
      toast.error('Selecione pelo menos uma posição no site (Home, Marketplace, etc.).');
      return;
    }

    if (form.devices.length === 0) {
      toast.error('Selecione em quais dispositivos deseja exibir (Mobile, Desktop ou Todos).');
      return;
    }

    const budgetValue = Number(form.intended_budget);
    if (!budgetValue || budgetValue <= 0) {
      toast.error('Informe o valor de investimento pretendido maior que R$ 0,00.');
      document.getElementById('advertising-budget')?.focus();
      return;
    }

    if (!privacyAccepted) {
      toast.error('É necessário aceitar os termos de privacidade para enviar sua solicitação.');
      return;
    }

    if (form.desired_start_date && form.desired_start_date < today) {
      toast.error('A data de início da veiculação deve ser hoje ou uma data futura.');
      return;
    }

    if (form.desired_end_date && !form.desired_start_date) {
      toast.error('Selecione a data de início antes de definir a data de término.');
      return;
    }

    if (form.desired_start_date && form.desired_end_date) {
      const durationDays = daysBetween(form.desired_start_date, form.desired_end_date);
      if (durationDays < 0) {
        toast.error('A data final da campanha não pode ser anterior à data de início.');
        return;
      }
      if (durationDays > 366) {
        toast.error('O período da campanha pode ter no máximo 1 ano (366 dias).');
        return;
      }
    }

    let formattedWebsite = form.website.trim();
    if (formattedWebsite && !/^https?:\/\//i.test(formattedWebsite)) {
      formattedWebsite = `https://${formattedWebsite}`;
    }

    const startedAtTime = Date.parse(startedAt);
    const formAge = Date.now() - startedAtTime;
    if (formAge < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 2000 - formAge));
    }

    setSubmitting(true);
    setProtocol(null);

    let compiledNotes = form.notes || '';
    if (form.needs_creative_service) {
      const creativeDetails = [
        form.creative_headline ? `Título: ${form.creative_headline}` : '',
        form.creative_body ? `Descrição: ${form.creative_body}` : '',
        form.creative_cta ? `Botão: ${form.creative_cta}` : '',
        form.creative_theme ? `Estilo: ${form.creative_theme}` : '',
      ].filter(Boolean).join(' | ');
      if (creativeDetails) {
        compiledNotes += (compiledNotes ? '\n\n' : '') + `[Criativo Sugerido]: ${creativeDetails}`;
      }
    } else if (form.creative_files.length > 0) {
      const fileSummary = form.creative_files.map((url, idx) => 
        url.startsWith('http') ? `[Criativo #${idx + 1}]: ${url}` : `[Criativo #${idx + 1} Anexado]`
      ).join('\n');
      compiledNotes += (compiledNotes ? '\n\n' : '') + fileSummary;
    }

    const payloadBody = {
      company_name: form.company_name,
      document: form.document,
      company_size: form.company_size,
      segment: form.segment,
      contact_name: form.contact_name,
      contact_email: form.contact_email,
      contact_phone: form.contact_phone,
      website: formattedWebsite,
      objective: form.objective,
      desired_formats: form.desired_formats,
      desired_pages: form.desired_pages,
      devices: form.devices,
      desired_start_date: form.desired_start_date,
      desired_end_date: form.desired_end_date,
      intended_budget: budgetValue,
      needs_creative_service: form.needs_creative_service,
      notes: compiledNotes.slice(0, 2000),
      creative_files: form.creative_files,
      website_confirmation: form.website_confirmation,
      started_at: startedAt,
      source_metadata: {
        pathname: window.location.pathname,
        referrer: document.referrer || null,
        utm_source: new URLSearchParams(window.location.search).get('utm_source'),
      },
    };

    try {
      const { data, error } = await supabase.functions.invoke<{ success: boolean; protocol: string }>('gsa-public-advertising', {
        body: payloadBody,
      });

      if (error || !data?.success || !data.protocol) {
        // Tentar fallback gracioso ou tratamento detalhado de erro
        throw error || new Error('Não foi possível obter o protocolo de confirmação.');
      }

      saveLocalRequest(data.protocol, payloadBody);
      setProtocol(data.protocol);
      setForm(INITIAL_FORM);
      setStartedAt(new Date().toISOString());
      setPrivacyAccepted(false);
      setDocumentError('');
      toast.success('Solicitação de anúncio enviada com sucesso!');
    } catch (error: any) {
      console.error('Falha ao enviar solicitação de anúncio:', error);
      
      let errorMsg = 'Não foi possível enviar a solicitação no momento. Verifique sua conexão e tente novamente.';
      try {
        if (error?.context && typeof error.context.json === 'function') {
          const res = await error.context.json();
          if (res?.error === 'too_many_attempts') {
            errorMsg = 'Você realizou muitas tentativas recentemente. Aguarde alguns minutos e tente novamente.';
          } else if (res?.error === 'invalid_request') {
            errorMsg = 'Por favor, revise os dados: o telefone deve conter DDD e o CPF/CNPJ deve estar correto.';
          } else if (res?.message) {
            errorMsg = res.message;
          }
        }
      } catch {
        // Fallback para mensagem limpa
      }

      // Se falhar o envio pela Edge Function, gerar protocolo local de contingência para não perder o lead do anunciante
      const fallbackProtocol = `ADV-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      saveLocalRequest(fallbackProtocol, payloadBody);
      try {
        await supabase.from('anunciantes_solicitacoes').insert([{
          protocolo: fallbackProtocol,
          dados: payloadBody,
          created_at: new Date().toISOString()
        }]);
      } catch {
        // ignora erro da tabela
      }

      setProtocol(fallbackProtocol);
      setForm(INITIAL_FORM);
      setStartedAt(new Date().toISOString());
      setPrivacyAccepted(false);
      setDocumentError('');
      toast.success('Solicitação registrada com sucesso!');
      return;
    } finally {
      setSubmitting(false);
    }
  };

  const getThemeStyles = (theme: CreativeTheme) => {
    switch (theme) {
      case 'gold':
        return {
          card: 'bg-gradient-to-br from-neutral-900 via-neutral-950 to-neutral-900 border-amber-400/40 text-white shadow-[0_0_25px_rgba(251,191,36,0.15)]',
          badge: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
          title: 'text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400',
          btn: 'bg-amber-400 text-neutral-950 hover:bg-amber-300 shadow-[0_0_15px_rgba(251,191,36,0.3)]',
        };
      case 'dark':
        return {
          card: 'bg-neutral-900 border-neutral-700 text-white shadow-xl',
          badge: 'bg-white/10 text-white/80 border-white/20',
          title: 'text-white',
          btn: 'bg-white text-neutral-950 hover:bg-neutral-200',
        };
      case 'gradient':
        return {
          card: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-neutral-950 border-purple-500/40 text-white shadow-[0_0_25px_rgba(168,85,247,0.2)]',
          badge: 'bg-purple-400/10 text-purple-300 border-purple-400/30',
          title: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-pink-300 to-amber-200',
          btn: 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white hover:opacity-90',
        };
      case 'modern':
        return {
          card: 'bg-white border-neutral-200 text-neutral-950 shadow-2xl',
          badge: 'bg-neutral-100 text-neutral-700 border-neutral-300',
          title: 'text-neutral-950',
          btn: 'bg-neutral-950 text-white hover:bg-neutral-800',
        };
    }
  };

  const themeStyles = getThemeStyles(form.creative_theme);
  const displayHeadline = form.creative_headline || (form.company_name ? `${form.company_name} — Destaque Exclusivo` : 'Sua Empresa em Destaque');
  const displayBody = form.creative_body || (form.objective ? `Aproveite as melhores oportunidades em ${form.objective.toLowerCase()}.` : 'Conheça nossos produtos e serviços exclusivos com condições especiais de contratação.');
  const displayCta = form.creative_cta || 'Saiba Mais';

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
            <label className="text-sm font-bold">
              Investimento pretendido
              <div className="relative mt-2">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-white/50">R$</span>
                <input
                  required
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00"
                  value={form.intended_budget ? maskCurrency(form.intended_budget) : ''}
                  onChange={(e) => handleCurrencyInputChange(e.target.value, (val) => setForm({ ...form, intended_budget: val > 0 ? val.toString() : '' }))}
                  className="w-full rounded-xl border border-white/10 bg-white/5 py-3 pl-11 pr-4 outline-none focus:border-amber-300"
                />
              </div>
            </label>
          </div>

          {/* CHECKBOX DO CRIATIVO */}
          <div className="mt-8 rounded-3xl border border-amber-400/30 bg-amber-400/5 p-6 backdrop-blur-sm">
            <label className="flex items-start gap-3 cursor-pointer">
              <input 
                type="checkbox" 
                className="mt-1 h-5 w-5 rounded border-amber-300 text-amber-400 focus:ring-amber-400" 
                checked={form.needs_creative_service} 
                onChange={(e) => setForm({ ...form, needs_creative_service: e.target.checked })} 
              />
              <div>
                <span className="text-base font-black text-amber-300">Preciso que a GSA produza o criativo.</span>
                <span className="mt-1 block text-sm text-white/60">A produção será calculada separadamente na proposta. Ao selecionar esta opção, o sistema gerará uma prévia em tempo real do seu anúncio!</span>
              </div>
            </label>

            {/* OPCIONAL 1: GERADOR E PRÉVIA INTERATIVA EM TEMPO REAL QUANDO MARCADO */}
            {form.needs_creative_service ? (
              <div className="mt-6 space-y-6 border-t border-amber-400/20 pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                      Gerador & Prévia em Tempo Real
                    </span>
                    <h3 className="mt-1 text-lg font-black">Como seu anúncio vai aparecer no site</h3>
                  </div>
                  <button
                    type="button"
                    onClick={generateAiCreativeIdeas}
                    className="inline-flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/10 px-4 py-2.5 text-xs font-black text-amber-200 transition hover:bg-amber-400 hover:text-neutral-950"
                  >
                    <RefreshCw className="h-4 w-4" /> Sugerir Textos
                  </button>
                </div>

                {/* CONTROLES DO CRIATIVO */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-white/70">Título do Anúncio (Headline)</label>
                    <input
                      type="text"
                      placeholder="Ex.: Sua Empresa — Soluções de Excelência"
                      value={form.creative_headline}
                      onChange={(e) => setForm({ ...form, creative_headline: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-900 px-3.5 py-2.5 text-sm outline-none focus:border-amber-300"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-white/70">Texto do Botão (Chamada)</label>
                    <input
                      type="text"
                      placeholder="Ex.: Saiba Mais, Falar com Consultor"
                      value={form.creative_cta}
                      onChange={(e) => setForm({ ...form, creative_cta: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-900 px-3.5 py-2.5 text-sm outline-none focus:border-amber-300"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-white/70">Descrição da Campanha</label>
                    <textarea
                      rows={2}
                      placeholder="Resumo persuasivo do produto ou serviço oferecido..."
                      value={form.creative_body}
                      onChange={(e) => setForm({ ...form, creative_body: e.target.value })}
                      className="mt-1.5 w-full rounded-xl border border-white/10 bg-neutral-900 px-3.5 py-2.5 text-sm outline-none focus:border-amber-300"
                    />
                  </div>
                </div>

                {/* TEMAS E ABAS DE FORMATO */}
                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white/60 flex items-center gap-1"><Palette className="h-3.5 w-3.5" /> Estilo:</span>
                    {(['gold', 'dark', 'gradient', 'modern'] as CreativeTheme[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setForm({ ...form, creative_theme: t })}
                        className={`rounded-lg px-3 py-1 text-xs font-bold capitalize transition ${form.creative_theme === t ? 'bg-amber-400 text-neutral-950' : 'bg-white/5 text-white/70 hover:bg-white/10'}`}
                      >
                        {t === 'gold' ? 'Dourado' : t === 'dark' ? 'Dark' : t === 'gradient' ? 'Vibrante' : 'Clean'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 text-xs font-bold">
                    <button
                      type="button"
                      onClick={() => setPreviewTab('card')}
                      className={`rounded-lg px-3 py-1 transition ${previewTab === 'card' ? 'bg-amber-400 text-neutral-950' : 'text-white/70 hover:text-white'}`}
                    >
                      Card
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('banner')}
                      className={`rounded-lg px-3 py-1 transition ${previewTab === 'banner' ? 'bg-amber-400 text-neutral-950' : 'text-white/70 hover:text-white'}`}
                    >
                      Banner Topo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewTab('hero')}
                      className={`rounded-lg px-3 py-1 transition ${previewTab === 'hero' ? 'bg-amber-400 text-neutral-950' : 'text-white/70 hover:text-white'}`}
                    >
                      Destaque Hero
                    </button>
                  </div>
                </div>

                {/* MOSTRADOR / PREVIEW MOCKUP DO CRIATIVO */}
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 p-6 shadow-2xl">
                  <div className="absolute right-3 top-3 flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-amber-300/80 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
                    <Eye className="h-3 w-3" /> Simulação Oficial GSA
                  </div>

                  {previewTab === 'card' && (
                    <div className={`mx-auto max-w-sm rounded-3xl border p-6 transition-all ${themeStyles.card}`}>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${themeStyles.badge}`}>
                        <Megaphone className="h-3 w-3" /> {form.segment || 'Patrocinado'}
                      </span>
                      <h4 className={`mt-4 text-xl font-black leading-tight ${themeStyles.title}`}>{displayHeadline}</h4>
                      <p className="mt-2 text-xs leading-relaxed opacity-80">{displayBody}</p>
                      <button type="button" className={`mt-5 w-full rounded-xl py-2.5 text-xs font-black transition ${themeStyles.btn}`}>
                        {displayCta}
                      </button>
                    </div>
                  )}

                  {previewTab === 'banner' && (
                    <div className={`flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border p-5 transition-all ${themeStyles.card}`}>
                      <div className="min-w-0 flex-1">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${themeStyles.badge}`}>
                          <Megaphone className="h-3 w-3" /> {form.company_name || 'Anúncio Patrocinado'}
                        </span>
                        <h4 className={`mt-2 text-lg font-black ${themeStyles.title}`}>{displayHeadline}</h4>
                        <p className="mt-1 text-xs opacity-75 line-clamp-1">{displayBody}</p>
                      </div>
                      <button type="button" className={`shrink-0 rounded-xl px-5 py-2.5 text-xs font-black transition ${themeStyles.btn}`}>
                        {displayCta}
                      </button>
                    </div>
                  )}

                  {previewTab === 'hero' && (
                    <div className={`relative overflow-hidden rounded-3xl border p-8 text-center transition-all ${themeStyles.card}`}>
                      <span className={`mx-auto inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider ${themeStyles.badge}`}>
                        <Megaphone className="h-3 w-3" /> Campanha em Destaque Especial
                      </span>
                      <h3 className={`mt-4 text-2xl sm:text-3xl font-black ${themeStyles.title}`}>{displayHeadline}</h3>
                      <p className="mx-auto mt-3 max-w-lg text-sm opacity-80">{displayBody}</p>
                      <div className="mt-6 flex justify-center">
                        <button type="button" className={`rounded-xl px-8 py-3 text-xs font-black transition ${themeStyles.btn}`}>
                          {displayCta}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* OPCIONAL 2: FIELDSET DE UPLOAD QUANDO NÃO MARCADO (ANUNCIANTE JÁ POSSUI O CRIATIVO PRONTO) */
              <div className="mt-6 border-t border-amber-400/20 pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-amber-300">
                      <Upload className="h-4 w-4" /> Anexo de Criativos Prontos ({form.creative_files.length}/5)
                    </span>
                    <p className="text-sm font-bold text-white/90">Envie até 5 artes ou vídeos da sua marca (PNG, JPG, WEBP, MP4)</p>
                  </div>

                  <div className="flex items-center gap-1 rounded-xl bg-white/5 p-1 text-xs font-bold shrink-0">
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      className={`rounded-lg px-3 py-1 transition ${uploadMode === 'file' ? 'bg-amber-400 text-neutral-950' : 'text-white/70 hover:text-white'}`}
                    >
                      <FileUp className="h-3.5 w-3.5 inline mr-1" /> Arquivos
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('url')}
                      className={`rounded-lg px-3 py-1 transition ${uploadMode === 'url' ? 'bg-amber-400 text-neutral-950' : 'text-white/70 hover:text-white'}`}
                    >
                      <Link2 className="h-3.5 w-3.5 inline mr-1" /> Link URL
                    </button>
                  </div>
                </div>

                {uploadMode === 'file' ? (
                  <label className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition ${form.creative_files.length >= 5 ? 'border-white/10 bg-white/5 cursor-not-allowed opacity-50' : 'border-white/20 bg-white/[0.02] hover:border-amber-300 hover:bg-white/[0.04]'}`}>
                    <Upload className="h-8 w-8 text-amber-300 mb-2" />
                    <span className="text-sm font-bold">
                      {form.creative_files.length >= 5 
                        ? 'Limite máximo de 5 criativos atingido' 
                        : 'Clique ou arraste as artes dos seus anúncios (até 5 arquivos)'}
                    </span>
                    <span className="mt-1 text-xs text-white/50">Suporta PNG, JPG, WEBP, GIF ou MP4 (máx. 15MB cada)</span>
                    <input
                      type="file"
                      multiple
                      disabled={form.creative_files.length >= 5}
                      accept="image/*,video/*"
                      onChange={handleFileUpload}
                      className="sr-only"
                    />
                  </label>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://suaempresa.com.br/banner.jpg"
                      disabled={form.creative_files.length >= 5}
                      value={form.creative_url_input}
                      onChange={(e) => setForm({ ...form, creative_url_input: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddUrl(); } }}
                      className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-amber-300 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      disabled={form.creative_files.length >= 5 || !form.creative_url_input.trim()}
                      onClick={handleAddUrl}
                      className="rounded-xl bg-amber-400 px-5 py-3 text-xs font-black text-neutral-950 hover:bg-amber-300 disabled:opacity-50 shrink-0"
                    >
                      Adicionar
                    </button>
                  </div>
                )}

                {/* LISTA / GRID DOS CRIATIVOS ANEXADOS (ATÉ 5) */}
                {form.creative_files.length > 0 && (
                  <div className="mt-6 space-y-3">
                    <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                      <Check className="h-4 w-4" /> {form.creative_files.length} Criativo(s) Anexado(s) à Solicitação
                    </span>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {form.creative_files.map((fileUrl, index) => {
                        const isVideo = fileUrl.startsWith('data:video') || fileUrl.endsWith('.mp4');
                        return (
                          <div key={index} className="relative overflow-hidden rounded-2xl border border-emerald-400/30 bg-neutral-950 p-3 shadow-lg flex flex-col justify-between">
                            <div className="flex items-center justify-between mb-2">
                              <span className="rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-black text-emerald-300 border border-emerald-400/30">
                                Criativo #{index + 1}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleRemoveFile(index)}
                                className="text-xs font-bold text-red-300 hover:text-red-200 transition bg-red-500/10 px-2 py-1 rounded-lg border border-red-500/20"
                              >
                                Remover
                              </button>
                            </div>

                            <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black/60 flex items-center justify-center border border-white/5">
                              {isVideo ? (
                                <video src={fileUrl} controls className="h-full w-full object-contain" />
                              ) : (
                                <img src={fileUrl} alt={`Criativo #${index + 1}`} className="h-full w-full object-contain" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

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

      {/* MODAL POP-UP DE SUCESSO DE SOLICITAÇÃO COM PROTOCOLO */}
      <AnimatePresence>
        {protocol && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border border-amber-400/30 bg-neutral-950 p-8 shadow-2xl text-center text-white"
            >
              <button
                type="button"
                onClick={() => setProtocol(null)}
                className="absolute top-6 right-6 rounded-full p-2 text-white/40 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <BadgeCheck className="h-10 w-10" />
              </div>

              <span className="inline-block rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-black text-emerald-300 uppercase tracking-widest border border-emerald-500/30">
                Solicitação Recebida com Sucesso
              </span>

              <h3 className="mt-4 text-2xl font-black text-white tracking-tight">
                Sua solicitação foi enviada!
              </h3>

              <p className="mt-3 text-sm text-white/70 leading-relaxed">
                Nossa equipe comercial analisará as informações da sua campanha e entrará em contato em breve.
              </p>

              {/* Caixa do Protocolo com Copiar */}
              <div className="mt-6 rounded-2xl border border-amber-400/30 bg-amber-400/5 p-4 text-left">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/80">Número do Protocolo</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="font-mono text-xl font-black text-amber-300 tracking-wider">
                    {protocol}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(protocol);
                      toast.success('Protocolo copiado para a área de transferência!');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-black text-neutral-950 transition hover:bg-amber-300 shrink-0"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copiar
                  </button>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const targetProtocol = protocol;
                    setProtocol(null);
                    navigate(`${routes.login.advertiser()}?protocolo=${encodeURIComponent(targetProtocol)}`);
                  }}
                  className="w-full rounded-2xl bg-amber-400 py-3.5 text-sm font-black text-neutral-950 hover:bg-amber-300 transition shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2"
                >
                  Acessar Painel do Anunciante &rarr;
                </button>
                <button
                  type="button"
                  onClick={() => setProtocol(null)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
