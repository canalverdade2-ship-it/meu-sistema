import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  Link2,
  Plane,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  Store,
  Tags,
  WalletCards,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { LogoGSA } from '../ui/LogoGSA';

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
  { code: 'loja', name: 'Loja GSA', description: 'Produtos e ofertas disponíveis no marketplace GSA.', percentage: 5 },
  { code: 'viagens', name: 'GSA Viagens', description: 'Pacotes e experiências de viagem para diferentes perfis.', percentage: 3 },
  { code: 'classificados', name: 'GSA Classificados', description: 'Imóveis, veículos e oportunidades anunciadas no hub.', percentage: 2 },
  { code: 'servicos', name: 'Serviços GSA', description: 'Serviços e assinaturas contratados dentro da plataforma.', percentage: 5 },
];

const programIcons: Record<string, typeof Store> = {
  loja: ShoppingBag,
  viagens: Plane,
  classificados: Tags,
  servicos: Store,
  saude: Stethoscope,
  seguros: ShieldCheck,
};

function normalizePrograms(value: unknown): PublicAffiliateProgram[] {
  const source = Array.isArray(value) ? value : [];
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
      description: String(row.descricao ?? row.description ?? 'Divulgue este serviço com seu link personalizado.'),
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
    document.title = 'Programa de Afiliados | GSA';
    let active = true;

    async function fetchPrograms() {
      try {
        const { data, error } = await supabase.rpc('gsa_public_affiliate_programs');
        if (!active || error) return;
        setRemotePrograms(normalizePrograms(data));
      } catch {
        // Mantém os programas de fallback quando a RPC pública estiver indisponível.
      }
    }

    void fetchPrograms();

    return () => {
      active = false;
      document.title = previousTitle;
    };
  }, []);

  const programs = useMemo(() => remotePrograms.length > 0 ? remotePrograms : FALLBACK_PROGRAMS, [remotePrograms]);

  return (
    <div className="min-h-screen bg-[#f5f2eb] text-neutral-950">
      <header className="border-b border-white/10 bg-[#080c12] text-white">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8" aria-label="Navegação do programa de afiliados">
          <button type="button" onClick={onBack} aria-label="Voltar para a página inicial" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">
            <LogoGSA size="md" variant="light" />
          </button>
          <button type="button" onClick={onLogin} className="rounded-xl border border-[#d8bd73]/50 px-4 py-2 text-sm font-bold text-[#e6ce8b] transition hover:bg-[#d8bd73]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">
            LOGIN AFILIADO
          </button>
        </nav>
      </header>

      <main>
        <section className="relative overflow-hidden bg-[#080c12] px-4 pb-20 pt-16 text-white sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
          <div className="pointer-events-none absolute -right-40 top-0 h-96 w-96 rounded-full bg-[#d8bd73]/10 blur-3xl" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#d8bd73]/30 bg-[#d8bd73]/10 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#e6ce8b]">
                <BadgeDollarSign className="h-4 w-4" /> Programa de Afiliados GSA
              </div>
              <h1 className="mt-7 max-w-4xl font-serif text-4xl leading-tight sm:text-5xl lg:text-6xl">
                Indique soluções GSA e ganhe por vendas realizadas pelo seu link.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
                Qualquer pessoa com uma conta GSA pode participar. Escolha o que combina com seu público, compartilhe seu link exclusivo e acompanhe suas comissões em um só lugar.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onRegister} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#d8bd73] px-6 py-3 text-sm font-black text-[#111318] transition hover:bg-[#e6ce8b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#080c12]">
                  Quero ser afiliado <ArrowRight className="h-4 w-4" />
                </button>
                <a href="#como-funciona" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d8bd73]">
                  Entenda como funciona
                </a>
              </div>
              <p className="mt-4 text-xs leading-5 text-white/45">Participação sujeita aos termos do programa. Percentuais e prazos são exibidos antes da adesão.</p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-2xl backdrop-blur sm:p-7">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/45">Seu painel</p>
                  <p className="mt-1 text-xl font-bold">Divulgue. Venda. Receba.</p>
                </div>
                <WalletCards className="h-9 w-9 text-[#d8bd73]" aria-hidden="true" />
              </div>
              <div className="mt-5 grid gap-3">
                {['Links separados por serviço', 'Acompanhamento de vendas e comissões', 'Solicitação de saque pelo portal'].map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl bg-black/20 p-4 text-sm font-semibold text-white/80">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#d8bd73]" aria-hidden="true" /> {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-6 px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="how-title">
          <div className="mx-auto max-w-7xl">
            <div className="max-w-2xl">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-[#947624]">Simples para começar</p>
              <h2 id="how-title" className="mt-3 font-serif text-3xl sm:text-4xl">Três passos para transformar indicações em comissão</h2>
            </div>
            <ol className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                { icon: CheckCircle2, title: 'Ative seu perfil', text: 'Entre ou crie sua conta GSA, aceite os termos e conclua seu cadastro de afiliado.' },
                { icon: Link2, title: 'Compartilhe seu link', text: 'Use um link exclusivo para cada solução e divulgue nos seus canais e contatos.' },
                { icon: BadgeDollarSign, title: 'Acompanhe e receba', text: 'Veja as vendas atribuídas, o prazo de liberação e o saldo disponível para saque.' },
              ].map((step, index) => (
                <li key={step.title} className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm sm:p-7">
                  <div className="flex items-center justify-between">
                    <step.icon className="h-8 w-8 text-[#947624]" aria-hidden="true" />
                    <span className="text-4xl font-black text-neutral-100" aria-hidden="true">0{index + 1}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-black">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-neutral-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8" aria-labelledby="programs-title">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-[#947624]">Oportunidades</p>
                <h2 id="programs-title" className="mt-3 font-serif text-3xl sm:text-4xl">Escolha o que quer divulgar</h2>
              </div>
              <p className="max-w-lg text-sm leading-6 text-neutral-500">Os percentuais abaixo são os vigentes no programa e podem variar conforme a categoria. A regra aplicável fica registrada na venda.</p>
            </div>
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((program) => {
                const Icon = programIcons[program.code] || Share2;
                return (
                  <article key={program.code} className="rounded-3xl border border-neutral-200 bg-[#faf9f6] p-6 transition hover:-translate-y-1 hover:border-[#d8bd73] hover:shadow-lg">
                    <div className="flex items-start justify-between gap-4">
                      <span className="rounded-2xl bg-[#11151b] p-3 text-[#d8bd73]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-black text-emerald-700">até {formatPercentage(program.percentage)}%</span>
                    </div>
                    <h3 className="mt-6 text-xl font-black">{program.name}</h3>
                    <p className="mt-3 text-sm leading-6 text-neutral-600">{program.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto flex max-w-5xl flex-col items-center rounded-[2rem] bg-[#11151b] px-6 py-12 text-center text-white shadow-xl sm:px-10 sm:py-16">
            <ShieldCheck className="h-10 w-10 text-[#d8bd73]" aria-hidden="true" />
            <h2 className="mt-5 max-w-2xl font-serif text-3xl sm:text-4xl">Seu próximo compartilhamento pode gerar uma nova renda.</h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-white/65">Crie sua conta gratuitamente, ative o perfil de afiliado e comece a divulgar as soluções do ecossistema GSA.</p>
            <button type="button" onClick={onRegister} className="mt-8 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#d8bd73] px-7 py-3 text-sm font-black text-[#111318] transition hover:bg-[#e6ce8b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
              Criar conta e participar <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-neutral-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <LogoGSA size="md" variant="light" />
          <p className="text-xs text-white/45">Programa de Afiliados GSA · Acompanhe regras e valores no seu painel.</p>
        </div>
      </footer>
    </div>
  );
}
