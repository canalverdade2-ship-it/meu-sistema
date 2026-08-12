import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Star, ShieldCheck, Zap, ArrowLeft, Sparkles, Trophy, Gift,
  Check, ArrowRight, ChevronDown, Award, Gem, Medal, CheckCircle2,
  UserPlus, LogIn, BadgePercent, Wallet, Headphones, Package,
  BarChart3, Users, TrendingUp, Lock,
} from 'lucide-react';
import { VIP_LEVELS } from '../../constants';
import { routes } from '../../routing/routeCatalog';
import { navigate } from '../../routing/navigationService';

interface PublicVIPPresentationPageProps {
  onBack?: () => void;
  clientId?: string;
}

const LEVEL_META: Record<string, { icon: any; accent: string; gradFrom: string; gradTo: string; ring: string; textAccent: string }> = {
  basico:   { icon: Medal,  accent: '#94a3b8', gradFrom: '#f1f5f9', gradTo: '#e2e8f0', ring: 'ring-slate-400',  textAccent: 'text-slate-400' },
  bronze:   { icon: Award,  accent: '#d97706', gradFrom: '#78350f', gradTo: '#92400e', ring: 'ring-amber-500',  textAccent: 'text-amber-400' },
  prata:    { icon: Star,   accent: '#94a3b8', gradFrom: '#334155', gradTo: '#475569', ring: 'ring-slate-400',  textAccent: 'text-slate-300' },
  ouro:     { icon: Crown,  accent: '#fbbf24', gradFrom: '#92400e', gradTo: '#b45309', ring: 'ring-yellow-400', textAccent: 'text-yellow-400' },
  diamante: { icon: Gem,    accent: '#38bdf8', gradFrom: '#0c4a6e', gradTo: '#075985', ring: 'ring-sky-400',   textAccent: 'text-sky-300' },
  black:    { icon: Trophy, accent: '#fbbf24', gradFrom: '#000000', gradTo: '#0f172a', ring: 'ring-yellow-500', textAccent: 'text-yellow-400' },
};

const HERO_STATS = [
  { value: '6',   label: 'Níveis VIP exclusivos' },
  { value: '5×',  label: 'Pontos por compra (Black)' },
  { value: '0%',  label: 'Taxa de saque no topo' },
  { value: 'PIX', label: 'Resgate em dinheiro real' },
];

const PERKS = [
  { icon: BadgePercent, title: 'Desconto VIP Exclusivo',   desc: 'De 2% a 15% de desconto adicional em produtos e serviços conforme seu nível.', color: '#f59e0b' },
  { icon: BarChart3,    title: 'Multiplicador de Pontos',  desc: 'Ganhe de 0,5× até 5× pontos em cada compra. Pontos não expiram nunca.',        color: '#10b981' },
  { icon: Wallet,       title: 'Resgate via PIX',          desc: 'Converta pontos em dinheiro real e saque direto na sua conta bancária.',         color: '#3b82f6' },
  { icon: Headphones,   title: 'Suporte Prioritário',      desc: 'Fila separada de atendimento para membros VIP com resolução acelerada.',         color: '#8b5cf6' },
  { icon: Package,      title: 'Frete & Taxas Reduzidas',  desc: 'Condições especiais de entrega e taxa de saque progressivamente menor.',         color: '#ec4899' },
  { icon: Gift,         title: 'Cupons & Vouchers',        desc: 'Acesso antecipado a ofertas relâmpago e cupons cumulativos exclusivos.',          color: '#f97316' },
];

/* ─── Neon glow helper ─── */
function NeonBadge({ children, color = '#fbbf24' }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.15em]"
      style={{ borderColor: color + '50', backgroundColor: color + '15', color }}
    >
      {children}
    </span>
  );
}

