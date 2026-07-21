import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MessageCircle, X } from 'lucide-react';
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
  ['loja', 'Loja virtual'],
  ['sistema', 'Sistema web'],
  ['aplicativo', 'Aplicativo'],
  ['automacao', 'Automação'],
  ['integracao', 'Integração entre sistemas'],
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
  const isBrandJourney = window.location.pathname.replace(/\/+$/, '') === '/empresa-do-zero-ao-digital';
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
  if (name.length < 2 || name.length > 120) return 'Informe um nome válido.';
  if (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Informe um e-mail válido.';
  if (phone.length < 10 || phone.length > 11) return 'Informe um telefone com DDD.';
  if (!PROJECT_TYPES.has(form.tipo)) return 'Selecione o tipo de projeto.';
  if (request.length < 20) return 'Descreva sua necessidade com pelo menos 20 caracteres.';
  if (request.length > 2000) return 'A descrição deve ter no máximo 2.000 caracteres.';
  return null;
}

export function SystemsBudgetModal({ isOpen, onClose }: SystemsBudgetModalProps) {
  const [form, setForm] = useState<BudgetForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const openedAtRef = useRef(new Date().toISOString());

  useEffect(() => {
    if (!isOpen) return;
    openedAtRef.current = new Date().toISOString();
    setProtocol(null);
  }, [isOpen]);

  const update = (field: keyof BudgetForm, value: string) => {
    setForm((previous) => ({ ...previous, [field]: value }));
  };

  const closeSafely = () => {
    if (submitting) return;
    setForm(EMPTY_FORM);
    setProtocol(null);
    onClose();
  };

  const openWhatsApp = () => {
    const message = protocol
      ? `Olá! Enviei uma solicitação de projeto pelo site. Protocolo: ${protocol}.`
      : 'Olá! Gostaria de falar sobre marca, presença digital, site, sistema ou redes sociais.';
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
    try {
      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim().toLowerCase(),
        telefone: form.telefone.replace(/\D/g, ''),
        tipo: form.tipo,
        solicitacao: form.solicitacao.trim(),
        website: form.website,
        started_at: openedAtRef.current,
        metadata: getCampaignMetadata(),
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
      toast.success('Solicitação enviada com sucesso.');
    } catch (error) {
      console.error('Falha ao enviar orçamento público:', error);
      toast.error('Não foi possível enviar sua solicitação. Tente novamente ou fale conosco pelo WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AccessibleDialog
      isOpen={isOpen}
      onClose={closeSafely}
      closeOnBackdrop={!submitting}
      ariaLabel="Solicitar orçamento de projeto digital"
      panelClassName="max-w-4xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
    >
      {protocol ? (
        <div className="text-center">
          <CheckCircle2 data-dialog-autofocus className="mx-auto h-14 w-14 text-emerald-600" tabIndex={-1} />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.2em] text-[#8a6e2f]">Solicitação recebida</p>
          <h2 className="mt-3 text-3xl font-black text-neutral-950">Seu projeto já está em análise</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-neutral-600">
            Nossa equipe retornará pelo contato informado. O código abaixo é o mesmo registrado no orçamento e pode ser usado no atendimento.
          </p>
          <div className="mx-auto mt-6 max-w-md rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
            <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">Protocolo do orçamento</span>
            <strong className="mt-1 block text-lg text-neutral-950">{protocol}</strong>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={openWhatsApp} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d6b25e] px-5 py-4 font-black text-neutral-950">
              <MessageCircle className="h-5 w-5" /> Falar pelo WhatsApp
            </button>
            <button type="button" onClick={closeSafely} className="rounded-xl border border-neutral-200 px-5 py-4 font-black text-neutral-700 hover:bg-neutral-50">
              Fechar
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8a6e2f]">Solicitar orçamento</p>
              <h2 className="mt-2 text-2xl font-black text-neutral-950">Marca, presença digital, sites e sistemas</h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">Conte-nos o que você precisa. É possível contratar uma etapa específica ou solicitar a jornada completa.</p>
            </div>
            <button type="button" onClick={closeSafely} aria-label="Fechar orçamento" className="rounded-lg bg-neutral-100 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="budget-website">Website</label>
            <input id="budget-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update('website', event.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="budget-name" className="mb-2 block text-sm font-bold text-neutral-700">Nome</label>
              <input id="budget-name" required data-dialog-autofocus autoComplete="name" maxLength={120} value={form.nome} onChange={(event) => update('nome', event.target.value)} placeholder="Seu nome ou razão social" className="input-field" />
            </div>
            <div>
              <label htmlFor="budget-email" className="mb-2 block text-sm font-bold text-neutral-700">E-mail</label>
              <input id="budget-email" required type="email" inputMode="email" autoComplete="email" maxLength={160} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="voce@exemplo.com" className="input-field" />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="budget-phone" className="mb-2 block text-sm font-bold text-neutral-700">Telefone com DDD</label>
              <input id="budget-phone" required type="tel" inputMode="tel" autoComplete="tel" value={form.telefone} onChange={(event) => update('telefone', maskPhone(event.target.value))} placeholder="(11) 99999-9999" className="input-field" />
            </div>
            <div>
              <label htmlFor="budget-type" className="mb-2 block text-sm font-bold text-neutral-700">Tipo de projeto</label>
              <select id="budget-type" required value={form.tipo} onChange={(event) => update('tipo', event.target.value)} className="input-field">
                <option value="">Selecione</option>
                {PROJECT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-4">
              <label htmlFor="budget-request" className="block text-sm font-bold text-neutral-700">Descreva sua necessidade</label>
              <span className="text-xs text-neutral-400">{form.solicitacao.length}/2000</span>
            </div>
            <textarea id="budget-request" required rows={6} minLength={20} maxLength={2000} value={form.solicitacao} onChange={(event) => update('solicitacao', event.target.value)} placeholder="Explique sua ideia, o público, o que já existe e quais resultados você busca alcançar." className="input-field resize-none" />
          </div>

          <p className="text-xs leading-5 text-neutral-500">
            Usaremos os dados para analisar a solicitação e entrar em contato. Também registramos a página de origem, o domínio de referência e parâmetros de campanha para medir a origem do atendimento; esses metadados não são usados para autenticação.
          </p>
          <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Enviando...' : 'Enviar solicitação'}</button>
        </form>
      )}
    </AccessibleDialog>
  );
}
