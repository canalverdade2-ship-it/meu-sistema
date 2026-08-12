import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Crown, 
  Star, 
  ShieldCheck, 
  Zap, 
  ArrowLeft, 
  Sparkles, 
  Trophy, 
  Gift, 
  Check, 
  ArrowRight,
  Calculator,
  UserPlus,
  LogIn,
  HelpCircle,
  ChevronDown
} from 'lucide-react';
import { VIP_LEVELS } from '../../constants';
import { routes } from '../../routing/routeCatalog';
import { navigate } from '../../routing/navigationService';

interface PublicVIPPresentationPageProps {
  onBack?: () => void;
  clientId?: string;
}

export function PublicVIPPresentationPage({ onBack, clientId }: PublicVIPPresentationPageProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>('ouro');
  const [simulatedSpend, setSimulatedSpend] = useState<number>(1000);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleRegister = () => {
    navigate(`${routes.login.personal()}?mode=register`);
  };

  const handleLogin = () => {
    navigate(routes.login.personal());
  };

  const handleGoToMemberArea = () => {
    navigate(routes.client.loyalty.vip());
  };

  const handleBackToStore = () => {
    if (onBack) {
      onBack();
    } else {
      navigate(routes.marketplace.root());
    }
  };

  const currentLevelObj = VIP_LEVELS.find(l => l.id === selectedLevel) || VIP_LEVELS[3];

  // Cálculo simulado
  const pointsPerMonth = Math.round(simulatedSpend * currentLevelObj.multiplier);
  const yearlyPoints = pointsPerMonth * 12;
  const yearlyCashbackValue = (yearlyPoints / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const faqs = [
    {
      q: 'O cadastro no Programa VIP GSA é gratuito?',
      a: 'Sim! A adesão ao nível Básico é 100% gratuita no momento em que você cria sua conta de cliente GSA.'
    },
    {
      q: 'Como funcionam os pontos de fidelidade?',
      a: 'A cada compra de produtos na Loja GSA, contratação de serviços ou indicação de amigos, você acumula pontos na sua conta. Quanto maior seu nível VIP, mais pontos você ganha por cada R$ 1,00 gasto (até 5x mais).'
    },
    {
      q: 'Posso resgatar pontos por dinheiro via PIX?',
      a: 'Sim! Você pode converter seus pontos em saldo na sua carteira digital e solicitar o saque via PIX direto para sua conta bancária, ou utilizá-los para obter descontos em novas compras.'
    },
    {
      q: 'Como faço para subir de nível VIP?',
      a: 'Seu nível é atualizado automaticamente conforme o acúmulo de pontos na plataforma. Você também tem a opção de adquirir pacotes de nível VIP direto pelo painel de fidelidade usando seus pontos acumulados.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0d1527] text-white selection:bg-amber-500 selection:text-black">
      {/* Top Header / Bar */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d1527]/90 backdrop-blur-md px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <button
            onClick={handleBackToStore}
            className="flex items-center gap-2 text-sm font-bold text-white/70 transition-colors hover:text-white"
          >
            <ArrowLeft size={18} />
            <span>Voltar ao Marketplace</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-slate-950 shadow-md">
              <Crown size={20} className="fill-slate-950" />
            </div>
            <span className="text-lg font-black tracking-tight text-white">GSA <span className="text-amber-400">VIP</span></span>
          </div>

          <div className="flex items-center gap-3">
            {clientId ? (
              <button
                onClick={handleGoToMemberArea}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg transition-transform hover:scale-105 active:scale-95"
              >
                <Trophy size={16} />
                <span>Meu Painel VIP</span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="hidden sm:flex items-center gap-1.5 rounded-xl border border-white/20 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-white/10"
                >
                  <LogIn size={15} />
                  <span>Entrar</span>
                </button>
                <button
                  onClick={handleRegister}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-950 shadow-lg transition-transform hover:scale-105 active:scale-95"
                >
                  <UserPlus size={16} />
                  <span>Cadastre-se</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-20 sm:pb-28">
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/15 blur-[120px] pointer-events-none"></div>
        <div className="absolute top-10 right-10 w-96 h-96 rounded-full bg-indigo-500/10 blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-1.5 backdrop-blur-md"
          >
            <Sparkles size={16} className="text-amber-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-amber-300">
              Programa de Fidelidade Exclusivo GSA HUB
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-3xl font-black leading-tight sm:text-5xl md:text-6xl tracking-tight"
          >
            Economize até <span className="bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">30% Adicional</span> e Acumule Pontos em Cada Compra
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg"
          >
            Seja um membro VIP GSA e tenha acesso a descontos exclusivos, atendimento prioritário, multiplicadores de pontos de até 5x e resgate de saldo via PIX.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <button
              onClick={handleRegister}
              className="w-full sm:w-auto flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 px-8 py-4 text-base font-black text-slate-950 shadow-xl shadow-amber-500/20 transition-all hover:scale-105 hover:shadow-amber-500/40 active:scale-95"
            >
              <span>Cadastrar-se Gratuitamente</span>
              <ArrowRight size={20} />
            </button>
            <button
              onClick={handleLogin}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/5 px-8 py-4 text-base font-bold text-white backdrop-blur-md transition-all hover:bg-white/10 hover:border-white/40"
            >
              <span>Já Tenho Conta (Entrar)</span>
            </button>
          </motion.div>

          {/* Destaques Rápidos */}
          <div className="mt-14 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
                <Gift size={20} />
              </div>
              <p className="text-xs text-slate-400 font-medium">Cashback & Pontos</p>
              <p className="text-sm font-bold text-white mt-0.5">Até 5x por R$ gasto</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left">
              <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                <ShieldCheck size={20} />
              </div>
              <p className="text-xs text-slate-400 font-medium">Desconto Direto</p>
              <p className="text-sm font-bold text-white mt-0.5">Até 30% em Membros</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left">
              <div className="h-9 w-9 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2">
                <Zap size={20} />
              </div>
              <p className="text-xs text-slate-400 font-medium">Resgate via PIX</p>
              <p className="text-sm font-bold text-white mt-0.5">Direto na sua conta</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md text-left">
              <div className="h-9 w-9 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400 mb-2">
                <Trophy size={20} />
              </div>
              <p className="text-xs text-slate-400 font-medium">Atendimento</p>
              <p className="text-sm font-bold text-white mt-0.5">Prioritário & VIP</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tabela de Níveis VIP */}
      <section className="relative border-t border-white/10 bg-slate-950/60 py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-2xl sm:text-4xl font-black text-white">Níveis do Programa VIP</h2>
            <p className="mt-3 text-slate-400 text-sm sm:text-base">
              Conheça as vantagens exclusivas e os multiplicadores de pontos para cada nível do ecossistema GSA.
            </p>
          </div>

          {/* Seletores de Nível (Tabs) */}
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {VIP_LEVELS.map((level) => (
              <button
                key={level.id}
                onClick={() => setSelectedLevel(level.id)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all ${
                  selectedLevel === level.id
                    ? 'bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 scale-105'
                    : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Crown size={14} />
                <span>{level.name}</span>
              </button>
            ))}
          </div>

          {/* Card Detalhado do Nível Selecionado */}
          <div className="mt-8 mx-auto max-w-4xl rounded-3xl border border-white/15 bg-gradient-to-b from-white/10 to-white/5 p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/10">
              <div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-amber-300">
                    Nível {currentLevelObj.name}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    {currentLevelObj.minPoints} a {currentLevelObj.maxPoints} Pontos
                  </span>
                </div>
                <h3 className="text-3xl font-black text-white mt-2">{currentLevelObj.name.toUpperCase()}</h3>
              </div>

              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Multiplicador de Pontos</p>
                  <p className="text-2xl font-black text-amber-400">{currentLevelObj.multiplier}x Pontos</p>
                </div>
                <div className="h-10 w-px bg-white/10"></div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Taxa de Saque</p>
                  <p className="text-2xl font-black text-emerald-400">{currentLevelObj.feePercentage}%</p>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-4 flex items-center gap-2">
                  <Check size={16} /> Benefícios Incluídos
                </h4>
                <ul className="space-y-3">
                  {currentLevelObj.benefits.map((b, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 text-sm text-slate-200">
                      <div className="mt-0.5 rounded-full bg-emerald-500/20 p-1 text-emerald-400 shrink-0">
                        <Check size={12} />
                      </div>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h4 className="text-xs font-black uppercase tracking-widest text-amber-400 mb-4 flex items-center gap-2">
                  <Sparkles size={16} /> Vantagens Especiais
                </h4>
                <ul className="space-y-3">
                  {currentLevelObj.exclusiveBenefits.length > 0 ? (
                    currentLevelObj.exclusiveBenefits.map((eb, idx) => (
                      <li key={idx} className="flex items-start gap-2.5 text-sm text-amber-200">
                        <div className="mt-0.5 rounded-full bg-amber-500/20 p-1 text-amber-400 shrink-0">
                          <Star size={12} />
                        </div>
                        <span>{eb}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-sm text-slate-400">Cadastre-se para começar a acumular pontos neste nível.</li>
                  )}
                </ul>
              </div>
            </div>

            <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-slate-400 text-center sm:text-left">
                Acumule pontos automaticamente em todas as suas movimentações na plataforma.
              </p>
              <button
                onClick={handleRegister}
                className="w-full sm:w-auto rounded-xl bg-amber-400 px-6 py-3 text-xs font-black uppercase tracking-wider text-slate-950 transition-all hover:bg-amber-300 shadow-lg"
              >
                Quero me Cadastrar no Nível {currentLevelObj.name}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Calculadora Simulação de Economia */}
      <section className="py-16 sm:py-24 border-t border-white/10 bg-gradient-to-b from-[#0d1527] to-slate-950">
        <div className="mx-auto max-w-5xl px-4 sm:px-6">
          <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 sm:p-10 backdrop-blur-md">
            <div className="flex items-center gap-3 text-amber-400 mb-2">
              <Calculator size={24} />
              <span className="text-xs font-black uppercase tracking-widest">Simulador de Economia & Pontos</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-white">Quanto Você Pode Ganhar?</h3>
            <p className="mt-2 text-sm text-slate-300">
              Ajuste o valor mensal estimado de compras para simular seu acúmulo de pontos e cashback anual.
            </p>

            <div className="mt-8 space-y-6">
              <div>
                <div className="flex justify-between text-sm font-bold text-white mb-2">
                  <span>Gasto Mensal Estimado:</span>
                  <span className="text-amber-400 font-mono text-lg">
                    {simulatedSpend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={simulatedSpend}
                  onChange={(e) => setSimulatedSpend(Number(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-2 bg-white/10 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pontos por Mês</p>
                  <p className="text-2xl font-black text-white mt-1">{pointsPerMonth} <span className="text-xs text-amber-400">pts</span></p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pontos em 1 Ano</p>
                  <p className="text-2xl font-black text-amber-400 mt-1">{yearlyPoints} <span className="text-xs text-amber-300">pts</span></p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cashback Estimado Anual</p>
                  <p className="text-2xl font-black text-emerald-400 mt-1">{yearlyCashbackValue}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 sm:py-24 border-t border-white/10 bg-[#0d1527]">
        <div className="mx-auto max-w-4xl px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-black text-white">Dúvidas Frequentes</h2>
            <p className="mt-2 text-sm text-slate-400">Tudo o que você precisa saber sobre o Programa VIP GSA HUB.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full flex items-center justify-between p-5 text-left font-bold text-white hover:bg-white/5 transition-colors"
                >
                  <span className="flex items-center gap-3 text-sm sm:text-base">
                    <HelpCircle size={18} className="text-amber-400 shrink-0" />
                    {faq.q}
                  </span>
                  <ChevronDown size={18} className={`transition-transform text-slate-400 ${openFaq === index ? 'rotate-180 text-amber-400' : ''}`} />
                </button>
                {openFaq === index && (
                  <div className="p-5 pt-0 text-sm text-slate-300 border-t border-white/5 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="relative overflow-hidden border-t border-amber-500/20 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 py-16 text-slate-950">
        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6">
          <Crown size={48} className="mx-auto text-slate-950 mb-4" />
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight">Pronto para ter Acesso VIP Exclusivo?</h2>
          <p className="mt-4 text-base sm:text-lg font-medium text-slate-900 max-w-2xl mx-auto">
            Crie sua conta em menos de 1 minuto, economize nas suas compras e ganhe pontos em todo o ecossistema GSA HUB.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={handleRegister}
              className="w-full sm:w-auto rounded-2xl bg-slate-950 px-8 py-4 text-base font-black text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
            >
              Criar Conta Gratuita e Ser VIP
            </button>
            <button
              onClick={handleLogin}
              className="w-full sm:w-auto rounded-2xl border-2 border-slate-950 px-8 py-4 text-base font-bold text-slate-950 hover:bg-slate-950/10 transition-colors"
            >
              Fazer Login
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 bg-[#080d18] py-8 text-center text-xs text-slate-500">
        <p>© 2026 GSA HUB — Gestão de Serviços & Tecnologia. Todos os direitos reservados.</p>
      </footer>
    </div>
  );
}
