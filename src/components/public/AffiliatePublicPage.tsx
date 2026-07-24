import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  BadgeDollarSign,
  Building2,
  Check,
  CheckCircle2,
  Clock3,
  Link2,
  LockKeyhole,
  Plane,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  Store,
  Tags,
  UserRoundCheck,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LogoGSA } from '../ui/LogoGSA';
import '../../affiliates.css';

interface PublicAffiliateProgram {
  code: string;
  name: string;
  description: string;
  percentage: number;
}

interface AffiliatePublicPageProps {
  onBack: () => void;
  onLogin: () => void;
  onRegister: () => void;
}

const FALLBACK_PROGRAMS: PublicAffiliateProgram[] = [
  { code: 'loja', name: 'Loja GSA', description: 'Produtos, serviços e assinaturas comercializados no marketplace GSA.', percentage: 5 },
  { code: 'viagens', name: 'GSA Viagens', description: 'Pacotes, hospedagens e experiências de viagem elegíveis ao programa.', percentage: 3 },
  { code: 'classificados', name: 'GSA Classificados', description: 'Oportunidades publicadas dentro das categorias habilitadas pela operação.', percentage: 2 },
  { code: 'servicos', name: 'Serviços GSA', description: 'Soluções digitais e serviços empresariais contratados pela plataforma.', percentage: 5 },
];

const programIcons: Record<string, typeof Store> = {
  loja: ShoppingBag,
  viagens: Plane,
  classificados: Tags,
  servicos: Building2,
  saude: Stethoscope,
  seguros: ShieldCheck,
};

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Ative o perfil',
    description: 'A ativação é vinculada à sua conta GSA e confirmada com CPF ou CNPJ e PIN de acesso.',
    icon: UserRoundCheck,
  },
  {
    number: '02',
    title: 'Gere links oficiais',
    description: 'Escolha o programa, defina o destino permitido e crie um link exclusivo dentro do portal.',
    icon: Link2,
  },
  {
    number: '03',
    title: 'Compartilhe com contexto',
    description: 'Apresente a solução ao seu público e utilize somente os links validados pelo sistema.',
    icon: Share2,
  },
  {
    number: '04',
    title: 'Acompanhe e receba',
    description: 'Cliques, conversões, carência, saldo e solicitações PIX ficam registrados no painel.',
    icon: WalletCards,
  },
] as const;

const GOVERNANCE_ITEMS = [
  'Atribuição registrada por código exclusivo',
  'Percentual e base de cálculo preservados na venda',
  'Carência e estornos tratados pela regra do programa',
  'Solicitação de saque vinculada à chave PIX cadastrada',
] as const;

const FAQ_ITEMS = [
  {
    question: 'Quem pode participar?',
    answer: 'Clientes com conta GSA ativa podem autenticar o acesso e solicitar a ativação do perfil de afiliado. A disponibilidade depende das regras vigentes do programa.',
  },
  {
    question: 'Quando a comissão fica disponível?',
    answer: 'Cada programa possui percentual, janela de atribuição e período de carência próprios. O painel informa o que está pendente, disponível, solicitado e pago.',
  },
  {
    question: 'Como funciona o pagamento?',
    answer: 'O afiliado solicita o saque pelo portal quando possui saldo disponível acima do mínimo vigente. A solicitação segue para análise e pagamento na chave PIX cadastrada.',
  },
  {
    question: 'Posso criar links para qualquer endereço?',
    answer: 'Não. O sistema valida os destinos permitidos para cada programa. Essa regra protege o rastreamento, o cliente e a integridade da comissão.',
  },
] as const;

function normalizePrograms(value: unknown): PublicAffiliateProgram[] {
  const payload = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>).programs
    : value;
  const source = Array.isArray(payload) ? payload : [];

  return source.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const code = String(row.codigo ?? row.code ?? '').trim().toLowerCase();
    const name = String(row.nome ?? row.name ?? '').trim();
    const percentage = Number(row.percentual ?? row.percentage ?? 0);
    if (!code || !name || !Number.isFinite(percentage) || percentage <= 0) return [];
    return [{
      code,
      name,
      description: String(row.descricao ?? row.description ?? 'Divulgue esta solução com seu link personalizado.'),
      percentage,
    }];
  });
}

