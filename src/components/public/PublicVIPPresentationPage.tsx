import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Crown, Star, ShieldCheck, Zap, ArrowLeft, Sparkles, Trophy, Gift,
  Check, ArrowRight, ChevronDown, Award, Gem, Medal, CheckCircle2,
  UserPlus, LogIn, BadgePercent, Wallet, Headphones, Package,
  BarChart3, Users, TrendingUp,
} from 'lucide-react';
import { VIP_LEVELS } from '../../constants';
import { routes } from '../../routing/routeCatalog';
import { navigate } from '../../routing/navigationService';

interface PublicVIPPresentationPageProps {
  onBack?: () => void;
  clientId?: string;
}

/* ─── Design Tokens (balanced palette) ─────────────────────────────────
 *
 *  HERO      : #1a2744 → #17345f  (navy dark, strong brand identity)
 *  BODY      : bg alternates #ffffff ↔ #f4f6fb (off-white, not pure gray)
 *  ACCENT    : #f59e0b (amber-500 — high contrast, warm premium)
 *  SURFACE   : #ffffff cards with border #e5e8ef shadow-sm
 *  TEXT      : #111827 headings · #374151 body · #6b7280 muted
 *  DARK CARD : #1e2d4a surface (for contrast sections inside light bg)
 *
 * ─────────────────────────────────────────────────────────────────────── */

const LEVEL_META: Record<string, {
  icon: any; accent: string; accentBg: string; accentBorder: string; gradHero: string; textAccent: string; ringClass: string;
}> = {
  basico:   { icon: Medal,  accent: '#64748b', accentBg: '#f1f5f9', accentBorder: '#cbd5e1', gradHero: 'from-slate-700 to-slate-800',   textAccent: 'text-slate-500', ringClass: 'ring-slate-300' },
  bronze:   { icon: Award,  accent: '#b45309', accentBg: '#fef3c7', accentBorder: '#fcd34d', gradHero: 'from-amber-700 to-amber-800',   textAccent: 'text-amber-600', ringClass: 'ring-amber-400' },
  prata:    { icon: Star,   accent: '#475569', accentBg: '#f1f5f9', accentBorder: '#94a3b8', gradHero: 'from-slate-600 to-slate-700',   textAccent: 'text-slate-500', ringClass: 'ring-slate-400' },
  ouro:     { icon: Crown,  accent: '#d97706', accentBg: '#fef3c7', accentBorder: '#fbbf24', gradHero: 'from-amber-600 to-yellow-600',  textAccent: 'text-amber-600', ringClass: 'ring-amber-400' },
  diamante: { icon: Gem,    accent: '#0284c7', accentBg: '#e0f2fe', accentBorder: '#7dd3fc', gradHero: 'from-sky-700 to-blue-700',      textAccent: 'text-sky-600',   ringClass: 'ring-sky-400' },
  black:    { icon: Trophy, accent: '#d97706', accentBg: '#111827', accentBorder: '#374151', gradHero: 'from-gray-900 to-gray-950',     textAccent: 'text-amber-400', ringClass: 'ring-gray-600' },
};

const HERO_STATS = [
  { value: '6',   label: 'Níveis VIP exclusivos' },
  { value: '5×',  label: 'Pontos por compra (Black)' },
  { value: '0%',  label: 'Taxa de saque no topo' },
  { value: 'PIX', label: 'Resgate em dinheiro' },
];