/* ─── Main Component ─── */
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

  const goRegister  = () => navigate(`${routes.login.personal()}?mode=register`);
  const goLogin     = () => navigate(routes.login.personal());
  const goBack      = () => onBack ? onBack() : navigate(routes.marketplace.root());
  const goDashboard = () => navigate(routes.client.loyalty.vip());

  const currentLevel = VIP_LEVELS.find(l => l.id === selectedLevel) || VIP_LEVELS[3];
  const meta = LEVEL_META[selectedLevel] || LEVEL_META.ouro;
  const LevelIcon = meta.icon;

  const pointsMonth = Math.round(simulatedSpend * currentLevel.multiplier);
  const yearlyPts   = pointsMonth * 12;
  const yearlyCash  = (yearlyPts / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const yearlySave  = (simulatedSpend * 12 * (currentLevel.discountPercentage / 100)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const faqs = [
    { q: 'O cadastro no Programa VIP GSA é gratuito?',       a: 'Sim! A adesão ao nível Básico é 100% gratuita ao criar sua conta de cliente GSA. Nenhuma mensalidade ou taxa de adesão.' },
    { q: 'Como funcionam os pontos e os multiplicadores?',    a: 'A cada R$ 1,00 gasto em produtos, serviços ou assinaturas GSA você acumula pontos. O multiplicador vai de 0,5× (Básico) até 5× (Black). Os pontos não expiram.' },
    { q: 'Posso resgatar pontos em dinheiro via PIX?',        a: 'Sim! Converta seus pontos em saldo real na sua carteira GSA e solicite o saque via PIX para sua conta bancária a qualquer momento.' },
    { q: 'Como subo de nível VIP?',                           a: 'Seu nível sobe automaticamente conforme você acumula pontos. Também é possível adquirir upgrades de nível usando pontos acumulados pelo painel de fidelidade.' },
    { q: 'Existe mensalidade ou contrato de fidelidade?',     a: 'Não há mensalidade para os níveis padrão. O programa é baseado exclusivamente no acúmulo de pontos por compras e contratações no ecossistema GSA.' },
  ];

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-sans antialiased">

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-[#080c14]/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={goBack}
            className="group flex items-center gap-1.5 text-sm font-medium text-white/60 transition-colors hover:text-white"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Voltar ao Marketplace</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg shadow-yellow-500/30">
              <Crown size={16} className="fill-gray-900 text-gray-900" />
            </div>
            <span className="text-sm font-black tracking-tight text-white">
              GSA <span className="text-yellow-400">VIP</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {clientId ? (
              <button
                onClick={goDashboard}
                className="flex items-center gap-2 rounded-lg bg-yellow-400 px-4 py-2 text-xs font-black text-gray-900 shadow-lg shadow-yellow-400/25 transition-all hover:bg-yellow-300 active:scale-95"
              >
                <Trophy size={13} /> Meu Painel VIP
              </button>
            ) : (
              <>
                <button
                  onClick={goLogin}
                  className="hidden items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-xs font-semibold text-white/80 transition-colors hover:bg-white/10 sm:flex"
                >
                  <LogIn size={13} /> Entrar
                </button>
                <button
                  onClick={goRegister}
                  className="flex items-center gap-2 rounded-lg bg-yellow-400 px-5 py-2 text-xs font-black text-gray-900 shadow-md shadow-yellow-400/30 transition-all hover:bg-yellow-300 active:scale-95"
                >
                  <UserPlus size={13} /> Cadastrar-se
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0a0e1a 0%, #0f1726 40%, #111827 100%)' }}
      >
        {/* Background decorations */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-32 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-yellow-500/10 blur-[120px]" />
          <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-amber-600/8 blur-[80px]" />
          <div className="absolute top-1/3 left-0 h-48 w-48 rounded-full bg-yellow-400/5 blur-[60px]" />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:items-center">

            {/* Left: Copy */}
            <div className="space-y-7">
              <NeonBadge color="#fbbf24">
                <Sparkles size={11} /> Programa de Fidelidade GSA HUB
              </NeonBadge>

              <h1 className="text-5xl font-black leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                Economize mais em<br />
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(90deg, #fbbf24, #f59e0b, #fde68a)' }}
                >
                  toda compra
                </span>{' '}
                <span className="text-white">no GSA</span>
              </h1>

              <p className="max-w-md text-base font-medium text-white/55 sm:text-lg leading-relaxed">
                Pontos que viram dinheiro. Descontos exclusivos. Frete reduzido. Cadastro <strong className="text-white/80">100% gratuito.</strong>
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={goRegister}
                  className="group flex items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-8 py-4 text-sm font-black text-gray-900 shadow-xl shadow-yellow-500/30 transition-all hover:shadow-yellow-500/50 hover:scale-[1.02] active:scale-95"
                >
                  Cadastrar Gratuitamente
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={goLogin}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-semibold text-white/80 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white"
                >
                  Já tenho conta
                </button>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-5 border-t border-white/10 pt-7 sm:grid-cols-4">
                {HERO_STATS.map((s, i) => (
                  <div key={i}>
                    <p className="text-2xl font-black text-yellow-400 sm:text-3xl">{s.value}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-white/40 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Stacked Cards */}
            <div className="relative hidden lg:flex items-center justify-center">
              <div className="relative h-80 w-full max-w-sm">
                {[
                  { label: 'Black VIP',    sub: '5× Pontos · 0% Taxa',  offsetY: 0,  offsetX: 0,   scale: 1,    z: 30, bg: 'linear-gradient(135deg, #0f0f0f, #1a1a2e)', border: 'rgba(251,191,36,0.4)', accent: '#fbbf24' },
                  { label: 'Diamante VIP', sub: '4× Pontos · 1% Taxa',  offsetY: 28, offsetX: -24, scale: 0.93, z: 20, bg: 'linear-gradient(135deg, #0c1929, #0e2438)', border: 'rgba(56,189,248,0.3)', accent: '#38bdf8' },
                  { label: 'Ouro VIP',     sub: '3× Pontos · 2% Taxa',  offsetY: 52, offsetX: -48, scale: 0.86, z: 10, bg: 'linear-gradient(135deg, #1a0f00, #2d1a00)', border: 'rgba(251,191,36,0.25)', accent: '#fbbf24' },
                ].map((card, i) => (
                  <div
                    key={i}
                    style={{ transform: `translateX(${card.offsetX}px) translateY(${card.offsetY}px) scale(${card.scale})`, zIndex: card.z, background: card.bg, borderColor: card.border }}
                    className="absolute left-0 right-0 mx-auto w-80 rounded-2xl border p-6 shadow-2xl"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: card.accent + '80' }}>
                          Cartão de Membro
                        </p>
                        <h3 className="mt-1 text-2xl font-black text-white">{card.label}</h3>
                        <p className="mt-0.5 text-xs font-medium text-white/50">{card.sub}</p>
                      </div>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: card.accent + '20' }}>
                        <Crown size={20} style={{ color: card.accent }} className="fill-current" />
                      </div>
                    </div>
                    <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Acumulado</p>
                        <p className="text-sm font-black" style={{ color: card.accent }}>GSA Pontos</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-white/30">Resgate</p>
                        <p className="text-sm font-black text-emerald-400">Via PIX</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS — Dark Cards with Glow ── */}
      <section className="py-20" style={{ background: 'linear-gradient(180deg, #080c14 0%, #0d1220 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <NeonBadge color="#fbbf24"><Sparkles size={11} /> Por que ser membro</NeonBadge>
              <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">
                Vantagens em <span className="text-yellow-400">cada compra</span> no GSA
              </h2>
            </div>
            <button
              onClick={goRegister}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-6 py-3 text-sm font-black text-gray-900 shadow-lg shadow-yellow-400/25 transition-all hover:bg-yellow-300 active:scale-95"
            >
              Criar conta grátis <ArrowRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((perk, i) => (
              <div
                key={i}
                className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/4 p-6 backdrop-blur-sm transition-all hover:border-white/20 hover:bg-white/7"
              >
                {/* Glow on hover */}
                <div
                  className="absolute -top-10 -right-10 h-32 w-32 rounded-full opacity-0 blur-2xl transition-opacity group-hover:opacity-20"
                  style={{ backgroundColor: perk.color }}
                />
                <div className="relative">
                  <div
                    className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border"
                    style={{ backgroundColor: perk.color + '18', borderColor: perk.color + '30', color: perk.color }}
                  >
                    <perk.icon size={22} strokeWidth={1.75} />
                  </div>
                  <h3 className="text-sm font-black text-white">{perk.title}</h3>
                  <p className="mt-2 text-xs leading-relaxed text-white/50">{perk.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TABELA DE NÍVEIS ── */}
      <section className="py-20" style={{ background: 'linear-gradient(180deg, #0d1220 0%, #0a0e1a 100%)' }}>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <NeonBadge color="#fbbf24"><TrendingUp size={11} /> Evolua e ganhe mais</NeonBadge>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Compare os Níveis do Programa</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
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
                      ? 'scale-105 shadow-lg'
                      : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                  }`}
                  style={active ? {
                    backgroundColor: lm.accent + '20',
                    borderColor: lm.accent + '60',
                    color: lm.accent,
                    boxShadow: `0 0 20px ${lm.accent}25`,
                  } : {}}
                >
                  <LvlIcon size={14} />
                  {level.name}
                </button>
              );
            })}
          </div>

          {/* Selected Level Card */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedLevel}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl"
              style={{ background: `linear-gradient(135deg, ${meta.gradFrom}40, ${meta.gradTo}40)` }}
            >
              {/* Card header */}
              <div
                className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between border-b border-white/10"
                style={{ background: `linear-gradient(135deg, ${meta.gradFrom}80, ${meta.gradTo}60)` }}
              >
                <div className="flex items-center gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 shadow-lg"
                    style={{ backgroundColor: meta.accent + '20', borderColor: meta.accent + '50', boxShadow: `0 0 20px ${meta.accent}30` }}
                  >
                    <LevelIcon size={26} style={{ color: meta.accent }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-white/40">Nível {currentLevel.name}</p>
                    <h3 className="text-2xl font-black text-white">{currentLevel.name} VIP</h3>
                  </div>
                </div>
                <div className="flex gap-8">
                  {[
                    { label: 'Pontos/R$1',   value: `${currentLevel.multiplier}×`, color: meta.accent },
                    { label: 'Desconto Extra', value: `${currentLevel.discountPercentage}%`, color: '#10b981' },
                    { label: 'Taxa Saque',    value: `${currentLevel.feePercentage}%`, color: '#38bdf8' },
                  ].map(({ label, value, color }, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</p>
                      <p className="text-2xl font-black" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Benefits grid */}
              <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
                <div className="border-b border-white/10 p-6 sm:border-b-0 sm:border-r">
                  <p className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/40">
                    <CheckCircle2 size={13} className="text-emerald-400" /> Benefícios Inclusos
                  </p>
                  <ul className="space-y-2.5">
                    {currentLevel.benefits.slice(0, 6).map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-white/70">
                        <Check size={12} className="mt-0.5 shrink-0 text-emerald-400" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-6">
                  <p className="mb-4 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/40">
                    <Sparkles size={13} className="text-yellow-400" /> Exclusivos deste Nível
                  </p>
                  <ul className="space-y-2.5">
                    {currentLevel.exclusiveBenefits.length > 0 ? (
                      currentLevel.exclusiveBenefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs font-semibold text-white">
                          <Star size={12} className="mt-0.5 shrink-0 fill-yellow-400 text-yellow-400" /> {b}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-white/30">Crie sua conta e comece a acumular pontos para desbloquear benefícios.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* CTA footer */}
              <div className="flex flex-col items-start justify-between gap-4 border-t border-white/10 bg-white/5 px-6 py-4 sm:flex-row sm:items-center">
                <p className="text-xs text-white/40">Inicie no nível Básico gratuitamente. Suba automaticamente comprando no GSA.</p>
                <button
                  onClick={goRegister}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-yellow-400 px-5 py-2.5 text-xs font-black text-gray-900 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 active:scale-95 cursor-pointer"
                >
                  Quero ser {currentLevel.name} VIP <ArrowRight size={13} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Comparison Table */}
          <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10 shadow-xl" style={{ background: '#0d1421' }}>
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-white/10" style={{ background: '#111827' }}>
                  {['Nível', 'Pontos Mínimos', 'Multiplicador', 'Desconto', 'Taxa Saque'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-black uppercase tracking-widest text-white/30">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VIP_LEVELS.map((level) => {
                  const lm = LEVEL_META[level.id];
                  const LvlIcon = lm.icon;
                  const isSelected = selectedLevel === level.id;
                  return (
                    <tr
                      key={level.id}
                      onClick={() => setSelectedLevel(level.id)}
                      className="cursor-pointer border-b border-white/5 last:border-0 transition-colors hover:bg-white/5"
                      style={isSelected ? { backgroundColor: lm.accent + '12' } : {}}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <LvlIcon size={14} style={{ color: lm.accent }} />
                          <span className={`font-black ${isSelected ? 'text-white' : 'text-white/60'}`}>{level.name}</span>
                          {isSelected && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: lm.accent + '25', color: lm.accent }}>
                              Selecionado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-white/40">{level.minPoints} — {level.maxPoints ?? '∞'}</td>
                      <td className="px-5 py-3.5 font-black" style={{ color: lm.accent }}>{level.multiplier}×</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-400">{level.discountPercentage}%</td>
                      <td className="px-5 py-3.5 font-bold text-sky-400">{level.feePercentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SIMULADOR ── */}
      <section className="py-20" style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #0d1220 100%)' }}>
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-2xl" style={{ background: '#0d1421' }}>
            {/* Header */}
            <div className="border-b border-white/10 px-6 py-6 sm:px-8" style={{ background: 'linear-gradient(135deg, #111827, #0f172a)' }}>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-400/20 border border-yellow-400/30">
                  <BarChart3 size={22} className="text-yellow-400" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/30">Calculadora VIP</p>
                  <h2 className="text-xl font-black text-white">Simule sua economia anual</h2>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* Slider */}
              <div className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-white/60">Gasto mensal estimado no GSA</p>
                  <p className="text-2xl font-black text-white">{simulatedSpend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <input
                  type="range" min={100} max={5000} step={100}
                  value={simulatedSpend}
                  onChange={e => setSimulatedSpend(Number(e.target.value))}
                  className="w-full cursor-pointer accent-yellow-400"
                  style={{ height: 6 }}
                />
                <div className="mt-2 flex justify-between text-xs text-white/25 font-medium">
                  <span>R$ 100</span><span>R$ 2.500</span><span>R$ 5.000</span>
                </div>
              </div>

              {/* Level selector */}
              <div className="mb-6 flex flex-wrap gap-2">
                <p className="w-full text-[11px] font-black uppercase tracking-widest text-white/30 mb-1">Nível para simular:</p>
                {VIP_LEVELS.map(level => {
                  const lm = LEVEL_META[level.id];
                  const active = selectedLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      onClick={() => setSelectedLevel(level.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        active ? 'shadow-md' : 'border-white/10 bg-white/5 text-white/40 hover:text-white'
                      }`}
                      style={active ? { backgroundColor: lm.accent + '20', borderColor: lm.accent + '50', color: lm.accent } : {}}
                    >
                      {level.name}
                    </button>
                  );
                })}
              </div>

              {/* Results */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Pontos por mês',     value: `${pointsMonth.toLocaleString('pt-BR')} pts`, color: '#ffffff', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.1)' },
                  { label: 'Pontos no ano',       value: `${yearlyPts.toLocaleString('pt-BR')} pts`,   color: '#fbbf24', bg: 'rgba(251,191,36,0.08)',  border: 'rgba(251,191,36,0.2)' },
                  { label: 'Resgate PIX anual',   value: yearlyCash,                                    color: '#10b981', bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.2)' },
                  { label: 'Desc. adicional/ano', value: yearlySave,                                    color: '#38bdf8', bg: 'rgba(56,189,248,0.08)',  border: 'rgba(56,189,248,0.2)' },
                ].map((r, i) => (
                  <div key={i} className="rounded-xl border p-4" style={{ backgroundColor: r.bg, borderColor: r.border }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/30">{r.label}</p>
                    <p className="mt-1.5 text-lg font-black sm:text-xl" style={{ color: r.color }}>{r.value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-white/25">
                * Estimativa com base no multiplicador do nível <strong className="text-white/40">{currentLevel.name}</strong> ({currentLevel.multiplier}×) e {currentLevel.discountPercentage}% de desconto adicional. Valores aproximados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="py-20" style={{ background: '#080c14' }}>
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-12 text-center">
            <NeonBadge color="#fbbf24"><Zap size={11} /> Dúvidas frequentes</NeonBadge>
            <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">Perguntas Frequentes</h2>
            <p className="mt-2 text-sm text-white/40">Tudo que você precisa saber antes de se cadastrar.</p>
          </div>

          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="overflow-hidden rounded-xl border border-white/10 transition-colors hover:border-white/20"
                style={{ background: '#0d1421' }}
              >
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between px-6 py-5 text-left cursor-pointer"
                >
                  <span className="text-sm font-bold text-white/85">{faq.q}</span>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 text-white/30 transition-transform ${openFaq === index ? 'rotate-180 text-yellow-400' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-white/10 px-6 py-5 text-sm leading-relaxed text-white/50"
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
      <section className="relative overflow-hidden py-24">
        <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(135deg, #0f0f00, #1a1200, #0d1000)' }}>
          <div className="absolute top-0 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-yellow-500/20 blur-[80px]" />
          <div className="absolute bottom-0 right-0 h-48 w-48 rounded-full bg-amber-600/15 blur-[60px]" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-2xl shadow-yellow-500/40">
            <Crown size={30} className="fill-gray-900 text-gray-900" />
          </div>
          <h2 className="text-4xl font-black text-white sm:text-5xl">Pronto para ter acesso VIP?</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-white/50 leading-relaxed">
            Crie sua conta gratuitamente em menos de 1 minuto e comece a acumular pontos em cada compra no GSA HUB.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={goRegister}
              className="w-full sm:w-auto rounded-xl bg-gradient-to-r from-yellow-400 to-amber-500 px-10 py-4 text-sm font-black text-gray-900 shadow-2xl shadow-yellow-500/40 transition-all hover:shadow-yellow-500/60 hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              Criar Conta Gratuita
            </button>
            <button
              onClick={goLogin}
              className="w-full sm:w-auto rounded-xl border border-white/15 bg-white/5 px-10 py-4 text-sm font-semibold text-white/80 backdrop-blur-sm transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              Fazer Login
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-white/20" style={{ background: '#050810' }}>
        © 2026 GSA HUB — Gestão de Serviços & Tecnologia. Todos os direitos reservados.
      </footer>

      {/* ── STICKY CTA ── */}
      <AnimatePresence>
        {stickyVisible && !clientId && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 px-4 py-3 shadow-2xl backdrop-blur-xl sm:py-2"
            style={{ background: 'rgba(8,12,20,0.95)' }}
          >
            <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
              <div className="hidden sm:flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-yellow-400/20 border border-yellow-400/30">
                  <Crown size={15} className="fill-yellow-400 text-yellow-400" />
                </div>
                <div>
                  <p className="text-sm font-black text-white">Programa VIP GSA</p>
                  <p className="text-xs text-white/40">Economize até 30% em cada compra</p>
                </div>
              </div>
              <div className="flex w-full items-center justify-center gap-3 sm:w-auto sm:justify-end">
                <button
                  onClick={goLogin}
                  className="rounded-lg border border-white/15 px-5 py-2.5 text-xs font-bold text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                >
                  Entrar
                </button>
                <button
                  onClick={goRegister}
                  className="rounded-lg bg-yellow-400 px-6 py-2.5 text-xs font-black text-gray-900 shadow-lg shadow-yellow-400/30 transition-all hover:bg-yellow-300 active:scale-95"
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
