import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Crown,
  Lock,
  ShieldCheck,
  Star,
  Wallet,
} from 'lucide-react';
import { Cliente, Module } from '../../types';
import { formatCurrency } from '../../lib/utils';
import { useVipLevels } from '../../hooks/useVipLevels';

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  count: number;
  locked?: boolean;
}

interface ClientDashboardProps {
  menuItems: MenuItem[];
  onNavigate: (module: Module) => void;
  cliente: Cliente;
  vipModuleConfig?: { ativo: boolean; oculto: boolean };
}

const MODULE_META: Record<string, { eyebrow: string; description: string }> = {
  perfil: { eyebrow: 'Cadastro pessoal', description: 'Dados, documentos e informações da sua conta.' },
  gsa_store: { eyebrow: 'Compras e benefícios', description: 'Loja, pedidos, assinaturas, trocas e ofertas.' },
  servicos_assinaturas: { eyebrow: 'Relacionamento operacional', description: 'Orçamentos, serviços contratados e assinaturas.' },
  financeiro: { eyebrow: 'Vida financeira', description: 'Faturas, carteira, extrato, crédito e movimentações.' },
  fidelidade: { eyebrow: 'Relacionamento GSA', description: 'Pontos, vantagens, indicações e programa de fidelidade.' },
  area_vip: { eyebrow: 'Benefícios do relacionamento', description: 'Condições e vantagens vinculadas ao seu nível atual.' },
  suporte: { eyebrow: 'Atendimento', description: 'Chamados, orientações e acompanhamento com a equipe GSA.' },
};

