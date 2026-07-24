import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
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
  X,
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

const HERO_TRUST_ITEMS = [
  'Ativação sem mensalidade',
  'Conta vinculada ao ecossistema GSA',
  'Links oficiais e rastreáveis',
  'Recebimento por PIX',
] as const;

const PARTICIPATION_STEPS = [
  'Faça login com sua conta GSA',
  'Ative seu perfil de afiliado',
  'Cadastre ou confirme sua chave PIX',
  'Escolha um programa e gere seu link oficial',
  'Acompanhe acessos, conversões e comissões',
  'Solicite o saque quando houver saldo disponível',
] as const;

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Ative o perfil',
    description: 'A ativação é vinculada à sua conta GSA e confirmada com CPF ou CNPJ e PIN de acesso.',
    icon: UserRoundCheck,
    modalLead: 'O perfil de afiliado funciona como uma extensão da sua conta GSA. Por isso, a ativação aproveita o cadastro que você já possui e mantém seus dados, acessos e histórico dentro do mesmo ambiente.',
    details: [
      'Clique em “Ativar meu perfil” e escolha a opção de ativação do Programa de Afiliados.',
      'Informe o mesmo CPF ou CNPJ e o PIN utilizados na sua conta GSA para confirmar sua identidade.',
      'Confira o nome de exibição e cadastre o tipo e a chave PIX que serão utilizados nos pagamentos.',
      'Leia e aceite os termos vigentes. Após a confirmação, o Portal do Afiliado será liberado para sua conta.',
    ],
    note: 'Não é criada uma conta paralela. O acesso permanece vinculado ao seu cadastro principal na GSA.',
  },
  {
    number: '02',
    title: 'Gere links oficiais',
    description: 'Escolha o programa, defina o destino permitido e crie um link exclusivo dentro do portal.',
    icon: Link2,
    modalLead: 'O link oficial identifica que uma visita ou contratação veio da sua indicação. Ele é criado dentro do portal e recebe o código necessário para que o sistema faça o rastreamento corretamente.',
    details: [
      'Acesse a área de links no Portal do Afiliado e selecione o programa que deseja divulgar.',
      'Informe ou escolha uma página de destino permitida para aquele programa.',
      'O sistema valida o endereço e gera uma URL exclusiva vinculada ao seu perfil.',
      'Copie o link gerado pelo portal e utilize exatamente essa versão em suas divulgações.',
    ],
    note: 'Evite editar o endereço, retirar parâmetros ou substituir o link oficial por uma versão que possa comprometer o rastreamento.',
  },
  {
    number: '03',
    title: 'Compartilhe com contexto',
    description: 'Apresente a solução ao seu público e utilize somente os links validados pelo sistema.',
    icon: Share2,
    modalLead: 'Compartilhar com contexto significa não enviar apenas um endereço. A recomendação deve explicar, de forma clara e verdadeira, qual solução está sendo apresentada e por que ela pode ser útil para aquele público.',
    details: [
      'Explique brevemente o produto, serviço ou oportunidade antes de apresentar o link.',
      'Direcione a divulgação para pessoas ou empresas que realmente possam ter interesse naquela solução.',
      'Use canais adequados, como atendimento, redes sociais, conteúdo próprio ou conversas autorizadas.',
      'Mantenha informações verdadeiras e evite mensagens em massa, promessas de resultado ou divulgação enganosa.',
    ],
    note: 'O contexto melhora a experiência de quem recebe a indicação e fortalece a credibilidade do afiliado e da GSA.',
  },
  {
    number: '04',
    title: 'Acompanhe e receba',
    description: 'Cliques, conversões, carência, saldo e solicitações PIX ficam registrados no painel.',
    icon: WalletCards,
    modalLead: 'Depois que o link começa a ser utilizado, o Portal do Afiliado centraliza o acompanhamento da operação, desde os acessos registrados até a disponibilidade da comissão e o histórico de pagamento.',
    details: [
      'Consulte no painel os links ativos, acessos, conversões e comissões relacionadas ao seu perfil.',
      'A comissão permanece pendente enquanto a contratação é confirmada e durante a carência definida pelo programa.',
      'Quando o valor se torna disponível e atende ao mínimo vigente, você pode solicitar o saque pelo portal.',
      'A solicitação é vinculada à chave PIX cadastrada, e o andamento permanece registrado no histórico financeiro.',
    ],
    note: 'Cancelamentos, estornos, carências e liberações seguem as regras específicas do programa em que a indicação foi registrada.',
  },
] as const;

type ProcessStep = (typeof PROCESS_STEPS)[number];

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

