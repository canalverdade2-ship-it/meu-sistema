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
  TrendingUp,
  Award,
  Building2,
  ChevronRight,
  FileCheck2,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { supabase } from '../../lib/supabase';
import { copyToClipboard, handleCurrencyInputChange, maskCPF, maskCurrency, maskPhone } from '../../lib/utils';
import { validarCPF } from '../../utils/cpfValidator';
import '../../careers.css';

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
    toast.success(`Currículo “${file.name}” anexado com sucesso.`);
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
    <div className="min-h-screen bg-[#070e0a] text-slate-100 selection:bg-emerald-500 selection:text-neutral-950 font-sans">
      {/* HEADER GLASS CORPORATIVO */}
      <header className="sticky top-0 z-50 border-b border-emerald-900/30 bg-[#070e0a]/90 backdrop-blur-2xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <button
              onClick={onBackToSite}
              className="group flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-emerald-400 transition"
            >
              <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
              <span>Voltar ao site</span>
            </button>
            <div className="h-5 w-px bg-white/10" />
            <LogoGSA size="sm" variant="light" />
          </div>

          <button
            onClick={onAccessPortal}
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 py-2.5 text-xs font-black uppercase tracking-wider text-neutral-950 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 hover:scale-[1.02] active:scale-[0.98] transition"
          >
            <LockKeyhole className="h-4 w-4 text-neutral-950" /> Área do Candidato
          </button>
        </div>
      </header>

      <main>
        {/* HERO SECTION CORPORATIVA */}
        <section className="relative overflow-hidden border-b border-emerald-900/20 bg-gradient-to-b from-[#0b1711] via-[#070e0a] to-[#070e0a] py-20 lg:py-28">
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 h-96 w-full max-w-6xl rounded-full bg-emerald-500/10 blur-[120px]" />
          <div className="pointer-events-none absolute right-0 top-1/3 h-80 w-80 rounded-full bg-teal-500/5 blur-[100px]" />

          <div className="relative mx-auto max-w-5xl px-6 text-center lg:px-8">
            <h1 className="mt-4 text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.1]">
              Construa sua trajetória de sucesso na{' '}
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300 bg-clip-text text-transparent">
                GSA HUB
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base text-slate-300 sm:text-lg leading-relaxed font-normal">
              Faça parte de uma estrutura sólida em Gestão de Serviços. Cadastre seu currículo em ambiente seguro e acompanhe cada etapa do seu processo seletivo em tempo real.
            </p>

            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <a
                href="#formulario-candidatura"
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-8 py-4 text-sm font-black uppercase tracking-wider text-neutral-950 shadow-xl shadow-emerald-500/25 hover:bg-emerald-400 hover:scale-[1.02] active:scale-[0.98] transition"
              >
                Cadastrar Currículo <ChevronRight className="h-4 w-4" />
              </a>
              <button
                onClick={onAccessPortal}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-bold text-white backdrop-blur-md hover:bg-white/10 hover:border-white/25 transition"
              >
                Consultar Candidatura
              </button>
            </div>

            {/* BARRA DE METRICAS E GARANTIAS */}
            <div className="mt-16 grid grid-cols-1 gap-4 border-t border-white/10 pt-12 sm:grid-cols-3">
              <div className="flex flex-col items-center p-4">
                <span className="text-3xl font-black text-white tracking-tight sm:text-4xl">+05 Anos</span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Tradição em Gestão de Serviços</span>
              </div>
              <div className="flex flex-col items-center p-4 border-t sm:border-t-0 sm:border-l border-white/10">
                <span className="text-3xl font-black text-emerald-400 tracking-tight sm:text-4xl">100% Digital</span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Acompanhamento Transparente por CPF</span>
              </div>
              <div className="flex flex-col items-center p-4 border-t sm:border-t-0 sm:border-l border-white/10">
                <span className="text-3xl font-black text-amber-300 tracking-tight sm:text-4xl">Nacional</span>
                <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Oportunidades em Diversos Segmentos</span>
              </div>
            </div>
          </div>
        </section>

        {/* DIFERENCIAIS DA EMPRESA */}
        <section className="border-b border-emerald-900/20 bg-[#060c09] py-20">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-14">
              <h2 className="text-xs font-black uppercase tracking-widest text-emerald-400">Por que escolher o GSA HUB?</h2>
              <p className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">
                Cultura corporativa focada em pessoas e resultados
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Segurança & Transparência',
                  desc: 'Seus dados são protegidos sob sigilo corporativo rigoroso. Acompanhe a evolução do seu perfil em cada fase do recrutamento.',
                },
                {
                  icon: TrendingUp,
                  title: 'Desenvolvimento Contínuo',
                  desc: 'Incentivamos a constante capacitação profissional e o crescimento interno em uma estrutura sólida e dinâmica.',
                },
                {
                  icon: Award,
                  title: 'Reconhecimento de Talentos',
                  desc: 'Valorizamos a dedicação com remuneração alinhada ao mercado, estabilidade e oportunidades de ascensão.',
                },
                {
                  icon: Users,
                  title: 'Ambiente Colaborativo',
                  desc: 'Trabalhe integrado a equipes multidisciplinares comprometidas com a excelência na prestação de serviços.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="group relative rounded-3xl border border-white/10 bg-[#0d1812] p-8 shadow-lg hover:border-emerald-500/40 hover:bg-[#101d16] transition duration-300"
                >
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500 group-hover:text-neutral-950 transition duration-300">
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-6 text-lg font-black text-white">{title}</h3>
                  <p className="mt-3 text-xs leading-relaxed text-slate-400 font-medium">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ÁREAS DE ATUAÇÃO */}
        <section className="border-b border-emerald-900/20 bg-[#070e0a] py-16">
          <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
            <h3 className="text-xs font-black uppercase tracking-widest text-emerald-400 mb-6">
              Áreas com Oportunidades Constantes
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {CAREER_AREAS.map((area) => (
                <span
                  key={area}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-xs font-bold text-slate-200 hover:border-emerald-500/40 hover:text-emerald-400 transition"
                >
                  <Building2 className="h-4 w-4 text-emerald-400" />
                  {area}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* FORMULÁRIO DE CANDIDATURA PROFISSIONAL — ESCURO EXECUTIVO (OBSIDIAN & ESMERALDA) */}
        <section id="formulario-candidatura" className="bg-gradient-to-b from-[#070e0a] via-[#091510] to-[#050a07] border-t border-emerald-900/30 py-20 lg:py-28 relative overflow-hidden">
          {/* Brilho Sutil de Fundo */}
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-full max-w-5xl rounded-full bg-emerald-500/10 blur-[140px]" />

          <div className="relative mx-auto max-w-4xl px-6 lg:px-8">
            {/* CARD OBSIDIAN EXECUTIVE */}
            <div className="relative rounded-[2.5rem] border border-emerald-500/30 bg-gradient-to-b from-[#0f1b15]/95 to-[#0b140f]/95 p-8 sm:p-14 shadow-2xl shadow-emerald-950/50 backdrop-blur-2xl text-white">
              <div className="mb-10 text-center sm:text-left border-b border-emerald-500/20 pb-8">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-wider text-emerald-400 mb-3">
                  <FileCheck2 className="h-3.5 w-3.5 text-emerald-400" /> Cadastro Corporativo
                </div>
                <h2 className="text-3xl font-black text-white sm:text-4xl tracking-tight">Formulário de Candidatura</h2>
                <p className="mt-2 text-xs text-slate-300 font-medium">
                  Preencha os dados do candidato com atenção. Os campos com asterisco (*) são obrigatórios para a geração do protocolo de acompanhamento.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Nome Completo *">
                    <input
                      required
                      value={form.candidate_name}
                      onChange={(event) => setForm({ ...form, candidate_name: event.target.value })}
                      className="career-input"
                      placeholder="Ex.: Carlos Eduardo Silva"
                    />
                  </Field>

                  <Field label="CPF *">
                    <input
                      required
                      value={form.document}
                      onChange={(event) => setForm({ ...form, document: maskCPF(event.target.value) })}
                      className="career-input"
                      placeholder="000.000.000-00"
                      inputMode="numeric"
                    />
                  </Field>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="E-mail Corporativo / Pessoal *">
                    <input
                      required
                      type="email"
                      value={form.email}
                      onChange={(event) => setForm({ ...form, email: event.target.value })}
                      className="career-input"
                      placeholder="seu.email@exemplo.com"
                    />
                  </Field>

                  <Field label="Telefone / WhatsApp *">
                    <input
                      required
                      type="tel"
                      value={form.phone}
                      onChange={(event) => setForm({ ...form, phone: maskPhone(event.target.value) })}
                      className="career-input"
                      placeholder="(11) 99999-9999"
                    />
                  </Field>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Área de Interesse *">
                    <select
                      value={form.desired_area}
                      onChange={(event) => setForm({ ...form, desired_area: event.target.value })}
                      className="career-input"
                    >
                      {CAREER_AREAS.map((area) => (
                        <option key={area} value={area}>{area}</option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Modalidade *">
                    <div className="flex h-[52px] rounded-2xl border border-white/15 bg-[#070e0a] p-1.5">
                      {(['clt', 'estagio'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setForm({ ...form, employment_type: type })}
                          className={`flex-1 rounded-xl text-xs uppercase tracking-wider transition ${
                            form.employment_type === type
                              ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-neutral-950 font-black shadow-lg shadow-emerald-500/20'
                              : 'text-slate-400 hover:text-white font-bold'
                          }`}
                        >
                          {type === 'clt' ? 'CLT (Efetivo)' : 'Estágio'}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                <div className="grid gap-6 sm:grid-cols-2">
                  <Field label="Pretensão Salarial">
                    <input
                      value={form.salary_expectation ? maskCurrency(form.salary_expectation) : ''}
                      onChange={(event) =>
                        handleCurrencyInputChange(event.target.value, (value) =>
                          setForm({ ...form, salary_expectation: value > 0 ? value.toString() : '' })
                        )
                      }
                      className="career-input"
                      placeholder="R$ 0,00"
                    />
                  </Field>

                  <Field label="Perfil do LinkedIn">
                    <input
                      type="url"
                      value={form.linkedin_url}
                      onChange={(event) => setForm({ ...form, linkedin_url: event.target.value })}
                      className="career-input"
                      placeholder="https://linkedin.com/in/seu-perfil"
                    />
                  </Field>
                </div>

                <Field label="Currículo Anexado — PDF, DOC, DOCX, JPG, PNG ou WEBP (máx. 10 MB)">
                  <label className="group flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-[#070e0a] p-8 text-center hover:border-emerald-400 hover:bg-emerald-500/5 transition duration-200">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition">
                      {resumeFile ? <FileText className="h-6 w-6 text-emerald-400" /> : <Upload className="h-6 w-6 text-emerald-400" />}
                    </div>
                    <span className="mt-4 text-sm font-bold text-white">
                      {resumeFile ? resumeFile.name : 'Clique ou arraste para anexar seu currículo'}
                    </span>
                    <span className="mt-1 text-xs text-slate-400 font-medium">
                      {resumeFile
                        ? `${(resumeFile.size / (1024 * 1024)).toFixed(2)} MB — Pronto para envio`
                        : 'Documento confidencial armazenado em servidor seguro GSA.'}
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                      onChange={handleResumeUpload}
                      className="sr-only"
                    />
                  </label>
                </Field>

                <Field label="Resumo Profissional / Apresentação">
                  <textarea
                    rows={4}
                    maxLength={4000}
                    value={form.notes}
                    onChange={(event) => setForm({ ...form, notes: event.target.value })}
                    className="career-input"
                    placeholder="Descreva brevemente suas principais realizações, diferenciais e trajetória profissional."
                  />
                </Field>

                <button
                  type="submit"
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 hover:from-emerald-400 hover:to-emerald-300 py-4.5 text-sm font-black uppercase tracking-wider text-neutral-950 shadow-xl shadow-emerald-500/20 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 transition"
                >
                  <Send className="h-4 w-4 text-neutral-950" />
                  {submitting ? 'Registrando candidatura no banco de dados...' : 'Confirmar e Enviar Candidatura'}
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      {/* MODAL DE SUCESSO / PROTOCOLO */}
      <AnimatePresence>
        {protocol && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-lg rounded-[2.5rem] border border-emerald-500/30 bg-[#0f1b14] p-8 sm:p-10 text-center shadow-2xl"
            >
              <button
                onClick={() => setProtocol(null)}
                className="absolute right-6 top-6 rounded-full p-2 text-slate-400 hover:bg-white/10 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-400 shadow-inner">
                <BadgeCheck className="h-10 w-10" />
              </div>

              <h3 className="mt-6 text-2xl font-black text-white">
                {alreadyExists ? 'Candidatura Já Registrada' : 'Candidatura Confirmada!'}
              </h3>

              <p className="mt-2 text-xs text-slate-300 font-medium leading-relaxed">
                {resumeWarning
                  ? 'Sua candidatura foi registrada no sistema, porém o arquivo do currículo não pôde ser anexado. Guarde seu protocolo e entre em contato com o RH.'
                  : 'Sua candidatura foi devidamente salva no banco de dados. Guarde seu protocolo oficial para consulta futura.'}
              </p>

              <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-[#070e0a] p-5 text-left shadow-inner">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Protocolo de Candidatura</p>
                    <p className="mt-1 font-mono text-xl font-black text-white sm:text-2xl">{protocol}</p>
                  </div>
                  <button
                    onClick={() => {
                      copyToClipboard(protocol);
                      toast.success('Protocolo copiado para a área de transferência!');
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-2.5 text-xs font-black uppercase text-neutral-950 shadow-md transition"
                  >
                    <Copy className="h-4 w-4" /> Copiar
                  </button>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-3">
                <button
                  onClick={() => {
                    setProtocol(null);
                    onAccessPortal();
                  }}
                  className="w-full rounded-2xl bg-emerald-500 py-4 text-xs font-black uppercase tracking-wider text-neutral-950 hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 transition"
                >
                  Acessar Área do Candidato
                </button>
                <button
                  onClick={() => setProtocol(null)}
                  className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-slate-300 hover:bg-white/10 hover:text-white transition"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="border-t border-white/10 bg-[#040806] py-8 text-center text-xs font-semibold text-slate-500">
        GSA HUB &copy; {new Date().getFullYear()} — Portal de Carreiras. Todos os direitos reservados.
      </footer>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-left">
      <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-emerald-400">{label}</span>
      {children}
    </label>
  );
}
