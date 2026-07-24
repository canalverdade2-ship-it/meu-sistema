import { ChangeEvent, FormEvent, type ReactNode, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Briefcase,
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
  ['01', 'Envio do perfil', 'Você registra seus dados profissionais e recebe um protocolo oficial.'],
  ['02', 'Análise responsável', 'O perfil é consultado pela equipe autorizada conforme as necessidades da empresa.'],
  ['03', 'Contato dos selecionados', 'Quando houver compatibilidade, o contato é realizado pelos canais informados.'],
  ['04', 'Continuidade do processo', 'As próximas etapas variam conforme a área e a oportunidade disponível.'],
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
    <div className="career-page min-h-screen bg-[#f5f4f1] text-[#182235] selection:bg-[#c5a15a] selection:text-white">
      <header className="sticky top-0 z-50 border-b border-[#dedbd4] bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-4 sm:gap-6">
            <button
              type="button"
              onClick={onBackToSite}
              className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-[#536071] transition-colors hover:text-[#142030] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Voltar ao site</span>
            </button>
            <span className="hidden h-7 w-px bg-[#dedbd4] sm:block" aria-hidden="true" />
            <LogoGSA size="sm" variant="dark" showText className="min-w-0" />
          </div>

          <button
            type="button"
            onClick={onAccessPortal}
            className="inline-flex items-center gap-2 border border-[#142030] bg-[#142030] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#243448] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4 sm:px-5"
          >
            <LockKeyhole className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Área do Candidato</span>
            <span className="sm:hidden">Acompanhar</span>
          </button>
        </div>
      </header>

      <main>
        <section className="border-b border-[#dedbd4] bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:gap-20 lg:px-8 lg:py-24">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a712d]">Carreiras GSA HUB</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] text-[#142030] sm:text-5xl lg:text-[4rem]">
                Faça parte do que estamos construindo.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#536071]">
                Buscamos pessoas responsáveis, comprometidas e preparadas para contribuir com projetos reais. Conheça nosso processo e mantenha seu perfil disponível para futuras oportunidades.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={scrollToApplication}
                  className="inline-flex items-center justify-center gap-2 bg-[#142030] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#243448] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4"
                >
                  Cadastrar no banco de talentos
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={onAccessPortal}
                  className="inline-flex items-center justify-center border border-[#bfc4ca] bg-white px-6 py-3.5 text-sm font-semibold text-[#142030] transition-colors hover:border-[#142030] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4"
                >
                  Consultar candidatura
                </button>
              </div>

              <p className="mt-5 max-w-xl text-sm leading-6 text-[#687484]">
                O cadastro no banco de talentos não representa garantia de entrevista ou contratação.
              </p>
            </div>

            <aside className="border-l-4 border-[#b68a3a] bg-[#142030] px-7 py-8 text-white sm:px-9 sm:py-10" aria-label="Princípios de trabalho do GSA HUB">
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#dbc38e]">Como trabalhamos</p>
              <p className="mt-4 text-2xl font-semibold leading-snug">Clareza no processo, responsabilidade nas decisões e respeito pelas pessoas.</p>
              <div className="mt-8 divide-y divide-white/15 border-y border-white/15">
                {[
                  ['01', 'Organização', 'Processos claros e informações tratadas com responsabilidade.'],
                  ['02', 'Compromisso', 'Cada função exige seriedade, constância e atenção aos resultados.'],
                  ['03', 'Desenvolvimento', 'Aprendizado construído no trabalho e na participação em projetos reais.'],
                ].map(([number, title, description]) => (
                  <div key={number} className="grid grid-cols-[2.5rem_1fr] gap-4 py-5">
                    <span className="font-mono text-sm text-[#dbc38e]">{number}</span>
                    <div>
                      <h2 className="font-semibold text-white">{title}</h2>
                      <p className="mt-1 text-sm leading-6 text-white/70">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="border-b border-[#dedbd4] bg-[#f5f4f1]">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a712d]">Ambiente profissional</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-[#142030] sm:text-4xl">Trabalho com propósito prático.</h2>
              </div>
              <div className="max-w-3xl">
                <p className="text-xl leading-8 text-[#2d394a]">
                  O GSA HUB atua em diferentes frentes de soluções digitais e administrativas. Procuramos pessoas que compreendam a importância de atender bem, organizar processos e entregar um trabalho confiável.
                </p>
                <div className="mt-10 grid gap-x-10 gap-y-8 border-t border-[#cfcac1] pt-8 sm:grid-cols-2">
                  {[
                    ['Responsabilidade', 'Cuidado com informações, prazos, compromissos e decisões.'],
                    ['Colaboração', 'Comunicação respeitosa e participação consciente no trabalho em equipe.'],
                    ['Evolução contínua', 'Abertura para aprender, revisar processos e melhorar a execução.'],
                    ['Foco no cliente', 'Entendimento real das necessidades antes de propor ou executar soluções.'],
                  ].map(([title, description]) => (
                    <div key={title}>
                      <h3 className="font-semibold text-[#142030]">{title}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#5e6977]">{description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="oportunidades" className="border-b border-[#dedbd4] bg-white scroll-mt-24">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a712d]">Oportunidades</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-[#142030] sm:text-4xl">Oportunidades disponíveis</h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-[#5e6977]">
                  Vagas específicas serão publicadas nesta área conforme a necessidade da empresa. No momento, o canal disponível é o cadastro contínuo no banco de talentos.
                </p>
              </div>
              <button
                type="button"
                onClick={onAccessPortal}
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#142030] underline decoration-[#c5a15a] decoration-2 underline-offset-4 hover:text-[#9a712d]"
              >
                Já possui protocolo? Acompanhar
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-10 border-y border-[#cfcac1]">
              <div className="grid gap-6 py-7 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center border border-[#cfcac1] bg-[#f5f4f1] text-[#142030]">
                    <Briefcase className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-lg font-semibold text-[#142030]">Banco de Talentos GSA HUB</h3>
                      <span className="border border-[#b9cbbd] bg-[#edf4ef] px-2.5 py-1 text-xs font-semibold text-[#31583a]">Cadastro aberto</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#5e6977]">Perfil profissional para futuras oportunidades em diferentes áreas de atuação.</p>
                  </div>
                </div>
                <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-1 md:gap-2">
                  <div className="flex gap-2">
                    <dt className="font-semibold text-[#2d394a]">Área:</dt>
                    <dd className="text-[#66717f]">Diversas</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="font-semibold text-[#2d394a]">Modalidade:</dt>
                    <dd className="text-[#66717f]">Conforme oportunidade</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  onClick={scrollToApplication}
                  className="inline-flex items-center justify-center gap-2 border border-[#142030] px-5 py-3 text-sm font-semibold text-[#142030] transition-colors hover:bg-[#142030] hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4"
                >
                  Enviar perfil
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#dedbd4] bg-[#142030] text-white">
          <div className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8 lg:py-20">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#dbc38e]">Processo seletivo</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">Um processo explicado com clareza.</h2>
              <p className="mt-4 text-base leading-7 text-white/70">As etapas podem variar de acordo com a área e a oportunidade disponível.</p>
            </div>

            <ol className="mt-12 grid gap-0 border-t border-white/20 md:grid-cols-4">
              {PROCESS_STEPS.map(([number, title, description], index) => (
                <li key={number} className={`border-b border-white/20 py-7 md:border-b-0 md:px-7 ${index > 0 ? 'md:border-l' : ''}`}>
                  <span className="font-mono text-sm text-[#dbc38e]">{number}</span>
                  <h3 className="mt-5 font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/65">{description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="formulario-candidatura" className="scroll-mt-24 border-b border-[#dedbd4] bg-[#f5f4f1]">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:px-8 lg:py-24">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a712d]">Banco de talentos</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-[#142030] sm:text-4xl">Apresente seu perfil profissional.</h2>
              <p className="mt-5 text-base leading-7 text-[#5e6977]">
                O formulário foi dividido em três etapas para facilitar o preenchimento. Ao final, o sistema gera um protocolo oficial de acompanhamento.
              </p>

              <div className="mt-9 border-t border-[#cfcac1]">
                {[
                  ['1', 'Dados pessoais', 'Informações para identificação e contato.'],
                  ['2', 'Perfil profissional', 'Área de interesse, experiência e apresentação.'],
                  ['3', 'Currículo e envio', 'Documento, autorização e confirmação.'],
                ].map(([number, title, description], index) => {
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
                      className="grid w-full grid-cols-[2.5rem_1fr] gap-4 border-b border-[#cfcac1] py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-inset"
                      aria-current={active ? 'step' : undefined}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center text-sm font-semibold ${active ? 'bg-[#142030] text-white' : complete ? 'bg-[#e4eadf] text-[#31583a]' : 'border border-[#bfc4ca] text-[#647080]'}`}>
                        {complete ? <Check className="h-4 w-4" aria-hidden="true" /> : number}
                      </span>
                      <span>
                        <strong className={`block text-sm ${active ? 'text-[#142030]' : 'text-[#566271]'}`}>{title}</strong>
                        <span className="mt-1 block text-sm leading-5 text-[#77818d]">{description}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-8 flex items-start gap-3 border-l-2 border-[#b68a3a] pl-4">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#9a712d]" aria-hidden="true" />
                <p className="text-sm leading-6 text-[#65707d]">Os currículos são armazenados em ambiente privado e o acesso administrativo ocorre por autorização.</p>
              </div>
            </div>

            <div className="bg-white p-6 shadow-[0_18px_60px_rgba(20,32,48,0.08)] sm:p-9 lg:p-10">
              <div className="flex items-start justify-between gap-6 border-b border-[#dedbd4] pb-6">
                <div>
                  <p className="text-sm font-semibold text-[#9a712d]">Etapa {currentStep} de 3</p>
                  <h3 className="mt-2 text-2xl font-semibold text-[#142030]">
                    {currentStep === 1 ? 'Dados pessoais' : currentStep === 2 ? 'Perfil profissional' : 'Currículo e confirmação'}
                  </h3>
                </div>
                <span className="text-sm font-semibold text-[#65707d]">{Math.round((currentStep / 3) * 100)}%</span>
              </div>
              <div className="h-1 bg-[#e4e1da]" aria-hidden="true">
                <div className="h-full bg-[#b68a3a] transition-all" style={{ width: `${(currentStep / 3) * 100}%` }} />
              </div>

              <form onSubmit={handleSubmit} className="mt-8">
                {currentStep === 1 && (
                  <div className="space-y-6">
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

                    <div className="grid gap-6 sm:grid-cols-2">
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
                    </div>

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
                )}

                {currentStep === 2 && (
                  <div className="space-y-6">
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

                    <Field label="Tipo de oportunidade" required>
                      <div className="grid grid-cols-2 border border-[#bfc4ca] p-1">
                        {(['clt', 'estagio'] as const).map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setForm({ ...form, employment_type: type })}
                            className={`min-h-11 px-4 text-sm font-semibold transition-colors ${form.employment_type === type ? 'bg-[#142030] text-white' : 'text-[#5e6977] hover:bg-[#f1f0ed]'}`}
                            aria-pressed={form.employment_type === type}
                          >
                            {type === 'clt' ? 'Efetivo / CLT' : 'Estágio'}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <div className="grid gap-6 sm:grid-cols-2">
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
                    </div>

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
                )}

                {currentStep === 3 && (
                  <div className="space-y-7">
                    <Field label="Currículo">
                      <label className="career-file-upload">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#cfcac1] bg-[#f5f4f1] text-[#142030]">
                          {resumeFile ? <FileText className="h-5 w-5" aria-hidden="true" /> : <Upload className="h-5 w-5" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm font-semibold text-[#142030]">
                            {resumeFile ? resumeFile.name : 'Selecionar arquivo do currículo'}
                          </strong>
                          <span className="mt-1 block text-sm leading-5 text-[#6a7582]">
                            {resumeFile ? `${(resumeFile.size / (1024 * 1024)).toFixed(2)} MB — arquivo pronto para envio` : 'PDF, DOC, DOCX, JPG, PNG ou WEBP — máximo de 10 MB'}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-[#9a712d]">Escolher</span>
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                          onChange={handleResumeUpload}
                          className="sr-only"
                        />
                      </label>
                    </Field>

                    <div className="border-t border-[#dedbd4] pt-6">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={acceptedPrivacy}
                          onChange={(event) => setAcceptedPrivacy(event.target.checked)}
                          className="career-checkbox mt-1"
                        />
                        <span className="text-sm leading-6 text-[#5e6977]">
                          Autorizo o tratamento dos dados informados para análise do meu perfil e possível contato relacionado a oportunidades profissionais do GSA HUB. <strong className="font-semibold text-[#142030]">Obrigatório.</strong>
                        </span>
                      </label>
                    </div>

                    <div className="flex items-start gap-3 bg-[#f3f1ec] p-4">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#31583a]" aria-hidden="true" />
                      <p className="text-sm leading-6 text-[#596573]">Revise os dados antes de enviar. O protocolo só será exibido depois da confirmação do registro no banco de dados.</p>
                    </div>
                  </div>
                )}

                <div className="mt-9 flex flex-col-reverse gap-3 border-t border-[#dedbd4] pt-6 sm:flex-row sm:justify-between">
                  {currentStep > 1 ? (
                    <button
                      type="button"
                      onClick={goToPreviousStep}
                      className="inline-flex items-center justify-center gap-2 border border-[#bfc4ca] px-5 py-3 text-sm font-semibold text-[#142030] transition-colors hover:border-[#142030] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4"
                    >
                      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                      Voltar
                    </button>
                  ) : <span />}

                  {currentStep < 3 ? (
                    <button
                      type="button"
                      onClick={goToNextStep}
                      className="inline-flex items-center justify-center gap-2 bg-[#142030] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#243448] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4"
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center justify-center gap-2 bg-[#142030] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#243448] disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" />
                      {submitting ? 'Registrando candidatura...' : 'Enviar candidatura'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </section>

        <section className="border-b border-[#dedbd4] bg-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-6 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20 lg:px-8 lg:py-20">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#9a712d]">Dúvidas frequentes</p>
              <h2 className="mt-4 text-3xl font-semibold tracking-[-0.025em] text-[#142030] sm:text-4xl">Informações antes do cadastro.</h2>
              <p className="mt-5 text-base leading-7 text-[#5e6977]">Consulte as orientações principais sobre candidatura, acompanhamento e documentos.</p>
            </div>

            <div className="border-t border-[#cfcac1]">
              {FAQ_ITEMS.map((item) => (
                <details key={item.question} className="career-faq border-b border-[#cfcac1]">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-6 text-left font-semibold text-[#142030]">
                    {item.question}
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#9a712d] transition-transform" aria-hidden="true" />
                  </summary>
                  <p className="max-w-2xl pb-6 text-sm leading-7 text-[#5e6977]">{item.answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#ece9e3]">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-5 py-12 sm:px-6 md:flex-row md:items-center lg:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-[#9a712d]">Já enviou seu perfil?</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#142030]">Consulte sua candidatura com protocolo e CPF.</h2>
            </div>
            <button
              type="button"
              onClick={onAccessPortal}
              className="inline-flex items-center justify-center gap-2 bg-[#142030] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#243448] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a] focus-visible:ring-offset-4"
            >
              Acessar Área do Candidato
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>

      <AnimatePresence>
        {protocol && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#101722]/75 p-4" role="dialog" aria-modal="true" aria-labelledby="career-success-title">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              className="relative w-full max-w-lg bg-white p-7 shadow-2xl sm:p-9"
            >
              <button
                type="button"
                onClick={() => setProtocol(null)}
                className="absolute right-4 top-4 p-2 text-[#65707d] transition-colors hover:bg-[#f1f0ed] hover:text-[#142030] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#b68a3a]"
                aria-label="Fechar confirmação"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="flex h-12 w-12 items-center justify-center bg-[#e9f0ea] text-[#31583a]">
                <BadgeCheck className="h-7 w-7" aria-hidden="true" />
              </div>

              <h3 id="career-success-title" className="mt-6 text-2xl font-semibold text-[#142030]">
                {alreadyExists ? 'Candidatura localizada' : 'Candidatura recebida'}
              </h3>

              <p className="mt-3 text-sm leading-7 text-[#5e6977]">
                {resumeWarning
                  ? 'Seu cadastro foi confirmado, mas o arquivo do currículo não pôde ser anexado. Guarde o protocolo e entre em contato com o atendimento.'
                  : alreadyExists
                    ? 'O sistema identificou que sua candidatura já estava registrada. Use o protocolo abaixo para acompanhar o cadastro existente.'
                    : 'Seu perfil foi registrado com sucesso. Guarde o protocolo abaixo para consultar o andamento na Área do Candidato.'}
              </p>

              <div className="mt-7 border border-[#cfcac1] bg-[#f5f4f1] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-[#7d6841]">Protocolo de candidatura</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="break-all font-mono text-xl font-semibold text-[#142030]">{protocol}</p>
                  <button
                    type="button"
                    onClick={() => {
                      copyToClipboard(protocol);
                      toast.success('Protocolo copiado.');
                    }}
                    className="inline-flex shrink-0 items-center justify-center gap-2 border border-[#142030] px-4 py-2.5 text-sm font-semibold text-[#142030] transition-colors hover:bg-[#142030] hover:text-white"
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
                  className="bg-[#142030] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#243448]"
                >
                  Acompanhar candidatura
                </button>
                <button
                  type="button"
                  onClick={() => setProtocol(null)}
                  className="border border-[#bfc4ca] px-5 py-3 text-sm font-semibold text-[#142030] transition-colors hover:border-[#142030]"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <footer className="border-t border-[#293548] bg-[#111b29] text-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <LogoGSA size="sm" variant="light" showText />
          <p className="text-sm text-white/60">© {new Date().getFullYear()} GSA HUB — Portal de Carreiras.</p>
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
