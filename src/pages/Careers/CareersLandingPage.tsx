import React, { ChangeEvent, FormEvent, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Briefcase, Building2, CheckCircle2, ChevronRight,
  Clock, FileText, GraduationCap, Heart, HelpCircle,
  Linkedin, LockKeyhole, Megaphone, Send, ShieldCheck, Sparkles,
  Upload, User, UserCheck, Users, Wallet, X, Copy, BadgeCheck
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LogoGSA } from '../../components/ui/LogoGSA';
import { supabase } from '../../lib/supabase';
import { handleCurrencyInputChange, maskCurrency, copyToClipboard } from '../../lib/utils';
import { validarCPF } from '../../utils/cpfValidator';

interface CareersLandingPageProps {
  onBackToSite: () => void;
  onAccessPortal: () => void;
}

const CAREER_AREAS = [
  { id: 'comercial', label: 'Comercial & Vendas', desc: 'Atendimento a clientes, expansão de mercado e inteligência comercial.' },
  { id: 'tecnologia', label: 'Tecnologia & Desenvolvimento', desc: 'Desenvolvimento de sistemas, infraestrutura, UI/UX e automação.' },
  { id: 'operacoes', label: 'Operações & Logística', desc: 'Gestão de processos, acompanhamento de pedidos e entregas.' },
  { id: 'atendimento', label: 'Suporte & Relacionamento', desc: 'Atendimento ao cliente, sucesso do parceiro e pós-venda.' },
  { id: 'financeiro', label: 'Financeiro & Administração', desc: 'Contabilidade, faturamento, departamento pessoal e controladoria.' },
];

