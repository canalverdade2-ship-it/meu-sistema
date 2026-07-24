import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  CircleCheck,
  Headphones,
  Layers3,
  Users,
} from 'lucide-react';
import type { Audience, IconItem, ServicePackage } from '../../../data/publicServiceCatalog';

interface PublicServicesPageProps {
  audience: Audience;
  setAudience: (audience: Audience) => void;
  packages: ServicePackage[];
  publicServices?: IconItem[];
  onBack: () => void;
  onSelect: (item: ServicePackage) => void;
}

const journey = [
  {
    icon: Layers3,
    number: '01',
    title: 'Escolha o perfil',
    text: 'Veja somente os pacotes organizados para a sua realidade.',
  },
  {
    icon: CheckCircle2,
    number: '02',
    title: 'Entenda o escopo',
    text: 'Abra cada pacote para conhecer os serviços e a forma de atendimento.',
  },
  {
    icon: Headphones,
    number: '03',
    title: 'Solicite atendimento',
    text: 'Continue pelo WhatsApp, e-mail ou Portal do Cliente.',
  },
];

export function PublicServicesPage({ audience, setAudience, packages, onBack, onSelect }: PublicServicesPageProps) {
  const audienceTitle = audience === 'PF' ? 'Soluções para sua vida e rotina' : 'Soluções para a operação da sua empresa';
  const audienceDescription = audience === 'PF'
    ? 'Pacotes organizados para necessidades pessoais, documentais, administrativas e de orientação.'
    : 'Pacotes para apoiar processos administrativos, obrigações, organização e crescimento do negócio.';

  return (
    <main className="min-h-screen bg-[#eee8dc] pt-[73px] text-[#17202a]">
      <section className="relative overflow-hidden border-b border-[#d8cfbf] bg-[linear-gradient(135deg,#faf7f0_0%,#f2ecdf_54%,#e8decc_100%)]">
        <div className="pointer-events-none absolute -right-40 -top-48 h-[34rem] w-[34rem] rounded-full border border-[#b8903e]/15" />
        <div className="pointer-events-none absolute right-10 top-12 h-56 w-56 rounded-full bg-[#d8bd73]/15 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#cfc5b5] bg-white/70 px-4 py-2 text-sm font-black text-[#44505b] transition hover:border-[#9f8140] hover:bg-white hover:text-[#17202a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140]"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao início
          </button>

          <div className="mt-10 grid items-end gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
            <div className="border-l-2 border-[#c7a458] pl-5 sm:pl-7">
              <p className="flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.22em] text-[#806128] sm:text-xs">
                <span className="h-px w-8 bg-[#b8903e]" />
                Serviços e assinaturas GSA
              </p>
              <h1 className="mt-5 max-w-[13ch] text-4xl font-black leading-[1.03] tracking-[-0.04em] text-[#111820] sm:text-5xl lg:text-[3.8rem]">
                Soluções organizadas para pessoas e empresas.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-[#59636d] sm:text-lg">
                Escolha o perfil, compare os pacotes e conheça com clareza o que está incluído antes de solicitar atendimento.
              </p>

              <div className="mt-8 grid max-w-2xl overflow-hidden rounded-xl border border-[#d8d0c3] bg-white/55 shadow-[0_12px_30px_rgba(43,50,56,0.06)] sm:grid-cols-3">
                {[
                  ['Catálogo real', `${packages.length} opções neste perfil`],
                  ['Escopo transparente', 'Serviços detalhados'],
                  ['Atendimento flexível', 'Três canais disponíveis'],
                ].map(([title, text], index) => (
                  <div key={title} className={`px-4 py-4 ${index > 0 ? 'border-t border-[#ddd5c8] sm:border-l sm:border-t-0' : ''}`}>
                    <strong className="block text-xs font-black text-[#17202a]">{title}</strong>
                    <span className="mt-1 block text-[11px] leading-4 text-[#69727b]">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            <aside className="overflow-hidden rounded-2xl border border-[#d8bd73]/35 bg-[linear-gradient(180deg,#142536_0%,#0b1723_100%)] text-white shadow-[inset_0_3px_0_#d8bd73,0_30px_70px_rgba(18,27,36,0.22)]">
              <div className="border-b border-white/10 px-5 py-6 sm:px-7">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d8bd73]">Para quem é o atendimento?</p>
                <h2 className="mt-3 text-2xl font-black leading-tight">Selecione seu perfil</h2>
                <p className="mt-3 text-sm leading-6 text-white/55">O catálogo será ajustado sem perder sua posição na página.</p>
              </div>

              <div className="grid gap-2 p-3 sm:grid-cols-2" role="group" aria-label="Perfil do catálogo">
                <button
                  type="button"
                  onClick={() => setAudience('PF')}
                  aria-pressed={audience === 'PF'}
                  className={`group min-h-28 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] ${
                    audience === 'PF'
                      ? 'border-[#d8bd73] bg-[#f7f2e6] text-[#17202a] shadow-lg'
                      : 'border-white/10 bg-white/[0.025] text-white hover:border-white/25 hover:bg-white/[0.05]'
                  }`}
                >
                  <Users className={`h-5 w-5 ${audience === 'PF' ? 'text-[#8a6b2f]' : 'text-[#d8bd73]'}`} />
                  <strong className="mt-4 block text-sm">Pessoa física</strong>
                  <span className={`mt-1 block text-[11px] leading-4 ${audience === 'PF' ? 'text-[#68717a]' : 'text-white/45'}`}>Necessidades pessoais e familiares.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAudience('PJ')}
                  aria-pressed={audience === 'PJ'}
                  className={`group min-h-28 rounded-xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73] ${
                    audience === 'PJ'
                      ? 'border-[#d8bd73] bg-[#f7f2e6] text-[#17202a] shadow-lg'
                      : 'border-white/10 bg-white/[0.025] text-white hover:border-white/25 hover:bg-white/[0.05]'
                  }`}
                >
                  <BriefcaseBusiness className={`h-5 w-5 ${audience === 'PJ' ? 'text-[#8a6b2f]' : 'text-[#d8bd73]'}`} />
                  <strong className="mt-4 block text-sm">Empresas</strong>
                  <span className={`mt-1 block text-[11px] leading-4 ${audience === 'PJ' ? 'text-[#68717a]' : 'text-white/45'}`}>Rotinas e demandas empresariais.</span>
                </button>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-20" aria-labelledby="service-packages-title">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 border-b border-[#d4ccbe] pb-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806128]">Catálogo selecionado</p>
              <h2 id="service-packages-title" className="mt-3 text-3xl font-black tracking-[-0.035em] text-[#111820] sm:text-4xl">
                {audienceTitle}
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-[#626b74] sm:text-base">{audienceDescription}</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-black text-[#6d5727]">
              <CircleCheck className="h-4 w-4" />
              {packages.length} {packages.length === 1 ? 'pacote disponível' : 'pacotes disponíveis'}
            </div>
          </div>

          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {packages.map((item, index) => (
              <button
                key={item.id || item.title}
                type="button"
                onClick={() => onSelect(item)}
                className="group relative flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-[#d6cfc3] bg-[#faf8f3] p-6 text-left shadow-[0_12px_34px_rgba(24,32,40,0.055)] transition duration-200 hover:-translate-y-1 hover:border-[#b99a4f] hover:bg-white hover:shadow-[0_22px_48px_rgba(24,32,40,0.11)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f8140] focus-visible:ring-offset-2 focus-visible:ring-offset-[#eee8dc]"
              >
                <span className="absolute inset-x-0 top-0 h-1 bg-[linear-gradient(90deg,#8a6b2f,#d8bd73,transparent)] opacity-65 transition group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-4">
                  <span className="text-[10px] font-black tracking-[0.2em] text-[#9b7c33]">{String(index + 1).padStart(2, '0')}</span>
                  <span className="rounded-full border border-[#d8bd73]/45 bg-[#f0e7cf] px-3 py-1 text-[9px] font-black uppercase tracking-[0.13em] text-[#6d5727]">
                    {audience === 'PF' ? 'Para você' : 'Para empresas'}
                  </span>
                </div>

                <div className="mt-7">
                  <p className="text-[10px] font-black uppercase tracking-[0.17em] text-[#8a6b2f]">{item.subtitle}</p>
                  <h3 className="mt-3 text-2xl font-black leading-tight tracking-[-0.025em] text-[#111820]">{item.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-[#616a73]">{item.description}</p>
                </div>

                <ul className="mt-6 space-y-3" aria-label={`Principais serviços do pacote ${item.title}`}>
                  {item.services.slice(0, 3).map((service) => (
                    <li key={service.name} className="flex items-start gap-3 text-xs font-semibold leading-5 text-[#39444e]">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#172331] text-[#d8bd73]">
                        <Check className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {service.name}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-center justify-between gap-4 border-t border-[#ddd6ca] pt-5">
                  <span className="text-[11px] font-bold text-[#7a838b]">
                    {item.services.length} {item.services.length === 1 ? 'serviço incluído' : 'serviços incluídos'}
                  </span>
                  <span className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.1em] text-[#765b25]">
                    Ver pacote
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </button>
            ))}

            {packages.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#c8bda9] bg-white/55 p-10 text-center md:col-span-2 xl:col-span-3">
                <BriefcaseBusiness className="mx-auto h-7 w-7 text-[#9b7c33]" />
                <h3 className="mt-4 text-lg font-black text-[#17202a]">Nenhum pacote publicado para este perfil</h3>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#68717a]">O catálogo será atualizado assim que novas opções forem disponibilizadas.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="border-y border-[#d6cfc3] bg-[#f8f5ee] py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-px overflow-hidden rounded-2xl border border-[#d6cfc3] bg-[#d6cfc3] md:grid-cols-3">
            {journey.map(({ icon: Icon, number, title, text }) => (
              <article key={number} className="bg-white p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#142231] text-[#d8bd73]"><Icon className="h-5 w-5" /></span>
                  <span className="text-[10px] font-black tracking-[0.18em] text-[#9b7c33]">{number}</span>
                </div>
                <h2 className="mt-5 text-lg font-black text-[#111820]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[#626b74]">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
