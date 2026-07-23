import { ChangeEvent, FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  CheckCircle2,
  Copy,
  FileText,
  LockKeyhole,
  Send,
  ShieldCheck,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { supabase } from '../../lib/supabase';
import { copyToClipboard, handleCurrencyInputChange, maskCurrency } from '../../lib/utils';
import { validarCPF } from '../../utils/cpfValidator';

interface CareersLandingPageProps {
  onBackToSite: () => void;
  onAccessPortal: () => void;
}

interface SubmitResult {
  success?: boolean;
  already_exists?: boolean;
  protocol?: string;
  id?: string;
  resume_upload_path?: string | null;
  code?: string;
}

const CAREER_BUCKET = 'gsa-careers-resumes';
const MAX_RESUME_SIZE = 10 * 1024 * 1024;

const CAREER_AREAS = [
  'Comercial & Vendas',
  'Tecnologia & Desenvolvimento',
  'Operações & Logística',
  'Suporte & Relacionamento',
  'Financeiro & Administração',
];

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function resolveResumeMimeType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  return MIME_BY_EXTENSION[extension] || '';
}

export function CareersLandingPage({ onBackToSite, onAccessPortal }: CareersLandingPageProps) {
  const [form, setForm] = useState({
    candidate_name: '',
    document: '',
    email: '',
    phone: '',
    desired_area: CAREER_AREAS[0],
    employment_type: 'clt' as 'clt' | 'estagio',
    salary_expectation: '',
    linkedin_url: '',
    notes: '',
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [resumeWarning, setResumeWarning] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);

  const handleResumeUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const mimeType = resolveResumeMimeType(file);
    if (file.size <= 0 || file.size > MAX_RESUME_SIZE) {
      toast.error('O currículo deve possuir no máximo 10 MB.');
      event.target.value = '';
      return;
    }
    if (!Object.values(MIME_BY_EXTENSION).includes(mimeType)) {
      toast.error('Formato não permitido. Envie PDF, DOC, DOCX, JPG, PNG ou WEBP.');
      event.target.value = '';
      return;
    }

    setResumeFile(file);
    toast.success(`Currículo “${file.name}” selecionado.`);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    const candidateName = form.candidate_name.trim();
    const document = form.document.replace(/\D/g, '');
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.replace(/\D/g, '');

    if (candidateName.length < 3) {
      toast.error('Informe o nome completo do candidato.');
      return;
    }
    if (!validarCPF(document)) {
      toast.error('Informe um CPF válido.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Informe um e-mail válido.');
      return;
    }
    if (phone.length < 10 || phone.length > 13) {
      toast.error('Informe um telefone com DDD válido.');
      return;
    }

    setSubmitting(true);
    setResumeWarning(false);
    setAlreadyExists(false);

    try {
      const resumeMimeType = resumeFile ? resolveResumeMimeType(resumeFile) : null;
      const payload = {
        candidate_name: candidateName,
        document,
        email,
        phone,
        desired_area: form.desired_area,
        employment_type: form.employment_type,
        salary_expectation: form.salary_expectation ? Number(form.salary_expectation) : null,
        linkedin_url: form.linkedin_url.trim() || null,
        notes: form.notes.trim() || null,
        resume_file_name: resumeFile?.name || null,
        resume_mime_type: resumeMimeType,
        resume_size: resumeFile?.size || null,
      };

      const { data, error } = await supabase.rpc('gsa_public_submit_career_application', {
        p_payload: payload,
      });
      if (error) throw error;

      const result = (data || {}) as SubmitResult;
      if (!result.success || !result.protocol) {
        throw new Error('O banco não confirmou o registro da candidatura.');
      }

      let uploadFailed = false;
      if (resumeFile && result.resume_upload_path) {
        const { error: uploadError } = await supabase.storage
          .from(CAREER_BUCKET)
          .upload(result.resume_upload_path, resumeFile, {
            upsert: false,
            cacheControl: '3600',
            contentType: resumeMimeType || undefined,
          });

        if (uploadError) {
          console.error('Falha no upload seguro do currículo:', uploadError);
          uploadFailed = true;
        } else {
          const { data: confirmation, error: confirmationError } = await supabase.rpc(
            'gsa_public_confirm_career_resume',
            {
              p_protocol: result.protocol,
              p_document: document,
              p_storage_path: result.resume_upload_path,
            },
          );

          if (confirmationError || !(confirmation as { success?: boolean } | null)?.success) {
            console.error('Falha ao confirmar o currículo enviado:', confirmationError || confirmation);
            uploadFailed = true;
          }
        }
      }

      setProtocol(result.protocol);
      setResumeWarning(uploadFailed);
      setAlreadyExists(Boolean(result.already_exists));

      if (uploadFailed) {
        toast.error('Candidatura registrada, mas o currículo não foi anexado. Guarde o protocolo e contate o RH.');
      } else if (result.already_exists) {
        toast.success('Sua candidatura já estava registrada e foi localizada com segurança.');
      } else {
        toast.success('Candidatura registrada no banco de dados com sucesso!');
      }
    } catch (error) {
      console.error('Erro ao registrar candidatura:', error);
      toast.error('Não foi possível registrar a candidatura. Nenhum protocolo foi gerado. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1a14] text-white selection:bg-emerald-500 selection:text-neutral-950">
      <header className="sticky top-0 z-50 border-b border-emerald-900/40 bg-[#0f1a14]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <button onClick={onBackToSite} className="flex items-center gap-2 text-sm font-semibold text-neutral-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar ao site</span>
            </button>
            <div className="h-5 w-px bg-white/10" />
            <LogoGSA size="sm" variant="light" />
          </div>
          <button onClick={onAccessPortal} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-neutral-950 hover:bg-emerald-400">
            <LockKeyhole className="h-3.5 w-3.5" /> Área do Candidato
          </button>
        </div>
      </header>

      <main>
        <section className="border-b border-emerald-900/30 bg-gradient-to-b from-[#13221b] to-[#0f1a14] py-16 sm:py-24">
          <div className="mx-auto max-w-5xl px-5 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-400">
              <Briefcase className="h-4 w-4" /> Trabalhe no Grupo GSA
            </span>
            <h1 className="mt-6 text-4xl font-black tracking-tight sm:text-6xl">Construa sua carreira com o Grupo GSA</h1>
            <p className="mx-auto mt-5 max-w-2xl text-neutral-300">Cadastre seu currículo com segurança e acompanhe cada etapa do processo seletivo pelo protocolo e CPF.</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="#formulario-candidatura" className="rounded-2xl bg-emerald-500 px-7 py-3.5 text-sm font-black text-neutral-950 hover:bg-emerald-400">Cadastrar currículo</a>
              <button onClick={onAccessPortal} className="rounded-2xl border border-white/15 bg-white/5 px-7 py-3.5 text-sm font-bold hover:bg-white/10">Consultar candidatura</button>
            </div>
          </div>
        </section>

        <section className="border-b border-emerald-900/30 bg-[#0d1611] py-12">
          <div className="mx-auto grid max-w-5xl gap-5 px-5 md:grid-cols-3">
            {[
              { icon: ShieldCheck, title: 'Dados protegidos', text: 'A candidatura é registrada no banco real e o currículo fica em armazenamento privado.' },
              { icon: Users, title: 'Análise centralizada', text: 'O RH acompanha o mesmo registro exibido na Área do Candidato.' },
              { icon: FileText, title: 'Histórico das etapas', text: 'Cada mudança de status fica registrada com data e responsável.' },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="rounded-3xl border border-emerald-800/40 bg-[#13221b] p-6">
                <Icon className="h-7 w-7 text-emerald-400" />
                <h2 className="mt-4 text-lg font-black">{title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-neutral-400">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="formulario-candidatura" className="bg-[#0f1a14] py-16">
          <div className="mx-auto max-w-4xl px-5">
            <div className="rounded-[2rem] border border-emerald-800/40 bg-[#13221b] p-6 shadow-2xl sm:p-10">
              <div className="mb-8">
                <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Cadastro seguro</p>
                <h2 className="mt-2 text-3xl font-black">Envie sua candidatura</h2>
                <p className="mt-2 text-sm text-neutral-400">Campos marcados com * são obrigatórios. O protocolo só será exibido após confirmação do banco.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Nome completo *">
                    <input required value={form.candidate_name} onChange={(event) => setForm({ ...form, candidate_name: event.target.value })} className="career-input" placeholder="Seu nome completo" />
                  </Field>
                  <Field label="CPF *">
                    <input required value={form.document} onChange={(event) => setForm({ ...form, document: event.target.value })} className="career-input" placeholder="000.000.000-00" inputMode="numeric" />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="E-mail *">
                    <input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className="career-input" placeholder="voce@exemplo.com" />
                  </Field>
                  <Field label="Telefone / WhatsApp *">
                    <input required type="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className="career-input" placeholder="(11) 99999-9999" />
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Área de interesse *">
                    <select value={form.desired_area} onChange={(event) => setForm({ ...form, desired_area: event.target.value })} className="career-input">
                      {CAREER_AREAS.map((area) => <option key={area} value={area}>{area}</option>)}
                    </select>
                  </Field>
                  <Field label="Modalidade *">
                    <div className="flex rounded-xl border border-emerald-900/50 bg-[#09120c] p-1">
                      {(['clt', 'estagio'] as const).map((type) => (
                        <button key={type} type="button" onClick={() => setForm({ ...form, employment_type: type })} className={`flex-1 rounded-lg py-2.5 text-xs font-black ${form.employment_type === type ? 'bg-emerald-500 text-neutral-950' : 'text-neutral-300'}`}>
                          {type === 'clt' ? 'CLT (Efetivo)' : 'Estágio'}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Pretensão salarial">
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">R$</span>
                      <input value={form.salary_expectation ? maskCurrency(form.salary_expectation) : ''} onChange={(event) => handleCurrencyInputChange(event.target.value, (value) => setForm({ ...form, salary_expectation: value > 0 ? value.toString() : '' }))} className="career-input pl-11" placeholder="0,00" />
                    </div>
                  </Field>
                  <Field label="LinkedIn">
                    <input type="url" value={form.linkedin_url} onChange={(event) => setForm({ ...form, linkedin_url: event.target.value })} className="career-input" placeholder="https://linkedin.com/in/seu-perfil" />
                  </Field>
                </div>

                <Field label="Currículo — PDF, DOC, DOCX, JPG, PNG ou WEBP (máx. 10 MB)">
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-900/60 bg-[#09120c]/70 p-6 text-center hover:border-emerald-500">
                    <Upload className="h-7 w-7 text-emerald-400" />
                    <span className="mt-3 text-sm font-bold">{resumeFile ? resumeFile.name : 'Clique para selecionar o currículo'}</span>
                    <span className="mt-1 text-xs text-neutral-500">O arquivo será enviado para um bucket privado.</span>
                    <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={handleResumeUpload} className="sr-only" />
                  </label>
                </Field>

                <Field label="Resumo das experiências">
                  <textarea rows={4} maxLength={4000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="career-input" placeholder="Conte brevemente sobre sua trajetória profissional." />
                </Field>

                <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-sm font-black uppercase tracking-wider text-neutral-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60">
                  <Send className="h-4 w-4" /> {submitting ? 'Registrando no banco...' : 'Enviar candidatura'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {protocol && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} className="relative w-full max-w-xl rounded-[2rem] border border-emerald-800/50 bg-[#13221b] p-8 text-center shadow-2xl">
              <button onClick={() => setProtocol(null)} className="absolute right-5 top-5 p-2 text-white/40 hover:text-white"><X className="h-5 w-5" /></button>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400"><BadgeCheck className="h-9 w-9" /></div>
              <h3 className="mt-5 text-2xl font-black">{alreadyExists ? 'Candidatura já registrada' : 'Candidatura confirmada'}</h3>
              <p className="mt-2 text-sm text-neutral-300">{resumeWarning ? 'O cadastro foi salvo, mas o currículo não foi anexado. Guarde o protocolo e contate o RH.' : 'O registro foi confirmado no banco de dados. Guarde o protocolo para acompanhar o processo.'}</p>
              <div className="mt-6 rounded-2xl border-2 border-emerald-400 bg-white p-5 text-left text-neutral-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-800">Protocolo</p>
                    <p className="mt-1 font-mono text-xl font-black sm:text-2xl">{protocol}</p>
                  </div>
                  <button onClick={() => { copyToClipboard(protocol); toast.success('Protocolo copiado!'); }} className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase text-white hover:bg-emerald-700"><Copy className="h-4 w-4" /> Copiar</button>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-2.5">
                <button onClick={() => { setProtocol(null); onAccessPortal(); }} className="w-full rounded-xl bg-emerald-500 py-3.5 text-sm font-black text-neutral-950 hover:bg-emerald-400">Ir para a Área do Candidato</button>
                <button onClick={() => setProtocol(null)} className="w-full rounded-xl border border-white/15 bg-white/5 py-3 text-xs font-bold text-neutral-300 hover:text-white">Fechar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="border-t border-emerald-900/30 bg-[#0a120e] py-6 text-center text-xs text-neutral-500">Grupo GSA &copy; {new Date().getFullYear()} — Trabalhe Conosco</footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-neutral-200">{label}</span>
      {children}
    </label>
  );
}
