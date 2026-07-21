import { ArrowRight, LogIn, Mail, MessageCircle, X } from 'lucide-react';
import { AccessibleDialog } from '../../ui/AccessibleDialog';
import type { ServicePackage } from '../../../data/publicServiceCatalog';

export function ServiceDetailsDialog({ selectedPackage, onClose, onInterest }: { selectedPackage: ServicePackage | null; onClose: () => void; onInterest: (item: ServicePackage) => void }) {
  return (
    <AccessibleDialog isOpen={Boolean(selectedPackage)} onClose={onClose} ariaLabel={selectedPackage ? `Detalhes do pacote ${selectedPackage.title}` : 'Detalhes do pacote'} panelClassName="max-w-4xl rounded-2xl bg-white p-6 shadow-2xl">
      {selectedPackage && (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-[#8a6e2f]">{selectedPackage.subtitle}</p>
              <h2 className="mt-2 text-3xl font-black">{selectedPackage.title}</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-600">{selectedPackage.description}</p>
            </div>
            <button type="button" onClick={onClose} data-dialog-autofocus aria-label="Fechar detalhes" className="rounded-lg bg-neutral-100 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2">
            {selectedPackage.services.map((service) => <div key={service.name} className="rounded-xl bg-neutral-50 p-4"><strong>{service.name}</strong><p className="mt-2 text-sm leading-6 text-neutral-600">{service.desc}</p></div>)}
          </div>
          <button type="button" onClick={() => onInterest(selectedPackage)} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-4 font-black text-white">Tenho interesse <ArrowRight className="h-4 w-4" /></button>
        </>
      )}
    </AccessibleDialog>
  );
}

export function RequestChannelDialog({ selectedPackage, onClose, onWhatsApp, onEmail, onPortal }: { selectedPackage: ServicePackage | null; onClose: () => void; onWhatsApp: (item: ServicePackage) => void; onEmail: (item: ServicePackage) => void; onPortal: (item: ServicePackage) => void }) {
  return (
    <AccessibleDialog isOpen={Boolean(selectedPackage)} onClose={onClose} ariaLabel="Escolher canal de atendimento" panelClassName="max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
      {selectedPackage && (
        <>
          <div className="flex items-start justify-between">
            <div><p className="text-xs font-black uppercase tracking-widest text-[#8a6e2f]">Solicitar atendimento</p><h2 className="mt-2 text-2xl font-black">{selectedPackage.title}</h2></div>
            <button type="button" onClick={onClose} data-dialog-autofocus aria-label="Fechar canais de atendimento" className="rounded-lg bg-neutral-100 p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"><X className="h-5 w-5" /></button>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <ChannelButton icon={MessageCircle} title="WhatsApp" onClick={() => onWhatsApp(selectedPackage)} />
            <ChannelButton icon={Mail} title="E-mail" onClick={() => onEmail(selectedPackage)} />
            <ChannelButton icon={LogIn} title="Portal" onClick={() => onPortal(selectedPackage)} />
          </div>
        </>
      )}
    </AccessibleDialog>
  );
}

function ChannelButton({ icon: Icon, title, onClick }: { icon: typeof MessageCircle; title: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-neutral-200 p-5 text-left transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"><Icon className="h-6 w-6 text-[#8a6e2f]" /><strong className="mt-4 block">{title}</strong></button>;
}
