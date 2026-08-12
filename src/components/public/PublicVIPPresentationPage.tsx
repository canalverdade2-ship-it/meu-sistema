import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  ChevronDown,
  Award,
  Gem,
  Medal,
  CheckCircle2,
  UserPlus,
  LogIn,
  BadgePercent,
  Wallet,
  Headphones,
  Package,
  BarChart3,
  Users,
} from 'lucide-react';
import { VIP_LEVELS } from '../../constants';
import { routes } from '../../routing/routeCatalog';
import { navigate } from '../../routing/navigationService';

interface PublicVIPPresentationPageProps {
  onBack?: () => void;
  clientId?: string;
}

/* ─────────────────────────── helpers ─────────────────────────── */
const LEVEL_META: Record<string, { icon: any; badge: string; accent: string; pill: string; ring: string }> = {
  basico:   { icon: Medal,   badge: 'bg-slate-100 text-slate-700',      accent: '#64748b', pill: 'bg-slate-100 text-slate-700 border-slate-200', ring: 'ring-slate-300' },
  bronze:   { icon: Award,   badge: 'bg-amber-100 text-amber-800',      accent: '#b45309', pill: 'bg-amber-100 text-amber-800 border-amber-200', ring: 'ring-amber-400' },
  prata:    { icon: Star,    badge: 'bg-slate-200 text-slate-800',      accent: '#475569', pill: 'bg-slate-200 text-slate-700 border-slate-300', ring: 'ring-slate-400' },
  ouro:     { icon: Crown,   badge: 'bg-yellow-100 text-yellow-800',    accent: '#d97706', pill: 'bg-yellow-100 text-yellow-800 border-yellow-300', ring: 'ring-yellow-400' },
  diamante: { icon: Gem,     badge: 'bg-cyan-100 text-cyan-800',        accent: '#0891b2', pill: 'bg-cyan-100 text-cyan-800 border-cyan-300',   ring: 'ring-cyan-400' },
  black:    { icon: Trophy,  badge: 'bg-gray-900 text-amber-400',       accent: '#d97706', pill: 'bg-gray-900 text-amber-400 border-gray-700',  ring: 'ring-gray-900' },
};

const HERO_STATS = [
  { value: '6',     label: 'Níveis de vantagens' },
  { value: '5x',    label: 'Pontos por compra (Black)' },
  { value: '0%',    label: 'Taxa saque VIP Black' },
  { value: 'PIX',   label: 'Resgate em dinheiro real' },
];

const PERKS = [
  { icon: BadgePercent, title: 'Desconto Exclusivo VIP', desc: 'De 2% a 15% de desconto adicional em produtos e serviços conforme seu nível.' },
  { icon: BarChart3,    title: 'Multiplicador de Pontos', desc: 'Ganhe de 0,5x até 5x pontos em cada compra. Pontos não expiram.' },
  { icon: Wallet,       title: 'Resgate via PIX', desc: 'Converta pontos em dinheiro real e saque direto na sua conta bancária.' },
  { icon: Headphones,   title: 'Suporte Prioritário', desc: 'Fila separada de atendimento para membros VIP com resolução acelerada.' },
  { icon: Package,      title: 'Frete & Taxas Reduzidas', desc: 'Condições especiais de entrega e taxa de saque progressivamente menor.' },
  { icon: Gift,         title: 'Cupons & Vouchers', desc: 'Acesso antecipado a ofertas relâmpago e cupons cumulativos exclusivos.' },
];

