import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Mail,
  MessageCircle,
  Paperclip,
  Phone,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  User,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AccessibleDialog } from '../ui/AccessibleDialog';
import { supabase } from '../../lib/supabase';
import { maskPhone } from '../../lib/utils';

const WHATSAPP_NUMBER = '5511920857756';
const PROJECT_OPTIONS = [
  ['nome_marca', 'Criação de nome e posicionamento'],
  ['logo', 'Criação de logo e logomarca'],
  ['identidade_visual', 'Identidade visual e branding'],
  ['redes_sociais', 'Estruturação de redes sociais'],
  ['social_media', 'Social media, posts e publicações'],
  ['marketing_digital', 'Estratégia digital e campanhas'],
  ['jornada_completa', 'Empresa do zero ao digital'],
  ['site', 'Site institucional ou landing page'],
  ['loja', 'Loja virtual / E-commerce'],
  ['sistema', 'Sistema web sob medida'],
  ['aplicativo', 'Aplicativo mobile (iOS e Android)'],
  ['automacao', 'Automação de processos'],
  ['integracao', 'Integração entre sistemas / APIs'],
] as const;
const PROJECT_TYPES = new Set<string>(PROJECT_OPTIONS.map(([value]) => value));

interface SystemsBudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BudgetForm {
  nome: string;
  email: string;
  telefone: string;
  tipo: string;
  solicitacao: string;
  website: string;
}

interface BudgetResponse {
  success?: boolean;
  protocol?: string;
  error?: string;
}

const EMPTY_FORM: BudgetForm = {
  nome: '',
  email: '',
  telefone: '',
  tipo: '',
  solicitacao: '',
  website: '',
};

function getCampaignMetadata() {
  const params = new URLSearchParams(window.location.search);
  const isBrandJourney = ['/empresa-do-zero-ao-digital', '/identidade-e-web-design'].includes(
    window.location.pathname.replace(/\/+$/, '')
  );
  return {
    source: isBrandJourney ? 'public_brand_journey' : 'public_sites_systems',
    page: window.location.pathname,
    referrer: document.referrer.slice(0, 500),
    utm_source: (params.get('utm_source') || '').slice(0, 120),
    utm_medium: (params.get('utm_medium') || '').slice(0, 120),
    utm_campaign: (params.get('utm_campaign') || '').slice(0, 160),
    utm_content: (params.get('utm_content') || '').slice(0, 160),
  };
}

function validateForm(form: BudgetForm) {
  const name = form.nome.trim();
  const email = form.email.trim().toLowerCase();
  const phone = form.telefone.replace(/\D/g, '');
  const request = form.solicitacao.trim();

  if (form.website.trim()) return 'Não foi possível validar o envio.';
  if (name.length < 2 || name.length > 120) return 'Informe um nome ou razão social válida.';
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.';
  if (phone.length < 10 || phone.length > 11) return 'Informe um telefone com DDD válido.';
  if (!PROJECT_TYPES.has(form.tipo)) return 'Selecione a categoria do seu projeto.';
  if (request.length < 20) return 'Descreva sua necessidade com pelo menos 20 caracteres para que possamos planejar sua proposta.';
  if (request.length > 2000) return 'A descrição deve ter no máximo 2.000 caracteres.';
  return null;
}

interface AttachedFile {
  file: File;
  name: string;
  size: number;
  type: string;
}

