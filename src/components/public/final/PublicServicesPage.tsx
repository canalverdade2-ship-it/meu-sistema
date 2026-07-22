import { ArrowLeft, ArrowRight, BriefcaseBusiness, CheckCircle2, Users } from 'lucide-react';
import type { Audience, IconItem, ServicePackage } from '../../../data/publicServiceCatalog';

interface PublicServicesPageProps {
  audience: Audience;
  setAudience: (audience: Audience) => void;
  packages: ServicePackage[];
  publicServices: IconItem[];
  onBack: () => void;
  onSelect: (item: ServicePackage) => void;
}

export function PublicServicesPage({ audience, setAudience, packages, publicServices, onBack, onSelect }: PublicServicesPageProps) {
  return (
    <main className="min-h-screen bg-[#f4f1ea] pt-28">
      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]"><ArrowLeft className="h-4 w-4" />Voltar</button>
        <div className="mt-10 grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#8a6e2f]">Catálogo GSA</p>
            <h1 className="mt-3 text-4xl font-black">Serviços e assinaturas para cada fase</h1>
            <p className="mt-4 text-base leading-7 text-neutral-600">Escolha seu perfil, conheça os pacotes e solicite atendimento pelo canal mais conveniente.</p>
            <div className="mt-7 flex gap-2 rounded-xl bg-neutral-950 p-1 text-white" role="group" aria-label="Perfil do catálogo">
              <button type="button" onClick={() => setAudience('PF')} aria-pressed={audience === 'PF'} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold ${audience === 'PF' ? 'bg-white text-neutral-950' : 'text-white/70'}`}><Users className="mr-2 inline h-4 w-4" />Pessoa física</button>
              <button type="button" onClick={() => setAudience('PJ')} aria-pressed={audience === 'PJ'} className={`flex-1 rounded-lg px-4 py-3 text-sm font-bold ${audience === 'PJ' ? 'bg-white text-neutral-950' : 'text-white/70'}`}><BriefcaseBusiness className="mr-2 inline h-4 w-4" />Empresas</button>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {publicServices.map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-xl border border-neutral-200 bg-white p-4">
                  <Icon className="h-5 w-5 text-[#8a6e2f]" />
                  <strong className="mt-3 block">{title}</strong>
                  <p className="mt-1 text-xs leading-5 text-neutral-600">{text}</p>
                </div>
              ))}
              {publicServices.length === 0 && <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-5 text-sm font-medium text-neutral-500">Nenhum serviço publicado pelo administrador.</div>}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {packages.map((item) => (
              <article key={item.title} className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#8a6e2f]">{item.subtitle}</p>
                <h2 className="mt-3 text-2xl font-black">{item.title}</h2>
                <p className="mt-3 text-sm leading-6 text-neutral-600">{item.description}</p>
                <ul className="mt-5 space-y-2 text-sm text-neutral-700">
                  {item.services.slice(0, 3).map((service) => <li key={service.name} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8a6e2f]" />{service.name}</li>)}
                </ul>
                <button type="button" onClick={() => onSelect(item)} className="mt-6 inline-flex items-center gap-2 font-bold text-[#142030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8a6e2f]">Ver detalhes <ArrowRight className="h-4 w-4" /></button>
              </article>
            ))}
            {packages.length === 0 && <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-8 text-center text-sm font-medium text-neutral-500 md:col-span-2">Nenhum pacote publicado para este perfil.</div>}
          </div>
        </div>
      </section>
    </main>
  );
}
