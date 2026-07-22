import React, { useEffect, useState } from 'react';
import {
  Briefcase, Search, Filter, RefreshCw, Eye, Download,
  CheckCircle2, Clock, AlertCircle, Building2, User, Phone,
  Mail, FileText, ExternalLink, ShieldCheck, DollarSign, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { formatCurrency, formatDate } from '../../lib/utils';
import { maskCPF, maskPhone } from '../../lib/utils';

export function CareersAdminModule() {
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [selectedApp, setSelectedApp] = useState<any | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');

  const fetchApplications = async () => {
    setLoading(true);
    let list: any[] = [];

    // 1. Tenta buscar no banco de dados Supabase
    try {
      const { data, error } = await supabase
        .from('gsa_careers_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        list = data;
      }
    } catch (err) {
      console.warn('Banco remoto gsa_careers_applications não disponível, lendo candidaturas locais:', err);
    }

    // 2. Sempre une com as candidaturas salvas no localStorage do navegador
    try {
      const local = JSON.parse(localStorage.getItem('gsa_career_apps') || '[]');
      const existingProtocols = new Set(list.map((item) => item.protocol));
      const newLocal = local.filter((item: any) => item && item.protocol && !existingProtocols.has(item.protocol));
      list = [...list, ...newLocal];
    } catch (e) {
      console.error('Erro ao ler candidaturas do localStorage:', e);
    }

    setApplications(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedApp) return;
    setUpdatingStatus(true);
    try {
      // 1. Tenta atualizar no Supabase
      try {
        await supabase
          .from('gsa_careers_applications')
          .update({
            status: newStatus,
            internal_notes: internalNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selectedApp.id);
      } catch (err) {
        console.warn('Atualização remota indisponível, salvando status localmente:', err);
      }

      // 2. Atualiza no localStorage
      try {
        const local = JSON.parse(localStorage.getItem('gsa_career_apps') || '[]');
        const updatedLocal = local.map((app: any) => {
          if (app.protocol === selectedApp.protocol || app.id === selectedApp.id) {
            return { ...app, status: newStatus, internal_notes: internalNotes, updated_at: new Date().toISOString() };
          }
          return app;
        });
        localStorage.setItem('gsa_career_apps', JSON.stringify(updatedLocal));
      } catch (e) {
        console.error('Erro ao atualizar status local:', e);
      }

      // 3. Atualiza na interface
      setApplications((prev) =>
        prev.map((app) =>
          app.id === selectedApp.id || app.protocol === selectedApp.protocol
            ? { ...app, status: newStatus, internal_notes: internalNotes }
            : app
        )
      );

      setSelectedApp((prev: any) => (prev ? { ...prev, status: newStatus, internal_notes: internalNotes } : null));
      toast.success('Status da candidatura atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      toast.error('Não foi possível atualizar o status.');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredApps = applications.filter((app) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      !term ||
      app.candidate_name?.toLowerCase().includes(term) ||
      app.email?.toLowerCase().includes(term) ||
      app.protocol?.toLowerCase().includes(term) ||
      app.document?.includes(term) ||
      app.desired_area?.toLowerCase().includes(term);

    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesType = typeFilter === 'all' || app.employment_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* ─── HEADER ───────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5 dark:border-neutral-800">
        <div>
          <span className="text-xs font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Recursos Humanos & Seleção
          </span>
          <h1 className="text-2xl font-black text-neutral-900 dark:text-white sm:text-3xl">
            Gestão de Candidaturas (Trabalhe Conosco)
          </h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            Análise de currículos, acompanhamento de talentos e atualização de etapas seletivas.
          </p>
        </div>

        <button
          onClick={fetchApplications}
          className="inline-flex items-center gap-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 px-4 py-2 text-xs font-bold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Atualizar Lista</span>
        </button>
      </div>

      {/* ─── METRIC CARDS ────────────────────────────── */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm">
          <span className="text-xs font-bold text-neutral-500">Total de Candidaturas</span>
          <div className="mt-2 text-2xl font-black text-neutral-900 dark:text-white">{applications.length}</div>
        </div>

        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 shadow-sm">
          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Candidaturas CLT</span>
          <div className="mt-2 text-2xl font-black text-emerald-700 dark:text-emerald-300">
            {applications.filter((a) => a.employment_type === 'clt').length}
          </div>
        </div>

        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-950/20 p-4 shadow-sm">
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Estagiários</span>
          <div className="mt-2 text-2xl font-black text-blue-700 dark:text-blue-300">
            {applications.filter((a) => a.employment_type === 'estagio').length}
          </div>
        </div>

        <div className="rounded-2xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/50 dark:bg-purple-950/20 p-4 shadow-sm">
          <span className="text-xs font-bold text-purple-600 dark:text-purple-400">Em Análise / Entrevista</span>
          <div className="mt-2 text-2xl font-black text-purple-700 dark:text-purple-300">
            {applications.filter((a) => ['under_review', 'interview_scheduled'].includes(a.status)).length}
          </div>
        </div>
      </div>

      {/* ─── FILTROS E BUSCA ────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar candidato por nome, CPF, e-mail ou protocolo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 py-2.5 pl-10 pr-4 text-xs font-medium outline-none focus:border-emerald-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 text-xs font-bold outline-none"
        >
          <option value="all">Todos os Status</option>
          <option value="received">Recebidas</option>
          <option value="under_review">Em Análise</option>
          <option value="interview_scheduled">Entrevista Agendada</option>
          <option value="approved">Aprovados</option>
          <option value="talent_pool">Banco de Talentos</option>
          <option value="rejected">Encerrados</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 py-2.5 text-xs font-bold outline-none"
        >
          <option value="all">Todas Modalidades</option>
          <option value="clt">CLT (Efetivo)</option>
          <option value="estagio">Estágio</option>
        </select>
      </div>

      {/* ─── TABELA DE CANDIDATURAS ──────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50 font-bold uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="p-4">Protocolo / Data</th>
                <th className="p-4">Candidato</th>
                <th className="p-4">Área & Modalidade</th>
                <th className="p-4">Pretensão Salarial</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {filteredApps.length > 0 ? (
                filteredApps.map((app) => (
                  <tr key={app.id || app.protocol} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-800/30 transition">
                    <td className="p-4">
                      <span className="font-mono font-bold text-neutral-900 dark:text-white block">{app.protocol}</span>
                      <span className="text-[10px] text-neutral-400">{formatDate(app.created_at)}</span>
                    </td>

                    <td className="p-4">
                      <span className="font-bold text-neutral-900 dark:text-white block">{app.candidate_name}</span>
                      <span className="text-[10px] text-neutral-400 block">{maskCPF(app.document)} • {app.email}</span>
                    </td>

                    <td className="p-4">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200 block">{app.desired_area}</span>
                      <span className={`inline-block mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${app.employment_type === 'estagio' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                        {app.employment_type === 'estagio' ? 'Estágio' : 'CLT'}
                      </span>
                    </td>

                    <td className="p-4 font-bold text-neutral-900 dark:text-white">
                      {app.salary_expectation ? formatCurrency(app.salary_expectation) : '-'}
                    </td>

                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                        app.status === 'approved' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        app.status === 'interview_scheduled' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300' :
                        app.status === 'under_review' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300' :
                        app.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300' :
                        'bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300'
                      }`}>
                        {app.status === 'approved' ? 'Aprovado' :
                         app.status === 'interview_scheduled' ? 'Entrevista' :
                         app.status === 'under_review' ? 'Em Análise' :
                         app.status === 'rejected' ? 'Encerrado' : 'Recebida'}
                      </span>
                    </td>

                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedApp(app);
                          setInternalNotes(app.internal_notes || '');
                        }}
                        className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition"
                      >
                        Avaliar
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-neutral-500">
                    Nenhuma candidatura encontrada com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── MODAL DE AVALIAÇÃO DO CANDIDATO ───────── */}
      {selectedApp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Ficha do Candidato • {selectedApp.protocol}
                </span>
                <h2 className="text-xl font-black text-neutral-900 dark:text-white">
                  {selectedApp.candidate_name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedApp(null)}
                className="rounded-lg p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div className="space-y-1">
                <span className="text-neutral-500 font-bold block">CPF:</span>
                <span className="font-bold text-neutral-900 dark:text-white">{maskCPF(selectedApp.document)}</span>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500 font-bold block">E-mail:</span>
                <span className="font-bold text-neutral-900 dark:text-white">{selectedApp.email}</span>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500 font-bold block">Telefone / WhatsApp:</span>
                <span className="font-bold text-neutral-900 dark:text-white">{maskPhone(selectedApp.phone)}</span>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500 font-bold block">Área de Interesse:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedApp.desired_area}</span>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500 font-bold block">Modalidade:</span>
                <span className="font-bold uppercase text-neutral-900 dark:text-white">
                  {selectedApp.employment_type === 'estagio' ? 'Estágio' : 'CLT (Efetivo)'}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-neutral-500 font-bold block">Pretensão Salarial:</span>
                <span className="font-bold text-neutral-900 dark:text-white">
                  {selectedApp.salary_expectation ? formatCurrency(selectedApp.salary_expectation) : 'Não informada'}
                </span>
              </div>
            </div>

            {selectedApp.notes && (
              <div className="rounded-xl bg-neutral-50 dark:bg-neutral-800/50 p-3.5 text-xs">
                <span className="font-bold text-neutral-500 block mb-1">Resumo das Experiências:</span>
                <p className="text-neutral-700 dark:text-neutral-300 leading-relaxed whitespace-pre-line">
                  {selectedApp.notes}
                </p>
              </div>
            )}

            {selectedApp.linkedin_url && (
              <div>
                <a
                  href={selectedApp.linkedin_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Acessar Perfil do LinkedIn
                </a>
              </div>
            )}

            {/* SEÇÃO DE AVALIAÇÃO DE STATUS */}
            <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
              <label className="block text-xs font-bold text-neutral-700 dark:text-neutral-300">
                Ações de Seleção / Alterar Status
              </label>

              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'under_review', label: 'Em Análise' },
                  { key: 'interview_scheduled', label: 'Agendar Entrevista' },
                  { key: 'approved', label: 'Aprovar' },
                  { key: 'talent_pool', label: 'Banco de Talentos' },
                  { key: 'rejected', label: 'Encerrar' },
                ].map((st) => (
                  <button
                    key={st.key}
                    disabled={updatingStatus}
                    onClick={() => handleUpdateStatus(st.key)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${selectedApp.status === st.key ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200'}`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-neutral-500 mb-1">
                  Anotações Internas do RH (visível apenas para administradores)
                </label>
                <textarea
                  rows={2}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Ex: Entrevista agendada para 25/07 às 14h via Google Meet..."
                  className="w-full rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800 p-2.5 text-xs outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
