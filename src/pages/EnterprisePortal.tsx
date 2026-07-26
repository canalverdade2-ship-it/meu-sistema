import { useCallback, useEffect, useState } from 'react';
import { Building2, FileClock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { logService } from '../lib/logService';
import { navigate } from '../routing/navigationService';
import { useAppLocation } from '../routing/useAppLocation';
import type { Cliente } from '../types';
import { ClientServicosAssinaturas } from '../components/client/ClientServicosAssinaturas';
import { ClientFinanceiro } from '../components/client/ClientFinanceiro';
import { ClientSuporte } from '../components/client/ClientSuporte';
import { ClientProfile } from '../components/client/ClientProfile';
import { MarketplaceGSAStore } from '../components/client/marketplace/MarketplaceGSAStore';
import { NotasFiscaisList } from '../components/client/financeiro/NotasFiscaisList';
import { createNotification } from '../lib/notifications';
import { EnterpriseDashboard, type EnterpriseSnapshot } from '../components/enterprise/EnterpriseDashboard';
import { EnterpriseCompanyProfile } from '../components/enterprise/EnterpriseCompanyProfile';
import { EnterpriseTeam } from '../components/enterprise/EnterpriseTeam';
import { EnterpriseShell, type EnterpriseModule } from '../components/enterprise/EnterpriseShell';

interface Props { clientId: string; onLogout: () => void; initialModule?: string; initialStoreTab?: string; initialStoreItemId?: string; }
const EMPTY: EnterpriseSnapshot = { counts: { pending_invoices: 0, overdue_invoices: 0, open_requests: 0, open_quotes: 0, active_services: 0, issued_documents: 0 }, next_invoices: [], recent_requests: [], recent_activity: [] };
const MODULES: EnterpriseModule[] = ['dashboard', 'servicos', 'financeiro', 'documentos', 'atendimentos', 'marketplace', 'empresa', 'equipe', 'historico', 'perfil'];

function normalize(value?: string): EnterpriseModule {
  const item = String(value || 'dashboard').replaceAll('_', '-');
  if (['servicos-e-assinaturas', 'servicos-assinaturas'].includes(item)) return 'servicos';
  if (item === 'suporte') return 'atendimentos';
  if (['gsa-store', 'loja'].includes(item)) return 'marketplace';
  return MODULES.includes(item as EnterpriseModule) ? item as EnterpriseModule : 'dashboard';
}

function pathFor(module: EnterpriseModule, tab?: string, itemId?: string) {
  const params = new URLSearchParams();
  if (tab) params.set('tab', tab);
  if (itemId) params.set('itemId', itemId);
  return `/empresa/${module}${params.size ? `?${params}` : ''}`;
}

async function fallback(clientId: string): Promise<EnterpriseSnapshot> {
  const today = new Date().toISOString().slice(0, 10);
  const [faturas, tickets, orcamentos, servicos, assinaturas, fiscais] = await Promise.all([
    supabase.from('faturas').select('id,codigo_fatura,data_vencimento,valor_total,status').eq('cliente_id', clientId).in('status', ['pendente', 'vencida', 'aguardando_link', 'pendente_pagamento', 'revisada']).order('data_vencimento').limit(10),
    supabase.from('tickets').select('id,assunto,status,data_abertura').eq('cliente_id', clientId).neq('status', 'concluido').order('data_abertura', { ascending: false }).limit(10),
    supabase.from('orcamentos').select('id', { count: 'exact', head: true }).eq('cliente_id', clientId),
    supabase.from('ordens_servico').select('id', { count: 'exact', head: true }).eq('cliente_id', clientId).eq('status', 'andamento'),
    supabase.from('ordens_assinatura').select('id', { count: 'exact', head: true }).eq('cliente_id', clientId).in('status', ['em_analise', 'concluido']),
    supabase.from('ordens_fiscais').select('id', { count: 'exact', head: true }).eq('cliente_id', clientId).eq('status_emissao', 'emitida'),
  ]);
  const invoices = faturas.data || []; const requests = tickets.data || [];
  return { counts: { pending_invoices: invoices.length, overdue_invoices: invoices.filter((x: any) => x.status === 'vencida' || x.data_vencimento < today).length, open_requests: requests.length, open_quotes: orcamentos.count || 0, active_services: (servicos.count || 0) + (assinaturas.count || 0), issued_documents: fiscais.count || 0 }, next_invoices: invoices.slice(0, 5).map((x: any) => ({ id: x.id, code: x.codigo_fatura, due_date: x.data_vencimento, amount: Number(x.valor_total || 0), status: x.status })), recent_requests: requests.slice(0, 5).map((x: any) => ({ id: x.id, subject: x.assunto, status: x.status, opened_at: x.data_abertura })), recent_activity: [] };
}

function History({ snapshot }: { snapshot: EnterpriseSnapshot }) {
  return <section className="overflow-hidden border border-[#d8dee5] bg-white"><div className="border-b border-[#e1e6eb] p-6 sm:p-8"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71808f]">Rastreabilidade</p><h2 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#0b1f33]">Histórico de atividades</h2></div>{snapshot.recent_activity.length === 0 ? <div className="p-10 text-center"><FileClock className="mx-auto h-8 w-8 text-[#9ba6b1]" /><p className="mt-3 text-sm font-semibold text-[#334355]">Nenhuma atividade empresarial registrada</p></div> : <div className="divide-y divide-[#edf0f3]">{snapshot.recent_activity.map((event) => <div key={event.id} className="grid gap-2 px-6 py-5 sm:grid-cols-[1fr_auto]"><div><p className="text-sm font-semibold text-[#0b1f33]">{event.description}</p><p className="mt-1 text-xs uppercase tracking-[0.08em] text-[#71808f]">{event.module || 'portal'} · {event.event_type}</p></div><time className="text-xs text-[#71808f]">{new Date(event.created_at).toLocaleString('pt-BR')}</time></div>)}</div>}</section>;
}

