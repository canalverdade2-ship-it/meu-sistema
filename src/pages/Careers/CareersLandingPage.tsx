import { ChangeEvent, FormEvent, type ReactNode, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  LockKeyhole,
  Send,
  ShieldCheck,
  Upload,
  X,
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

type FormStep = 1 | 2 | 3;

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

const PROCESS_STEPS = [
  {
    number: '01',
    title: 'Envio confirmado',
    description: 'O perfil é registrado no banco de dados e o protocolo oficial é gerado somente após a confirmação do sistema.',
  },
  {
    number: '02',
    title: 'Leitura do perfil',
    description: 'A equipe autorizada analisa os dados conforme as necessidades, áreas e oportunidades disponíveis.',
  },
  {
    number: '03',
    title: 'Contato dos selecionados',
    description: 'Quando houver compatibilidade, o contato é realizado pelos canais informados na candidatura.',
  },
  {
    number: '04',
    title: 'Continuidade do processo',
    description: 'Entrevistas e avaliações podem variar de acordo com a área e com a oportunidade em andamento.',
  },
] as const;

const FAQ_ITEMS = [
  {
    question: 'O cadastro no banco de talentos garante uma entrevista?',
    answer: 'Não. O cadastro mantém seu perfil disponível para análise, mas não representa garantia de contato, entrevista ou contratação.',
  },
  {
    question: 'Como confirmo que o envio foi concluído?',
    answer: 'O sistema apresenta um protocolo somente depois que o banco de dados confirma o registro. Guarde esse número para consultar sua candidatura.',
  },
  {
    question: 'Posso consultar o andamento depois?',
    answer: 'Sim. Use a Área do Candidato e informe o protocolo recebido junto com o CPF utilizado no cadastro.',
  },
  {
    question: 'Quais arquivos são aceitos como currículo?',
    answer: 'São aceitos arquivos PDF, DOC, DOCX, JPG, PNG e WEBP com tamanho máximo de 10 MB.',
  },
] as const;

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
  const [currentStep, setCurrentStep] = useState<FormStep>(1);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);
  const [resumeWarning, setResumeWarning] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);

  const scrollToApplication = () => {
    document.getElementById('formulario-candidatura')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const validatePersonalData = () => {
    const candidateName = form.candidate_name.trim();
    const document = form.document.replace(/\D/g, '');
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.replace(/\D/g, '');

    if (candidateName.length < 3) {
      toast.error('Informe o nome completo do candidato.');
      return false;
    }
    if (!validarCPF(document)) {
      toast.error('Informe um CPF válido.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Informe um e-mail válido.');
      return false;
    }
    if (phone.length < 10 || phone.length > 13) {
      toast.error('Informe um telefone com DDD válido.');
      return false;
    }

    return true;
  };

  const goToNextStep = () => {
    if (currentStep === 1 && !validatePersonalData()) return;
    setCurrentStep((step) => Math.min(step + 1, 3) as FormStep);
  };

  const goToPreviousStep = () => {
    setCurrentStep((step) => Math.max(step - 1, 1) as FormStep);
  };

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

    if (!validatePersonalData()) {
      setCurrentStep(1);
      return;
    }

    if (!acceptedPrivacy) {
      toast.error('Confirme a autorização para o tratamento dos dados da candidatura.');
      return;
    }

    const candidateName = form.candidate_name.trim();
    const document = form.document.replace(/\D/g, '');
    const email = form.email.trim().toLowerCase();
    const phone = form.phone.replace(/\D/g, '');

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
            // Rollback storage upload
            await supabase.storage.from(CAREER_BUCKET).remove([result.resume_upload_path]);
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
    <div className="career-page min-h-screen bg-[#f3f0e9] text-[#172235] selection:bg-[#c39a4b] selection:text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0d1724]/95 text-white backdrop-blur-md">
        <div className="mx-auto flex h-[78px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <div className="flex min-w-0 items-center gap-5 sm:gap-7">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-white/70 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d2b06e] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1724]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Voltar ao site</span>
            </button>
            <span className="hidden h-7 w-px bg-white/20 sm:block" aria-hidden="true" />
            <LogoGSA size="sm" variant="light" showText className="min-w-0" />
          </div>

          <button
            type="button"
            onClick={onAccessPortal}
            className="inline-flex items-center gap-2 border border-[#d2b06e] px-4 py-2.5 text-sm font-semibold text-[#f0ddb5] transition-colors hover:bg-[#d2b06e] hover:text-[#0d1724] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1724] sm:px-5"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Área do Candidato</span>
            <span className="sm:hidden">Acompanhar</span>
          </button>
        </div>
      </header>

      <main>
        <section className="career-hero relative isolate overflow-hidden bg-[#0d1724] text-white">
          <div className="career-hero-grid absolute inset-0 opacity-55" aria-hidden="true" />
          <div className="career-outline-word absolute left-1/2 top-[44%] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap" aria-hidden="true">CARREIRAS</div>

          <div className="relative mx-auto flex min-h-[720px] max-w-[1440px] flex-col justify-between px-5 pb-0 pt-16 sm:px-8 sm:pt-20 lg:px-12 lg:pt-24">
            <div className="mx-auto max-w-5xl text-center">
              <div className="mx-auto flex w-fit items-center gap-3 border-y border-white/20 py-3 text-xs font-bold uppercase tracking-[0.24em] text-[#d2b06e]">
                <span className="h-px w-8 bg-[#d2b06e]" aria-hidden="true" />
                Carreiras GSA HUB
                <span className="h-px w-8 bg-[#d2b06e]" aria-hidden="true" />
              </div>

              <h1 className="mt-10 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] text-white sm:text-6xl md:text-7xl lg:text-[6.4rem]">
                Trabalho sério.<br />Espaço para construir.
              </h1>
              <p className="mx-auto mt-8 max-w-3xl text-base leading-8 text-white/70 sm:text-lg">
                Procuramos pessoas responsáveis, atentas e preparadas para transformar conhecimento em trabalho bem executado. O primeiro passo pode começar pelo nosso banco de talentos.
              </p>

              <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={scrollToApplication}
                  className="inline-flex items-center justify-center gap-2 bg-[#d2b06e] px-7 py-4 text-sm font-bold text-[#0d1724] transition-colors hover:bg-[#e2c98f] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1724]"
                >
                  Apresentar meu perfil
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onAccessPortal}
                  className="inline-flex items-center justify-center gap-2 border border-white/25 px-7 py-4 text-sm font-semibold text-white transition-colors hover:border-white hover:bg-white hover:text-[#0d1724] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#d2b06e] focus-visible:ring-offset-4 focus-visible:ring-offset-[#0d1724]"
                >
                  Consultar candidatura
                </button>
              </div>
            </div>

            <div className="career-hero-footer mt-16 grid border-t border-white/20 md:grid-cols-3">
              {[
                ['01', 'Processo transparente', 'Protocolo oficial e consulta protegida por CPF.'],
                ['02', 'Dados sob controle', 'Currículos mantidos em armazenamento privado.'],
                ['03', 'Cadastro contínuo', 'Perfil disponível para futuras oportunidades.'],
              ].map(([number, title, description], index) => (
                <div key={number} className={`px-1 py-7 sm:px-6 md:py-8 ${index > 0 ? 'md:border-l md:border-white/20' : ''}`}>
                  <div className="flex items-start gap-4">
                    <span className="font-mono text-xs text-[#d2b06e]">{number}</span>
                    <div>
                      <h2 className="text-sm font-semibold text-white">{title}</h2>
                      <p className="mt-2 text-sm leading-6 text-white/60">{description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f3f0e9]">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <div className="mx-auto max-w-6xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9b722b]">Nossa forma de trabalhar</p>
              <blockquote className="mt-8 text-3xl font-semibold leading-tight tracking-[-0.035em] text-[#172235] sm:text-4xl lg:text-5xl">
                “Não procuramos personagens prontos. Procuramos profissionais que tratem cada responsabilidade com clareza, respeito e consistência.”
              </blockquote>
            </div>

            <div className="mt-16 grid border-y border-[#c9c2b5] md:grid-cols-3">
              {[
                ['Responsabilidade', 'Cuidado real com dados, prazos, decisões e compromissos assumidos.'],
                ['Colaboração', 'Comunicação direta, respeito profissional e participação consciente.'],
                ['Evolução', 'Capacidade de aprender, revisar e elevar a qualidade da própria execução.'],
              ].map(([title, description], index) => (
                <article key={title} className={`px-2 py-9 sm:px-8 md:py-12 ${index > 0 ? 'md:border-l md:border-[#c9c2b5]' : ''}`}>
                  <span className="block h-1 w-10 bg-[#c39a4b]" aria-hidden="true" />
                  <h2 className="mt-7 text-xl font-semibold text-[#172235]">{title}</h2>
                  <p className="mt-3 text-sm leading-7 text-[#5f6873]">{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-white">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9b722b]">Onde você pode contribuir</p>
                <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-[#172235] sm:text-5xl">Diferentes áreas. Um mesmo padrão de responsabilidade.</h2>
              </div>
              <p className="max-w-md text-sm leading-7 text-[#66707b]">As áreas abaixo representam frentes de interesse do banco de talentos. A disponibilidade de vagas específicas depende da necessidade da empresa.</p>
            </div>

            <div className="career-discipline-grid mt-14 border-t border-[#c9c2b5]">
              {CAREER_AREAS.map((area, index) => (
                <div key={area} className="career-discipline-row group grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-b border-[#c9c2b5] py-6 transition-colors hover:bg-[#f7f5f0] sm:grid-cols-[5rem_1fr_auto] sm:py-8">
                  <span className="font-mono text-xs text-[#9b722b]">0{index + 1}</span>
                  <h3 className="text-lg font-semibold text-[#172235] sm:text-2xl">{area}</h3>
                  <ArrowRight className="h-5 w-5 -translate-x-2 text-[#9b722b] opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" aria-hidden="true" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="oportunidades" className="scroll-mt-24 bg-[#c39a4b] text-[#0d1724]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
            <div className="career-opportunity-panel border border-[#0d1724]/30 bg-[#d6b878]">
              <div className="grid lg:grid-cols-[0.55fr_1.45fr]">
                <div className="flex min-h-[230px] items-center justify-center border-b border-[#0d1724]/25 p-8 lg:border-b-0 lg:border-r">
                  <span className="text-[7rem] font-semibold leading-none tracking-[-0.08em] text-[#0d1724]/10 sm:text-[10rem]" aria-hidden="true">01</span>
                </div>
                <div className="p-7 sm:p-10 lg:p-12">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="bg-[#0d1724] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-white">Cadastro aberto</span>
                    <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#0d1724]/60">Banco de talentos</span>
                  </div>
                  <h2 className="mt-7 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">Mantenha seu perfil disponível para futuras oportunidades.</h2>
                  <p className="mt-5 max-w-3xl text-base leading-7 text-[#283342]">No momento, o canal ativo é o banco de talentos. Seu cadastro pode ser considerado quando surgir uma oportunidade compatível com sua área e experiência.</p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={scrollToApplication}
                      className="inline-flex items-center justify-center gap-2 bg-[#0d1724] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#263649] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#d6b878]"
                    >
                      Entrar no banco de talentos
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={onAccessPortal}
                      className="inline-flex items-center justify-center border border-[#0d1724] px-6 py-3.5 text-sm font-semibold text-[#0d1724] transition-colors hover:bg-[#0d1724] hover:text-white"
                    >
                      Já tenho protocolo
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <p className="mt-5 text-xs leading-6 text-[#0d1724]/60">O cadastro não representa promessa de contato, entrevista ou contratação.</p>
          </div>
        </section>

        <section className="bg-[#0d1724] text-white">
          <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
            <div className="mx-auto max-w-3xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d2b06e]">Processo seletivo</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">Cada etapa precisa fazer sentido.</h2>
              <p className="mt-5 text-base leading-7 text-white/60">O fluxo pode variar conforme a oportunidade, mas a candidatura sempre começa com um registro confirmado e consultável.</p>
            </div>

            <ol className="career-timeline relative mx-auto mt-16 max-w-6xl">
              {PROCESS_STEPS.map((step, index) => {
                const placeLeft = index % 2 === 0;
                return (
                  <li key={step.number} className="career-timeline-item relative grid gap-6 pb-12 md:grid-cols-[1fr_72px_1fr] md:gap-8 md:pb-16">
                    <article className={`${placeLeft ? 'md:col-start-1 md:text-right' : 'md:col-start-3'} ${placeLeft ? '' : 'md:row-start-1'} border border-white/20 bg-[#111e2e] p-6 sm:p-8`}>
                      <span className="font-mono text-xs text-[#d2b06e]">ETAPA {step.number}</span>
                      <h3 className="mt-4 text-xl font-semibold text-white">{step.title}</h3>
                      <p className="mt-3 text-sm leading-7 text-white/60">{step.description}</p>
                    </article>
                    <div className="career-timeline-node hidden md:col-start-2 md:row-start-1 md:flex" aria-hidden="true">
                      <span>{step.number}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </section>

        <section id="formulario-candidatura" className="scroll-mt-24 bg-[#e9e4d9] py-20 sm:py-24 lg:py-32">
          <div className="mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-12">
            <div className="mx-auto max-w-4xl text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9b722b]">Banco de talentos</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-[#172235] sm:text-5xl lg:text-6xl">Seu perfil começa por uma apresentação clara.</h2>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-[#626c77]">Três etapas, dados preservados entre elas e protocolo gerado somente após a confirmação do banco de dados.</p>
            </div>

            <div className="career-application-shell mx-auto mt-14 max-w-5xl overflow-hidden bg-white shadow-[0_32px_90px_rgba(13,23,36,0.14)]">
              <div className="bg-[#0d1724] px-6 py-7 text-white sm:px-10 lg:px-12">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#d2b06e]">Ficha profissional</p>
                    <h3 className="mt-2 text-2xl font-semibold">Cadastro de candidatura</h3>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-white/60">
                    <ShieldCheck className="h-5 w-5 text-[#d2b06e]" aria-hidden="true" />
                    Ambiente protegido
                  </div>
                </div>

                <div className="mt-8 grid gap-2 sm:grid-cols-3">
                  {[
                    ['1', 'Identificação'],
                    ['2', 'Experiência'],
                    ['3', 'Confirmação'],
                  ].map(([number, label], index) => {
                    const step = (index + 1) as FormStep;
                    const active = currentStep === step;
                    const complete = currentStep > step;
                    return (
                      <button
                        key={number}
                        type="button"
                        onClick={() => {
                          if (step === 1 || currentStep > step || validatePersonalData()) setCurrentStep(step);
                        }}
                        className={`career-step-button flex items-center gap-3 border px-4 py-3 text-left transition-colors ${active ? 'border-[#d2b06e] bg-[#d2b06e] text-[#0d1724]' : complete ? 'border-white/20 bg-white/10 text-white' : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'}`}
                        aria-current={active ? 'step' : undefined}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center border text-xs font-bold ${active ? 'border-[#0d1724]/25' : 'border-current'}`}>
                          {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : number}
                        </span>
                        <span className="text-sm font-semibold">{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <form onSubmit={handleSubmit} className="px-6 py-8 sm:px-10 sm:py-10 lg:px-14 lg:py-12">
                <div className="mb-8 flex items-end justify-between gap-4 border-b border-[#ddd7cb] pb-6">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9b722b]">Etapa {currentStep} de 3</p>
                    <h4 className="mt-2 text-2xl font-semibold text-[#172235]">
                      {currentStep === 1 ? 'Dados de identificação' : currentStep === 2 ? 'Perfil e experiência' : 'Currículo e autorização'}
                    </h4>
                  </div>
                  <span className="font-mono text-sm text-[#727b85]">{Math.round((currentStep / 3) * 100)}%</span>
                </div>

                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.18 }}
                  >
                    {currentStep === 1 && (
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Nome completo" required>
                            <input
                              required
                              autoComplete="name"
                              value={form.candidate_name}
                              onChange={(event) => setForm({ ...form, candidate_name: event.target.value })}
                              className="career-input"
                              placeholder="Digite seu nome completo"
                            />
                          </Field>
                        </div>
                        <Field label="CPF" required>
                          <input
                            required
                            value={form.document}
                            onChange={(event) => setForm({ ...form, document: maskCPF(event.target.value) })}
                            className="career-input"
                            placeholder="000.000.000-00"
                            inputMode="numeric"
                          />
                        </Field>
                        <Field label="Telefone ou WhatsApp" required>
                          <input
                            required
                            type="tel"
                            autoComplete="tel"
                            value={form.phone}
                            onChange={(event) => setForm({ ...form, phone: maskPhone(event.target.value) })}
                            className="career-input"
                            placeholder="(11) 99999-9999"
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="E-mail" required>
                            <input
                              required
                              type="email"
                              autoComplete="email"
                              value={form.email}
                              onChange={(event) => setForm({ ...form, email: event.target.value })}
                              className="career-input"
                              placeholder="seuemail@exemplo.com"
                            />
                          </Field>
                        </div>
                      </div>
                    )}

                    {currentStep === 2 && (
                      <div className="grid gap-6 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                          <Field label="Área de interesse" required>
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
                        </div>

                        <div className="sm:col-span-2">
                          <Field label="Tipo de oportunidade" required>
                            <div className="grid grid-cols-2 border border-[#bfc4ca] p-1">
                              {(['clt', 'estagio'] as const).map((type) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => setForm({ ...form, employment_type: type })}
                                  className={`min-h-12 px-4 text-sm font-semibold transition-colors ${form.employment_type === type ? 'bg-[#0d1724] text-white' : 'text-[#5e6977] hover:bg-[#f1eee8]'}`}
                                  aria-pressed={form.employment_type === type}
                                >
                                  {type === 'clt' ? 'Efetivo / CLT' : 'Estágio'}
                                </button>
                              ))}
                            </div>
                          </Field>
                        </div>

                        <Field label="Pretensão salarial">
                          <input
                            value={form.salary_expectation ? maskCurrency(form.salary_expectation) : ''}
                            onChange={(event) =>
                              handleCurrencyInputChange(event.target.value, (value) =>
                                setForm({ ...form, salary_expectation: value > 0 ? value.toString() : '' }),
                              )
                            }
                            className="career-input"
                            placeholder="R$ 0,00"
                            inputMode="numeric"
                          />
                        </Field>

                        <Field label="LinkedIn">
                          <input
                            type="url"
                            value={form.linkedin_url}
                            onChange={(event) => setForm({ ...form, linkedin_url: event.target.value })}
                            className="career-input"
                            placeholder="linkedin.com/in/seu-perfil"
                          />
                        </Field>

                        <div className="sm:col-span-2">
                          <Field label="Resumo profissional">
                            <textarea
                              rows={5}
                              maxLength={4000}
                              value={form.notes}
                              onChange={(event) => setForm({ ...form, notes: event.target.value })}
                              className="career-input"
                              placeholder="Apresente brevemente sua experiência, principais conhecimentos e objetivos profissionais."
                            />
                          </Field>
                        </div>
                      </div>
                    )}

                    {currentStep === 3 && (
                      <div className="space-y-7">
                        <Field label="Currículo">
                          <label className="career-file-upload">
                            <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-[#cfc8bc] bg-[#f3f0e9] text-[#172235]">
                              {resumeFile ? <FileText className="h-5 w-5" aria-hidden="true" /> : <Upload className="h-5 w-5" aria-hidden="true" />}
                            </span>
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-sm font-semibold text-[#172235]">
                                {resumeFile ? resumeFile.name : 'Selecionar arquivo do currículo'}
                              </strong>
                              <span className="mt-1 block text-sm leading-5 text-[#69737d]">
                                {resumeFile ? `${(resumeFile.size / (1024 * 1024)).toFixed(2)} MB — arquivo pronto para envio` : 'PDF, DOC, DOCX, JPG, PNG ou WEBP — máximo de 10 MB'}
                              </span>
                            </span>
                            <span className="shrink-0 text-sm font-semibold text-[#9b722b]">Escolher</span>
                            <input
                              type="file"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                              onChange={handleResumeUpload}
                              className="sr-only"
                            />
                          </label>
                        </Field>

                        <div className="border-t border-[#ddd7cb] pt-6">
                          <label className="flex cursor-pointer items-start gap-3">
                            <input
                              type="checkbox"
                              checked={acceptedPrivacy}
                              onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                              className="career-checkbox mt-1"
                            />
                            <span className="text-sm leading-7 text-[#5e6977]">
                              Autorizo o tratamento dos dados informados para análise do meu perfil e possível contato relacionado a oportunidades profissionais do GSA HUB. <strong className="font-semibold text-[#172235]">Obrigatório.</strong>
                            </span>
                          </label>
                        </div>

                        <div className="flex items-start gap-3 border-l-4 border-[#c39a4b] bg-[#f3f0e9] p-5">
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#31583a]" aria-hidden="true" />
                          <p className="text-sm leading-7 text-[#596573]">Revise os dados antes de enviar. O protocolo só será exibido depois da confirmação do registro no banco de dados.</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>

                <div className="mt-10 flex flex-col-reverse gap-3 border-t border-[#ddd7cb] pt-7 sm:flex-row sm:justify-between">
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      onClick={goToPreviousStep}
                      className="inline-flex items-center justify-center gap-2 border border-[#bfc4ca] px-6 py-3.5 text-sm font-semibold text-[#172235] transition-colors hover:border-[#172235] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c39a4b] focus-visible:ring-offset-4"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Voltar
                    </button>
                  ) : <span />}

                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={goToNextStep}
                      className="inline-flex items-center justify-center gap-2 bg-[#0d1724] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#263649] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c39a4b] focus-visible:ring-offset-4"
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 bg-[#0d1724] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[#263649] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c39a4b] focus-visible:ring-offset-4"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {submitting ? 'Registrando candidatura...' : 'Enviar candidatura'}
                    </button>
                  )}
                </div>
              </form>
            </div>

            <div className="mx-auto mt-8 flex max-w-5xl flex-col justify-between gap-4 border-t border-[#c9c2b5] pt-6 text-sm text-[#65707a] sm:flex-row sm:items-center">
              <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#9b722b]" aria-hidden="true" /> Currículos armazenados em ambiente privado.</span>
              <span>O protocolo é gerado somente após confirmação do banco.</span>
            </div>
          </div>
        </section>

        <section className="bg-white">
          <div className="mx-auto max-w-[1100px] px-5 py-20 sm:px-8 lg:py-24">
            <div className="text-center">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#9b722b]">Dúvidas frequentes</p>
              <h2 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-[#172235] sm:text-5xl">Antes de enviar, confira.</h2>
            </div>

            <div className="mt-12 border-t border-[#c9c2b5]">
              {FAQ_ITEMS.map((item, index) => (
                <details key={item.question} className="career-faq group border-b border-[#c9c2b5]">
                  <summary className="grid cursor-pointer list-none grid-cols-[3rem_1fr_auto] items-center gap-4 py-7 text-left text-[#172235] sm:grid-cols-[4rem_1fr_auto] sm:py-8">
                    <span className="font-mono text-xs text-[#9b722b]">0{index + 1}</span>
                    <span className="text-base font-semibold sm:text-lg">{item.question}</span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#9b722b] transition-transform" aria-hidden="true" />
                  </summary>
                  <p className="max-w-3xl pb-8 pl-[4rem] text-sm leading-7 text-[#5f6873] sm:pl-[5rem]">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#c39a4b] text-[#0d1724]">
          <div className="mx-auto max-w-[1440px] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
            <div className="flex flex-col items-start justify-between gap-9 lg:flex-row lg:items-center">
              <div className="max-w-4xl">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#0d1724]/60">Já enviou seu perfil?</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl lg:text-5xl">Seu protocolo mantém você conectado ao processo.</h2>
              </div>
              <button
                type="button"
                onClick={onAccessPortal}
                className="inline-flex shrink-0 items-center justify-center gap-2 bg-[#0d1724] px-7 py-4 text-sm font-bold text-white transition-colors hover:bg-[#263649] focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-4 focus-visible:ring-offset-[#c39a4b]"
              >
                Acessar Área do Candidato
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {protocol && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#07101c]/80 p-4" role="dialog" aria-modal="true" aria-labelledby="career-success-title">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              className="relative w-full max-w-lg bg-white p-7 shadow-2xl sm:p-10"
            >
              <button
                type="button"
                onClick={() => setProtocol(null)}
                className="absolute right-4 top-4 p-2 text-[#65707d] transition-colors hover:bg-[#f1eee8] hover:text-[#172235] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c39a4b]"
                aria-label="Fechar confirmação"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="flex h-12 w-12 items-center justify-center bg-[#e8efe9] text-[#31583a]">
                <BadgeCheck className="h-7 w-7" aria-hidden="true" />
              </div>

              <h3 id="career-success-title" className="mt-6 text-2xl font-semibold text-[#172235]">
                {alreadyExists ? 'Candidatura localizada' : 'Candidatura recebida'}
              </h3>

              <p className="mt-3 text-sm leading-7 text-[#5e6977]">
                {resumeWarning
                  ? 'Seu cadastro foi confirmado, mas o arquivo do currículo não pôde ser anexado. Guarde o protocolo e entre em contato com o atendimento.'
                  : alreadyExists
                    ? 'O sistema identificou que sua candidatura já estava registrada. Use o protocolo abaixo para acompanhar o cadastro existente.'
                    : 'Seu perfil foi registrado com sucesso. Guarde o protocolo abaixo para consultar o andamento na Área do Candidato.'}
              </p>

              <div className="mt-7 border border-[#cfc8bc] bg-[#f3f0e9] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#7d6841]">Protocolo de candidatura</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="break-all font-mono text-xl font-semibold text-[#172235]">{protocol}</p>
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(protocol);
                      toast.success('Protocolo copiado.');
                    }}
                    className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#172235] px-4 py-2.5 text-sm font-semibold text-[#172235] transition-colors hover:bg-[#172235] hover:text-white"
                  >
                    <Copy className="h-4 w-4" aria-hidden="true" />
                    Copiar
                  </button>
                </div>
              </div>

              <div className="mt-7 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setProtocol(null);
                    onAccessPortal();
                  }}
                  className="bg-[#0d1724] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#263649]"
                >
                  Acompanhar candidatura
                </button>
                <button
                  type="button"
                  onClick={() => setProtocol(null)}
                  className="border border-[#bfc4ca] px-5 py-3 text-sm font-semibold text-[#172235] transition-colors hover:border-[#172235]"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="border-t border-white/10 bg-[#07101c] text-white">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-5 py-9 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-12">
          <LogoGSA size="sm" variant="light" showText />
          <p className="text-sm text-white/50">© {new Date().getFullYear()} GSA HUB — Portal de Carreiras.</p>
        </div>
      </footer>
    </div>
  );
}

function Field({ label, children, required = false }: { label: string; children: ReactNode; required?: boolean }) {
  return (
    <label className="block text-left">
      <span className="mb-2 block text-sm font-semibold text-[#2d394a]">
        {label}
        {required && <span className="ml-1 text-[#9a4c3c]" aria-hidden="true">*</span>}
      </span>
      {children}
    </label>
  );
}
