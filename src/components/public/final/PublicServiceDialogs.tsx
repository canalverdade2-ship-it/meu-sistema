import { ArrowRight, LogIn, Mail, MessageCircle, X } from 'lucide-react';
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
      panelClassName="w-full max-w-3xl my-auto max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl transition-all"
    >
      {selectedPackage && (
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="pr-2">
              <p className="text-xs font-black uppercase tracking-widest text-[#8a6e2f]">{selectedPackage.subtitle}</p>
              <h2 className="mt-1.5 text-xl sm:text-3xl font-black text-neutral-900">{selectedPackage.title}</h2>
              <p className="mt-2 text-xs sm:text-sm leading-6 text-neutral-600">{selectedPackage.description}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-dialog-autofocus
              aria-label="Fechar detalhes"
              className="shrink-0 rounded-lg bg-neutral-100 p-2 text-neutral-600 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 sm:mt-7 grid gap-3 grid-cols-1 sm:grid-cols-2">
            {selectedPackage.services.map((service) => (
              <div key={service.name} className="rounded-xl border border-neutral-100 bg-neutral-50 p-3.5 sm:p-4">
                <strong className="text-sm sm:text-base font-bold text-neutral-900 block">{service.name}</strong>
                <p className="mt-1.5 text-xs sm:text-sm leading-5 text-neutral-600">{service.desc}</p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onInterest(selectedPackage)}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-3.5 sm:py-4 text-xs sm:text-sm font-black uppercase tracking-wider text-white transition hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"
          >
            <span>Tenho interesse</span>
            <ArrowRight className="h-4 w-4 text-[#d8bd73]" />
          </button>
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
      panelClassName="w-full max-w-xl my-auto max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl transition-all"
    >
      {selectedPackage && (
        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#8a6e2f]">Solicitar atendimento</p>
              <h2 className="mt-1.5 text-lg sm:text-2xl font-black text-neutral-900">{selectedPackage.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-dialog-autofocus
              aria-label="Fechar canais de atendimento"
              className="shrink-0 rounded-lg bg-neutral-100 p-2 text-neutral-600 transition hover:bg-neutral-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
            <ChannelButton icon={MessageCircle} title="WhatsApp" onClick={() => onWhatsApp(selectedPackage)} />
            <ChannelButton icon={Mail} title="E-mail" onClick={() => onEmail(selectedPackage)} />
            <ChannelButton icon={LogIn} title="Portal" onClick={() => onPortal(selectedPackage)} />
          </div>
        </div>
      )}
    </AccessibleDialog>
  );
}

function ChannelButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof MessageCircle;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center sm:flex-col sm:items-start justify-start gap-3 sm:gap-2 rounded-xl border border-neutral-200 p-4 text-left transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"
    >
      <Icon className="h-6 w-6 shrink-0 text-[#8a6e2f]" />
      <strong className="block text-sm font-bold text-neutral-900">{title}</strong>
    </button>
  );
}