function formatPercentage(value: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
}

export function AffiliatePublicPage({ onBack, onLogin, onRegister }: AffiliatePublicPageProps) {
  const [remotePrograms, setRemotePrograms] = useState<PublicAffiliateProgram[]>([]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Programa de Afiliados | GSA HUB';
    let active = true;

    void (async () => {
      try {
        const { data, error } = await supabase.rpc('gsa_public_affiliate_programs');
        if (!active || error) return;
        setRemotePrograms(normalizePrograms(data));
      } catch {
        // O catálogo institucional permanece disponível em contingência.
      }
    })();

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, []);

  const programs = useMemo(
    () => remotePrograms.length > 0 ? remotePrograms : FALLBACK_PROGRAMS,
    [remotePrograms],
  );

  const highestPercentage = useMemo(
    () => Math.max(...programs.map((program) => program.percentage)),
    [programs],
  );

  return (
    <div className="affiliate-page min-h-screen bg-[#f2efe7] text-[#142033] selection:bg-[#c59a4a] selection:text-[#0b1522]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b1522]/95 text-white backdrop-blur-md">
        <nav className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12" aria-label="Navegação do Programa de Afiliados">
          <div className="flex min-w-0 items-center gap-5 sm:gap-7">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-white/65 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ddc28d] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b1522]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Voltar ao site</span>
            </button>
            <span className="hidden h-7 w-px bg-white/20 sm:block" aria-hidden="true" />
            <LogoGSA size="sm" variant="light" showText className="min-w-0" />
          </div>

          <button
            type="button"
            onClick={onLogin}
            className="inline-flex items-center gap-2 border border-[#ddc28d] px-4 py-2.5 text-sm font-semibold text-[#f0ddb5] transition-colors hover:bg-[#ddc28d] hover:text-[#0b1522] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b1522] sm:px-5"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Portal do Afiliado</span>
            <span className="sm:hidden">Entrar</span>
          </button>
        </nav>
      </header>

      <main>
        <section className="relative isolate overflow-hidden bg-[#0b1522] text-white">
          <div className="affiliate-grid-bg absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="affiliate-outline-word absolute left-1/2 top-[46%] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">GSA</div>

          <div className="relative mx-auto grid min-h-[720px] max-w-[1440px] items-center gap-16 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[1.2fr_0.8fr] lg:px-12 lg:py-28">
            <div className="max-w-4xl">
              <div className="flex items-center gap-3 text-xs font-bold uppercase tracking-[0.22em] text-[#ddc28d]">
                <span className="h-px w-10 bg-[#ddc28d]" aria-hidden="true" />
                Programa de Afiliados GSA HUB
              </div>
              <h1 className="mt-8 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl lg:text-[5.5rem]">
                Indicações com regra clara, acompanhamento real e comissão registrada.
              </h1>
              <p className="mt-8 max-w-2xl text-base leading-8 text-white/68 sm:text-lg">
                Uma operação estruturada para clientes GSA que desejam recomendar soluções do ecossistema, gerar links oficiais e acompanhar cada etapa até o pagamento.
              </p>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={onRegister}
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#c59a4a] px-7 text-sm font-bold text-[#0b1522] transition-colors hover:bg-[#ddc28d] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b1522]"
                >
                  Ativar meu perfil <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <a
                  href="#como-funciona"
                  className="inline-flex min-h-14 items-center justify-center border border-white/25 px-7 text-sm font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ddc28d]"
                >
                  Conhecer a operação
                </a>
              </div>

              <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 border-t border-white/15 pt-6 text-xs font-semibold text-white/58">
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#ddc28d]" /> Ativação sem mensalidade</span>
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#ddc28d]" /> Acesso vinculado à conta GSA</span>
                <span className="inline-flex items-center gap-2"><Check className="h-4 w-4 text-[#ddc28d]" /> Pagamento por PIX</span>
              </div>
            </div>

            <aside className="affiliate-panel-shadow border border-white/15 bg-[#101d2c] p-6 sm:p-8" aria-label="Resumo do programa">
              <div className="flex items-start justify-between gap-5 border-b border-white/15 pb-6">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#ddc28d]">Operação vigente</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-[-0.025em]">Visão objetiva do programa</h2>
                </div>
                <BadgeDollarSign className="h-9 w-9 shrink-0 text-[#ddc28d]" aria-hidden="true" />
              </div>

              <dl className="grid grid-cols-2 border-b border-white/15">
                <div className="border-r border-white/15 py-6 pr-5">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Programas ativos</dt>
                  <dd className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{programs.length}</dd>
                </div>
                <div className="py-6 pl-5">
                  <dt className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Comissão máxima</dt>
                  <dd className="mt-2 text-4xl font-semibold tracking-[-0.04em]">{formatPercentage(highestPercentage)}%</dd>
                </div>
              </dl>

              <div className="space-y-0">
                {[
                  ['Rastreamento', 'Links exclusivos por programa'],
                  ['Transparência', 'Cliques, vendas e saldos no painel'],
                  ['Recebimento', 'Solicitação PIX com histórico'],
                ].map(([label, value]) => (
                  <div key={label} className="grid grid-cols-[0.85fr_1.15fr] gap-4 border-b border-white/10 py-4 last:border-b-0">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/40">{label}</span>
                    <span className="text-sm font-semibold text-white/82">{value}</span>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={onLogin}
                className="mt-6 inline-flex w-full items-center justify-between border border-[#c59a4a]/70 px-5 py-4 text-sm font-bold text-[#f0ddb5] transition-colors hover:bg-[#c59a4a] hover:text-[#0b1522]"
              >
                Já sou afiliado <ArrowRight className="h-4 w-4" />
              </button>
            </aside>
          </div>
        </section>

        <section className="border-b border-[#c9c2b6] bg-[#e8e1d5]">
          <div className="mx-auto grid max-w-[1440px] divide-y divide-[#c9c2b6] px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-12">
            {[
              { icon: ShieldCheck, title: 'Acesso protegido', text: 'Autenticação pela conta GSA antes da ativação.' },
              { icon: Clock3, title: 'Regras preservadas', text: 'Percentual, janela e carência ficam registrados.' },
              { icon: BadgeCheck, title: 'Histórico operacional', text: 'Comissões e saques permanecem disponíveis no portal.' },
            ].map(({ icon: Icon, title, text }) => (
              <article key={title} className="flex gap-4 py-7 md:px-7 first:md:pl-0 last:md:pr-0">
                <Icon className="mt-0.5 h-6 w-6 shrink-0 text-[#8d6829]" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-bold text-[#0b1522]">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-[#59616c]">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 border-b border-[#c9c2b6] bg-[#f2efe7]">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
            <div className="grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8d6829]">Como funciona</p>
                <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.045em] text-[#0b1522] sm:text-5xl">
                  Um fluxo simples para o afiliado. Uma operação controlada para a GSA.
                </h2>
                <p className="mt-6 max-w-xl text-base leading-7 text-[#5c6470]">
                  Cada etapa foi organizada para reduzir dúvidas, proteger a atribuição e permitir acompanhamento sem depender de controles paralelos.
                </p>
              </div>

              <ol className="border-t border-[#bcb4a8]">
                {PROCESS_STEPS.map(({ number, title, description, icon: Icon }) => (
                  <li key={number} className="group grid gap-4 border-b border-[#bcb4a8] py-7 sm:grid-cols-[80px_1fr_auto] sm:items-start sm:gap-7">
                    <span className="font-mono text-sm font-bold text-[#8d6829]">{number}</span>
                    <div>
                      <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#0b1522]">{title}</h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6470]">{description}</p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center border border-[#bcb4a8] text-[#8d6829] transition-colors group-hover:border-[#0b1522] group-hover:bg-[#0b1522] group-hover:text-[#ddc28d]">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section className="border-b border-[#c9c2b6] bg-white" aria-labelledby="programs-title">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8d6829]">Programas disponíveis</p>
                <h2 id="programs-title" className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-[#0b1522] sm:text-5xl">Escolha o que faz sentido para o seu público.</h2>
              </div>
              <p className="max-w-xl text-sm leading-7 text-[#5c6470]">
                Os percentuais exibidos são carregados das regras administrativas vigentes e podem variar conforme programa, categoria ou campanha.
              </p>
            </div>

            <div className="mt-12 border-t border-[#bcb4a8]">
              {programs.map((program, index) => {
                const Icon = programIcons[program.code] || Share2;
                return (
                  <article key={program.code} className="group grid gap-5 border-b border-[#bcb4a8] py-7 sm:grid-cols-[64px_1fr_auto] sm:items-center sm:gap-7">
                    <span className="flex h-14 w-14 items-center justify-center bg-[#0b1522] text-[#ddc28d]">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="font-mono text-xs font-bold text-[#9a8f7d]">{String(index + 1).padStart(2, '0')}</span>
                        <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#0b1522]">{program.name}</h3>
                      </div>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5c6470]">{program.description}</p>
                    </div>
                    <div className="sm:text-right">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#7b838d]">Comissão vigente</p>
                      <p className="mt-1 text-3xl font-semibold tracking-[-0.04em] text-[#8d6829]">até {formatPercentage(program.percentage)}%</p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="bg-[#0e1b2a] text-white">
          <div className="mx-auto grid max-w-[1440px] gap-14 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.9fr_1.1fr] lg:px-12 lg:py-28">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ddc28d]">Governança da comissão</p>
              <h2 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-5xl">Transparência não é um detalhe do programa. É parte da operação.</h2>
              <p className="mt-6 max-w-xl text-base leading-7 text-white/62">
                O afiliado acompanha o que aconteceu com cada valor, enquanto a GSA mantém critérios consistentes para atribuição, carência, estorno e pagamento.
              </p>
            </div>

            <div className="border-t border-white/20">
              {GOVERNANCE_ITEMS.map((item, index) => (
                <div key={item} className="grid grid-cols-[52px_1fr] gap-4 border-b border-white/15 py-6">
                  <span className="font-mono text-xs font-bold text-[#ddc28d]">G{index + 1}</span>
                  <p className="text-base font-semibold text-white/84">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#c9c2b6] bg-[#e8e1d5]">
          <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-20 sm:px-8 sm:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-12">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8d6829]">Perguntas frequentes</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-[#0b1522]">Antes de ativar, entenda as regras essenciais.</h2>
            </div>
            <div className="border-t border-[#bcb4a8]">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question} className="group border-b border-[#bcb4a8] py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-base font-semibold text-[#0b1522] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c59a4a]">
                    {item.question}
                    <span className="text-2xl font-light text-[#8d6829] transition-transform group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="max-w-3xl pt-4 text-sm leading-7 text-[#5c6470]">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f2efe7]">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
            <div className="affiliate-panel-shadow grid gap-10 border-t-4 border-[#c59a4a] bg-white p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center lg:p-12">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8d6829]">Próximo passo</p>
                <h2 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-[#0b1522]">Transforme boas indicações em uma relação comercial organizada.</h2>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[#5c6470]">A ativação confirma sua conta GSA, registra os termos vigentes e prepara o portal para gerar seus primeiros links.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                <button type="button" onClick={onRegister} className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#0b1522] px-7 text-sm font-bold text-white transition-colors hover:bg-[#24364b]">
                  Ativar perfil <ArrowRight className="h-4 w-4" />
                </button>
                <button type="button" onClick={onLogin} className="inline-flex min-h-14 items-center justify-center border border-[#0b1522] px-7 text-sm font-bold text-[#0b1522] transition-colors hover:bg-[#f2efe7]">
                  Acessar portal
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-[#07101c] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <LogoGSA size="sm" variant="light" showText />
          <p className="text-sm text-white/50">© {new Date().getFullYear()} GSA HUB — Programa de Afiliados.</p>
        </div>
      </footer>
    </div>
  );
}
