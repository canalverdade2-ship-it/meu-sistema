import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, MessageCircle, Send, ShieldCheck, X } from 'lucide-react';
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
      overlayClassName="items-center justify-center overflow-y-auto bg-[#03070d]/78 p-3 backdrop-blur-sm sm:p-6"
      panelClassName="max-h-[90dvh] max-w-2xl overflow-hidden rounded-[1.25rem] border border-white/15 bg-white shadow-[0_28px_90px_rgba(0,0,0,0.48)]"
    >
      {protocol ? (
        <div className="flex max-h-[90dvh] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#0a1420] px-5 py-4 text-white sm:px-6 sm:py-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d7b96e]">Orçamento registrado</p>
              <h2 className="mt-1 text-xl font-black sm:text-2xl">Solicitação recebida</h2>
            </div>
            <button
              type="button"
              onClick={closeSafely}
              aria-label="Fechar confirmação"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7b96e]"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="overflow-y-auto px-5 py-6 text-center sm:px-8 sm:py-8">
            <CheckCircle2 data-dialog-autofocus className="mx-auto h-12 w-12 text-emerald-600" tabIndex={-1} />
            <h3 className="mt-4 text-2xl font-black text-[#111820]">Seu projeto já está em análise</h3>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-neutral-600">
              Nossa equipe retornará pelo contato informado. Guarde o protocolo abaixo para acompanhar o atendimento.
            </p>
            <div className="mx-auto mt-5 max-w-sm rounded-[10px] border border-[#ddd8ce] bg-[#f7f5f0] px-5 py-4">
              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-500">Protocolo do orçamento</span>
              <strong className="mt-1 block text-lg text-[#111820]">{protocol}</strong>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={openWhatsApp}
                className="inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#d7b96e] px-5 py-3.5 text-sm font-black text-[#111820] transition hover:bg-[#e2c982]"
              >
                <MessageCircle className="h-4 w-4" />
                Falar pelo WhatsApp
              </button>
              <button
                type="button"
                onClick={closeSafely}
                className="rounded-[10px] border border-[#ddd8ce] px-5 py-3.5 text-sm font-black text-neutral-700 transition hover:bg-neutral-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="flex max-h-[90dvh] min-h-0 flex-col" noValidate>
          <header className="shrink-0 border-b border-white/10 bg-[#0a1420] px-5 py-4 text-white sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d7b96e]">Solicitar orçamento</p>
                <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">Conte-nos sobre o seu projeto</h2>
                <p className="mt-1.5 text-xs leading-5 text-white/62 sm:text-sm">
                  Preencha as informações principais para iniciarmos a análise.
                </p>
              </div>
              <button
                type="button"
                onClick={closeSafely}
                aria-label="Fechar orçamento"
                data-dialog-autofocus
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d7b96e]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
            <label htmlFor="budget-website">Website</label>
            <input id="budget-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => update('website', event.target.value)} />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f7f5f0] px-4 py-4 sm:px-6 sm:py-5">
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div>
                <label htmlFor="budget-name" className="mb-1.5 block text-xs font-black text-neutral-700">Nome ou empresa</label>
                <input id="budget-name" required autoComplete="name" maxLength={120} value={form.nome} onChange={(event) => update('nome', event.target.value)} placeholder="Seu nome ou razão social" className="input-field" />
              </div>
              <div>
                <label htmlFor="budget-email" className="mb-1.5 block text-xs font-black text-neutral-700">E-mail</label>
                <input id="budget-email" required type="email" inputMode="email" autoComplete="email" maxLength={160} value={form.email} onChange={(event) => update('email', event.target.value)} placeholder="voce@exemplo.com" className="input-field" />
              </div>
              <div>
                <label htmlFor="budget-phone" className="mb-1.5 block text-xs font-black text-neutral-700">Telefone com DDD</label>
                <input id="budget-phone" required type="tel" inputMode="tel" autoComplete="tel" value={form.telefone} onChange={(event) => update('telefone', maskPhone(event.target.value))} placeholder="(11) 99999-9999" className="input-field" />
              </div>
              <div>
                <label htmlFor="budget-type" className="mb-1.5 block text-xs font-black text-neutral-700">Tipo de projeto</label>
                <select id="budget-type" required value={form.tipo} onChange={(event) => update('tipo', event.target.value)} className="input-field">
                  <option value="">Selecione</option>
                  {PROJECT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between gap-4">
                <label htmlFor="budget-request" className="block text-xs font-black text-neutral-700">Descreva sua necessidade</label>
                <span className="text-[10px] font-bold text-neutral-400">{form.solicitacao.length}/2000</span>
              </div>
              <textarea
                id="budget-request"
                required
                rows={4}
                minLength={20}
                maxLength={2000}
                value={form.solicitacao}
                onChange={(event) => update('solicitacao', event.target.value)}
                placeholder="Explique sua ideia, o público, o que já existe e o resultado que deseja alcançar."
                className="input-field min-h-[112px] resize-y"
              />
            </div>

            <div className="mt-4 flex items-start gap-2.5 rounded-[10px] border border-[#ded8cc] bg-white px-3.5 py-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#80672c]" />
              <p className="text-[11px] leading-5 text-neutral-500">
                Seus dados serão usados somente para analisar a solicitação, registrar sua origem e entrar em contato sobre o projeto.
              </p>
            </div>
          </div>

          <footer className="shrink-0 border-t border-[#ddd8ce] bg-white px-4 py-3 sm:px-6 sm:py-4">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] bg-[#0a1420] px-5 py-3.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(8,17,29,0.18)] transition hover:bg-[#142434] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80672c] focus-visible:ring-offset-2"
            >
              {submitting ? 'Enviando solicitação...' : 'Enviar solicitação'}
              {!submitting && <Send className="h-4 w-4" />}
            </button>
          </footer>
        </form>
      )}
    </AccessibleDialog>
  );
}
