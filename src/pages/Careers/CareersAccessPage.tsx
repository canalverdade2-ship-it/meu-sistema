import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft, Search, ShieldCheck, CheckCircle2, Clock,
  FileText, User, Building2, ExternalLink, RefreshCw, AlertCircle
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';

interface CareersAccessPageProps {
  onBackToLanding: () => void;
  onBackToSite: () => void;
}

export function CareersAccessPage({ onBackToLanding, onBackToSite }: CareersAccessPageProps) {
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [application, setApplication] = useState<any | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = searchInput.trim();
    if (!query) {
      toast.error('Informe seu CPF ou o Número do Protocolo.');
      return;
    }

    setLoading(true);
    setSearched(true);
    setApplication(null);

    const cleanQuery = query.toLowerCase().replace(/\s+/g, '');
    const docDigits = query.replace(/\D/g, '');

    let foundResult: any = null;

    // 1. Tenta buscar no banco Supabase (se a tabela existir no backend)
    try {
      const { data, error } = await supabase
        .from('gsa_careers_applications')
        .select('*')
        .or(`protocol.eq.${query},document.eq.${docDigits}`)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        foundResult = data;
      }
    } catch (e) {
      console.warn('Tabela remota gsa_careers_applications indisponível, consultando registros locais:', e);
    }

    // 2. Se não encontrou no DB remoto, busca no registro local do navegador
    if (!foundResult) {
      try {
        const localApps = JSON.parse(localStorage.getItem('gsa_career_apps') || '[]');
        foundResult = localApps.find((app: any) => {
          const appProto = (app.protocol || '').toLowerCase().replace(/\s+/g, '');
          const protoMatch = appProto === cleanQuery;
          const docMatch = docDigits.length >= 11 && app.document === docDigits;
          return protoMatch || docMatch;
        });
      } catch (e) {
        console.error('Erro ao ler localStorage:', e);
      }
    }

    if (foundResult) {
      setApplication(foundResult);
      toast.success('Candidatura localizada com sucesso!');
    } else {
      toast.error('Nenhuma candidatura encontrada para os dados informados.');
    }

    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'received':
        return {
          label: 'Recebida - Em Fila de Análise',
          color: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
          icon: Clock
        };
      case 'under_review':
        return {
          label: 'Em Análise pela Equipe de RH',
          color: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
          icon: RefreshCw
        };
      case 'interview_scheduled':
        return {
          label: 'Entrevista Agendada',
          color: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
          icon: CheckCircle2
        };
      case 'approved':
        return {
          label: 'Aprovado no Processo Seletivo',
          color: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
          icon: ShieldCheck
        };
      case 'talent_pool':
        return {
          label: 'Registrado em Banco de Talentos',
          color: 'bg-teal-500/10 text-teal-300 border-teal-500/30',
          icon: Building2
        };
      case 'rejected':
        return {
          label: 'Processo Encerrado',
          color: 'bg-red-500/10 text-red-300 border-red-500/30',
          icon: AlertCircle
        };
      default:
        return {
          label: 'Registrada',
          color: 'bg-neutral-500/10 text-neutral-300 border-neutral-500/30',
          icon: Clock
        };
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1a14] text-white flex flex-col justify-between selection:bg-emerald-500 selection:text-neutral-950">
      {/* ─── NAVBAR ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-emerald-900/40 bg-[#0f1a14]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToLanding}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar ao Trabalhe Conosco</span>
            </button>
            <div className="h-5 w-px bg-white/10 hidden sm:block" />
            <LogoGSA size="sm" variant="light" />
          </div>

          <button
            onClick={onBackToSite}
            className="text-xs font-bold text-neutral-400 hover:text-white"
          >
            Ir para Home do Site
          </button>
        </div>
      </header>

      {/* ─── CONTEÚDO PRINCIPAL ─────────────────────── */}
      <main className="relative flex-1 flex items-center justify-center p-5 py-12">
        <div className="w-full max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-emerald-500/20 bg-[#0f1d16] p-6 sm:p-10 shadow-2xl backdrop-blur-xl text-white"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-black text-white">Consulte sua Candidatura</h1>
              <p className="mt-2 text-sm text-neutral-300 sm:whitespace-nowrap">Informe seu CPF ou o Número do Protocolo (ex: RH-20260722-XXXX) para visualizar o andamento.</p>
            </div>

            {/* FORMULÁRIO DE CONSULTA */}
            <form onSubmit={handleSearch} className="flex gap-3 mb-8">
              <input
                type="text"
                placeholder="Digite seu CPF ou o Protocolo RH-..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-neutral-900 font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 px-6 py-3.5 text-sm font-black uppercase tracking-wider text-neutral-950 shadow-md shadow-emerald-950/60 disabled:opacity-50 flex items-center gap-2 shrink-0 transition-all"
              >
                <Search className="h-4 w-4" />
                <span>{loading ? 'Buscando...' : 'Consultar'}</span>
              </button>
            </form>

            {/* RESULTADO DA CONSULTA */}
            {searched && (
              application ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border border-emerald-800/40 bg-[#0a120e] p-6 space-y-5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-900/40 pb-4">
                    <div>
                      <span className="text-[10px] font-black uppercase text-emerald-400">Protocolo</span>
                      <h3 className="text-xl font-black font-mono text-emerald-300">{application.protocol}</h3>
                    </div>

                    {(() => {
                      const badge = getStatusBadge(application.status);
                      const Icon = badge.icon;
                      return (
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black uppercase ${badge.color}`}>
                          <Icon className="h-3.5 w-3.5" />
                          {badge.label}
                        </span>
                      );
                    })()}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2 text-xs">
                    <div>
                      <span className="text-neutral-400 block font-bold">Candidato:</span>
                      <span className="font-bold text-white text-sm">{application.candidate_name}</span>
                    </div>

                    <div>
                      <span className="text-neutral-400 block font-bold">Área de Interesse:</span>
                      <span className="font-bold text-white text-sm">{application.desired_area}</span>
                    </div>

                    <div>
                      <span className="text-neutral-400 block font-bold">Modalidade:</span>
                      <span className="font-bold text-emerald-400 uppercase">{application.employment_type === 'estagio' ? 'Estágio' : 'CLT (Efetivo)'}</span>
                    </div>

                    <div>
                      <span className="text-neutral-400 block font-bold">Data de Envio:</span>
                      <span className="text-white font-semibold">{formatDate(application.created_at)}</span>
                    </div>
                  </div>

                  {application.linkedin_url && (
                    <div className="pt-2 border-t border-emerald-900/40">
                      <a
                        href={application.linkedin_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:underline font-bold"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Ver Perfil do LinkedIn informado
                      </a>
                    </div>
                  )}

                  <div className="rounded-xl bg-[#070e0a] border border-emerald-900/30 p-4 text-xs text-neutral-300">
                    <p className="font-bold text-white mb-1">Próximos Passos:</p>
                    <p>Caso seu perfil seja selecionado para as fases de entrevista, a equipe de Seleção entrará em contato via E-mail ou WhatsApp.</p>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-8 rounded-2xl border border-emerald-800/40 bg-[#0a120e] p-6">
                  <AlertCircle className="h-10 w-10 text-neutral-500 mx-auto mb-2" />
                  <p className="font-bold text-sm text-white">Nenhum registro encontrado</p>
                  <p className="text-xs text-neutral-400 mt-1">Verifique se o CPF ou número de protocolo foi digitado corretamente.</p>
                </div>
              )
            )}
          </motion.div>
        </div>
      </main>

      {/* ─── FOOTER ─────────────────────────────────── */}
      <footer className="border-t border-emerald-900/30 bg-[#0a120e] py-6 text-center text-xs text-neutral-500">
        Grupo GSA &copy; {new Date().getFullYear()} — Portal de Atendimento ao Candidato.
      </footer>
    </div>
  );
}
