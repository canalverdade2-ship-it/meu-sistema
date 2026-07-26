import {
  AlertTriangle,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  CheckCircle2,
  FileText,
  ReceiptText,
  ShieldCheck,
} from 'lucide-react';
import type { Cliente } from '../../types';
import { formatCurrency, formatDate } from '../../lib/utils';

export interface EnterpriseSnapshot {
  counts: {
    pending_invoices: number;
    overdue_invoices: number;
    open_requests: number;
    open_quotes: number;
    active_services: number;
    issued_documents: number;
  };
  next_invoices: Array<{
    id: string;
    code: string;
    due_date: string;
    amount: number;
    status: string;
  }>;
  recent_requests: Array<{
    id: string;
    subject: string;
    status: string;
    opened_at: string;
  }>;
  recent_activity: Array<{
    id: string;
    event_type: string;
    description: string;
    module: string | null;
    created_at: string;
  }>;
}

interface EnterpriseDashboardProps {
  cliente: Cliente;
  snapshot: EnterpriseSnapshot;
  loading?: boolean;
  onNavigate: (module: string, tab?: string, itemId?: string) => void;
}

function StatusBadge({ value }: { value: string }) {
  const normalized = value.toLowerCase();
  const className = normalized.includes('pago') || normalized.includes('conclu') || normalized.includes('ativo')
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : normalized.includes('venc') || normalized.includes('cancel')
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';

  return <span className={`inline-flex border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${className}`}>{value.replaceAll('_', ' ')}</span>;
}