function ProcessStepModal({ step, onClose }: { step: ProcessStep; onClose: () => void }) {
  const Icon = step.icon;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-[#07101c]/78 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={`affiliate-step-title-${step.number}`}
        aria-describedby={`affiliate-step-description-${step.number}`}
        className="affiliate-panel-shadow max-h-[92vh] w-full overflow-y-auto border-t-4 border-[#c59a4a] bg-[#f7f4ed] text-[#142033] sm:max-w-3xl sm:border sm:border-t-4 sm:border-[#c9c2b6] sm:border-t-[#c59a4a]"
      >
        <header className="flex items-start justify-between gap-6 border-b border-[#c9c2b6] bg-white px-5 py-5 sm:px-8 sm:py-6">
          <div className="flex min-w-0 items-start gap-4 sm:gap-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center bg-[#0b1522] text-[#ddc28d] sm:h-14 sm:w-14">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.16em] text-[#8d6829]">Etapa {step.number}</p>
              <h2 id={`affiliate-step-title-${step.number}`} className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-[#0b1522] sm:text-3xl">
                {step.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Fechar explicação"
            className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#bcb4a8] text-[#0b1522] transition-colors hover:border-[#0b1522] hover:bg-[#0b1522] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c59a4a]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="px-5 py-7 sm:px-8 sm:py-8">
          <p id={`affiliate-step-description-${step.number}`} className="text-base leading-8 text-[#4f5967]">
            {step.modalLead}
          </p>

          <ol className="mt-7 border-t border-[#bcb4a8]">
            {step.details.map((detail, index) => (
              <li key={detail} className="grid grid-cols-[38px_1fr] gap-4 border-b border-[#d3ccc0] py-5 sm:grid-cols-[48px_1fr]">
                <span className="flex h-8 w-8 items-center justify-center bg-[#0b1522] font-mono text-xs font-bold text-[#ddc28d]">
                  {index + 1}
                </span>
                <p className="pt-0.5 text-sm leading-7 text-[#4f5967]">{detail}</p>
              </li>
            ))}
          </ol>

          <div className="mt-7 flex gap-4 border-l-4 border-[#c59a4a] bg-white p-5">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#8d6829]" aria-hidden="true" />
            <p className="text-sm font-semibold leading-6 text-[#273548]">{step.note}</p>
          </div>

          <div className="mt-7 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-12 items-center justify-center bg-[#0b1522] px-7 text-sm font-bold text-white transition-colors hover:bg-[#24364b] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c59a4a] focus-visible:ring-offset-2"
            >
              Entendi
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export function AffiliatePublicPage({ onBack, onLogin, onRegister }: AffiliatePublicPageProps) {
  const [remotePrograms, setRemotePrograms] = useState<PublicAffiliateProgram[]>([]);
  const [activeProcessStep, setActiveProcessStep] = useState<ProcessStep | null>(null);

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
        <section className="border-b border-white/10 bg-[#0b1522] text-white" aria-labelledby="affiliate-hero-title">
          <div className="mx-auto grid max-w-[1440px] gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-20 lg:px-12 lg:py-24 xl:gap-24">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em] text-[#ddc28d] sm:text-xs">
                <span className="h-px w-8 bg-[#c59a4a]" aria-hidden="true" />
                Programa de Afiliados GSA HUB
              </div>

              <h1 id="affiliate-hero-title" className="mt-7 text-4xl font-semibold leading-[1.06] tracking-[-0.04em] text-white sm:text-5xl lg:text-[4rem]">
                Ative seu perfil, gere links oficiais e acompanhe suas comissões em um portal próprio.
              </h1>

              <p className="mt-7 max-w-2xl text-base leading-8 text-[#c8d0da] sm:text-lg">
                Uma operação estruturada para clientes GSA que desejam divulgar produtos, serviços e soluções do ecossistema com rastreamento, acompanhamento de resultados e solicitação de recebimento por PIX.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={onRegister}
                  className="inline-flex min-h-14 items-center justify-center gap-3 bg-[#c59a4a] px-7 text-sm font-bold text-[#0b1522] transition-colors hover:bg-[#ddc28d] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b1522]"
                >
                  Solicitar ativação <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onLogin}
                  className="inline-flex min-h-14 items-center justify-center border border-white/45 px-7 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ddc28d] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0b1522]"
                >
                  Acessar portal
                </button>
                <a
                  href="#como-funciona"
                  onClick={(event) => {
                    event.preventDefault();
                    document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className="inline-flex min-h-14 items-center justify-center gap-2 px-2 text-sm font-semibold text-[#e4cf9e] underline decoration-[#c59a4a]/60 underline-offset-4 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ddc28d]"
                >
                  Entender como funciona <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </a>
              </div>

              <ul className="mt-10 grid gap-x-8 gap-y-4 border-t border-white/15 pt-7 text-sm font-semibold text-[#d6dce3] sm:grid-cols-2" aria-label="Condições principais do programa">
                {HERO_TRUST_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border border-[#c59a4a] text-[#ddc28d]">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <aside className="border border-[#c9c2b6] bg-[#f4f0e8] text-[#142033]" aria-labelledby="participation-title">
              <div className="border-b border-[#c9c2b6] px-6 py-6 sm:px-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#8d6829]">Guia de participação</p>
                <h2 id="participation-title" className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-[#0b1522]">Como participar</h2>
                <p className="mt-4 text-sm leading-7 text-[#56606d]">
                  O acesso é vinculado à conta GSA e todo o acompanhamento é realizado dentro do Portal do Afiliado.
                </p>
              </div>

              <ol className="px-6 sm:px-8">
                {PARTICIPATION_STEPS.map((step, index) => (
                  <li key={step} className="grid grid-cols-[36px_1fr] gap-4 border-b border-[#d1c9bc] py-4 last:border-b-0">
                    <span className="font-mono text-xs font-bold text-[#8d6829]">{String(index + 1).padStart(2, '0')}</span>
                    <p className="text-sm font-semibold leading-6 text-[#273548]">{step}</p>
                  </li>
                ))}
              </ol>

              <div className="flex gap-4 border-t border-[#c9c2b6] bg-white px-6 py-5 sm:px-8">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#8d6829]" aria-hidden="true" />
                <p className="text-sm leading-6 text-[#56606d]">
                  O portal mantém o histórico de links, cliques, conversões, saldos e solicitações de pagamento.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="border-b border-[#c9c2b6] bg-[#e9e4da]" aria-label="Garantias operacionais do Programa de Afiliados">
          <dl className="mx-auto grid max-w-[1440px] divide-y divide-[#c9c2b6] px-5 sm:px-8 md:grid-cols-3 md:divide-x md:divide-y-0 lg:px-12">
            {[
              { icon: ShieldCheck, title: 'Acesso protegido', text: 'Autenticação pela conta GSA antes da ativação.' },
              { icon: Clock3, title: 'Regras registradas', text: 'Percentual, janela e carência permanecem vinculados à operação.' },
              { icon: BadgeCheck, title: 'Histórico operacional', text: 'Links, comissões e saques ficam disponíveis no portal.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-4 py-6 md:px-7 first:md:pl-0 last:md:pr-0">
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-[#8d6829]" aria-hidden="true" />
                <div>
                  <dt className="text-sm font-bold text-[#0b1522]">{title}</dt>
                  <dd className="mt-1 text-sm leading-6 text-[#59616c]">{text}</dd>
                </div>
              </div>
            ))}
          </dl>
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
                {PROCESS_STEPS.map((step) => {
                  const { number, title, description, icon: Icon } = step;
                  return (
                    <li key={number} className="border-b border-[#bcb4a8]">
                      <button
                        type="button"
                        onClick={() => setActiveProcessStep(step)}
                        aria-label={`Ver explicação da etapa ${number}: ${title}`}
                        className="group grid w-full gap-4 py-7 text-left transition-colors hover:bg-white/55 focus:outline-none focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#c59a4a] sm:grid-cols-[80px_1fr_auto] sm:items-start sm:gap-7 sm:px-4"
                      >
                        <span className="font-mono text-sm font-bold text-[#8d6829]">{number}</span>
                        <div>
                          <h3 className="text-xl font-semibold tracking-[-0.02em] text-[#0b1522]">{title}</h3>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#5c6470]">{description}</p>
                          <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-[#8d6829]">
                            Clique para entender <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                          </span>
                        </div>
                        <span className="flex h-11 w-11 items-center justify-center border border-[#bcb4a8] text-[#8d6829] transition-colors group-hover:border-[#0b1522] group-hover:bg-[#0b1522] group-hover:text-[#ddc28d]">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        </section>

        <section className="border-b border-[#c9c2b6] bg-white" aria-labelledby="programs-title">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8d6829]">Programas disponíveis</p>
              <h2 id="programs-title" className="mt-5 text-4xl font-semibold tracking-[-0.045em] text-[#0b1522] sm:text-5xl">Escolha o que faz sentido para o seu público.</h2>
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

      {activeProcessStep && (
        <ProcessStepModal step={activeProcessStep} onClose={() => setActiveProcessStep(null)} />
      )}
    </div>
  );
}