/* ─────────────────────────── component ─────────────────────────── */
export function PublicVIPPresentationPage({ onBack, clientId }: PublicVIPPresentationPageProps) {
  const [selectedLevel, setSelectedLevel] = useState<string>('ouro');
  const [simulatedSpend, setSimulatedSpend] = useState<number>(1500);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [stickyVisible, setStickyVisible] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setStickyVisible(!e.isIntersecting), { threshold: 0 });
    if (heroRef.current) obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  const goRegister = () => navigate(`${routes.login.personal()}?mode=register`);
  const goLogin    = () => navigate(routes.login.personal());
  const goBack     = () => onBack ? onBack() : navigate(routes.marketplace.root());
  const goDashboard = () => navigate(routes.client.loyalty.vip());

  const currentLevel = VIP_LEVELS.find(l => l.id === selectedLevel) || VIP_LEVELS[3];
  const meta = LEVEL_META[selectedLevel] || LEVEL_META.ouro;
  const LevelIcon = meta.icon;

  const pointsMonth = Math.round(simulatedSpend * currentLevel.multiplier);
  const yearlyPts   = pointsMonth * 12;
  const yearlyCash  = (yearlyPts / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const yearlySave  = (simulatedSpend * 12 * (currentLevel.discountPercentage / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const faqs = [
    { q: 'O cadastro no Programa VIP GSA é gratuito?', a: 'Sim! A adesão ao nível Básico é 100% gratuita ao criar sua conta de cliente GSA. Nenhuma mensalidade ou taxa de adesão.' },
    { q: 'Como funcionam os pontos e os multiplicadores?', a: 'A cada R$ 1,00 gasto em produtos, serviços ou assinaturas GSA você acumula pontos. O multiplicador vai de 0,5x (Básico) até 5x (Black). Os pontos não expiram.' },
    { q: 'Posso resgatar pontos em dinheiro via PIX?', a: 'Sim! Converta seus pontos em saldo real na sua carteira GSA e solicite o saque via PIX para sua conta bancária a qualquer momento.' },
    { q: 'Como subo de nível VIP?', a: 'Seu nível sobe automaticamente conforme você acumula pontos. Também é possível adquirir upgrades de nível usando pontos acumulados pelo painel de fidelidade.' },
    { q: 'Existe mensalidade ou contrato de fidelidade?', a: 'Não há mensalidade para os níveis padrão. O programa é baseado exclusivamente no acúmulo de pontos por compras e contratações no ecossistema GSA.' },
  ];

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 h-14 border-b border-gray-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Back */}
          <button
            onClick={goBack}
            className="group flex items-center gap-1.5 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Voltar ao Marketplace</span>
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
              <Crown size={18} className="fill-yellow-400 text-yellow-400" />
            </div>
            <span className="text-sm font-black tracking-tight text-gray-900">
              GSA <span className="text-yellow-500">VIP</span>
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {clientId ? (
              <button
                onClick={goDashboard}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-gray-800"
              >
                <Trophy size={14} />
                <span>Meu Painel VIP</span>
              </button>
            ) : (
              <>
                <button
                  onClick={goLogin}
                  className="hidden items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:flex"
                >
                  <LogIn size={14} />
                  <span>Entrar</span>
                </button>
                <button
                  onClick={goRegister}
                  className="flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2 text-xs font-black text-gray-900 shadow-sm transition-all hover:bg-yellow-500 active:scale-95"
                >
                  <UserPlus size={14} />
                  <span>Cadastrar-se</span>
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="border-b border-gray-100 bg-gradient-to-b from-gray-950 to-gray-900 text-white"
      >
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">

            {/* Left: Copy */}
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1">
                <Sparkles size={13} className="text-yellow-400" />
                <span className="text-xs font-bold uppercase tracking-widest text-yellow-400">
                  Programa de Fidelidade GSA HUB
                </span>
              </div>

              <h1 className="text-4xl font-black leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
                Economize mais em<br />
                <span className="text-yellow-400">toda compra</span> no GSA
              </h1>

              <p className="max-w-md text-base text-gray-400 sm:text-lg">
                Pontos que viram dinheiro. Descontos exclusivos. Frete reduzido. Tudo isso com cadastro 100% gratuito.
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={goRegister}
                  className="flex items-center justify-center gap-2.5 rounded-xl bg-yellow-400 px-8 py-4 text-sm font-black text-gray-900 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:shadow-yellow-400/40 active:scale-95"
                >
                  Cadastrar Gratuitamente
                  <ArrowRight size={18} />
                </button>
                <button
                  onClick={goLogin}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/20 px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                >
                  Já tenho conta
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6 sm:grid-cols-4">
                {HERO_STATS.map((s, i) => (
                  <div key={i}>
                    <p className="text-xl font-black text-yellow-400 sm:text-2xl">{s.value}</p>
                    <p className="mt-0.5 text-xs font-medium text-gray-500">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Level cards preview */}
            <div className="relative hidden lg:flex items-center justify-center">
              <div className="relative h-80 w-full max-w-sm">
                {/* Card stack */}
                {[
                  { label: 'Black VIP',    sub: '5x Pontos · 0% Taxa', offsetY: 0, offsetX: 0, scale: 1,    z: 30, dark: true },
                  { label: 'Diamante VIP', sub: '4x Pontos · 1% Taxa', offsetY: 24, offsetX: -20, scale: 0.95, z: 20, dark: false },
                  { label: 'Ouro VIP',     sub: '3x Pontos · 2% Taxa', offsetY: 48, offsetX: -40, scale: 0.90, z: 10, dark: false },
                ].map((card, i) => (
                  <div
                    key={i}
                    style={{ transform: `translateX(${card.offsetX}px) translateY(${card.offsetY}px) scale(${card.scale})`, zIndex: card.z }}
                    className={`absolute left-0 right-0 mx-auto w-80 rounded-2xl p-6 shadow-2xl transition-all ${
                      card.dark
                        ? 'bg-gray-950 border border-yellow-500/40 ring-1 ring-white/5'
                        : 'bg-white border border-gray-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className={`text-xs font-black uppercase tracking-widest ${card.dark ? 'text-yellow-400' : 'text-gray-400'}`}>
                          Cartão de Membro
                        </p>
                        <h3 className={`mt-1 text-2xl font-black ${card.dark ? 'text-white' : 'text-gray-900'}`}>{card.label}</h3>
                        <p className={`mt-0.5 text-xs font-medium ${card.dark ? 'text-gray-400' : 'text-gray-500'}`}>{card.sub}</p>
                      </div>
                      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.dark ? 'bg-yellow-400' : 'bg-gray-100'}`}>
                        <Crown size={20} className={card.dark ? 'fill-gray-900 text-gray-900' : 'text-gray-700'} />
                      </div>
                    </div>
                    <div className={`mt-6 flex items-center justify-between border-t pt-4 ${card.dark ? 'border-white/10' : 'border-gray-100'}`}>
                      <div>
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${card.dark ? 'text-gray-500' : 'text-gray-400'}`}>Acumulado</p>
                        <p className={`text-sm font-black ${card.dark ? 'text-yellow-400' : 'text-gray-900'}`}>GSA Pontos</p>
                      </div>
                      <div className="text-right">
                        <p className={`text-[10px] font-bold uppercase tracking-widest ${card.dark ? 'text-gray-500' : 'text-gray-400'}`}>Resgate</p>
                        <p className={`text-sm font-black ${card.dark ? 'text-emerald-400' : 'text-emerald-600'}`}>Via PIX</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS RÁPIDOS (estilo Amazon Prime) ── */}
      <section className="border-b border-gray-100 bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-yellow-500">Por que ser membro</p>
              <h2 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">Vantagens em cada compra no GSA</h2>
            </div>
            <button
              onClick={goRegister}
              className="flex items-center gap-2 rounded-xl bg-gray-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-gray-800 active:scale-95"
            >
              Criar conta grátis
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((perk, i) => (
              <div
                key={i}
                className="group flex items-start gap-4 rounded-2xl border border-gray-100 bg-gray-50 p-5 transition-all hover:border-yellow-300 hover:bg-yellow-50/40"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm group-hover:border-yellow-300 group-hover:text-yellow-600 transition-colors">
                  <perk.icon size={22} strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-gray-900">{perk.title}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-gray-500">{perk.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TABELA DE NÍVEIS (estilo Shopee Club / Meli+) ── */}
      <section className="border-b border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-yellow-500">Evolua e ganhe mais</p>
            <h2 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">Compare os Níveis do Programa</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-gray-500">
              Quanto mais você compra e contrata no GSA, mais pontos acumula e mais vantagens destrava.
            </p>
          </div>

          {/* Level Tabs */}
          <div className="mb-8 flex flex-wrap justify-center gap-2">
            {VIP_LEVELS.map((level) => {
              const lm = LEVEL_META[level.id];
              const LvlIcon = lm.icon;
              const active = selectedLevel === level.id;
              return (
                <button
                  key={level.id}
                  onClick={() => setSelectedLevel(level.id)}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all cursor-pointer ${
                    active
                      ? `${lm.pill} ring-2 ${lm.ring} shadow-sm scale-105`
                      : 'border-gray-200 bg-white text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  <LvlIcon size={15} />
                  {level.name}
                </button>
              );
            })}
          </div>

          {/* Selected Level Detail Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedLevel}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
            >
              {/* Card header */}
              <div className={`flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between ${selectedLevel === 'black' ? 'bg-gray-950' : 'bg-white border-b border-gray-100'}`}>
                <div className="flex items-center gap-3">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${meta.ring} ${selectedLevel === 'black' ? 'bg-white/10' : 'bg-gray-50'}`}>
                    <LevelIcon size={24} style={{ color: meta.accent }} />
                  </div>
                  <div>
                    <p className={`text-xs font-black uppercase tracking-widest ${selectedLevel === 'black' ? 'text-gray-400' : 'text-gray-400'}`}>
                      Nível {currentLevel.name}
                    </p>
                    <h3 className={`text-xl font-black ${selectedLevel === 'black' ? 'text-white' : 'text-gray-900'}`}>
                      {currentLevel.name} VIP
                    </h3>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="text-center">
                    <p className={`text-xs font-bold uppercase tracking-wide ${selectedLevel === 'black' ? 'text-gray-500' : 'text-gray-400'}`}>Pontos/R$1</p>
                    <p className="text-2xl font-black" style={{ color: meta.accent }}>{currentLevel.multiplier}x</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-xs font-bold uppercase tracking-wide ${selectedLevel === 'black' ? 'text-gray-500' : 'text-gray-400'}`}>Desconto Extra</p>
                    <p className="text-2xl font-black text-emerald-600">{currentLevel.discountPercentage}%</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-xs font-bold uppercase tracking-wide ${selectedLevel === 'black' ? 'text-gray-500' : 'text-gray-400'}`}>Taxa Saque</p>
                    <p className="text-2xl font-black text-blue-600">{currentLevel.feePercentage}%</p>
                  </div>
                </div>
              </div>

              {/* Benefits grid */}
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                {/* Standard benefits */}
                <div className="border-b border-gray-100 p-6 sm:border-b-0 sm:border-r">
                  <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
                    <CheckCircle2 size={14} className="text-emerald-500" />
                    Benefícios Inclusos
                  </p>
                  <ul className="space-y-2">
                    {currentLevel.benefits.slice(0, 6).map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Exclusive */}
                <div className="p-6">
                  <p className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-400">
                    <Sparkles size={14} className="text-yellow-500" />
                    Exclusivos deste Nível
                  </p>
                  <ul className="space-y-2">
                    {currentLevel.exclusiveBenefits.length > 0 ? (
                      currentLevel.exclusiveBenefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs font-semibold text-gray-900">
                          <Star size={13} className="mt-0.5 shrink-0 fill-yellow-400 text-yellow-400" />
                          {b}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-gray-400">Crie sua conta e comece a acumular pontos para desbloquear benefícios.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* CTA footer */}
              <div className="flex flex-col items-start justify-between gap-4 border-t border-gray-100 bg-gray-50 px-6 py-4 sm:flex-row sm:items-center">
                <p className="text-xs text-gray-500">
                  Inicie no nível Básico gratuitamente. Suba automaticamente comprando no GSA.
                </p>
                <button
                  onClick={goRegister}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-black text-gray-900 transition-all hover:bg-yellow-500 active:scale-95 cursor-pointer"
                >
                  Quero ser {currentLevel.name} VIP
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Comparison quick table */}
          <div className="mt-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-5 py-3 text-left font-black text-gray-500 uppercase tracking-widest">Nível</th>
                  <th className="px-5 py-3 text-center font-black text-gray-500 uppercase tracking-widest">Pontos</th>
                  <th className="px-5 py-3 text-center font-black text-gray-500 uppercase tracking-widest">Multiplicador</th>
                  <th className="px-5 py-3 text-center font-black text-gray-500 uppercase tracking-widest">Desconto</th>
                  <th className="px-5 py-3 text-center font-black text-gray-500 uppercase tracking-widest">Taxa Saque</th>
                </tr>
              </thead>
              <tbody>
                {VIP_LEVELS.map((level, i) => {
                  const lm = LEVEL_META[level.id];
                  const LvlIcon = lm.icon;
                  const isSelected = selectedLevel === level.id;
                  return (
                    <tr
                      key={level.id}
                      onClick={() => setSelectedLevel(level.id)}
                      className={`cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-yellow-50/60 ${isSelected ? 'bg-yellow-50' : ''}`}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <LvlIcon size={14} style={{ color: lm.accent }} />
                          <span className={`font-black ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>{level.name}</span>
                          {isSelected && (
                            <span className="rounded-full bg-yellow-200 px-2 py-0.5 text-[10px] font-black text-yellow-800">Selecionado</span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-center text-gray-500">
                        {level.minPoints} — {level.maxPoints ?? '∞'}
                      </td>
                      <td className="px-5 py-3.5 text-center font-black" style={{ color: lm.accent }}>
                        {level.multiplier}x
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-emerald-600">
                        {level.discountPercentage}%
                      </td>
                      <td className="px-5 py-3.5 text-center font-bold text-blue-600">
                        {level.feePercentage}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SIMULADOR DE ECONOMIA ── */}
      <section className="border-b border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200 shadow-sm">
            {/* Header */}
            <div className="border-b border-gray-100 bg-gray-50 px-6 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-400 text-gray-900">
                  <BarChart3 size={20} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Calculadora VIP</p>
                  <h2 className="text-lg font-black text-gray-900">Simule sua economia anual</h2>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* Range slider */}
              <div className="mb-8">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-700">Gasto mensal estimado no GSA</p>
                  <p className="text-xl font-black text-gray-900">
                    {simulatedSpend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </p>
                </div>
                <input
                  type="range"
                  min={100}
                  max={5000}
                  step={100}
                  value={simulatedSpend}
                  onChange={e => setSimulatedSpend(Number(e.target.value))}
                  className="w-full cursor-pointer accent-yellow-400"
                  style={{ height: 6 }}
                />
                <div className="mt-1.5 flex justify-between text-xs text-gray-400 font-medium">
                  <span>R$ 100</span>
                  <span>R$ 2.500</span>
                  <span>R$ 5.000</span>
                </div>
              </div>

              {/* Nível selector dentro do simulador */}
              <div className="mb-6 flex flex-wrap gap-2">
                <p className="w-full text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Nível para simular:</p>
                {VIP_LEVELS.map(level => {
                  const lm = LEVEL_META[level.id];
                  const active = selectedLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      onClick={() => setSelectedLevel(level.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        active
                          ? `${lm.pill} ring-2 ${lm.ring}`
                          : 'border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {level.name}
                    </button>
                  );
                })}
              </div>

              {/* Results grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Pontos por mês',   value: `${pointsMonth.toLocaleString('pt-BR')} pts`,  color: 'text-gray-900', bg: 'bg-gray-50 border-gray-200' },
                  { label: 'Pontos no ano',     value: `${yearlyPts.toLocaleString('pt-BR')} pts`,   color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200' },
                  { label: 'Resgate PIX anual', value: yearlyCash,   color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
                  { label: 'Desc. adicional/ano', value: yearlySave, color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
                ].map((r, i) => (
                  <div key={i} className={`rounded-xl border p-4 ${r.bg}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{r.label}</p>
                    <p className={`mt-1 text-lg font-black sm:text-xl ${r.color}`}>{r.value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-gray-400">
                * Estimativa com base no multiplicador do nível <strong>{currentLevel.name}</strong> ({currentLevel.multiplier}x) e {currentLevel.discountPercentage}% de desconto adicional. Valores aproximados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PROVA SOCIAL / TRUST ── */}
      <section className="border-b border-gray-100 bg-gray-50 py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {[
              { icon: Users,       stat: '+12.000',   label: 'Clientes VIP ativos no ecossistema GSA' },
              { icon: Wallet,      stat: 'R$ 4,2M',   label: 'Em pontos resgatados via PIX pelos membros' },
              { icon: ShieldCheck, stat: '100%',       label: 'Gratuito para ingressar no nível Básico' },
            ].map((t, i) => (
              <div key={i} className="flex items-start gap-4 rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-50 text-yellow-600 border border-yellow-200">
                  <t.icon size={24} strokeWidth={1.75} />
                </div>
                <div>
                  <p className="text-3xl font-black text-gray-900">{t.stat}</p>
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{t.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-b border-gray-100 bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <h2 className="text-2xl font-black text-gray-900 sm:text-3xl">Perguntas Frequentes</h2>
            <p className="mt-2 text-sm text-gray-500">Tudo que você precisa saber antes de se cadastrar.</p>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50 transition-colors hover:border-gray-300">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left cursor-pointer"
                >
                  <span className="text-sm font-bold text-gray-900">{faq.q}</span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-gray-400 transition-transform ${openFaq === index ? 'rotate-180 text-yellow-500' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-200 px-5 py-4 text-sm leading-relaxed text-gray-600"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── BOTTOM CTA BAND ── */}
      <section className="bg-gray-950 py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400">
            <Crown size={28} className="fill-gray-900 text-gray-900" />
          </div>
          <h2 className="text-3xl font-black sm:text-4xl">
            Pronto para ter acesso VIP?
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm text-gray-400">
            Crie sua conta gratuitamente em menos de 1 minuto e comece a acumular pontos em cada compra no GSA HUB.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={goRegister}
              className="w-full sm:w-auto rounded-xl bg-yellow-400 px-10 py-4 text-sm font-black text-gray-900 shadow-lg shadow-yellow-400/20 transition-all hover:bg-yellow-300 hover:shadow-yellow-400/40 active:scale-95 cursor-pointer"
            >
              Criar Conta Gratuita
            </button>
            <button
              onClick={goLogin}
              className="w-full sm:w-auto rounded-xl border border-white/20 px-10 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/10 cursor-pointer"
            >
              Fazer Login
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gray-900 py-6 text-center text-xs text-gray-600">
        © 2026 GSA HUB — Gestão de Serviços & Tecnologia. Todos os direitos reservados.
      </footer>

      {/* ── STICKY CTA (aparece quando o hero some) ── */}
      <AnimatePresence>
        {stickyVisible && !clientId && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white px-4 py-3 shadow-2xl sm:py-2"
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-900">
                  <Crown size={16} className="fill-yellow-400 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-gray-900">Programa VIP GSA</p>
                  <p className="text-xs text-gray-500">Economize até 30% em cada compra</p>
                </div>
              </div>
              <div className="flex w-full items-center justify-center gap-3 sm:w-auto sm:justify-end">
                <button
                  onClick={goLogin}
                  className="rounded-lg border border-gray-300 px-5 py-2.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-50"
                >
                  Entrar
                </button>
                <button
                  onClick={goRegister}
                  className="rounded-lg bg-yellow-400 px-6 py-2.5 text-xs font-black text-gray-900 shadow-sm transition-all hover:bg-yellow-500 active:scale-95"
                >
                  Criar conta grátis
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