const PERKS = [
  { icon: BadgePercent, title: 'Desconto VIP Exclusivo',   desc: 'De 2% a 15% de desconto adicional em produtos e serviços conforme seu nível.', accent: '#f59e0b', bg: '#fffbeb', border: '#fde68a' },
  { icon: BarChart3,    title: 'Multiplicador de Pontos',  desc: 'Ganhe de 0,5× até 5× pontos em cada compra. Pontos não expiram nunca.',        accent: '#10b981', bg: '#f0fdf4', border: '#a7f3d0' },
  { icon: Wallet,       title: 'Resgate via PIX',          desc: 'Converta pontos em dinheiro real e saque direto na sua conta bancária.',         accent: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe' },
  { icon: Headphones,   title: 'Suporte Prioritário',      desc: 'Fila separada de atendimento para membros VIP com resolução acelerada.',         accent: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe' },
  { icon: Package,      title: 'Frete & Taxas Reduzidas',  desc: 'Condições especiais de entrega e taxa de saque progressivamente menor.',         accent: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8' },
  { icon: Gift,         title: 'Cupons & Vouchers',        desc: 'Acesso antecipado a ofertas relâmpago e cupons cumulativos exclusivos.',          accent: '#f97316', bg: '#fff7ed', border: '#fed7aa' },
];

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
  const meta         = LEVEL_META[selectedLevel] || LEVEL_META.ouro;
  const LevelIcon    = meta.icon;

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
    <div className="min-h-screen bg-white font-sans antialiased">

      {/* ── NAVBAR ── white, navy logo, border bottom */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={goBack}
            className="group flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-900"
          >
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-0.5" />
            <span className="hidden sm:inline">Voltar ao Marketplace</span>
          </button>

          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#17345f]">
              <Crown size={16} className="fill-amber-400 text-amber-400" />
            </div>
            <span className="text-sm font-black tracking-tight text-gray-900">
              GSA <span className="text-amber-500">VIP</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {clientId ? (
              <button
                onClick={goDashboard}
                className="flex items-center gap-2 rounded-lg bg-[#17345f] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#0f2342] active:scale-95"
              >
                <Trophy size={13} /> Meu Painel VIP
              </button>
            ) : (
              <>
                <button
                  onClick={goLogin}
                  className="hidden items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 sm:flex"
                >
                  <LogIn size={13} /> Entrar
                </button>
                <button
                  onClick={goRegister}
                  className="flex items-center gap-2 rounded-lg bg-amber-400 px-5 py-2 text-xs font-black text-gray-900 shadow-sm transition-all hover:bg-amber-500 active:scale-95"
                >
                  <UserPlus size={13} /> Cadastrar-se
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ── HERO — navy dark gradient, amber accent ── */}
      <section
        ref={heroRef}
        className="relative overflow-hidden bg-gradient-to-br from-[#17345f] via-[#1e3a6e] to-[#0f2342]"
      >
        {/* Subtle texture overlay */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
        />
        {/* Amber glow */}
        <div className="pointer-events-none absolute -top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-amber-400/15 blur-[100px]" />

        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">

            {/* Left */}
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1">
                <Sparkles size={12} className="text-amber-400" />
                <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
                  Programa de Fidelidade GSA HUB
                </span>
              </div>

              <h1 className="text-4xl font-black leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Economize mais em<br />
                <span className="text-amber-400">toda compra</span> no GSA
              </h1>

              <p className="max-w-md text-base text-white/65 sm:text-lg leading-relaxed">
                Pontos que viram dinheiro. Descontos exclusivos. Frete reduzido.
                Cadastro <strong className="font-black text-white/90">100% gratuito.</strong>
              </p>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={goRegister}
                  className="group flex items-center justify-center gap-2.5 rounded-xl bg-amber-400 px-8 py-4 text-sm font-black text-gray-900 shadow-lg shadow-amber-400/25 transition-all hover:bg-amber-300 hover:shadow-amber-400/40 hover:scale-[1.02] active:scale-95"
                >
                  Cadastrar Gratuitamente
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </button>
                <button
                  onClick={goLogin}
                  className="flex items-center justify-center gap-2 rounded-xl border border-white/25 bg-white/10 px-8 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                >
                  Já tenho conta
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-5 border-t border-white/15 pt-7 sm:grid-cols-4">
                {HERO_STATS.map((s, i) => (
                  <div key={i}>
                    <p className="text-2xl font-black text-amber-400 sm:text-3xl">{s.value}</p>
                    <p className="mt-0.5 text-[11px] font-medium text-white/45 leading-tight">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Member Cards */}
            <div className="relative hidden lg:flex items-center justify-center">
              <div className="relative h-80 w-full max-w-sm">
                {[
                  { label: 'Black VIP',    sub: '5× Pontos · 0% Taxa',  offsetY: 0,  offsetX: 0,   scale: 1,    z: 30, bg: '#0f172a', border: 'rgba(251,191,36,0.5)', textColor: '#fff', accent: '#fbbf24' },
                  { label: 'Diamante VIP', sub: '4× Pontos · 1% Taxa',  offsetY: 26, offsetX: -22, scale: 0.93, z: 20, bg: '#fff',    border: 'rgba(14,165,233,0.4)',  textColor: '#111827', accent: '#0ea5e9' },
                  { label: 'Ouro VIP',     sub: '3× Pontos · 2% Taxa',  offsetY: 50, offsetX: -44, scale: 0.86, z: 10, bg: '#fff',    border: 'rgba(245,158,11,0.4)',  textColor: '#111827', accent: '#f59e0b' },
                ].map((card, i) => (
                  <div
                    key={i}
                    style={{ transform: `translateX(${card.offsetX}px) translateY(${card.offsetY}px) scale(${card.scale})`, zIndex: card.z, backgroundColor: card.bg, borderColor: card.border }}
                    className="absolute left-0 right-0 mx-auto w-80 rounded-2xl border-2 p-6 shadow-2xl"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: card.accent + 'aa' }}>Cartão de Membro</p>
                        <h3 className="mt-1 text-xl font-black" style={{ color: card.textColor }}>{card.label}</h3>
                        <p className="mt-0.5 text-xs font-medium" style={{ color: card.textColor + '80' }}>{card.sub}</p>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: card.accent + '20' }}>
                        <Crown size={18} style={{ color: card.accent }} />
                      </div>
                    </div>
                    <div className="mt-5 flex items-center justify-between border-t pt-4" style={{ borderColor: card.textColor + '15' }}>
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: card.textColor + '40' }}>Acumulado</p>
                        <p className="text-sm font-black" style={{ color: card.accent }}>GSA Pontos</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: card.textColor + '40' }}>Resgate</p>
                        <p className="text-sm font-black text-emerald-500">Via PIX</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFÍCIOS — off-white bg, colorful cards ── */}
      <section className="bg-[#f4f6fb] py-16 border-y border-gray-200">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-amber-500">Por que ser membro</p>
              <h2 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">
                Vantagens em <span className="text-[#17345f]">cada compra</span> no GSA
              </h2>
            </div>
            <button
              onClick={goRegister}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-[#17345f] px-6 py-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0f2342] active:scale-95"
            >
              Criar conta grátis <ArrowRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((perk, i) => (
              <div
                key={i}
                className="group flex items-start gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5"
                style={{ borderColor: perk.border + '60' }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border transition-colors"
                  style={{ backgroundColor: perk.bg, borderColor: perk.border, color: perk.accent }}
                >
                  <perk.icon size={21} strokeWidth={1.75} />
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

      {/* ── TABELA DE NÍVEIS — white bg ── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-amber-500">Evolua e ganhe mais</p>
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
                    active ? 'shadow-md scale-105' : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-700'
                  }`}
                  style={active ? {
                    backgroundColor: lm.accentBg,
                    borderColor: lm.accentBorder,
                    color: lm.accent,
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mx-auto max-w-4xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md"
            >
              {/* Card header — dark navy for all selected level headers */}
              <div className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between bg-[#17345f]">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl border-2"
                    style={{ backgroundColor: meta.accent + '20', borderColor: meta.accent + '60' }}
                  >
                    <LevelIcon size={24} style={{ color: meta.accent }} />
                  </div>
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-white/50">Nível {currentLevel.name}</p>
                    <h3 className="text-2xl font-black text-white">{currentLevel.name} VIP</h3>
                  </div>
                </div>
                <div className="flex gap-8">
                  {[
                    { label: 'Pontos/R$1',    value: `${currentLevel.multiplier}×`, color: meta.accent },
                    { label: 'Desconto Extra', value: `${currentLevel.discountPercentage}%`, color: '#34d399' },
                    { label: 'Taxa Saque',     value: `${currentLevel.feePercentage}%`, color: '#60a5fa' },
                  ].map(({ label, value, color }, i) => (
                    <div key={i} className="text-center">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/40">{label}</p>
                      <p className="text-2xl font-black" style={{ color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Benefits grid — white bg */}
              <div className="grid grid-cols-1 sm:grid-cols-2">
                <div className="border-b border-gray-100 p-6 sm:border-b-0 sm:border-r">
                  <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
                    <CheckCircle2 size={13} className="text-emerald-500" /> Benefícios Inclusos
                  </p>
                  <ul className="space-y-2.5">
                    {currentLevel.benefits.slice(0, 6).map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700">
                        <Check size={12} className="mt-0.5 shrink-0 text-emerald-500" /> {b}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="p-6">
                  <p className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
                    <Sparkles size={13} className="text-amber-500" /> Exclusivos deste Nível
                  </p>
                  <ul className="space-y-2.5">
                    {currentLevel.exclusiveBenefits.length > 0 ? (
                      currentLevel.exclusiveBenefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-xs font-semibold text-gray-900">
                          <Star size={12} className="mt-0.5 shrink-0 fill-amber-400 text-amber-400" /> {b}
                        </li>
                      ))
                    ) : (
                      <li className="text-xs text-gray-400">Crie sua conta e comece a acumular pontos para desbloquear benefícios.</li>
                    )}
                  </ul>
                </div>
              </div>

              {/* CTA footer — light off-white */}
              <div className="flex flex-col items-start justify-between gap-4 border-t border-gray-100 bg-[#f8f9fc] px-6 py-4 sm:flex-row sm:items-center">
                <p className="text-xs text-gray-500">Inicie no nível Básico gratuitamente. Suba automaticamente comprando no GSA.</p>
                <button
                  onClick={goRegister}
                  className="flex shrink-0 items-center gap-2 rounded-xl bg-amber-400 px-5 py-2.5 text-xs font-black text-gray-900 shadow-sm transition-all hover:bg-amber-500 active:scale-95 cursor-pointer"
                >
                  Quero ser {currentLevel.name} VIP <ArrowRight size={13} />
                </button>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Comparison Table */}
          <div className="mt-10 overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-[#f4f6fb]">
                  {['Nível', 'Pontos Mínimos', 'Multiplicador', 'Desconto', 'Taxa Saque'].map(h => (
                    <th key={h} className="px-5 py-3.5 text-left font-black uppercase tracking-widest text-gray-400">{h}</th>
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
                      className="cursor-pointer border-b border-gray-50 last:border-0 transition-colors hover:bg-amber-50/60"
                      style={isSelected ? { backgroundColor: lm.accentBg + '80' } : {}}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <LvlIcon size={14} style={{ color: lm.accent }} />
                          <span className={`font-black ${isSelected ? 'text-gray-900' : 'text-gray-600'}`}>{level.name}</span>
                          {isSelected && (
                            <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: lm.accentBorder + '60', color: lm.accent }}>
                              Selecionado
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-400">{level.minPoints} — {level.maxPoints ?? '∞'}</td>
                      <td className="px-5 py-3.5 font-black" style={{ color: lm.accent }}>{level.multiplier}×</td>
                      <td className="px-5 py-3.5 font-bold text-emerald-600">{level.discountPercentage}%</td>
                      <td className="px-5 py-3.5 font-bold text-blue-600">{level.feePercentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── SIMULADOR — off-white bg ── */}
      <section className="bg-[#f4f6fb] py-16 border-y border-gray-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
            {/* Header — navy */}
            <div className="border-b border-gray-100 bg-[#17345f] px-6 py-6 sm:px-8">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-400/20 border border-amber-400/30">
                  <BarChart3 size={21} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-[11px] font-black uppercase tracking-widest text-white/40">Calculadora VIP</p>
                  <h2 className="text-xl font-black text-white">Simule sua economia anual</h2>
                </div>
              </div>
            </div>

            <div className="p-6 sm:p-8">
              {/* Slider */}
              <div className="mb-8">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-600">Gasto mensal estimado no GSA</p>
                  <p className="text-2xl font-black text-gray-900">{simulatedSpend.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                <input
                  type="range" min={100} max={5000} step={100}
                  value={simulatedSpend}
                  onChange={e => setSimulatedSpend(Number(e.target.value))}
                  className="w-full cursor-pointer accent-amber-500"
                  style={{ height: 6 }}
                />
                <div className="mt-2 flex justify-between text-xs text-gray-400 font-medium">
                  <span>R$ 100</span><span>R$ 2.500</span><span>R$ 5.000</span>
                </div>
              </div>

              {/* Level selector */}
              <div className="mb-6 flex flex-wrap gap-2">
                <p className="w-full text-[11px] font-black uppercase tracking-widest text-gray-400 mb-1">Nível para simular:</p>
                {VIP_LEVELS.map(level => {
                  const lm = LEVEL_META[level.id];
                  const active = selectedLevel === level.id;
                  return (
                    <button
                      key={level.id}
                      onClick={() => setSelectedLevel(level.id)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                        active ? 'shadow-sm' : 'border-gray-200 bg-gray-50 text-gray-500 hover:text-gray-700'
                      }`}
                      style={active ? { backgroundColor: lm.accentBg, borderColor: lm.accentBorder, color: lm.accent } : {}}
                    >
                      {level.name}
                    </button>
                  );
                })}
              </div>

              {/* Results */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  { label: 'Pontos por mês',     value: `${pointsMonth.toLocaleString('pt-BR')} pts`, color: '#111827', bg: '#f4f6fb', border: '#e5e7eb' },
                  { label: 'Pontos no ano',       value: `${yearlyPts.toLocaleString('pt-BR')} pts`,   color: '#d97706', bg: '#fffbeb', border: '#fde68a' },
                  { label: 'Resgate PIX anual',   value: yearlyCash,                                    color: '#059669', bg: '#f0fdf4', border: '#a7f3d0' },
                  { label: 'Desc. adicional/ano', value: yearlySave,                                    color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
                ].map((r, i) => (
                  <div key={i} className="rounded-xl border p-4" style={{ backgroundColor: r.bg, borderColor: r.border }}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{r.label}</p>
                    <p className="mt-1.5 text-lg font-black sm:text-xl" style={{ color: r.color }}>{r.value}</p>
                  </div>
                ))}
              </div>

              <p className="mt-4 text-xs text-gray-400">
                * Estimativa com base no multiplicador do nível <strong className="text-gray-600">{currentLevel.name}</strong> ({currentLevel.multiplier}×) e {currentLevel.discountPercentage}% de desconto adicional. Valores aproximados.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ — white bg ── */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <div className="mb-10 text-center">
            <p className="text-xs font-black uppercase tracking-widest text-amber-500">Dúvidas frequentes</p>
            <h2 className="mt-1 text-2xl font-black text-gray-900 sm:text-3xl">Perguntas Frequentes</h2>
            <p className="mt-2 text-sm text-gray-500">Tudo que você precisa saber antes de se cadastrar.</p>
          </div>
          <div className="space-y-2">
            {faqs.map((faq, index) => (
              <div key={index} className="overflow-hidden rounded-xl border border-gray-200 bg-white transition-colors hover:border-gray-300 shadow-sm">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left cursor-pointer"
                >
                  <span className="text-sm font-bold text-gray-900">{faq.q}</span>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 text-gray-400 transition-transform ${openFaq === index ? 'rotate-180 text-amber-500' : ''}`}
                  />
                </button>
                <AnimatePresence>
                  {openFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="border-t border-gray-100 bg-[#f8f9fc] px-5 py-4 text-sm leading-relaxed text-gray-600"
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

      {/* ── BOTTOM CTA — navy dark, strong contrast ── */}
      <section className="relative overflow-hidden bg-[#17345f] py-20">
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '28px 28px' }}
        />
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400/20 blur-[80px]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 shadow-xl shadow-amber-400/30">
            <Crown size={30} className="fill-gray-900 text-gray-900" />
          </div>
          <h2 className="text-3xl font-black text-white sm:text-4xl lg:text-5xl">Pronto para ter acesso VIP?</h2>
          <p className="mx-auto mt-4 max-w-lg text-sm text-white/60 leading-relaxed">
            Crie sua conta gratuitamente em menos de 1 minuto e comece a acumular pontos em cada compra no GSA HUB.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={goRegister}
              className="w-full sm:w-auto rounded-xl bg-amber-400 px-10 py-4 text-sm font-black text-gray-900 shadow-lg shadow-amber-400/25 transition-all hover:bg-amber-300 hover:shadow-amber-400/40 hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              Criar Conta Gratuita
            </button>
            <button
              onClick={goLogin}
              className="w-full sm:w-auto rounded-xl border border-white/25 bg-white/10 px-10 py-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 cursor-pointer"
            >
              Fazer Login
            </button>
          </div>
        </div>
      </section>

      {/* ── FOOTER — dark navy ── */}
      <footer className="bg-[#0f2342] py-6 text-center text-xs text-white/30">
        © 2026 GSA HUB — Gestão de Serviços & Tecnologia. Todos os direitos reservados.
      </footer>

      {/* ── STICKY CTA — white with shadow ── */}
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
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#17345f]">
                  <Crown size={15} className="fill-amber-400 text-amber-400" />
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
                  className="rounded-lg bg-amber-400 px-6 py-2.5 text-xs font-black text-gray-900 shadow-sm transition-all hover:bg-amber-500 active:scale-95"
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