export function SystemsBudgetModal({ isOpen, onClose }: SystemsBudgetModalProps) {
  const [form, setForm] = useState<BudgetForm>(EMPTY_FORM);
  const [attachedFile, setAttachedFile] = useState<AttachedFile | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [copiedProtocol, setCopiedProtocol] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    if (!isOpen) return;
    openedAtRef.current = new Date().toISOString();
    setProtocol(null);
    setCopiedProtocol(false);
    setAttachedFile(null);
    setUploadProgress(null);
  }, [isOpen]);

  const update = (field: keyof BudgetForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Máximo 15MB
    if (file.size > 15 * 1024 * 1024) {
      toast.error('O arquivo excede o limite máximo permitido de 15MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setAttachedFile({
      file,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream',
    });
    toast.success(`Arquivo "${file.name}" anexado.`);
  };

  const handleRemoveFile = () => {
    setAttachedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const closeSafely = () => {
    if (submitting) return;
    setForm(EMPTY_FORM);
    setAttachedFile(null);
    setUploadProgress(null);
    setProtocol(null);
    setCopiedProtocol(false);
    onClose();
  };

  const copyToClipboard = async () => {
    if (!protocol) return;
    try {
      await navigator.clipboard.writeText(protocol);
      setCopiedProtocol(true);
      toast.success('Protocolo copiado para a área de transferência!');
      setTimeout(() => setCopiedProtocol(false), 2500);
    } catch {
      toast.error('Não foi possível copiar o protocolo.');
    }
  };

  const openWhatsApp = () => {
    const message = protocol
      ? `Olá! Enviei uma solicitação de projeto pelo portal Grupo GSA.\nProtocolo do orçamento: ${protocol}\nGostaria de agilizar o atendimento com a equipe.`
      : 'Olá! Gostaria de tirar dúvidas sobre o desenvolvimento de um projeto digital com o Grupo GSA.';
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationMessage = validateForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setSubmitting(true);
    setUploadProgress(null);

    try {
      let anexosPayload: Array<{ nome: string; url: string; tipo: string; tamanho: number }> = [];

      // Se houver arquivo selecionado, faz upload seguro para o bucket orcamentos-anexos
      if (attachedFile) {
        setUploadProgress('Enviando arquivo anexado...');
        const fileExt = attachedFile.name.split('.').pop() || 'dat';
        const sanitizedBaseName = attachedFile.name
          .replace(/\.[^/.]+$/, '')
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9_-]/g, '_')
          .slice(0, 40);
        const uniqueFileName = `public/leads/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${sanitizedBaseName}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('orcamentos-anexos')
          .upload(uniqueFileName, attachedFile.file, {
            cacheControl: '3600',
            upsert: false,
            contentType: attachedFile.type,
          });

        if (uploadError) {
          console.error('Falha ao subir arquivo para storage:', uploadError);
          throw new Error('Não foi possível realizar o upload do anexo. Tente novamente ou envie sem anexo.');
        }

        const { data: publicUrlData } = supabase.storage
          .from('orcamentos-anexos')
          .getPublicUrl(uniqueFileName);

        anexosPayload = [
          {
            nome: attachedFile.name,
            url: publicUrlData.publicUrl,
            tipo: attachedFile.type,
            tamanho: attachedFile.size,
          },
        ];
      }

      setUploadProgress('Registrando sua solicitação...');

      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.replace(/\D/g, ''),
        tipo: form.tipo,
        solicitacao: form.solicitacao.trim(),
        website: form.website,
        started_at: openedAtRef.current,
        metadata: getCampaignMetadata(),
        ...(anexosPayload.length > 0 ? { anexos: anexosPayload } : {}),
      };

      const { data, error } = await supabase.functions.invoke<BudgetResponse>('gsa-public-budget', {
        body: { payload },
      });
      if (error) throw error;
      if (!data?.success || typeof data.protocol !== 'string' || !data.protocol.trim()) {
        throw new Error(data?.error || 'Resposta inválida do serviço de orçamento.');
      }

      setProtocol(data.protocol.trim());
      setForm(EMPTY_FORM);
      setAttachedFile(null);
      toast.success('Solicitação enviada com sucesso!');
    } catch (error: any) {
      console.error('Falha ao enviar orçamento público:', error);
      toast.error(error.message || 'Não foi possível enviar sua solicitação no momento. Tente novamente ou converse direto pelo WhatsApp.');
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
  };

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={closeSafely}
      closeOnBackdrop={!submitting}
      ariaLabel="Solicitar proposta e orçamento de projeto digital"
      overlayClassName="items-center justify-center overflow-y-auto bg-[#03070d]/82 p-2.5 backdrop-blur-md sm:p-6"
      panelClassName="max-h-[92dvh] w-full max-w-2xl overflow-hidden rounded-2xl sm:rounded-3xl border border-white/20 bg-white shadow-[0_32px_100px_rgba(0,0,0,0.6)]"
    >
      {protocol ? (
        /* ==================== TELA DE SUCESSO / PROTOCOLO ==================== */
        <div className="flex max-h-[92dvh] flex-col">
          {/* Hairline decorativa dourada */}
          <div className="h-1 w-full shrink-0 bg-gradient-to-r from-transparent via-[#d7b96e] to-transparent" />

          <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#0e1a26] px-5 py-4 text-white sm:px-7 sm:py-5">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" />
                Solicitação Confirmada
              </div>
              <h2 className="mt-1.5 text-xl font-bold tracking-tight sm:text-2xl">
                Proposta em Elaboração
              </h2>
            </div>
            <button
              type="button"
              onClick={closeSafely}
              aria-label="Fechar confirmação"
              className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-[#d7b96e]/50 hover:bg-[#d7b96e]/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d7b96e]"
            >
              <X className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
            </button>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f8f7f4] px-5 py-6 sm:px-8 sm:py-7">
            <div className="mx-auto max-w-lg text-center">
              {/* Ícone com anel de destaque */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm ring-8 ring-emerald-500/10">
                <CheckCircle2 data-dialog-autofocus className="h-8 w-8" tabIndex={-1} />
              </div>

              <h3 className="mt-4 text-xl font-extrabold text-slate-900 sm:text-2xl">
                Seu projeto já está na mesa técnica
              </h3>
              <p className="mt-2 text-xs sm:text-sm leading-relaxed text-slate-600">
                Registramos com sucesso a sua demanda. Nossa equipe de arquitetura e tecnologia entrará em contato pelos canais informados com um diagnóstico inicial.
              </p>

              {/* Cartão do Protocolo */}
              <div className="relative mx-auto mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-slate-900 p-5 text-left text-white shadow-lg">
                <div className="absolute right-0 top-0 h-24 w-24 translate-x-6 -translate-y-6 rounded-full bg-[#d7b96e]/10 blur-xl" />
                <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#d7b96e]">
                      Protocolo do orçamento
                    </span>
                    <p className="mt-1 font-mono text-lg font-extrabold tracking-wider text-white sm:text-xl">
                      {protocol}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/20 hover:text-white active:scale-95"
                  >
                    {copiedProtocol ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Copiado!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-slate-300" />
                        <span>Copiar Código</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Timeline de Próximos Passos */}
              <div className="mt-6 rounded-2xl border border-[#e5e0d4] bg-white p-4 sm:p-5 text-left shadow-sm">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#8a6b2f]">
                  Próximos Passos
                </p>
                <div className="mt-3 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d7b96e]/20 text-[11px] font-bold text-[#8a6b2f]">
                      1
                    </div>
                    <p className="text-xs text-slate-700">
                      <strong>Triagem do escopo:</strong> analistas avaliam os requisitos técnicos e as integrações necessárias.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d7b96e]/20 text-[11px] font-bold text-[#8a6b2f]">
                      2
                    </div>
                    <p className="text-xs text-slate-700">
                      <strong>Contato consultivo:</strong> retorno ágil via WhatsApp ou e-mail com estimativa de cronograma e investimento.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#d7b96e]/20 text-[11px] font-bold text-[#8a6b2f]">
                      3
                    </div>
                    <p className="text-xs text-slate-700">
                      <strong>Apresentação executiva:</strong> demonstração da arquitetura proposta sem compromisso contratual.
                    </p>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={openWhatsApp}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3.5 text-sm font-bold text-white shadow-md transition hover:bg-[#20bd5a] active:scale-[0.98]"
                >
                  <MessageCircle className="h-4 w-4" />
                  Agilizar via WhatsApp
                </button>
                <button
                  type="button"
                  onClick={closeSafely}
                  className="rounded-xl border border-stone-300 bg-white px-5 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-stone-50 active:scale-[0.98]"
                >
                  Concluir e Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== FORMULÁRIO DE ORÇAMENTO ==================== */
        <form onSubmit={submit} className="flex max-h-[92dvh] min-h-0 flex-col" noValidate>
          {/* Hairline decorativa dourada */}
          <div className="h-1 w-full shrink-0 bg-gradient-to-r from-transparent via-[#d7b96e] to-transparent" />

          <header className="shrink-0 border-b border-white/10 bg-[#0e1a26] px-5 py-4 text-white sm:px-7 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-[#d7b96e]/30 bg-[#d7b96e]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-[#d7b96e]">
                  <Sparkles className="h-3 w-3" />
                  Orçamento &amp; Consultoria Sob Medida
                </div>
                <h2 className="mt-2 text-xl font-bold tracking-tight leading-tight sm:text-2xl">
                  Conte-nos sobre o seu projeto
                </h2>
                <p className="mt-1 text-xs text-slate-300/80 sm:text-sm">
                  Preencha as informações principais para prepararmos seu diagnóstico técnico e comercial.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSafely}
                aria-label="Fechar orçamento"
                data-dialog-autofocus
                className="group flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-400 transition hover:border-[#d7b96e]/50 hover:bg-[#d7b96e]/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-[#d7b96e]"
              >
                <X className="h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              </button>
            </div>
          </header>

          {/* Honeypot invisível */}
          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="budget-website">Website</label>
            <input
              id="budget-website"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(event) => update('website', event.target.value)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f8f7f4] px-4 py-4 sm:px-7 sm:py-6">
            <div className="grid gap-3.5 sm:grid-cols-2 sm:gap-4">
              {/* Nome ou Empresa */}
              <div>
                <label htmlFor="budget-name" className="mb-1.5 block text-xs font-bold text-slate-800">
                  Nome ou Empresa <span className="text-[#8a6b2f]">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    id="budget-name"
                    required
                    autoComplete="name"
                    maxLength={120}
                    value={form.nome}
                    onChange={(event) => update('nome', event.target.value)}
                    placeholder="Seu nome completo ou razão social"
                    className="h-11 sm:h-12 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-stone-400 transition-all duration-150 focus:border-[#8a6b2f] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d7b96e]/20 shadow-sm"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <label htmlFor="budget-email" className="mb-1.5 block text-xs font-bold text-slate-800">
                  E-mail para contato <span className="text-[#8a6b2f]">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    id="budget-email"
                    required
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={160}
                    value={form.email}
                    onChange={(event) => update('email', event.target.value)}
                    placeholder="exemplo@empresa.com.br"
                    className="h-11 sm:h-12 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-stone-400 transition-all duration-150 focus:border-[#8a6b2f] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d7b96e]/20 shadow-sm"
                  />
                </div>
              </div>

              {/* Telefone com DDD */}
              <div>
                <label htmlFor="budget-phone" className="mb-1.5 block text-xs font-bold text-slate-800">
                  WhatsApp com DDD <span className="text-[#8a6b2f]">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                    <Phone className="h-4 w-4" />
                  </div>
                  <input
                    id="budget-phone"
                    required
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.telefone}
                    onChange={(event) => update('telefone', maskPhone(event.target.value))}
                    placeholder="(11) 99999-9999"
                    className="h-11 sm:h-12 w-full rounded-xl border border-stone-300 bg-white pl-10 pr-4 text-sm text-slate-900 placeholder:text-stone-400 transition-all duration-150 focus:border-[#8a6b2f] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d7b96e]/20 shadow-sm"
                  />
                </div>
              </div>

              {/* Tipo de Projeto */}
              <div>
                <label htmlFor="budget-type" className="mb-1.5 block text-xs font-bold text-slate-800">
                  Tipo de projeto pretendido <span className="text-[#8a6b2f]">*</span>
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400">
                    <Briefcase className="h-4 w-4" />
                  </div>
                  <select
                    id="budget-type"
                    required
                    value={form.tipo}
                    onChange={(event) => update('tipo', event.target.value)}
                    className="h-11 sm:h-12 w-full appearance-none rounded-xl border border-stone-300 bg-white pl-10 pr-10 text-sm text-slate-900 transition-all duration-150 focus:border-[#8a6b2f] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d7b96e]/20 shadow-sm cursor-pointer"
                  >
                    <option value="">Selecione a categoria...</option>
                    {PROJECT_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-500">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Descrição do Projeto */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between gap-4">
                <label htmlFor="budget-request" className="block text-xs font-bold text-slate-800">
                  Descreva suas necessidades e objetivos <span className="text-[#8a6b2f]">*</span>
                </label>
                <span
                  className={`text-[11px] font-bold ${
                    form.solicitacao.length >= 20
                      ? 'text-emerald-700 font-semibold'
                      : form.solicitacao.length > 0
                        ? 'text-amber-700'
                        : 'text-stone-400'
                  }`}
                >
                  {form.solicitacao.length}/2000{' '}
                  {form.solicitacao.length < 20 && form.solicitacao.length > 0 && '(mín. 20 caracteres)'}
                </span>
              </div>
              <textarea
                id="budget-request"
                required
                rows={4}
                minLength={20}
                maxLength={2000}
                value={form.solicitacao}
                onChange={(event) => update('solicitacao', event.target.value)}
                placeholder="Explique sua ideia principal, público-alvo, se já possui sistema/site atual e qual resultado espera alcançar..."
                className="w-full rounded-xl border border-stone-300 bg-white p-3.5 text-sm text-slate-900 placeholder:text-stone-400 transition-all duration-150 focus:border-[#8a6b2f] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#d7b96e]/20 shadow-sm min-h-[110px] resize-y"
              />
            </div>

            {/* Upload de Arquivos / Documentos de Apoio */}
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Paperclip className="h-3.5 w-3.5 text-[#8a6b2f]" />
                  Anexar arquivo para análise técnica
                  <span className="text-[11px] font-normal text-slate-500">(opcional)</span>
                </label>
                <span className="text-[10px] font-medium text-slate-500">
                  PDF, DOCX, Imagem ou Planilha até 15MB
                </span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                id="budget-file-upload"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg,.webp"
                className="hidden"
                disabled={submitting}
              />

              {!attachedFile ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50/70 p-4 transition-all duration-200 hover:border-[#8a6b2f] hover:bg-[#d7b96e]/5 active:scale-[0.99]"
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#8a6b2f] shadow-sm ring-1 ring-stone-200 group-hover:scale-105 group-hover:text-[#5e4719] transition-all">
                    <UploadCloud className="h-5 w-5" />
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-800">
                    <span className="text-[#8a6b2f] group-hover:underline">Clique para selecionar</span> ou arraste o arquivo aqui
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Briefing, apresentação, escopo, referências visuais ou especificações
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-3 shadow-sm">
                  <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                      <Paperclip className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-bold text-slate-900" title={attachedFile.name}>
                        {attachedFile.name}
                      </p>
                      <p className="text-[10px] font-medium text-emerald-800">
                        {formatFileSize(attachedFile.size)} • Pronto para análise
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    disabled={submitting}
                    aria-label="Remover anexo"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-white text-red-600 transition hover:bg-red-50 active:scale-95 disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Selo de Segurança e Sigilo com aviso detalhado */}
            <div className="mt-4 flex items-start gap-3 rounded-xl border border-[#d7b96e]/25 bg-gradient-to-r from-[#d7b96e]/10 to-transparent p-3 sm:p-3.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#d7b96e]/20 text-[#8a6b2f]">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-800">Privacidade &amp; Sigilo Garantidos</p>
                <p className="text-[11px] leading-relaxed text-slate-600">
                  Seus dados e arquivos estão protegidos sob a LGPD. Para otimizar seu atendimento, registramos a página de origem, o domínio de referência e parâmetros de campanha estritamente para formulação e acompanhamento da sua proposta comercial.
                </p>
              </div>
            </div>
          </div>

          <footer className="shrink-0 border-t border-stone-200 bg-white px-4 py-3.5 sm:px-7 sm:py-4">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={openWhatsApp}
                className="inline-flex items-center justify-center gap-2 text-xs font-semibold text-[#8a6b2f] transition hover:text-[#5e4719] hover:underline"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Prefere atendimento imediato? Fale no WhatsApp
              </button>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#0c1825] via-[#14263b] to-[#0c1825] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:from-[#14263b] hover:to-[#1a334f] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#d7b96e] focus:ring-offset-2"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    <span>{uploadProgress || 'Enviando solicitação...'}</span>
                  </>
                ) : (
                  <>
                    <span>Enviar Solicitação de Orçamento</span>
                    <Send className="h-4 w-4 text-[#d7b96e]" />
                  </>
                )}
              </button>
            </div>
          </footer>
        </form>
      )}
    </AccessibleDialog>
  );
}

