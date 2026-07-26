import type { ReactNode } from 'react';
import { useState } from 'react';
import {
  BellRing, BriefcaseBusiness, Building2, ChevronRight, ClipboardCheck,
  FileClock, FileText, LayoutDashboard, LogOut, Menu, ReceiptText,
  ShieldCheck, Store, UsersRound, X,
} from 'lucide-react';
import type { Cliente } from '../../types';
import { UniversalNotificationBell } from '../ui/UniversalNotificationBell';
import { useClientNotifications } from '../../hooks/useClientNotifications';

export type EnterpriseModule = 'dashboard' | 'servicos' | 'financeiro' | 'documentos' | 'atendimentos' | 'marketplace' | 'empresa' | 'equipe' | 'historico' | 'perfil';

export const ENTERPRISE_LABELS: Record<EnterpriseModule, string> = {
  dashboard: 'Central da Empresa', servicos: 'Serviços Contratados', financeiro: 'Financeiro Empresarial',
  documentos: 'Documentos Fiscais', atendimentos: 'Atendimentos e Protocolos', marketplace: 'Marketplace GSA',
  empresa: 'Dados da Empresa', equipe: 'Equipe e Responsáveis', historico: 'Histórico de Atividades', perfil: 'Segurança e Acesso',
};

interface Props {
  cliente: Cliente;
  activeModule: EnterpriseModule;
  counts: { invoices: number; requests: number; quotes: number };
  onNavigate: (module: string, tab?: string, itemId?: string) => void;
  onLogout: () => void;
  children: ReactNode;
}

export function EnterpriseShell({ cliente, activeModule, counts, onNavigate, onLogout, children }: Props) {
  const [mobileMenu, setMobileMenu] = useState(false);
  const { notifications, unreadNotifications, markAsRead, markAllAsRead, pendencies } = useClientNotifications();
  const menu = [
    ['dashboard', 'Visão geral', LayoutDashboard, 0], ['servicos', 'Serviços', BriefcaseBusiness, counts.quotes],
    ['financeiro', 'Financeiro', ReceiptText, counts.invoices], ['documentos', 'Documentos', FileText, 0],
    ['atendimentos', 'Atendimentos', ClipboardCheck, counts.requests], ['marketplace', 'Marketplace GSA', Store, 0],
    ['empresa', 'Dados da empresa', Building2, 0], ['equipe', 'Equipe e responsáveis', UsersRound, 0],
    ['historico', 'Histórico', FileClock, 0], ['perfil', 'Segurança e acesso', ShieldCheck, pendencies.modulePerfil],
  ] as const;

  return (
    <div className="flex min-h-screen bg-[#f4f6f8] text-[#18212b]">
      {mobileMenu && <button type="button" aria-label="Fechar menu" onClick={() => setMobileMenu(false)} className="fixed inset-0 z-40 bg-[#07111d]/55 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-[292px] flex-col border-r border-white/10 bg-[#091827] text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${mobileMenu ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-24 items-center justify-between border-b border-white/10 px-7">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center border border-[#c8aa64]/40 bg-[#c8aa64]/10"><Building2 className="h-5 w-5 text-[#dfc27d]" /></div><div><p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[#dfc27d]">GSA HUB</p><p className="mt-1 text-sm font-semibold">Portal Empresarial</p></div></div>
          <button type="button" onClick={() => setMobileMenu(false)} className="p-2 text-white/60 lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <div className="border-b border-white/10 px-7 py-6"><p className="truncate text-sm font-semibold">{cliente.nome_razao || cliente.nome}</p><p className="mt-2 text-xs text-white/45">{cliente.cnpj}</p><p className="mt-4 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Sessão empresarial</p></div>
        <nav className="flex-1 overflow-y-auto px-4 py-5"><p className="px-3 pb-3 text-[9px] font-semibold uppercase tracking-[0.22em] text-white/30">Gestão da empresa</p><div className="space-y-1">
          {menu.map(([id, label, Icon, count]) => <button key={id} type="button" onClick={() => { onNavigate(id); setMobileMenu(false); }} className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm transition ${activeModule === id ? 'bg-white text-[#0b1f33]' : 'text-white/65 hover:bg-white/10 hover:text-white'}`}><span className="flex items-center gap-3"><Icon className="h-4 w-4" />{label}</span><span className="flex items-center gap-2">{count > 0 && <span className={`min-w-5 px-1.5 py-0.5 text-center text-[9px] font-bold ${activeModule === id ? 'bg-[#0b1f33] text-white' : 'bg-white/10'}`}>{count}</span>}<ChevronRight className="h-3.5 w-3.5 opacity-40" /></span></button>)}
        </div></nav>
        <div className="border-t border-white/10 p-4"><button type="button" onClick={onLogout} className="flex w-full items-center gap-3 px-4 py-3 text-sm font-semibold text-red-300 hover:bg-red-500/10"><LogOut className="h-4 w-4" /> Encerrar sessão</button></div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-20 items-center justify-between border-b border-[#dce2e8] bg-white/95 px-5 backdrop-blur sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-4"><button type="button" onClick={() => setMobileMenu(true)} className="flex h-10 w-10 items-center justify-center border border-[#d6dde4] lg:hidden"><Menu className="h-5 w-5" /></button><div className="min-w-0"><p className="truncate text-lg font-semibold tracking-[-0.02em] text-[#0b1f33] sm:text-xl">{ENTERPRISE_LABELS[activeModule]}</p><p className="mt-1 hidden truncate text-xs text-[#73808c] sm:block">{cliente.nome_razao || cliente.nome} · {cliente.cnpj}</p></div></div>
          <div className="flex items-center gap-3"><div className="hidden items-center gap-2 border border-[#d8dee5] bg-[#f7f9fa] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#546373] md:flex"><BellRing className="h-3.5 w-3.5" /> Ambiente corporativo</div><UniversalNotificationBell variant="client" notifications={notifications} unreadCount={unreadNotifications} onMarkAsRead={markAsRead} onMarkAllAsRead={markAllAsRead} onNavigate={(module, tab, itemId) => onNavigate(String(module), tab, itemId)} /></div>
        </header>
        <div className="p-5 sm:p-8 lg:p-10">{children}</div>
      </main>
    </div>
  );
}
