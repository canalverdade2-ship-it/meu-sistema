import {
  ArrowRight,
  LogIn,
  Mail,
  MessageCircle,
  X,
  type LucideIcon,
} from 'lucide-react';
import { AccessibleDialog } from '../../ui/AccessibleDialog';
import type { ServicePackage } from '../../../data/publicServiceCatalog';

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
      overlayClassName="items-center justify-center overflow-y-auto bg-[#03070d]/75 p-3 backdrop-blur-sm sm:p-6"
      panelClassName="max-h-[92dvh] max-w-3xl overflow-hidden rounded-[1.5rem] border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
    >
      {selectedPackage && (
        <div className="flex max-h-[92dvh] min-h-0 flex-col">
          <header className="shrink-0 border-b border-white/10 bg-[#0a1420] px-4 py-4 text-white sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d8bd73]">
                  Detalhes do pacote
                </p>
                <h2 className="mt-1.5 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                  {selectedPackage.title}
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-white/65 sm:text-sm sm:leading-6">
                  {selectedPackage.description}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                data-dialog-autofocus
                aria-label="Fechar detalhes"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <section
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#f7f5f0] px-4 py-4 sm:px-6 sm:py-5"
            aria-labelledby="included-services-title"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 id="included-services-title" className="text-lg font-black tracking-tight text-[#101820] sm:text-xl">
                O que está incluído
              </h3>
              <span className="shrink-0 rounded-full border border-[#d8bd73]/40 bg-white px-2.5 py-1 text-[11px] font-black text-[#6d5727] shadow-sm">
                {selectedPackage.services.length} {selectedPackage.services.length === 1 ? 'serviço' : 'serviços'}
              </span>
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2 sm:gap-3">
              {selectedPackage.services.map((service, index) => (
                <article
                  key={`${service.name}-${index}`}
                  className="rounded-xl border border-[#ddd8ce] bg-white px-3 py-3 shadow-[0_4px_14px_rgba(16,24,32,0.04)] sm:px-4 sm:py-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#0b1521] text-[10px] font-black text-[#d8bd73]">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black leading-5 text-[#101820] sm:text-[15px]">{service.name}</h4>
                      <p className="mt-1 text-xs leading-5 text-neutral-600 sm:text-sm">{service.desc}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <footer className="shrink-0 border-t border-[#e3ded4] bg-white px-4 py-3 sm:px-6 sm:py-4">
            <button
              type="button"
              onClick={() => onInterest(selectedPackage)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0a1420] px-5 py-3.5 text-sm font-black text-white shadow-[0_10px_24px_rgba(8,17,29,0.2)] transition hover:bg-[#132334] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f] focus-visible:ring-offset-2"
            >
              Solicitar atendimento
              <ArrowRight className="h-4 w-4" />
            </button>
          </footer>
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
      overlayClassName="items-center justify-center overflow-y-auto bg-[#03070d]/75 p-3 backdrop-blur-sm sm:p-6"
      panelClassName="max-h-[92dvh] max-w-lg overflow-hidden rounded-[1.5rem] border border-white/15 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.42)]"
    >
      {selectedPackage && (
        <div className="flex max-h-[92dvh] min-h-0 flex-col">
          <header className="shrink-0 border-b border-white/10 bg-[#0a1420] px-4 py-4 text-white sm:px-6 sm:py-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#d8bd73]">Solicitar atendimento</p>
                <h2 className="mt-1 text-xl font-black leading-tight sm:text-2xl">Escolha como deseja continuar</h2>
                <p className="mt-2 text-xs leading-5 text-white/65 sm:text-sm">
                  Pacote: <strong className="text-white">{selectedPackage.title}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                data-dialog-autofocus
                aria-label="Fechar canais de atendimento"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/75 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f5f0] p-4 sm:p-5">
            <div className="space-y-2.5">
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
  icon: LucideIcon;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-xl border border-[#ddd8ce] bg-white p-3.5 text-left shadow-[0_4px_14px_rgba(16,24,32,0.04)] transition hover:border-[#cdb36d] hover:shadow-[0_8px_20px_rgba(16,24,32,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f] focus-visible:ring-offset-2"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b1521] text-[#d8bd73]">
        <Icon className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <strong className="text-sm text-[#101820]">{title}</strong>
          {badge && (
            <span className="rounded-full bg-[#ede3c7] px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-[#6d5727]">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-neutral-600">{description}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#806729] transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