export function EnterpriseDashboard({ cliente, snapshot, loading, onNavigate }: EnterpriseDashboardProps) {
  const companyName = cliente.nome_razao || cliente.nome;
  const healthy = snapshot.counts.overdue_invoices === 0;
  const indicators = [
    {
      label: 'Situação financeira',
      value: healthy ? 'Regular' : 'Atenção',
      description: healthy ? 'Nenhuma cobrança vencida identificada.' : `${snapshot.counts.overdue_invoices} cobrança(s) vencida(s).`,
      icon: healthy ? CheckCircle2 : AlertTriangle,
      action: () => onNavigate('financeiro', 'faturas'),
    },
    {
      label: 'Solicitações abertas',
      value: String(snapshot.counts.open_requests),
      description: 'Atendimentos que ainda exigem acompanhamento.',
      icon: FileText,
      action: () => onNavigate('atendimentos'),
    },
    {
      label: 'Serviços ativos',
      value: String(snapshot.counts.active_services),
      description: 'Serviços e assinaturas em execução.',
      icon: BriefcaseBusiness,
      action: () => onNavigate('servicos'),
    },
    {
      label: 'Documentos fiscais',
      value: String(snapshot.counts.issued_documents),
      description: 'Documentos emitidos e disponíveis no portal.',
      icon: ReceiptText,
      action: () => onNavigate('documentos'),
    },
  ];

  return (
    <div className="space-y-8">
      <section className="border border-[#d8dee5] bg-white">
        <div className="grid lg:grid-cols-[1fr_auto]">
          <div className="p-7 sm:p-9">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 border border-[#c7a55b]/40 bg-[#fbf7ed] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86651f]">
                <Building2 className="h-3.5 w-3.5" /> Central da Empresa
              </span>
              <span className={`inline-flex items-center gap-2 border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] ${healthy ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                <ShieldCheck className="h-3.5 w-3.5" /> {healthy ? 'Situação regular' : 'Ação necessária'}
              </span>
            </div>
            <h2 className="mt-6 max-w-3xl text-3xl font-semibold tracking-[-0.035em] text-[#0b1f33] sm:text-4xl">{companyName}</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-[#627181]">
              Visão consolidada dos serviços, compromissos financeiros, documentos e atendimentos vinculados ao CNPJ da empresa.
            </p>
          </div>
          <div className="border-t border-[#e1e6eb] bg-[#f6f8fa] p-7 lg:w-72 lg:border-l lg:border-t-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#71808f]">Identificação</p>
            <p className="mt-4 text-sm font-semibold text-[#0b1f33]">{cliente.cnpj || 'CNPJ não informado'}</p>
            <p className="mt-2 text-xs text-[#6d7985]">Código {cliente.codigo_cliente}</p>
            <div className="mt-6 border-t border-[#dfe5ea] pt-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71808f]">Atualização</p>
              <p className="mt-2 text-xs font-medium text-[#334355]">Dados consultados agora</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
        {indicators.map((item) => (
          <button key={item.label} type="button" onClick={item.action} className="group border border-[#d8dee5] bg-white p-6 text-left transition hover:border-[#9dadbd] hover:shadow-[0_18px_45px_rgba(11,31,51,0.08)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1d4ed8]">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-10 w-10 items-center justify-center bg-[#edf2f6] text-[#0b1f33]"><item.icon className="h-5 w-5" /></div>
              <ArrowRight className="h-4 w-4 text-[#9ba6b1] transition group-hover:translate-x-1 group-hover:text-[#0b1f33]" />
            </div>
            <p className="mt-6 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71808f]">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[#0b1f33]">{loading ? '—' : item.value}</p>
            <p className="mt-2 text-xs leading-5 text-[#6b7885]">{item.description}</p>
          </button>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="border border-[#d8dee5] bg-white">
          <div className="flex items-center justify-between border-b border-[#e1e6eb] px-6 py-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71808f]">Agenda financeira</p>
              <h3 className="mt-1 text-lg font-semibold text-[#0b1f33]">Próximos vencimentos</h3>
            </div>
            <button type="button" onClick={() => onNavigate('financeiro', 'faturas')} className="text-xs font-semibold text-[#1d4ed8] hover:underline">Ver financeiro</button>
          </div>
          {snapshot.next_invoices.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarClock className="mx-auto h-7 w-7 text-[#9aa6b2]" />
              <p className="mt-3 text-sm font-semibold text-[#334355]">Nenhum vencimento pendente</p>
              <p className="mt-1 text-xs text-[#75818d]">Não foram encontradas cobranças em aberto para esta empresa.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf0f3]">
              {snapshot.next_invoices.map((invoice) => (
                <button key={invoice.id} type="button" onClick={() => onNavigate('financeiro', 'faturas', invoice.id)} className="grid w-full grid-cols-[1fr_auto] gap-4 px-6 py-5 text-left hover:bg-[#f7f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1d4ed8]">
                  <div>
                    <p className="text-sm font-semibold text-[#0b1f33]">{invoice.code}</p>
                    <p className="mt-1 text-xs text-[#6d7985]">Vencimento em {formatDate(invoice.due_date)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#0b1f33]">{formatCurrency(invoice.amount)}</p>
                    <div className="mt-2"><StatusBadge value={invoice.status} /></div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="border border-[#d8dee5] bg-white">
          <div className="flex items-center justify-between border-b border-[#e1e6eb] px-6 py-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#71808f]">Relacionamento GSA</p>
              <h3 className="mt-1 text-lg font-semibold text-[#0b1f33]">Atendimentos recentes</h3>
            </div>
            <button type="button" onClick={() => onNavigate('atendimentos')} className="text-xs font-semibold text-[#1d4ed8] hover:underline">Ver todos</button>
          </div>
          {snapshot.recent_requests.length === 0 ? (
            <div className="p-8 text-center">
              <FileText className="mx-auto h-7 w-7 text-[#9aa6b2]" />
              <p className="mt-3 text-sm font-semibold text-[#334355]">Nenhum atendimento aberto</p>
              <p className="mt-1 text-xs text-[#75818d]">Abra uma solicitação sempre que precisar falar com a GSA.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf0f3]">
              {snapshot.recent_requests.map((request) => (
                <button key={request.id} type="button" onClick={() => onNavigate('atendimentos', undefined, request.id)} className="w-full px-6 py-5 text-left hover:bg-[#f7f9fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1d4ed8]">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#0b1f33]">{request.subject}</p>
                      <p className="mt-1 text-xs text-[#6d7985]">Aberto em {formatDate(request.opened_at)}</p>
                    </div>
                    <StatusBadge value={request.status} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