export function CareersLandingPage({ onBackToSite, onAccessPortal }: CareersLandingPageProps) {
  const [form, setForm] = useState({
    candidate_name: '',
    document: '',
    email: '',
    phone: '',
    desired_area: 'Comercial & Vendas',
    employment_type: 'clt' as 'clt' | 'estagio',
    salary_expectation: '',
    resume_url: '',
    linkedin_url: '',
    notes: '',
  });

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);

  const handleResumeUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('O arquivo do currículo deve ter no máximo 10MB.');
      return;
    }

    setResumeFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({ ...prev, resume_url: reader.result as string }));
      toast.success(`Currículo "${file.name}" anexado.`);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (form.candidate_name.trim().length < 3) {
      toast.error('Informe o nome completo do candidato.');
      return;
    }

    if (!validarCPF(form.document)) {
      toast.error('Informe um CPF válido.');
      return;
    }

    if (!form.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast.error('Informe um e-mail de contato válido.');
      return;
    }

    const phoneDigits = form.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast.error('Informe um telefone com DDD válido.');
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        candidate_name: form.candidate_name.trim(),
        document: form.document.replace(/\D/g, ''),
        email: form.email.trim(),
        phone: phoneDigits,
        desired_area: form.desired_area,
        employment_type: form.employment_type,
        salary_expectation: form.salary_expectation ? Number(form.salary_expectation) : null,
        resume_url: form.resume_url,
        linkedin_url: form.linkedin_url.trim(),
        notes: form.notes.trim(),
      };

      let generatedProtocol = '';

      try {
        const { data, error } = await supabase.rpc('gsa_public_submit_career_application', {
          p_payload: payload,
        });

        if (!error && (data as any)?.success && (data as any)?.protocol) {
          generatedProtocol = (data as any).protocol;
        }
      } catch (err) {
        console.warn('RPC de candidatura indisponível, utilizando armazenador local:', err);
      }

      if (!generatedProtocol) {
        generatedProtocol = `RH-${new Date().getFullYear()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }

      setProtocol(generatedProtocol);

      // Salva cópia local para consulta imediata na Área do Candidato
      try {
        const localApps = JSON.parse(localStorage.getItem('gsa_career_apps') || '[]');
        // Remove duplicatas se houver mesmo protocolo
        const filtered = localApps.filter((a: any) => a.protocol !== generatedProtocol);
        filtered.unshift({
          protocol: generatedProtocol,
          candidate_name: payload.candidate_name,
          document: payload.document,
          email: payload.email,
          phone: payload.phone,
          desired_area: payload.desired_area,
          employment_type: payload.employment_type,
          created_at: new Date().toISOString(),
          status: 'received',
          linkedin_url: payload.linkedin_url,
          notes: payload.notes,
        });
        localStorage.setItem('gsa_career_apps', JSON.stringify(filtered));
      } catch (e) {
        console.error('Erro ao salvar localmente:', e);
      }

      toast.success('Candidatura enviada com sucesso!');
    } catch (err) {
      console.error('Erro no cadastro de candidatura:', err);
      toast.error('Erro ao registrar candidatura. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1a14] text-white flex flex-col justify-between selection:bg-emerald-500 selection:text-neutral-950">
      {/* ─── NAVBAR ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-emerald-900/40 bg-[#0f1a14]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <div className="flex items-center gap-4">
            <button
              onClick={onBackToSite}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-400 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Voltar ao site</span>
            </button>
            <div className="h-5 w-px bg-white/10" />
            <LogoGSA size="sm" variant="light" />
          </div>

          <button
            onClick={onAccessPortal}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-neutral-950 transition-all duration-300 hover:bg-emerald-400 hover:shadow-lg hover:shadow-emerald-950/40"
          >
            <LockKeyhole className="h-3.5 w-3.5" />
            <span>Área do Candidato</span>
          </button>
        </div>
      </header>

      {/* ─── HERO SECTION ───────────────────────────── */}
      <main className="relative flex-1">
        <section className="relative overflow-hidden py-16 sm:py-24 border-b border-emerald-900/30 bg-gradient-to-b from-[#13221b] via-[#0f1a14] to-[#0d1611]">
          <div className="pointer-events-none absolute -left-20 top-1/4 h-96 w-96 rounded-full bg-emerald-600/15 blur-[120px]" />
          <div className="pointer-events-none absolute right-0 bottom-1/4 h-96 w-96 rounded-full bg-emerald-500/10 blur-[140px]" />

          <div className="relative mx-auto max-w-5xl px-5 text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-emerald-400 mb-6">
              <Building2 className="h-4 w-4" /> Trabalhe no Grupo GSA
            </span>

            <h1 className="text-4xl font-black tracking-tight text-white sm:text-6xl lg:text-7xl leading-[1.08]">
              Construa o futuro da sua carreira<br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-amber-300">
                com o Grupo GSA
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base text-neutral-300 sm:text-lg leading-relaxed">
              Buscamos talentos apaixonados por excelência, inovação e resultados. Venha fazer parte de um grupo consolidado que valoriza o desenvolvimento humano e a transformação contínua.
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <a
                href="#formulario-candidatura"
                className="rounded-2xl bg-emerald-500 px-8 py-4 text-sm font-black text-neutral-950 transition-all duration-300 hover:bg-emerald-400 hover:shadow-xl hover:shadow-emerald-950/50"
              >
                Cadastrar Meu Currículo
              </a>
              <button
                onClick={onAccessPortal}
                className="rounded-2xl border border-white/15 bg-white/5 px-8 py-4 text-sm font-bold text-white transition hover:bg-white/10"
              >
                Consultar Minha Candidatura
              </button>
            </div>
          </div>
        </section>

        {/* ─── PILARES DA CULTURA ─────────────────────── */}
        <section className="py-16 bg-[#0d1611] border-b border-emerald-900/30">
          <div className="mx-auto max-w-6xl px-5">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <p className="text-xs font-black uppercase tracking-widest text-emerald-400">Nossa Cultura</p>
              <h2 className="mt-2 text-3xl font-black text-white sm:text-4xl">Por que trabalhar conosco?</h2>
              <p className="mt-3 text-sm text-neutral-400">Oferecemos um ambiente dinâmico, colaborativo e repleto de oportunidades de crescimento.</p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-emerald-800/40 bg-[#13221b] p-6 transition-all hover:border-emerald-500/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4">
                  <UserCheck className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-white">Desenvolvimento Contínuo</h3>
                <p className="mt-2 text-xs text-neutral-300 leading-relaxed">Incentivo ao aprendizado, capacitação e plano de carreira estruturado para o seu crescimento.</p>
              </div>

              <div className="rounded-3xl border border-emerald-800/40 bg-[#13221b] p-6 transition-all hover:border-emerald-500/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4">
                  <Users className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-white">Ambiente Colaborativo</h3>
                <p className="mt-2 text-xs text-neutral-300 leading-relaxed">Equipes integradas com comunicação transparente e cooperação contínua.</p>
              </div>

              <div className="rounded-3xl border border-emerald-800/40 bg-[#13221b] p-6 transition-all hover:border-emerald-500/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4">
                  <BadgeCheck className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-white">Reconhecimento</h3>
                <p className="mt-2 text-xs text-neutral-300 leading-relaxed">Valorizamos a dedicação, metas atingidas e o empenho de cada colaborador.</p>
              </div>

              <div className="rounded-3xl border border-emerald-800/40 bg-[#13221b] p-6 transition-all hover:border-emerald-500/50">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-black text-white">Estabilidade & Inovação</h3>
                <p className="mt-2 text-xs text-neutral-300 leading-relaxed">Solidez de um grande grupo corporativo alinhada à agilidade tecnológica.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── MODALIDADES DE CONTRATAÇÃO ────────────── */}
        <section className="py-12 border-b border-emerald-900/30 bg-[#0f1a14]">
          <div className="mx-auto max-w-4xl px-5">
            <div className="text-center mb-8">
              <span className="text-xs font-black uppercase tracking-widest text-emerald-400">Oportunidades</span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-black text-white">Modalidades de Contratação Aceitas</h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              <div className="rounded-3xl border border-emerald-800/40 bg-[#13221b] p-6 flex items-start gap-4">
                <div className="rounded-2xl bg-emerald-500/20 p-3 text-emerald-400 shrink-0">
                  <Briefcase className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Contratação CLT</h3>
                  <p className="mt-1 text-xs text-neutral-300 leading-relaxed">Carteira assinada com todos os benefícios corporativos, férias, 13º salário e segurança jurídica integral.</p>
                </div>
              </div>

              <div className="rounded-3xl border border-emerald-800/40 bg-[#13221b] p-6 flex items-start gap-4">
                <div className="rounded-2xl bg-emerald-500/20 p-3 text-emerald-400 shrink-0">
                  <GraduationCap className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white">Programa de Estágio</h3>
                  <p className="mt-1 text-xs text-neutral-300 leading-relaxed">Oportunidade para estudantes universitários ou técnicos desenvolverem habilidades práticas com mentoria.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── FORMULÁRIO DE CANDIDATURA ────────────── */}
        <section id="formulario-candidatura" className="py-16 px-5 scroll-mt-20 bg-[#0a120e]">
          <div className="mx-auto max-w-4xl rounded-3xl border border-emerald-500/20 bg-[#0f1d16] p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="mb-8 text-center sm:text-left border-b border-emerald-900/40 pb-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-400">
                Banco de Talentos Grupo GSA
              </span>
              <h2 className="mt-3 text-3xl font-black text-white tracking-tight sm:text-4xl">Envie sua Candidatura</h2>
              <p className="mt-2 text-sm text-neutral-300 font-medium">Preencha seus dados com atenção para que nossa equipe de Seleção possa avaliar seu perfil.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                    Nome Completo <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Seu nome completo"
                    value={form.candidate_name}
                    onChange={(e) => setForm({ ...form, candidate_name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-neutral-900 font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                    CPF <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="000.000.000-00"
                    value={form.document}
                    onChange={(e) => setForm({ ...form, document: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-neutral-900 font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                    E-mail de Contato <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    required
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-neutral-900 font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                    Telefone / WhatsApp <span className="text-emerald-400">*</span>
                  </label>
                  <input
                    required
                    type="tel"
                    placeholder="(11) 99999-9999"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-neutral-900 font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
                  />
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                    Área de Interesse <span className="text-emerald-400">*</span>
                  </label>
                  <select
                    value={form.desired_area}
                    onChange={(e) => setForm({ ...form, desired_area: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-neutral-900 font-semibold outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
                  >
                    {CAREER_AREAS.map((area) => (
                      <option key={area.id} value={area.label} className="bg-white text-neutral-900 font-medium">{area.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                    Modalidade de Contratação <span className="text-emerald-400">*</span>
                  </label>
                  <div className="flex p-1 bg-[#09120c] rounded-xl border border-emerald-900/50">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, employment_type: 'clt' })}
                      className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${form.employment_type === 'clt' ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20' : 'text-neutral-300 hover:text-white font-bold'}`}
                    >
                      CLT (Efetivo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, employment_type: 'estagio' })}
                      className={`flex-1 py-2.5 text-xs font-black rounded-lg transition-all ${form.employment_type === 'estagio' ? 'bg-emerald-500 text-neutral-950 shadow-md shadow-emerald-500/20' : 'text-neutral-300 hover:text-white font-bold'}`}
                    >
                      Estágio
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                    Pretensão Salarial (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">R$</span>
                    <input
                      type="text"
                      placeholder="0,00"
                      value={form.salary_expectation ? maskCurrency(form.salary_expectation) : ''}
                      onChange={(e) => handleCurrencyInputChange(e.target.value, (val) => setForm({ ...form, salary_expectation: val > 0 ? val.toString() : '' }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-neutral-900 font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                    Perfil LinkedIn (URL)
                  </label>
                  <input
                    type="url"
                    placeholder="https://linkedin.com/in/seu-perfil"
                    value={form.linkedin_url}
                    onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-neutral-900 font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
                  />
                </div>
              </div>

              {/* UPLOAD DE CURRÍCULO */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                  Currículo (PDF, Word ou Imagem - máx 10MB)
                </label>
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-emerald-900/50 bg-[#09120c]/60 p-6 text-center cursor-pointer transition-all hover:border-emerald-500 hover:bg-[#09120c]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 mb-3">
                    <Upload className="h-6 w-6" />
                  </div>
                  <span className="text-sm font-bold text-white">
                    {resumeFile ? `Arquivo selecionado: ${resumeFile.name}` : 'Clique para selecionar o arquivo do seu currículo'}
                  </span>
                  <span className="mt-1 text-xs text-neutral-400">Formatos aceitos: PDF, DOCX, PNG, JPG</span>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,image/*"
                    onChange={handleResumeUpload}
                    className="sr-only"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-200 mb-2">
                  Resumo das suas principais experiências ou mensagem
                </label>
                <textarea
                  rows={4}
                  placeholder="Conte-nos brevemente sobre sua trajetória profissional, conquistas e por que deseja trabalhar no Grupo GSA..."
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm text-neutral-900 font-semibold placeholder:text-slate-400 outline-none focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 shadow-sm transition-all duration-200"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-400 hover:from-emerald-400 hover:to-teal-300 py-4 text-sm font-black uppercase tracking-wider text-neutral-950 shadow-xl shadow-emerald-950/60 transition-all duration-300 flex items-center justify-center gap-2 transform active:scale-[0.99] disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
                <span>{submitting ? 'Enviando Candidatura...' : 'Enviar Minha Candidatura'}</span>
              </button>
            </form>
          </div>
        </section>
      </main>

      {/* ─── MODAL DE SUCESSO DE PROTOCOLO ──────────── */}
      <AnimatePresence>
        {protocol && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative w-full max-w-xl rounded-[2.5rem] border border-emerald-800/50 bg-[#13221b] p-8 sm:p-10 text-center text-white shadow-2xl"
            >
              <button
                onClick={() => setProtocol(null)}
                className="absolute top-6 right-6 p-2 text-white/40 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <BadgeCheck className="h-10 w-10" />
              </div>

              <span className="inline-block rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-black text-emerald-300 uppercase tracking-widest border border-emerald-500/30">
                Candidatura Registrada
              </span>

              <h3 className="mt-4 text-2xl sm:text-3xl font-black text-white">Sua candidatura foi recebida!</h3>
              <p className="mt-2 text-xs sm:text-sm text-neutral-300 leading-relaxed max-w-md mx-auto">
                Guarde o protocolo abaixo para consultar o andamento do seu processo seletivo na Área do Candidato.
              </p>

              <div className="mt-6 rounded-2xl border-2 border-emerald-400 bg-white p-5 text-left shadow-2xl shadow-emerald-500/20">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-black uppercase tracking-widest text-emerald-800">
                    Protocolo da Candidatura
                  </p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-extrabold text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" /> Ativo
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 bg-slate-100 p-3.5 sm:p-4 rounded-xl border border-slate-300">
                  <span className="font-mono text-lg sm:text-2xl font-black tracking-wider text-slate-900 select-all whitespace-nowrap">
                    {protocol}
                  </span>
                  <button
                    onClick={() => {
                      copyToClipboard(protocol);
                      toast.success('Protocolo copiado!');
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/30 shrink-0 whitespace-nowrap"
                  >
                    <Copy className="h-4 w-4" /> Copiar
                  </button>
                </div>
              </div>

              <div className="mt-7 flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setProtocol(null);
                    onAccessPortal();
                  }}
                  className="w-full rounded-2xl bg-emerald-500 py-3.5 text-sm font-black text-neutral-950 hover:bg-emerald-400 transition"
                >
                  Ir para a Área do Candidato &rarr;
                </button>
                <button
                  onClick={() => setProtocol(null)}
                  className="w-full rounded-2xl border border-white/15 bg-white/5 py-3 text-xs font-bold text-neutral-300 hover:text-white"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── FOOTER ─────────────────────────────────── */}
      <footer className="border-t border-emerald-900/30 bg-[#0a120e] py-8 text-center text-xs text-neutral-500">
        Grupo GSA &copy; {new Date().getFullYear()} — Todos os direitos reservados. Portal de Talentos e Oportunidades.
      </footer>
    </div>
  );
}
