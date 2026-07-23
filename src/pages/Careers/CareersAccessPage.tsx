import { FormEvent, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Briefcase,
  CalendarClock,
  CheckCircle2,
  Clock,
  MapPin,
  Search,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { supabase } from '../../lib/supabase';
import { formatDate } from '../../lib/utils';
import { validarCPF } from '../../utils/cpfValidator';

interface CareersAccessPageProps {
  onBackToLanding: () => void;
  onBackToSite: () => void;
}

interface CareerApplicationPublic {
  protocol: string;
  candidate_name: string;
  desired_area: string;
  employment_type: 'clt' | 'estagio';
  status: CareerStatus;
  created_at: string;
  updated_at: string;
  status_changed_at?: string | null;
  interview_at?: string | null;
  interview_location?: string | null;
  public_message?: string | null;
}

type CareerStatus = 'received' | 'under_review' | 'interview_scheduled' | 'approved' | 'talent_pool' | 'rejected';

const STATUS_PRESENTATION: Record<CareerStatus, { label: string; className: string; icon: typeof Clock }> = {
  received: {
    label: 'Recebida — Em fila de análise',
    className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    icon: Clock,
  },
  under_review: {
    label: 'Em análise pelo RH',
    className: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
    icon: Search,
  },
  interview_scheduled: {
    label: 'Entrevista agendada',
    className: 'border-purple-500/30 bg-purple-500/10 text-purple-300',
    icon: CalendarClock,
  },
  approved: {
    label: 'Aprovado no processo seletivo',
    className: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    icon: CheckCircle2,
  },
  talent_pool: {
    label: 'Banco de Talentos',
    className: 'border-teal-500/30 bg-teal-500/10 text-teal-300',
    icon: UserCheck,
  },
  rejected: {
    label: 'Processo encerrado',
    className: 'border-red-500/30 bg-red-500/10 text-red-300',
    icon: AlertCircle,
  },
};

function normalizeProtocol(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '');
}