export function ClientDashboard({ menuItems, onNavigate, cliente, vipModuleConfig }: ClientDashboardProps) {
  const vipAtivo = vipModuleConfig?.ativo ?? true;
  const vipOculto = vipModuleConfig?.oculto ?? false;
  const { levels } = useVipLevels();
  const [showLevelUpdate, setShowLevelUpdate] = React.useState(false);
  const [previousLevel, setPreviousLevel] = React.useState<string | null>(null);

  const currentPoints = Number(cliente.pontos_totais || 0);
  let currentLevel: any = null;

  if (levels.length > 0) {
    const manualId = cliente.nivel_manual_id;
    const autoId = cliente.nivel_id;

    if (manualId) {
      currentLevel = (levels as any[]).find((level: any) => level.dbId === manualId)
        || (cliente.manual_level
          ? levels.find((level) => level.name.toLowerCase() === (cliente.manual_level as any)?.nome_nivel?.toLowerCase())
          : null);
    }

    if (!currentLevel && autoId) {
      currentLevel = (levels as any[]).find((level: any) => level.dbId === autoId)
        || (cliente.auto_level
          ? levels.find((level) => level.name.toLowerCase() === (cliente.auto_level as any)?.nome_nivel?.toLowerCase())
          : null);
    }

    if (!currentLevel) {
      currentLevel = levels.find((level) => currentPoints >= level.minPoints && (level.maxPoints === null || currentPoints <= level.maxPoints)) || levels[0];
    }
  }

  currentLevel = currentLevel || {
    name: 'Básico',
    minPoints: 0,
    maxPoints: null,
    multiplier: 1,
    color: '#8a6b2f',
  };

  React.useEffect(() => {
    const levelName = currentLevel.name;
    if (previousLevel && levelName && previousLevel !== levelName) {
      setShowLevelUpdate(true);
    }
    if (levelName) setPreviousLevel(levelName);
  }, [currentLevel.name, previousLevel]);

  const displayItems = menuItems.filter((item) => item.id !== 'dashboard' && !(item.id === 'area_vip' && vipOculto));
  const pendingItems = displayItems.filter((item) => !item.locked && Number(item.count || 0) > 0);
  const isBlocked = (
    ['bloqueado', 'inativo', 'excluido'].includes(String(cliente?.status || '').toLowerCase())
    || cliente?.cadastro_aprovado === false
    || cliente?.bloqueado === true
  );

  const currentLevelIndex = levels.findIndex((level) => level.name === currentLevel.name);
  const nextLevel = currentLevelIndex >= 0 ? levels[currentLevelIndex + 1] : undefined;
  const progress = nextLevel ? Math.min(100, (currentPoints / Math.max(1, nextLevel.minPoints)) * 100) : 100;
  const firstName = String(cliente.nome || 'Cliente').trim().split(/\s+/)[0];

  const handleModuleClick = (item: MenuItem) => {
    if (item.locked) return;
    onNavigate(item.id as Module);
  };

  const todayLabel = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  }).format(new Date());

  return (
    <div className="relative space-y-7 pb-12 text-[#15202b]">
      <AnimatePresence>
        {showLevelUpdate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07111d]/65 p-5 backdrop-blur-sm"
            onClick={() => setShowLevelUpdate(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="w-full max-w-lg overflow-hidden rounded-2xl border border-[#d8bd73]/35 bg-[#f8f5ee] shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-[#d8d0c2] bg-[#0c1c2b] px-7 py-6 text-white">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#d8bd73]">Atualização do relacionamento</p>
                <h2 className="mt-3 text-3xl font-semibold tracking-[-0.035em]">Seu nível GSA foi atualizado.</h2>
              </div>
              <div className="p-7">
                <div className="flex items-center gap-4 border-l-2 border-[#b8903e] pl-5">
                  <Crown className="h-7 w-7 text-[#806329]" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#806329]">Novo nível</p>
                    <p className="mt-1 text-2xl font-black text-[#15202b]">{currentLevel.name}</p>
                  </div>
                </div>
                <p className="mt-6 text-sm leading-7 text-[#606a72]">As vantagens correspondentes já estão disponíveis na área de fidelidade e benefícios.</p>
                <button
                  type="button"
                  onClick={() => setShowLevelUpdate(false)}
                  className="mt-7 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-[#152332] px-5 text-sm font-black text-white hover:bg-[#223449]"
                >
                  Continuar no portal
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="overflow-hidden rounded-2xl border border-[#d8d0c2] bg-[#f8f5ee] shadow-[0_18px_50px_rgba(25,34,43,0.07)]">
        <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
          <div className="relative overflow-hidden bg-[#0b1825] px-6 py-8 text-white sm:px-8 sm:py-10">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[#d8bd73]/15" />
            <div className="pointer-events-none absolute right-12 top-20 h-40 w-40 rounded-full border border-white/8" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-[#d8bd73]">Central pessoal GSA</p>
            <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.02] tracking-[-0.045em] sm:text-5xl">
              Olá, {firstName}. O que precisa da sua atenção está reunido aqui.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/62 sm:text-base">
              Acompanhe sua relação com a GSA, consulte compromissos financeiros e continue serviços sem procurar informações em vários lugares.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs font-bold text-white/55">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#d8bd73]" />Ambiente autenticado</span>
              <span className="inline-flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#d8bd73]" />{todayLabel}</span>
            </div>
          </div>

          <div className="flex flex-col justify-between border-t border-[#d8d0c2] bg-white p-6 lg:border-l lg:border-t-0 lg:p-8">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806329]">Situação da conta</p>
              <div className="mt-5 flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${isBlocked ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {isBlocked ? <Lock className="h-5 w-5" /> : <BadgeCheck className="h-5 w-5" />}
                </span>
                <div>
                  <p className="font-black text-[#15202b]">{isBlocked ? 'Acesso com restrições' : 'Conta ativa'}</p>
                  <p className="mt-1 text-xs leading-5 text-[#69727a]">{isBlocked ? 'Algumas ações estão indisponíveis até a regularização.' : 'Seus módulos estão disponíveis conforme a contratação.'}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleModuleClick({ id: 'perfil', label: 'Perfil', icon: BadgeCheck, count: 0 })}
              className="mt-8 flex items-center justify-between border-t border-[#e2ddd4] pt-5 text-left"
            >
              <span><strong className="block text-sm">Revisar dados da conta</strong><span className="mt-1 block text-xs text-[#747c83]">Cadastro, documentos e contatos.</span></span>
              <ArrowRight className="h-4 w-4 text-[#806329]" />
            </button>
          </div>
        </div>
      </section>

      {isBlocked && (
        <section className="flex items-start gap-4 rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-red-900">
          <Lock className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-black">Sua conta possui restrições operacionais.</p>
            <p className="mt-1 text-sm leading-6 text-red-800">Acesse o perfil ou o suporte para consultar o motivo e solicitar regularização.</p>
          </div>
        </section>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => handleModuleClick({ id: 'financeiro', label: 'Financeiro', icon: Wallet, count: 0 })}
          className="group rounded-2xl border border-[#d8d0c2] bg-white p-6 text-left transition hover:border-[#9f8140] hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#142536] text-[#d8bd73]"><Wallet className="h-5 w-5" /></span>
            <ChevronRight className="h-4 w-4 text-[#8a6b2f] transition group-hover:translate-x-1" />
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-[#806329]">Carteira GSA</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#15202b]">{formatCurrency(Number(cliente.saldo_carteira || 0))}</p>
          <p className="mt-2 text-xs leading-5 text-[#6d757c]">Saldo disponível e movimentações financeiras.</p>
        </button>

        <button
          type="button"
          onClick={() => handleModuleClick({ id: 'fidelidade', label: 'Fidelidade', icon: Star, count: 0 })}
          className="group rounded-2xl border border-[#d8d0c2] bg-white p-6 text-left transition hover:border-[#9f8140] hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f2ead5] text-[#806329]"><Star className="h-5 w-5" /></span>
            <ChevronRight className="h-4 w-4 text-[#8a6b2f] transition group-hover:translate-x-1" />
          </div>
          <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-[#806329]">Pontos disponíveis</p>
          <p className="mt-2 text-3xl font-black tracking-[-0.035em] text-[#15202b]">{Number(cliente.saldo_pontos || 0).toLocaleString('pt-BR')}</p>
          <p className="mt-2 text-xs leading-5 text-[#6d757c]">Consulte benefícios, histórico e oportunidades.</p>
        </button>

        {!vipOculto ? (
          <button
            type="button"
            disabled={!vipAtivo}
            onClick={() => vipAtivo && handleModuleClick({ id: 'area_vip', label: 'Área VIP', icon: Crown, count: 0 })}
            className="group rounded-2xl border border-[#bea35e] bg-[#172433] p-6 text-left text-white transition hover:bg-[#223449] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#d8bd73]/35 bg-white/5 text-[#d8bd73]"><Crown className="h-5 w-5" /></span>
              <ChevronRight className="h-4 w-4 text-[#d8bd73] transition group-hover:translate-x-1" />
            </div>
            <p className="mt-6 text-[10px] font-black uppercase tracking-[0.18em] text-[#d8bd73]">Relacionamento atual</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.035em]">{currentLevel.name}</p>
            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#d8bd73]" style={{ width: `${progress}%` }} /></div>
            <p className="mt-3 text-xs leading-5 text-white/55">{nextLevel ? `Progresso para ${nextLevel.name}.` : 'Você está no nível mais alto disponível.'}</p>
          </button>
        ) : (
          <div className="rounded-2xl border border-[#d8d0c2] bg-[#f8f5ee] p-6">
            <CircleDollarSign className="h-6 w-6 text-[#806329]" />
            <p className="mt-6 font-black">Relacionamento GSA</p>
            <p className="mt-2 text-xs leading-5 text-[#68717a]">Benefícios são apresentados quando disponibilizados para a sua conta.</p>
          </div>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="rounded-2xl border border-[#d8d0c2] bg-[#f8f5ee] p-6 sm:p-7">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806329]">Prioridades</p>
          <h2 className="mt-3 text-2xl font-black tracking-[-0.03em]">O que precisa ser visto agora</h2>
          {pendingItems.length > 0 ? (
            <div className="mt-6 space-y-2">
              {pendingItems.slice(0, 5).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleModuleClick(item)}
                  className="flex w-full items-center justify-between rounded-xl border border-[#ddd5c8] bg-white px-4 py-3 text-left hover:border-[#a88945]"
                >
                  <span className="flex min-w-0 items-center gap-3"><item.icon className="h-4 w-4 shrink-0 text-[#806329]" /><span className="truncate text-sm font-bold">{item.label}</span></span>
                  <span className="rounded-full bg-[#172433] px-2.5 py-1 text-[10px] font-black text-white">{item.count}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-xl border border-dashed border-[#cfc4b1] bg-white/55 p-5">
              <ShieldCheck className="h-5 w-5 text-emerald-700" />
              <p className="mt-3 font-black">Nenhuma pendência destacada.</p>
              <p className="mt-2 text-xs leading-5 text-[#68717a]">Você pode continuar pelos módulos ao lado.</p>
            </div>
          )}
        </div>

        <div>
          <div className="flex items-end justify-between border-b border-[#d8d0c2] pb-5">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#806329]">Áreas do portal</p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.03em]">Continue pelo assunto que deseja resolver</h2>
            </div>
          </div>

          <div className="mt-4 divide-y divide-[#ded7cb] border-y border-[#ded7cb]">
            {displayItems.map((item) => {
              const meta = MODULE_META[item.id] || { eyebrow: 'Área do cliente', description: 'Acesse informações e ações deste módulo.' };
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.locked}
                  onClick={() => handleModuleClick(item)}
                  className="group grid w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-4 py-5 text-left transition hover:bg-white/55 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-[#d8d0c2] bg-white text-[#806329]"><item.icon className="h-5 w-5" /></span>
                  <span className="min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-[#8a6b2f]">{meta.eyebrow}</span>
                    <strong className="mt-1 block text-base text-[#15202b]">{item.label}</strong>
                    <span className="mt-1 block text-xs leading-5 text-[#6a737a]">{meta.description}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {item.count > 0 && !item.locked && <span className="rounded-full bg-[#152332] px-2 py-1 text-[10px] font-black text-white">{item.count}</span>}
                    {item.locked ? <Lock className="h-4 w-4 text-[#8d9499]" /> : <ArrowRight className="h-4 w-4 text-[#806329] transition group-hover:translate-x-1" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
