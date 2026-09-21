import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, MonitorPlay, Wallet, Users, Settings, Briefcase, Handshake, Box, Plane, HeartPulse, ShieldAlert, BarChart3, Bot, Tv2, Megaphone, Terminal, AlertCircle, Landmark, Truck, MessageSquare, Share2, Crown, ShieldCheck } from 'lucide-react';


interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ElementType;
  keywords: string[];
  module: string;
  tab?: string;
  action?: () => void;
}

const GLOBAL_ACTIONS: ActionItem[] = [
  { id: 'op_orcamentos', title: 'Orçamentos', subtitle: 'Operações e Vendas', icon: Box, keywords: ['vendas', 'orcamentos', 'pedidos', 'compras'], module: 'operacoes', tab: 'orcamentos' },
  { id: 'op_demandas', title: 'Demandas (OS)', subtitle: 'Operações Terceirizadas', icon: Briefcase, keywords: ['os', 'ordem de servico', 'tarefas', 'demandas'], module: 'demandas' },
  { id: 'op_viagens', title: 'Viagens GSA', subtitle: 'Operações', icon: Plane, keywords: ['viagem', 'pacotes', 'turismo', 'passagens'], module: 'viagens' },
  { id: 'op_anuncios', title: 'GSA Anúncios', subtitle: 'Operações Publicitárias', icon: Megaphone, keywords: ['ads', 'marketing', 'campanhas', 'anuncios'], module: 'anuncios' },
  { id: 'fin_faturas', title: 'Faturas e Recebimentos', subtitle: 'Financeiro', icon: Wallet, keywords: ['faturas', 'pagamentos', 'receber', 'boletos', 'pix'], module: 'financeiro', tab: 'faturas' },
  { id: 'fin_cobranca', title: 'Régua de Cobrança', subtitle: 'Financeiro', icon: AlertCircle, keywords: ['cobranca', 'inadimplencia', 'protesto', 'atrasos'], module: 'cobranca' },
  { id: 'fin_emprestimos', title: 'Empréstimos', subtitle: 'Financeiro', icon: Landmark, keywords: ['credito', 'emprestimo', 'financiamento'], module: 'emprestimos' },
  { id: 'pes_clientes', title: 'Clientes', subtitle: 'Cadastros', icon: Users, keywords: ['clientes', 'pessoas', 'usuarios', 'cadastros'], module: 'cadastro', tab: 'clientes' },
  { id: 'pes_prestadores', title: 'Prestadores de Serviço', subtitle: 'Cadastros', icon: Briefcase, keywords: ['prestadores', 'fornecedores', 'parceiros', 'servicos'], module: 'cadastro', tab: 'prestadores' },
  { id: 'pes_fornecedores', title: 'Fornecedores', subtitle: 'Cadastros', icon: Truck, keywords: ['fornecedores', 'estoque', 'produtos'], module: 'fornecedores' },
  { id: 'pes_tickets', title: 'Tickets de Suporte', subtitle: 'Atendimento', icon: MessageSquare, keywords: ['suporte', 'ajuda', 'tickets', 'atendimento', 'sac'], module: 'atendimento' },
  { id: 'rel_afiliados', title: 'Afiliados GSA', subtitle: 'Relacionamento', icon: Share2, keywords: ['afiliados', 'marketing', 'comissoes', 'indicacoes'], module: 'afiliados' },
  { id: 'rel_vip', title: 'Área VIP', subtitle: 'Relacionamento', icon: Crown, keywords: ['vip', 'gamificacao', 'pontos', 'fidelidade'], module: 'area_vip' },
  { id: 'rel_saude', title: 'GSA Saúde', subtitle: 'Relacionamento', icon: HeartPulse, keywords: ['saude', 'planos', 'medico', 'odonto'], module: 'saude' },
  { id: 'rel_seguros', title: 'GSA Seguros', subtitle: 'Relacionamento', icon: ShieldAlert, keywords: ['seguros', 'apolices', 'sinistros'], module: 'seguros' },
  { id: 'sys_relatorios', title: 'Relatórios Gerenciais', subtitle: 'Sistema', icon: BarChart3, keywords: ['relatorios', 'bi', 'dashboards', 'metricas', 'graficos'], module: 'relatorios' },
  { id: 'sys_acessos', title: 'Controle de Acessos', subtitle: 'Sistema', icon: ShieldCheck, keywords: ['acessos', 'permissoes', 'usuarios', 'colaboradores', 'senhas'], module: 'acessos' },
  { id: 'sys_config', title: 'Configurações Globais', subtitle: 'Sistema', icon: Settings, keywords: ['configuracoes', 'ajustes', 'parametros', 'empresa', 'whatsapp'], module: 'configuracoes' },
  { id: 'sys_automacoes', title: 'Automações (Scraping)', subtitle: 'Sistema', icon: Bot, keywords: ['robos', 'scraping', 'automacoes', 'n8n'], module: 'automacoes' },
  { id: 'sys_monitor', title: 'Saúde do Sistema', subtitle: 'Sistema', icon: Terminal, keywords: ['monitor', 'servidor', 'vps', 'cloudflare', 'banco de dados'], module: 'sistema' },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string, tab?: string, itemId?: string) => void;
}

export function AdminCommandPalette({ isOpen, onClose, onNavigate }: Props) {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const filteredActions = GLOBAL_ACTIONS.filter(action => {
    const searchStr = `${action.title} ${action.subtitle} ${action.keywords.join(' ')}`.toLowerCase();
    return searchStr.includes(query.toLowerCase());
  }).slice(0, 7);

  const handleExecute = (action: ActionItem) => {
    if (action.action) {
      action.action();
    } else {
      onNavigate(action.module, action.tab);
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[100] bg-neutral-950/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed left-1/2 top-[15%] z-[101] w-full max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl bg-[#0F0F0F] shadow-2xl ring-1 ring-white/10"
          >
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4">
              <Search className="h-5 w-5 text-indigo-400" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Busque clientes, módulos ou comandos..."
                className="flex-1 bg-transparent text-lg font-bold text-white outline-none placeholder:text-white/30"
              />
              <div className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-white/50">
                <span className="text-xs">ESC</span>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2">
              {filteredActions.length > 0 ? (
                <div className="space-y-1">
                  {filteredActions.map((action, i) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.id}
                        onClick={() => handleExecute(action)}
                        className="group flex w-full items-center gap-4 rounded-xl px-4 py-3 text-left transition hover:bg-indigo-500/20"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/50 transition group-hover:bg-indigo-500 group-hover:text-white shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-white transition group-hover:text-indigo-300">
                            {action.title}
                          </p>
                          <p className="text-xs font-semibold text-white/40 transition group-hover:text-indigo-200/70">
                            {action.subtitle}
                          </p>
                        </div>
                        <div className="hidden text-xs font-bold text-white/20 group-hover:block group-hover:text-indigo-400">
                          Acessar ↵
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-12 text-center">
                  <MonitorPlay className="mx-auto h-12 w-12 text-white/10" />
                  <p className="mt-4 text-sm font-bold text-white/50">Nenhum comando encontrado.</p>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between border-t border-white/10 bg-white/5 px-4 py-3 text-xs font-bold text-white/30">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5"><kbd className="rounded bg-white/10 px-1.5 py-0.5">↑↓</kbd> Navegar</span>
                <span className="flex items-center gap-1.5"><kbd className="rounded bg-white/10 px-1.5 py-0.5">↵</kbd> Executar</span>
              </div>
              <div className="font-black uppercase tracking-widest text-indigo-500">GSA OS OmniBar</div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