export function CareersAccessPage({ onBackToLanding, onBackToSite }: CareersAccessPageProps) {
  const [protocol, setProtocol] = useState('');
  const [document, setDocument] = useState('');
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [application, setApplication] = useState<CareerApplicationPublic | null>(null);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();

    const normalizedProtocol = normalizeProtocol(protocol);
    const documentDigits = document.replace(/\D/g, '');

    if (!/^RH-\d{8}-[A-Z0-9]{6,12}$/.test(normalizedProtocol)) {
      toast.error('Informe um protocolo válido no formato RH-AAAAMMDD-CÓDIGO.');
      return;
    }
    if (!validarCPF(documentDigits)) {
      toast.error('Informe o mesmo CPF utilizado na candidatura.');
      return;
    }

    setLoading(true);
    setSearched(true);
    setApplication(null);

    try {
      const { data, error } = await supabase.rpc('gsa_public_get_career_application', {
        p_protocol: normalizedProtocol,
        p_document: documentDigits,
      });
      if (error) throw error;

      const result = data as { success?: boolean; application?: CareerApplicationPublic; code?: string } | null;
      if (!result?.success || !result.application) {
        toast.error('Candidatura não encontrada. Confira o protocolo e o CPF.');
        return;
      }

      setApplication(result.application);
      toast.success('Candidatura localizada com segurança.');
    } catch (error) {
      console.error('Erro ao consultar candidatura:', error);
      toast.error('Não foi possível consultar o banco de dados. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const status = application ? STATUS_PRESENTATION[application.status] || STATUS_PRESENTATION.received : null;
  const StatusIcon = status?.icon || Clock;

  return (
    <div className="flex min-h-screen flex-col bg-[#0f1a14] text-white selection:bg-emerald-500 selection:text-neutral-950">
      <header className="sticky top-0 z-50 border-b border-emerald-900/40 bg-[#0f1a14]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <button onClick={onBackToLanding} className="flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              <span>Voltar ao Trabalhe Conosco</span>
            </button>
            <div className="hidden h-5 w-px bg-white/10 sm:block" />
            <LogoGSA size="sm" variant="light" />
          </div>
          <button onClick={onBackToSite} className="text-xs font-bold text-neutral-400 hover:text-white">Ir para o site</button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center p-5 py-12">
        <div className="w-full max-w-3xl">
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-emerald-500/20 bg-[#0f1d16] p-6 shadow-2xl sm:p-10">
            <div className="text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="h-7 w-7" />
              </div>
              <h1 className="mt-5 text-3xl font-black">Consulte sua candidatura</h1>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-neutral-300">Para proteger seus dados, a consulta exige o protocolo e o CPF utilizados no cadastro. Nenhum currículo ou anotação interna é enviado para esta página.</p>
            </div>

            <form onSubmit={handleSearch} className="mt-8 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
              <label>
                <span className="mb-2 block text-[11px] font-black uppercase tracking-wider text-neutral-300">Protocolo</span>
                <input value={protocol} onChange={(event) => setProtocol(event.target.value)} placeholder="RH-20260722-ABC123" className="career-input" autoComplete="off" />
              </label>
              <label>
                <span className="mb-2 block text-[11px] font-black uppercase tracking-wider text-neutral-300">CPF</span>
                <input value={document} onChange={(event) => setDocument(event.target.value)} placeholder="000.000.000-00" className="career-input" inputMode="numeric" autoComplete="off" />
              </label>
              <button type="submit" disabled={loading} className="mt-auto flex h-[50px] items-center justify-center gap-2 rounded-xl bg-emerald-500 px-6 text-sm font-black uppercase tracking-wider text-neutral-950 hover:bg-emerald-400 disabled:opacity-60">
                <Search className="h-4 w-4" /> {loading ? 'Buscando...' : 'Consultar'}
              </button>
            </form>

            {searched && !loading && (
              application && status ? (
                <motion.section initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="mt-8 space-y-5 rounded-2xl border border-emerald-800/40 bg-[#0a120e] p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-emerald-900/40 pb-5">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Protocolo confirmado</span>
                      <h2 className="mt-1 font-mono text-xl font-black text-emerald-300">{application.protocol}</h2>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-black uppercase ${status.className}`}>
                      <StatusIcon className="h-3.5 w-3.5" /> {status.label}
                    </span>
                  </div>

                  <div className="grid gap-4 text-sm sm:grid-cols-2">
                    <Info label="Candidato" value={application.candidate_name} />
                    <Info label="Área de interesse" value={application.desired_area} />
                    <Info label="Modalidade" value={application.employment_type === 'estagio' ? 'Estágio' : 'CLT (Efetivo)'} />
                    <Info label="Data de envio" value={formatDate(application.created_at)} />
                  </div>

                  {application.status === 'interview_scheduled' && application.interview_at && (
                    <div className="grid gap-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 sm:grid-cols-2">
                      <div className="flex items-start gap-2">
                        <CalendarClock className="mt-0.5 h-4 w-4 text-purple-300" />
                        <div><p className="text-[10px] font-black uppercase text-purple-300">Data da entrevista</p><p className="mt-1 text-sm font-bold">{new Date(application.interview_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p></div>
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-4 w-4 text-purple-300" />
                        <div><p className="text-[10px] font-black uppercase text-purple-300">Local ou link</p><p className="mt-1 break-all text-sm font-bold">{application.interview_location || 'A equipe do RH entrará em contato.'}</p></div>
                      </div>
                    </div>
                  )}

                  <div className="rounded-2xl border border-emerald-900/40 bg-[#07100b] p-4">
                    <div className="flex items-center gap-2 text-emerald-400"><Briefcase className="h-4 w-4" /><p className="text-xs font-black uppercase tracking-wider">Próxima orientação</p></div>
                    <p className="mt-2 text-sm leading-relaxed text-neutral-300">{application.public_message || 'A equipe de Recursos Humanos atualizará esta página conforme o andamento do processo.'}</p>
                  </div>
                </motion.section>
              ) : (
                <div className="mt-8 rounded-2xl border border-red-500/20 bg-red-500/5 p-7 text-center">
                  <AlertCircle className="mx-auto h-10 w-10 text-red-300" />
                  <p className="mt-3 text-sm font-black">Nenhum registro foi localizado</p>
                  <p className="mt-1 text-xs text-neutral-400">O protocolo e o CPF precisam corresponder à mesma candidatura.</p>
                </div>
              )
            )}
          </motion.div>
        </div>
      </main>

      <footer className="border-t border-emerald-900/30 bg-[#0a120e] py-6 text-center text-xs text-neutral-500">Grupo GSA &copy; {new Date().getFullYear()} — Portal do Candidato</footer>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] font-black uppercase tracking-wider text-neutral-500">{label}</span>
      <span className="mt-1 block font-bold text-white">{value}</span>
    </div>
  );
}