export function EnterprisePortal({ clientId, onLogout, initialModule, initialStoreTab, initialStoreItemId }: Props) {
  const route = useAppLocation();
  const enterpriseRoute = route.pathname === '/empresa' || route.pathname.startsWith('/empresa/');
  const activeModule = normalize(enterpriseRoute ? route.module : initialModule);
  const activeTab = enterpriseRoute ? route.query.tab : initialStoreTab;
  const activeItemId = enterpriseRoute ? route.query.itemId : initialStoreItemId;
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [snapshot, setSnapshot] = useState<EnterpriseSnapshot>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: company, error } = await supabase.from('clientes').select('*, auto_level:client_levels!nivel_id(*), manual_level:client_levels!nivel_manual_id(*)').eq('id', clientId).single();
      if (error || !company || company.tipo_pessoa !== 'pj') throw new Error('Cadastro empresarial não localizado.');
      setCliente(company as Cliente);
      const { data, error: rpcError } = await supabase.rpc('gsa_enterprise_portal_snapshot');
      setSnapshot(!rpcError && data?.success ? { counts: { ...EMPTY.counts, ...data.counts }, next_invoices: data.next_invoices || [], recent_requests: data.recent_requests || [], recent_activity: data.recent_activity || [] } : await fallback(clientId));
    } catch (error: any) { toast.error(error?.message || 'Não foi possível carregar o Portal Empresarial.'); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const channel = supabase.channel(`enterprise-${clientId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'faturas', filter: `cliente_id=eq.${clientId}` }, load).on('postgres_changes', { event: '*', schema: 'public', table: 'tickets', filter: `cliente_id=eq.${clientId}` }, load).subscribe(); return () => { supabase.removeChannel(channel); }; }, [clientId, load]);

  const go = (module: string, tab?: string, itemId?: string) => {
    let target = normalize(module);
    if (['orcamentos', 'produtos', 'assinaturas', 'servicos_assinaturas'].includes(module)) target = 'servicos';
    if (module === 'suporte') target = 'atendimentos';
    if (['gsa_store', 'loja', 'classificados'].includes(module)) target = 'marketplace';
    navigate(pathFor(target, tab, itemId));
  };

  const openTicket = async (assunto: string, descricao: string) => {
    const { data, error } = await supabase.from('tickets').insert({ cliente_id: clientId, assunto, descricao, status: 'aberto' }).select('id').single();
    if (error) return toast.error('Não foi possível abrir o atendimento.');
    await createNotification(clientId, 'Atendimento empresarial aberto', `A solicitação “${assunto}” foi registrada.`, 'suporte', 'abertos', data.id);
    await logService.logAction({ ator_tipo: 'cliente', ator_id: clientId, ator_nome: cliente?.nome_razao || cliente?.nome, acao: 'ABRIR_TICKET_EMPRESARIAL', detalhes: assunto });
    toast.success('Atendimento registrado.'); go('atendimentos', undefined, data.id);
  };

  if (!cliente) return <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f6f8] text-[#0b1f33]"><div className="flex h-12 w-12 items-center justify-center bg-[#0b1f33] text-white"><Building2 className="h-5 w-5" /></div><p className="mt-4 text-sm font-semibold">{loading ? 'Carregando Portal Empresarial...' : 'Empresa não encontrada.'}</p></div>;
  const blocked = cliente.bloqueado || cliente.cadastro_aprovado === false || cliente.status !== 'ativo';

  return <EnterpriseShell cliente={cliente} activeModule={activeModule} counts={{ invoices: snapshot.counts.pending_invoices, requests: snapshot.counts.open_requests, quotes: snapshot.counts.open_quotes }} onNavigate={go} onLogout={onLogout}>
    {blocked && <div className="mb-6 border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><p className="font-semibold">Acesso empresarial com restrições</p><p className="mt-1">O cadastro está em análise ou bloqueado. Perfil e atendimento permanecem disponíveis.</p></div>}
    {activeModule === 'dashboard' && <EnterpriseDashboard cliente={cliente} snapshot={snapshot} loading={loading} onNavigate={go} />}
    {activeModule === 'servicos' && !blocked && <div className="border border-[#d8dee5] bg-white p-4 sm:p-6"><ClientServicosAssinaturas clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} onNavigate={(module: any, tab, itemId) => go(String(module), tab, itemId)} /></div>}
    {activeModule === 'financeiro' && !blocked && <ClientFinanceiro clientId={clientId} initialTab={activeTab} initialItemId={activeItemId} cliente={cliente} onNavigate={(module: any, tab, itemId) => go(String(module), tab, itemId)} />}
    {activeModule === 'documentos' && !blocked && <section className="border border-[#d8dee5] bg-white p-5 sm:p-8"><h2 className="mb-6 text-2xl font-semibold tracking-[-0.03em] text-[#0b1f33]">Documentos fiscais emitidos</h2><NotasFiscaisList clientId={clientId} initialItemId={activeItemId} /></section>}
    {activeModule === 'atendimentos' && <div className="border border-[#d8dee5] bg-white p-4 sm:p-6"><ClientSuporte clientId={clientId} initialItemId={activeItemId} /></div>}
    {activeModule === 'marketplace' && !blocked && <MarketplaceGSAStore clientId={clientId} initialTab={activeTab || 'home'} initialItemId={activeItemId} onNavigate={(module, tab, itemId) => go(String(module), tab, itemId)} />}
    {activeModule === 'empresa' && <EnterpriseCompanyProfile cliente={cliente} onUpdated={load} />}
    {activeModule === 'equipe' && <EnterpriseTeam clientId={clientId} />}
    {activeModule === 'historico' && <History snapshot={snapshot} />}
    {activeModule === 'perfil' && <div className="border border-[#d8dee5] bg-white p-4 sm:p-6"><ClientProfile cliente={cliente} onOpenTicket={openTicket} initialTab={activeTab} initialItemId={activeItemId} /></div>}
  </EnterpriseShell>;
}
