import { useEffect, useMemo, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Globe2,
  ImagePlus,
  MapPin,
  Send,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { submitPartnerApplication } from '../../features/partners/service';
import type { PartnerApplicationData, PartnerServiceMode } from '../../features/partners/types';
import { Modal } from '../ui/Modal';

interface PartnerApplicationModalProps {
  open: boolean;
  onClose: () => void;
}

const STEP_LABELS = ['Empresa', 'Contato', 'Atuação', 'Imagens e envio'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function emptyApplication(startedAt = new Date().toISOString()): PartnerApplicationData {
  return {
    name: '',
    legal_name: '',
    tax_document: '',
    category: '',
    short_description: '',
    description: '',
    contact_person: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    instagram: '',
    facebook: '',
    linkedin: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip_code: '',
    business_hours: '',
    service_mode: 'hibrido',
    service_regions: [],
    services: [],
    products: [],
    benefits: '',
    privacy_consent: false,
    started_at: startedAt,
    company_website: '',
  };
}

function textToList(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 30);
}

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function validateImage(file: File | null): string | null {
  if (!file) return null;
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'Envie somente imagens JPG, PNG ou WEBP.';
  if (file.size > MAX_IMAGE_BYTES) return 'Cada imagem deve ter no máximo 5 MB.';
  return null;
}

export function PartnerApplicationModal({ open, onClose }: PartnerApplicationModalProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<PartnerApplicationData>(() => emptyApplication());
  const [regionsText, setRegionsText] = useState('');
  const [servicesText, setServicesText] = useState('');
  const [productsText, setProductsText] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [protocol, setProtocol] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(0);
    setForm(emptyApplication());
    setRegionsText('');
    setServicesText('');
    setProductsText('');
    setLogoFile(null);
    setCoverFile(null);
    setProtocol(null);
  }, [open]);

  const logoPreview = useMemo(() => logoFile ? URL.createObjectURL(logoFile) : null, [logoFile]);
  const coverPreview = useMemo(() => coverFile ? URL.createObjectURL(coverFile) : null, [coverFile]);

  useEffect(() => () => {
    if (logoPreview) URL.revokeObjectURL(logoPreview);
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [logoPreview, coverPreview]);

  const update = <K extends keyof PartnerApplicationData>(field: K, value: PartnerApplicationData[K]) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const validateCurrentStep = (): boolean => {
    if (step === 0) {
      const documentDigits = onlyDigits(form.tax_document);
      if (form.name.trim().length < 2) return fail('Informe o nome da empresa ou profissional.');
      if (form.legal_name.trim().length < 2) return fail('Informe a razão social ou o nome completo.');
      if (![11, 14].includes(documentDigits.length)) return fail('Informe um CPF ou CNPJ válido para análise cadastral.');
      if (form.category.trim().length < 2) return fail('Informe a categoria de atuação.');
      if (form.short_description.trim().length < 20) return fail('A descrição curta deve ter pelo menos 20 caracteres.');
    }

    if (step === 1) {
      if (form.contact_person.trim().length < 2) return fail('Informe o responsável pela solicitação.');
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return fail('Informe um e-mail válido.');
      if (onlyDigits(form.whatsapp).length < 10) return fail('Informe um WhatsApp válido.');
      if (form.city.trim().length < 2 || form.state.trim().length !== 2) return fail('Informe cidade e estado.');
    }

    if (step === 2) {
      if (textToList(servicesText).length === 0) return fail('Informe pelo menos um serviço ou especialidade.');
      if (form.business_hours.trim().length < 3) return fail('Informe o horário de atendimento.');
    }

    if (step === 3) {
      const logoError = validateImage(logoFile);
      const coverError = validateImage(coverFile);
      if (logoError || coverError) return fail(logoError || coverError || 'Imagem inválida.');
      if (!form.privacy_consent) return fail('É necessário autorizar o tratamento dos dados para enviar a solicitação.');
    }
    return true;
  };

  const next = () => {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, STEP_LABELS.length - 1));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validateCurrentStep()) return;

    setSending(true);
    try {
      const result = await submitPartnerApplication({
        ...form,
        tax_document: onlyDigits(form.tax_document),
        phone: onlyDigits(form.phone),
        whatsapp: onlyDigits(form.whatsapp),
        zip_code: onlyDigits(form.zip_code),
        state: form.state.trim().toUpperCase().slice(0, 2),
        service_regions: textToList(regionsText),
        services: textToList(servicesText),
        products: textToList(productsText),
      }, logoFile, coverFile);
      setProtocol(result.protocol);
      toast.success('Solicitação enviada para análise.');
    } catch (error: any) {
      console.error('Erro ao enviar solicitação de parceria:', error);
      toast.error(error?.message || 'Não foi possível enviar sua solicitação.');
    } finally {
      setSending(false);
    }
  };

  if (protocol) {
    return (
      <Modal isOpen={open} onClose={onClose} title="Solicitação enviada" size="xl">
        <div className="py-8 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-11 w-11" />
          </div>
          <h2 className="mt-6 text-2xl font-black text-neutral-950">Recebemos sua solicitação</h2>
          <p className="mx-auto mt-3 max-w-xl leading-7 text-neutral-600">
            Os dados foram enviados ao painel administrativo da GSA HUB e ficaram com o status <strong>Em análise</strong>. A publicação não é automática: nossa equipe revisará as informações antes de aprovar o perfil.
          </p>
          <div className="mx-auto mt-7 max-w-sm rounded-2xl border border-[#d8bd73]/50 bg-[#d8bd73]/10 p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#76591e]">Protocolo da solicitação</p>
            <p className="mt-2 text-xl font-black tracking-wider text-neutral-950">{protocol}</p>
          </div>
          <button type="button" onClick={onClose} className="mt-8 rounded-xl bg-neutral-950 px-7 py-3 text-sm font-black text-white">Concluir</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={open} onClose={onClose} title="Seja nosso parceiro" size="wide">
      <form onSubmit={submit} className="space-y-6">
        <div className="grid grid-cols-4 gap-2" aria-label="Etapas do formulário">
          {STEP_LABELS.map((label, index) => (
            <div key={label} className="min-w-0">
              <div className={`h-1.5 rounded-full ${index <= step ? 'bg-[#b79443]' : 'bg-neutral-200'}`} />
              <p className={`mt-2 truncate text-center text-[10px] font-black uppercase tracking-wide ${index === step ? 'text-[#76591e]' : 'text-neutral-400'}`}>{label}</p>
            </div>
          ))}
        </div>

        {step === 0 && (
          <FormSection icon={<Building2 className="h-5 w-5" />} title="Dados da empresa ou profissional">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome comercial" required value={form.name} onChange={(value) => update('name', value)} maxLength={160} />
              <Field label="Razão social ou nome completo" required value={form.legal_name} onChange={(value) => update('legal_name', value)} maxLength={180} />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="CPF ou CNPJ" required value={form.tax_document} onChange={(value) => update('tax_document', value)} maxLength={18} inputMode="numeric" />
              <Field label="Categoria de atuação" required value={form.category} onChange={(value) => update('category', value)} placeholder="Ex.: Saúde, Contabilidade, Tecnologia" maxLength={100} />
            </div>
            <Area label="Descrição curta" required value={form.short_description} onChange={(value) => update('short_description', value)} rows={3} maxLength={280} placeholder="Resuma o que sua empresa oferece e seu principal diferencial." />
            <Area label="Apresentação completa" value={form.description} onChange={(value) => update('description', value)} rows={5} maxLength={4000} />
          </FormSection>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <FormSection icon={<UserRound className="h-5 w-5" />} title="Responsável e contatos">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Responsável pela solicitação" required value={form.contact_person} onChange={(value) => update('contact_person', value)} maxLength={160} />
                <Field label="E-mail" required type="email" value={form.email} onChange={(value) => update('email', value)} maxLength={180} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Telefone" value={form.phone} onChange={(value) => update('phone', value)} inputMode="tel" maxLength={20} />
                <Field label="WhatsApp" required value={form.whatsapp} onChange={(value) => update('whatsapp', value)} inputMode="tel" maxLength={20} />
              </div>
            </FormSection>

            <FormSection icon={<MapPin className="h-5 w-5" />} title="Endereço">
              <div className="grid gap-4 md:grid-cols-[1fr_150px]">
                <Field label="Rua ou avenida" value={form.street} onChange={(value) => update('street', value)} maxLength={180} />
                <Field label="Número" value={form.number} onChange={(value) => update('number', value)} maxLength={30} />
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Complemento" value={form.complement} onChange={(value) => update('complement', value)} maxLength={100} />
                <Field label="Bairro" value={form.neighborhood} onChange={(value) => update('neighborhood', value)} maxLength={100} />
                <Field label="CEP" value={form.zip_code} onChange={(value) => update('zip_code', value)} inputMode="numeric" maxLength={10} />
              </div>
              <div className="grid gap-4 md:grid-cols-[1fr_120px]">
                <Field label="Cidade" required value={form.city} onChange={(value) => update('city', value)} maxLength={100} />
                <Field label="Estado" required value={form.state} onChange={(value) => update('state', value.toUpperCase().slice(0, 2))} maxLength={2} />
              </div>
            </FormSection>
          </div>
        )}

        {step === 2 && (
          <FormSection icon={<BriefcaseBusiness className="h-5 w-5" />} title="Atuação, serviços e benefícios">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-bold text-neutral-700">Modalidade de atendimento
                <select value={form.service_mode} onChange={(event) => update('service_mode', event.target.value as PartnerServiceMode)} className="input-field">
                  <option value="presencial">Presencial</option>
                  <option value="online">On-line</option>
                  <option value="hibrido">Presencial e on-line</option>
                </select>
              </label>
              <Field label="Horário de atendimento" required value={form.business_hours} onChange={(value) => update('business_hours', value)} placeholder="Ex.: Segunda a sexta, das 8h às 18h" maxLength={180} />
            </div>
            <Area label="Regiões atendidas — uma por linha" value={regionsText} onChange={setRegionsText} rows={3} maxLength={1500} placeholder="Atibaia e região\nTodo o Brasil on-line" />
            <div className="grid gap-4 md:grid-cols-2">
              <Area label="Serviços e especialidades — um por linha" required value={servicesText} onChange={setServicesText} rows={6} maxLength={3000} />
              <Area label="Produtos e soluções — um por linha" value={productsText} onChange={setProductsText} rows={6} maxLength={3000} />
            </div>
            <Area label="Benefício ou condição especial para clientes GSA" value={form.benefits} onChange={(value) => update('benefits', value)} rows={3} maxLength={1200} />
          </FormSection>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <FormSection icon={<Globe2 className="h-5 w-5" />} title="Presença digital">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Site" value={form.website} onChange={(value) => update('website', value)} maxLength={300} placeholder="https://" />
                <Field label="Instagram" value={form.instagram} onChange={(value) => update('instagram', value)} maxLength={300} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Facebook" value={form.facebook} onChange={(value) => update('facebook', value)} maxLength={300} />
                <Field label="LinkedIn" value={form.linkedin} onChange={(value) => update('linkedin', value)} maxLength={300} />
              </div>
            </FormSection>

            <FormSection icon={<ImagePlus className="h-5 w-5" />} title="Logotipo e foto de apresentação">
              <div className="grid gap-4 md:grid-cols-2">
                <ImageField label="Logotipo" file={logoFile} preview={logoPreview} onChange={setLogoFile} help="JPG, PNG ou WEBP, até 5 MB." />
                <ImageField label="Foto de capa" file={coverFile} preview={coverPreview} onChange={setCoverFile} help="Imagem horizontal recomendada, até 5 MB." />
              </div>
            </FormSection>

            <label className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-sm leading-6 text-neutral-600">
              <input type="checkbox" checked={form.privacy_consent} onChange={(event) => update('privacy_consent', event.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
              <span>Autorizo a GSA HUB a receber, armazenar e analisar os dados enviados para fins de avaliação da parceria. Estou ciente de que o envio não garante aprovação ou publicação automática.</span>
            </label>

            <div className="hidden" aria-hidden="true">
              <label>Site da empresa<input tabIndex={-1} autoComplete="off" value={form.company_website} onChange={(event) => update('company_website', event.target.value)} /></label>
            </div>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-neutral-200 pt-5 sm:flex-row sm:justify-between">
          <button type="button" disabled={sending} onClick={step === 0 ? onClose : () => setStep((current) => current - 1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 px-5 py-3 text-sm font-black text-neutral-700 disabled:opacity-50">
            {step === 0 ? 'Cancelar' : <><ChevronLeft className="h-4 w-4" /> Voltar</>}
          </button>
          {step < STEP_LABELS.length - 1 ? (
            <button type="button" onClick={next} className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-6 py-3 text-sm font-black text-white">Continuar <ChevronRight className="h-4 w-4" /></button>
          ) : (
            <button type="submit" disabled={sending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#b79443] px-6 py-3 text-sm font-black text-neutral-950 disabled:opacity-60">
              <Send className="h-4 w-4" /> {sending ? 'Enviando solicitação...' : 'Enviar para análise'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

function fail(message: string): false {
  toast.error(message);
  return false;
}

function FormSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5">
      <h2 className="flex items-center gap-2 text-base font-black text-neutral-950">{icon}{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = 'text',
  maxLength,
  placeholder,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-neutral-700">
      {label}
      <input required={required} type={type} value={value} onChange={(event) => onChange(event.target.value)} maxLength={maxLength} placeholder={placeholder} inputMode={inputMode} className="input-field" />
    </label>
  );
}

function Area({
  label,
  value,
  onChange,
  rows,
  required = false,
  maxLength,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows: number;
  required?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-bold text-neutral-700">
      {label}
      <textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} rows={rows} maxLength={maxLength} placeholder={placeholder} className="input-field resize-y" />
    </label>
  );
}

function ImageField({
  label,
  file,
  preview,
  onChange,
  help,
}: {
  label: string;
  file: File | null;
  preview: string | null;
  onChange: (file: File | null) => void;
  help: string;
}) {
  return (
    <label className="grid gap-3 rounded-2xl border border-dashed border-neutral-300 bg-white p-4 text-sm font-bold text-neutral-700">
      <span>{label}</span>
      <div className="flex h-40 items-center justify-center overflow-hidden rounded-xl bg-neutral-100">
        {preview ? <img src={preview} alt={`Prévia de ${label}`} className="h-full w-full object-contain" /> : <ImagePlus className="h-12 w-12 text-neutral-300" />}
      </div>
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => onChange(event.target.files?.[0] || null)} className="block w-full text-xs font-medium text-neutral-500 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-950 file:px-4 file:py-2 file:font-bold file:text-white" />
      <span className="text-xs font-medium text-neutral-500">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(1)} MB` : help}</span>
    </label>
  );
}
