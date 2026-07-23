import {
  ArrowRight,
  Check,
  LogIn,
  Mail,
  MessageCircle,
  ShieldCheck,
  X,
} from 'lucide-react';
import { AccessibleDialog } from '../../ui/AccessibleDialog';
import type { ServicePackage } from '../../../data/publicServiceCatalog';

function getAudienceLabel(audience: ServicePackage['audience']) {
  if (audience === 'PJ') return 'Para empresas';
  if (audience === 'PF') return 'Para você';
  return 'Para pessoas e empresas';
}

export function ServiceDetailsDialog({
  selectedPackage,
  onClose,
  onInterest,
}: {
  selectedPackage: ServicePackage | null;
  onClose: () => void;
  onInterest: (item: ServicePackage) => void;
}) {
  return (
    <AccessibleDialog
      isOpen={Boolean(selectedPackage)}
      onClose={onClose}
      ariaLabel={selectedPackage ? `Detalhes do pacote ${selectedPackage.title}` : 'Detalhes do pacote'}
      overlayClassName="items-end justify-center overflow-y-auto bg-[#03070d]/80 p-0 backdrop-blur-md sm:items-center sm:p-5"
      panelClassName="max-h-[calc(100dvh-0.5rem)] max-w-5xl overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#f7f4ed] shadow-[0_32px_90px_rgba(0,0,0,0.45)] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem]"
    >
      {selectedPackage && (
        <div className="flex max-h-[inherit] flex-col">
          <header className="relative overflow-hidden bg-[#08111d] px-5 pb-7 pt-6 text-white sm:px-8 sm:pb-9 sm:pt-8 lg:px-10">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full border border-[#d8bd73]/15" />
            <div className="pointer-events-none absolute -right-7 -top-8 h-36 w-36 rounded-full bg-[#d8bd73]/10 blur-3xl" />

            <div className="relative flex items-start justify-between gap-5">
              <div className="min-w-0 max-w-3xl">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="rounded-full border border-[#d8bd73]/35 bg-[#d8bd73]/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-[#e6cf8c]">
                    {getAudienceLabel(selectedPackage.audience)}
                  </span>
                  <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/55">
                    Serviços e assinaturas
                  </span>
                </div>

                <p className="mt-5 text-xs font-black uppercase tracking-[0.18em] text-[#d8bd73]">
                  {selectedPackage.subtitle}
                </p>
                <h2 className="mt-2 max-w-2xl font-serif text-3xl font-semibold leading-tight tracking-[-0.02em] sm:text-4xl lg:text-[2.7rem]">
                  {selectedPackage.title}
                </h2>
                <p className="mt-4 max-w-2xl text-sm leading-6 text-white/68 sm:text-base sm:leading-7">
                  {selectedPackage.description}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                data-dialog-autofocus
                aria-label="Fechar detalhes"
                className="shrink-0 rounded-full border border-white/15 bg-white/5 p-2.5 text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="overflow-y-auto overscroll-contain">
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="px-5 py-7 sm:px-8 sm:py-9 lg:px-10" aria-labelledby="included-services-title">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#8a6e2f]">
                      Escopo do pacote
                    </p>
                    <h3 id="included-services-title" className="mt-1.5 text-2xl font-black tracking-tight text-[#101820]">
                      O que está incluído
                    </h3>
                  </div>
                  <span className="shrink-0 rounded-full border border-[#d8bd73]/35 bg-white px-3 py-1.5 text-xs font-black text-[#6d5727] shadow-sm">
                    {selectedPackage.services.length} {selectedPackage.services.length === 1 ? 'serviço' : 'serviços'}
                  </span>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  {selectedPackage.services.map((service, index) => (
                    <article
                      key={`${service.name}-${index}`}
                      className="group rounded-2xl border border-[#ded8cc] bg-white p-5 shadow-[0_10px_28px_rgba(16,24,32,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cdb36d]/60 hover:shadow-[0_16px_35px_rgba(16,24,32,0.09)]"
                    >
                      <div className="flex items-start gap-3.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0c1724] text-xs font-black text-[#d8bd73]">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <div>
                          <h4 className="font-black leading-5 text-[#101820]">{service.name}</h4>
                          <p className="mt-2 text-sm leading-6 text-neutral-600">{service.desc}</p>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <aside className="border-t border-[#ddd6c8] bg-[#eee8dc] px-5 py-7 sm:px-8 sm:py-9 lg:border-l lg:border-t-0 lg:px-7">
                <div className="lg:sticky lg:top-0">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0b1521] text-[#d8bd73] shadow-lg">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <h3 className="mt-5 text-xl font-black tracking-tight text-[#101820]">Atendimento organizado do início ao fim</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">
                    Sua solicitação é direcionada para análise, definição do escopo e acompanhamento pelos canais da GSA.
                  </p>

                  <ul className="mt-6 space-y-3" aria-label="Vantagens do atendimento">
                    {[
                      'Análise inicial da necessidade',
                      'Escopo confirmado antes da contratação',
                      'Acompanhamento centralizado da solicitação',
                    ].map((benefit) => (
                      <li key={benefit} className="flex items-start gap-3 text-sm font-semibold leading-5 text-[#27313b]">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[#806729] shadow-sm">
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        </span>
                        {benefit}
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => onInterest(selectedPackage)}
                    className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a1420] px-5 py-4 text-sm font-black text-white shadow-[0_14px_30px_rgba(8,17,29,0.22)] transition hover:-translate-y-0.5 hover:bg-[#111f2e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f] focus-visible:ring-offset-2"
                  >
                    Solicitar atendimento
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <p className="mt-3 text-center text-[11px] leading-4 text-neutral-500">
                    Na próxima etapa, você poderá escolher o canal de atendimento.
                  </p>
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </AccessibleDialog>
  );
}

export function RequestChannelDialog({
  selectedPackage,
  onClose,
  onWhatsApp,
  onEmail,
  onPortal,
}: {
  selectedPackage: ServicePackage | null;
  onClose: () => void;
  onWhatsApp: (item: ServicePackage) => void;
  onEmail: (item: ServicePackage) => void;
  onPortal: (item: ServicePackage) => void;
}) {
  return (
    <AccessibleDialog
      isOpen={Boolean(selectedPackage)}
      onClose={onClose}
      ariaLabel="Escolher canal de atendimento"
      overlayClassName="items-end justify-center overflow-y-auto bg-[#03070d]/80 p-0 backdrop-blur-md sm:items-center sm:p-5"
      panelClassName="max-h-[calc(100dvh-0.5rem)] max-w-3xl overflow-hidden rounded-t-[2rem] border border-white/10 bg-[#f7f4ed] shadow-[0_32px_90px_rgba(0,0,0,0.45)] sm:max-h-[calc(100dvh-2.5rem)] sm:rounded-[2rem]"
    >
      {selectedPackage && (
        <div className="overflow-y-auto overscroll-contain">
          <header className="relative overflow-hidden bg-[#08111d] px-5 pb-7 pt-6 text-white sm:px-8 sm:pb-8 sm:pt-8">
            <div className="pointer-events-none absolute -right-12 -top-16 h-44 w-44 rounded-full border border-[#d8bd73]/15" />
            <div className="relative flex items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Solicitar atendimento</p>
                <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight">Escolha como prefere continuar</h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-white/65">
                  Selecione um canal para falar sobre o pacote <strong className="text-white">{selectedPackage.title}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                data-dialog-autofocus
                aria-label="Fechar canais de atendimento"
                className="shrink-0 rounded-full border border-white/15 bg-white/5 p-2.5 text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </header>

          <div className="px-5 py-7 sm:px-8 sm:py-8">
            <div className="grid gap-3 sm:grid-cols-3">
              <ChannelButton
                icon={MessageCircle}
                title="WhatsApp"
                description="Converse agora com nossa equipe."
                onClick={() => onWhatsApp(selectedPackage)}
              />
              <ChannelButton
                icon={Mail}
                title="E-mail"
                description="Envie sua solicitação por escrito."
                onClick={() => onEmail(selectedPackage)}
              />
              <ChannelButton
                icon={LogIn}
                title="Portal do cliente"
                description="Registre e acompanhe sua solicitação."
                badge="Recomendado"
                onClick={() => onPortal(selectedPackage)}
              />
            </div>
            <p className="mt-5 text-center text-xs leading-5 text-neutral-500">
              O canal escolhido não altera o escopo do pacote.
            </p>
          </div>
        </div>
      )}
    </AccessibleDialog>
  );
}

function ChannelButton({
  icon: Icon,
  title,
  description,
  badge,
  onClick,
}: {
  icon: typeof MessageCircle;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative rounded-2xl border border-[#ddd6c8] bg-white p-5 text-left shadow-[0_10px_26px_rgba(16,24,32,0.05)] transition duration-200 hover:-translate-y-0.5 hover:border-[#cdb36d] hover:shadow-[0_16px_34px_rgba(16,24,32,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f] focus-visible:ring-offset-2"
    >
      {badge && (
        <span className="absolute right-3 top-3 rounded-full bg-[#ede3c7] px-2 py-1 text-[9px] font-black uppercase tracking-wider text-[#6d5727]">
          {badge}
        </span>
      )}
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b1521] text-[#d8bd73] transition group-hover:bg-[#132334]">
        <Icon className="h-5 w-5" />
      </span>
      <strong className="mt-4 block text-base text-[#101820]">{title}</strong>
      <span className="mt-2 block text-sm leading-5 text-neutral-600">{description}</span>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-[#806729]">
        Continuar <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}
