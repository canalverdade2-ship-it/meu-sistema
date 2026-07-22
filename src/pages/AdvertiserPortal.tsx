import {
  FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  ExternalLink,
  Eye,
  FileImage,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MessageSquareText,
  Pencil,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User,
  WalletCards,
  X,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { advertiserAccess } from '../lib/advertiserAccess';
import { PrivacyPolicyDialog } from '../components/public/PrivacyPolicyDialog';
import { UniversalNotificationBell, type StandardNotification } from '../components/ui/UniversalNotificationBell';
import { maskPhone, maskCurrency, handleCurrencyInputChange } from '../lib/utils';
import { navigate } from '../routing/navigationService';
import { PaymentModal } from '../components/client/financeiro/PaymentModal';
import type {
  AdvertiserPortalSnapshot,
  AdvertisingCampaign,
  AdvertisingCreative,
  AdvertisingPaymentStatus,
  AdvertisingProposal,
} from '../types/advertising';

type PortalTab = 'overview' | 'requests' | 'proposals' | 'campaigns' | 'creatives' | 'finance' | 'reports' | 'profile';

const PAGE_SIZE = 20;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const ALLOWED_VIDEO_TYPES = new Set(['video/mp4', 'video/webm']);

const TABS: Array<{ id: PortalTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
  { id: 'requests', label: 'Minhas Solicitações', icon: ClipboardList },
  { id: 'proposals', label: 'Propostas', icon: MessageSquareText },
  { id: 'campaigns', label: 'Campanhas', icon: Megaphone },
  { id: 'creatives', label: 'Criativos', icon: FileImage },
  { id: 'finance', label: 'Financeiro', icon: WalletCards },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'profile', label: 'Meu Perfil', icon: User },
];

const requestStatusLabels: Record<string, string> = {
  submitted: 'Recebida',
  under_review: 'Em análise pela equipe',
  awaiting_information: 'Aguardando informações',
  proposal_sent: 'Proposta enviada',
  negotiation_requested: 'Em negociação',
  accepted: 'Aprovada / Aceita',
  rejected: 'Recusada',
  cancelled: 'Cancelada',
};

const proposalLabels: Record<string, string> = {
  draft: 'Rascunho',
  sent: 'Aguardando sua resposta',
  negotiating: 'Em negociação',
  final_offer: 'Oferta final',
  accepted: 'Aceita',
  rejected: 'Recusada',
  expired: 'Expirada',
  cancelled: 'Cancelada',
};

const campaignLabels: Record<string, string> = {
  draft: 'Rascunho',
  payment_pending: 'Aguardando pagamento',
  creative_review: 'Criativo em análise',
  scheduled: 'Agendada',
  active: 'Ativa',
  paused: 'Pausada',
  completed: 'Concluída',
  cancelled: 'Cancelada',
};

const paymentLabels: Record<AdvertisingPaymentStatus, string> = {
  pending: 'Pendente',
  processing: 'Em processamento',
  paid: 'Pago',
  failed: 'Falhou',
  refunded: 'Estornado',
  cancelled: 'Cancelado',
};

function money(value: number | string | null | undefined) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value || 0));
}

function date(value?: string | null) {
  if (!value) return 'A definir';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Data inválida';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(parsed);
}

function dateTime(value?: string | null) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function safeFileName(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '-').slice(-120) || 'criativo';
}

function safeHttpsUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function translateAuthError(error: unknown, fallback: string = 'Não foi possível concluir a operação.'): string {
  if (!error) return fallback;
  
  const rawMessage = (
    typeof error === 'string'
      ? error
      : (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string')
        ? error.message
        : ''
  ).toLowerCase();

  const status = error && typeof error === 'object' && 'status' in error ? error.status : null;

  if (rawMessage.includes('for security purposes') || rawMessage.includes('request this after')) {
    const match = rawMessage.match(/after\s+(\d+)\s+seconds/);
    const secs = match ? match[1] : '45';
    return `Por motivos de segurança do servidor, aguarde ${secs} segundos para solicitar novo cadastro, ou acesse com sua senha.`;
  }
  if (rawMessage.includes('email not confirmed')) {
    return 'Seu e-mail precisa de confirmação. Verifique a mensagem enviada para sua caixa de entrada para ativar a conta, ou entre pela aba "Entrar por E-mail".';
  }
  if (rawMessage.includes('too many requests') || rawMessage.includes('rate limit') || status === 429) {
    return 'Muitas tentativas realizadas em curto período. Por favor, aguarde alguns instantes antes de tentar novamente.';
  }
  if (rawMessage.includes('user already registered') || rawMessage.includes('already exists')) {
    return 'Este e-mail já possui cadastro. Utilize a aba "Entrar por E-mail" para receber seu link seguro de acesso.';
  }
  if (rawMessage.includes('invalid login credentials') || rawMessage.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos. Verifique os dados digitados.';
  }
  if (rawMessage.includes('password should be at least')) {
    return 'A senha digitada é muito curta. Crie uma senha com no mínimo 6 caracteres.';
  }

  return fallback || 'Ocorreu um erro no acesso. Verifique os dados digitados ou tente novamente em instantes.';
}

function messageFromError(error: unknown, fallback: string) {
  return translateAuthError(error, fallback);
}

function validateFile(file: File) {
  const image = ALLOWED_IMAGE_TYPES.has(file.type);
  const video = ALLOWED_VIDEO_TYPES.has(file.type);
  if (!image && !video) return 'Formato não aceito. Use JPG, PNG, WEBP, GIF, MP4 ou WEBM.';
  if (image && file.size > IMAGE_MAX_BYTES) return 'A imagem deve ter no máximo 10 MB.';
  if (video && file.size > VIDEO_MAX_BYTES) return 'O vídeo deve ter no máximo 50 MB.';
  if (file.size === 0) return 'O arquivo selecionado está vazio.';
  return null;
}

async function readAssetMetadata(file: File) {
  const objectUrl = URL.createObjectURL(file);
  try {
    if (ALLOWED_IMAGE_TYPES.has(file.type)) {
      return await new Promise<{ width: number; height: number; durationSeconds: null }>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight, durationSeconds: null });
        image.onerror = () => reject(new Error('A imagem está corrompida ou não pode ser lida.'));
        image.src = objectUrl;
      });
    }
    return await new Promise<{ width: number; height: number; durationSeconds: number }>((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration <= 0) {
          reject(new Error('Não foi possível identificar a duração do vídeo.'));
          return;
        }
        resolve({ width: video.videoWidth, height: video.videoHeight, durationSeconds: Number(video.duration.toFixed(2)) });
      };
      video.onerror = () => reject(new Error('O vídeo está corrompido ou não pode ser lido.'));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AdvertiserPortal() {
  const [snapshot, setSnapshot] = useState<AdvertiserPortalSnapshot | null>(null);
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSent, setLinkSent] = useState(false);
  const [tab, setTab] = useState<PortalTab>('overview');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [refreshing, setRefreshing] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [selectedProposalDetails, setSelectedProposalDetails] = useState<AdvertisingProposal | null>(null);
  const [counterProposal, setCounterProposal] = useState<AdvertisingProposal | null>(null);
  const [counterAmount, setCounterAmount] = useState('');
  const [counterMessage, setCounterMessage] = useState('');
  const [rejectProposal, setRejectProposal] = useState<AdvertisingProposal | null>(null);
  const [rejectMessage, setRejectMessage] = useState('');

  const [editingCreative, setEditingCreative] = useState<AdvertisingCreative | null>(null);
  const [creativeCampaignId, setCreativeCampaignId] = useState('');
  const [creativeFile, setCreativeFile] = useState<File | null>(null);
  const [creativeHeadline, setCreativeHeadline] = useState('');
  const [creativeBody, setCreativeBody] = useState('');
  const [creativeAlt, setCreativeAlt] = useState('');
  const [creativeTarget, setCreativeTarget] = useState('');
  const [creativeInputKey, setCreativeInputKey] = useState(0);
  const [uploading, setUploading] = useState(false);

  const creativePreviewUrl = useMemo(() => creativeFile ? URL.createObjectURL(creativeFile) : null, [creativeFile]);
  useEffect(() => () => { if (creativePreviewUrl) URL.revokeObjectURL(creativePreviewUrl); }, [creativePreviewUrl]);

  const [readAdvNotificationIds, setReadAdvNotificationIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem('gsa_adv_read_notifications');
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const advNotifications = useMemo<StandardNotification[]>(() => {
    if (!snapshot) return [];
    const list: StandardNotification[] = [];

    (snapshot.requests || []).forEach((req) => {
      const id = `req-${req.id || req.protocol}`;
      list.push({
        id,
        titulo: `Solicitação ${req.protocol}`,
        mensagem: `Empresa: ${req.company_name} — Status: ${requestStatusLabels[req.status] || req.status}`,
        lida: readAdvNotificationIds.has(id),
        created_at: req.created_at || new Date().toISOString(),
        modulo: 'anuncios',
        tab: 'requests',
      });
    });

    (snapshot.proposals || []).forEach((prop) => {
      const id = `prop-${prop.id}`;
      list.push({
        id,
        titulo: `Proposta de Anúncio #${String(prop.id).slice(0, 6)}`,
        mensagem: `Valor: R$ ${prop.total_amount}. Status: ${prop.status}`,
        lida: readAdvNotificationIds.has(id),
        created_at: prop.created_at || new Date().toISOString(),
        modulo: 'anuncios',
        tab: 'proposals',
      });
    });

    return list.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [snapshot, readAdvNotificationIds]);

  const unreadAdvCount = advNotifications.filter((n) => !n.lida).length;

  const handleMarkAdvRead = async (id: string) => {
    setReadAdvNotificationIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      try { localStorage.setItem('gsa_adv_read_notifications', JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const handleMarkAllAdvRead = async () => {
    const allIds = advNotifications.map((n) => n.id);
    setReadAdvNotificationIds((prev) => {
      const next = new Set([...prev, ...allIds]);
      try { localStorage.setItem('gsa_adv_read_notifications', JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };

  const load = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    else setRefreshing(true);
    try {
      let realSnapshot = await advertiserAccess.getSnapshot();
      if (!realSnapshot) {
        try {
          const storedLocal = localStorage.getItem('gsa_advertiser_session');
          if (storedLocal) {
            realSnapshot = JSON.parse(storedLocal);
          }
        } catch {}
      }

      // Sincronizar o status mais recente das solicitações do gsa_adv_requests_store
      if (realSnapshot && realSnapshot.requests) {
        try {
          const storeReqs = JSON.parse(localStorage.getItem('gsa_adv_requests_store') || '[]');
          if (Array.isArray(storeReqs) && storeReqs.length > 0) {
            realSnapshot.requests = realSnapshot.requests.map((req) => {
              const match = storeReqs.find((s: any) => s.protocol === req.protocol || s.id === req.id);
              return match ? { ...req, status: match.status } : req;
            });
          }
        } catch {}
      }

      setSnapshot(realSnapshot);
    } catch (error) {
      console.error('Falha ao carregar portal do anunciante:', error);
      toast.error('Não foi possível carregar o portal do anunciante.');
    } finally {
      setChecking(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const handleStorageChange = () => { void load(true); };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(() => { void load(true); }, 2000);
    const { data } = supabase.auth.onAuthStateChange(() => { void load(true); });
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
      data.subscription.unsubscribe();
    };
  }, [load]);
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [tab]);

  const metrics = useMemo(() => {
    const rows = snapshot?.campaigns.flatMap((campaign) => campaign.metrics || []) || [];
    return rows.reduce((acc, row) => ({
      served: acc.served + Number(row.served || 0),
      viewable: acc.viewable + Number(row.viewable_impressions || 0),
      clicks: acc.clicks + Number(row.clicks || 0),
      videoStarts: acc.videoStarts + Number(row.video_starts || 0),
      videoCompletions: acc.videoCompletions + Number(row.video_completions || 0),
    }), { served: 0, viewable: 0, clicks: 0, videoStarts: 0, videoCompletions: 0 });
  }, [snapshot]);

  const reportRows = useMemo(() => snapshot?.campaigns.flatMap((campaign) =>
    (campaign.metrics || []).map((row) => ({ campaign, row })),
  ) || [], [snapshot]);

  // Estados para o Primeiro Acesso por Protocolo
  const initialProtocol = useMemo(() => {
    return new URLSearchParams(window.location.search).get('protocolo') ||
           new URLSearchParams(window.location.search).get('protocol') || '';
  }, []);

  const [accessMode, setAccessMode] = useState<'protocol' | 'magic_link'>('protocol');
  const [protocolInput, setProtocolInput] = useState(initialProtocol);
  const [protocolValidated, setProtocolValidated] = useState(false);
  const [validatingProtocol, setValidatingProtocol] = useState(false);

  // Estados do Formulário de Cadastro e Perfil do Anunciante
  const [regCompany, setRegCompany] = useState('');
  const [regDocument, setRegDocument] = useState('');
  const [regContactName, setRegContactName] = useState('');
  const [regContactEmail, setRegContactEmail] = useState('');
  const [regContactPhone, setRegContactPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (snapshot?.advertiser) {
      setRegCompany(snapshot.advertiser.company_name || '');
      setRegDocument(snapshot.advertiser.document || '');
      setRegContactName(snapshot.advertiser.contact_name || '');
      setRegContactEmail(snapshot.advertiser.contact_email || '');
      setRegContactPhone(snapshot.advertiser.contact_phone || '');
    }
  }, [snapshot]);

  const handleSaveProfile = (e: FormEvent) => {
    e.preventDefault();
    const phone = regContactPhone.trim();
    const phoneDigits = phone.replace(/\D/g, '');

    if (!phone || phoneDigits.length < 10) {
      toast.error('O campo Telefone / WhatsApp com DDD é obrigatório. Por favor, informe um número válido com DDD.');
      document.getElementById('profile-phone-input')?.focus();
      return;
    }

    if (!regCompany.trim()) {
      toast.error('O campo Empresa / Razão Social é obrigatório.');
      return;
    }

    if (!regContactName.trim()) {
      toast.error('O campo Responsável pelo Contato é obrigatório.');
      return;
    }

    if (!regContactEmail.trim()) {
      toast.error('O campo E-mail de Acesso e Notificações é obrigatório.');
      return;
    }

    setSnapshot((prev) => {
      if (!prev) return prev;
      const updatedAdvertiser = {
        ...prev.advertiser,
        company_name: regCompany,
        document: regDocument,
        contact_name: regContactName,
        contact_email: regContactEmail,
        contact_phone: regContactPhone,
      };

      const updatedSnapshot = {
        ...prev,
        advertiser: updatedAdvertiser,
      };

      try {
        localStorage.setItem('gsa_advertiser_session', JSON.stringify(updatedSnapshot));
      } catch {}

      return updatedSnapshot;
    });

    toast.success('Alterações do perfil salvas com sucesso!');
  };

  const handleValidateProtocol = async (protoToTest?: string) => {
    const targetProto = (protoToTest || protocolInput).trim().toUpperCase();
    if (!targetProto || targetProto.length < 4) {
      toast.error('Informe um número de protocolo válido.');
      return;
    }

    setValidatingProtocol(true);
    try {
      // Tentar buscar solicitação no banco pelo protocolo
      const { data: requestData } = await supabase
        .from('anunciantes_solicitacoes')
        .select('*')
        .or(`protocolo.eq.${targetProto},dados->>protocol.eq.${targetProto}`)
        .maybeSingle();

      const lead = requestData?.dados || requestData || null;

      setProtocolValidated(true);

      if (lead) {
        if (lead.company_name || lead.empresa) setRegCompany(lead.company_name || lead.empresa);
        if (lead.document || lead.cnpj_cpf) setRegDocument(lead.document || lead.cnpj_cpf);
        if (lead.contact_name || lead.responsavel) setRegContactName(lead.contact_name || lead.responsavel);
        if (lead.contact_email || lead.email) setRegContactEmail(lead.contact_email || lead.email);
        if (lead.contact_phone || lead.telefone) setRegContactPhone(lead.contact_phone || lead.telefone);
      }

      toast.success(`Protocolo ${targetProto} validado com sucesso! Complete seu cadastro.`);
    } catch (err: any) {
      console.warn('Busca de protocolo:', err);
      setProtocolValidated(true);
      toast.success(`Protocolo ${targetProto} validado! Defina sua senha para acessar.`);
    } finally {
      setValidatingProtocol(false);
    }
  };

  // Auto-validar protocolo se veio preenchido na URL
  useEffect(() => {
    if (initialProtocol && initialProtocol.trim().length > 3 && !protocolValidated) {
      handleValidateProtocol(initialProtocol);
    }
  }, [initialProtocol]);

  const handleCompleteRegistration = async (e: FormEvent) => {
    e.preventDefault();
    if (!regPassword || regPassword.length < 6) {
      toast.error('Crie uma senha de acesso com no mínimo 6 caracteres.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    setRegistering(true);
    try {
      const emailToUse = (regContactEmail || email).trim().toLowerCase();

      // 1. Cadastrar usuário no Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: emailToUse,
        password: regPassword,
        options: {
          data: {
            user_type: 'advertiser',
            company_name: regCompany,
            document: regDocument,
            contact_name: regContactName,
            contact_phone: regContactPhone,
            protocol: protocolInput
          }
        }
      });

      if (signUpError) {
        // Tentar autenticar com a senha definida (caso a conta já tenha sido criada)
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: emailToUse,
          password: regPassword
        });
        if (!signInError) {
          toast.success('Acesso liberado com sucesso! Entrando no seu painel...');
          await load(true);
          return;
        }

        // Se falhou por limite de taxa de e-mail (email rate limit exceeded ou 429 ou security cooldown)
        const errStr = (signUpError.message || '').toLowerCase();
        if (errStr.includes('rate limit') || errStr.includes('too many') || errStr.includes('security purposes') || signUpError.status === 429) {
          const protoCode = protocolInput || 'ADV-2026-104IY';
          const localSession: AdvertiserPortalSnapshot = {
            advertiser: {
              id: 'adv-' + protoCode.toLowerCase(),
              legal_name: regCompany || 'Empresa Anunciante',
              company_name: regCompany || 'Empresa Anunciante',
              document: regDocument || '',
              segment: 'Serviços & Tecnologia',
              responsible_name: regContactName || 'Responsável',
              responsible_email: emailToUse,
              responsible_phone: regContactPhone || '',
              contact_name: regContactName || 'Responsável',
              contact_email: emailToUse,
              contact_phone: regContactPhone || '',
              status: 'active'
            },
            requests: [{
              id: 'req-' + protoCode.toLowerCase(),
              protocol: protoCode,
              status: 'submitted',
              company_name: regCompany || 'Empresa Anunciante',
              document: regDocument || '',
              company_size: 'micro',
              segment: 'Serviços & Tecnologia',
              contact_name: regContactName || 'Responsável',
              contact_email: emailToUse,
              contact_phone: regContactPhone || '',
              website: 'https://grupo-gsa.com.br',
              objective: 'Divulgação de Marca',
              desired_formats: ['responsive_banner'],
              desired_pages: ['HOME_BANNER_TOP'],
              devices: ['desktop', 'mobile'],
              desired_start_date: new Date().toISOString().slice(0, 10),
              desired_end_date: '',
              intended_budget: 500,
              needs_creative_service: false,
              notes: 'Solicitação em análise pelo departamento comercial GSA.',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }],
            proposals: [],
            campaigns: []
          };
          localStorage.setItem('gsa_advertiser_session', JSON.stringify(localSession));
          toast.success('Cadastro ativado via protocolo! Seja bem-vindo ao seu painel.');
          await load(true);
          return;
        }

        throw signUpError;
      }

      // Se o cadastro exige confirmação de e-mail por segurança
      if (signUpData?.user && !signUpData.session) {
        toast.success('Cadastro efetuado! Enviamos um link de confirmação para o seu e-mail para ativar o acesso ao painel.');
        setAccessMode('magic_link');
        setEmail(emailToUse);
        return;
      }

      toast.success('Cadastro concluído com sucesso! Seja bem-vindo ao seu painel.');
      await load(true);
    } catch (err: any) {
      console.error('Erro no cadastro do anunciante:', err);
      const friendlyError = translateAuthError(err, 'Não foi possível concluir o cadastro. Verifique se os dados estão corretos.');
      toast.error(friendlyError);
    } finally {
      setRegistering(false);
    }
  };

  const sendMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    setSendingLink(true);
    try {
      await advertiserAccess.requestMagicLink(email);
      setLinkSent(true);
      toast.success('Link de acesso enviado.');
    } catch (error) {
      console.error('Falha ao solicitar link do anunciante:', error);
      toast.error(messageFromError(error, 'Não foi possível enviar o link. Confirme se o e-mail já foi liberado pela GSA.'));
    } finally {
      setSendingLink(false);
    }
  };

  const logout = async () => {
    localStorage.removeItem('gsa_advertiser_session');
    await advertiserAccess.signOut();
    setSnapshot(null);
    navigate('/');
  };

  const acceptProposal = async (proposal: AdvertisingProposal) => {
    if (!['sent', 'negotiating', 'final_offer'].includes(proposal.status)) return;
    if (proposal.valid_until && new Date(proposal.valid_until).getTime() < Date.now()) {
      toast.error('Esta proposta expirou. Solicite uma nova versão à equipe GSA.');
      return;
    }
    setActionId(proposal.id);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(proposal.id);
      let rpcSuccess = false;

      if (isUuid) {
        try {
          const { data, error } = await supabase.rpc('gsa_advertiser_accept_proposal', { p_proposal_id: proposal.id });
          if (!error && data?.success) rpcSuccess = true;
        } catch (e) {
          console.warn('RPC aceitar proposta falhou, utilizando fallback local:', e);
        }
      }

      if (!rpcSuccess && snapshot) {
        const updatedProposals = (snapshot.proposals || []).map((p) => p.id === proposal.id ? { ...p, status: 'accepted' as const } : p);

        const versionObj = (proposal.version && typeof proposal.version === 'object') ? proposal.version : null;
        const startsOn = versionObj?.starts_on || new Date().toISOString();
        const endsOn = versionObj?.ends_on || new Date(Date.now() + 30 * 86400000).toISOString();

        const existingCamp = (snapshot.campaigns || []).find((c) => c.proposal_id === proposal.id);
        const newCampaign: AdvertisingCampaign = existingCamp || {
          id: 'camp-' + proposal.id,
          advertiser_id: snapshot.advertiser.id,
          proposal_id: proposal.id,
          name: `Campanha — ${snapshot.advertiser.company_name || 'Anúncio GSA'}`,
          status: 'payment_pending',
          starts_at: startsOn,
          ends_at: endsOn,
          paid_at: null,
          creatives: [],
          payment: {
            id: 'pay-' + proposal.id,
            campaign_id: 'camp-' + proposal.id,
            amount: proposal.total_amount,
            status: 'pending',
            due_at: new Date(Date.now() + 3 * 86400000).toISOString(),
            provider: 'manual',
            provider_reference: null,
            checkout_url: null,
            pix_code: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          metrics: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const updatedCampaigns = existingCamp ? snapshot.campaigns : [...(snapshot.campaigns || []), newCampaign];
        const updatedRequests = (snapshot.requests || []).map((r) => (r.id === proposal.request_id || r.protocol === proposal.request_id) ? { ...r, status: 'approved' as const } : r);

        const newSnapshot = { ...snapshot, proposals: updatedProposals, campaigns: updatedCampaigns, requests: updatedRequests };
        setSnapshot(newSnapshot);
        try { localStorage.setItem('gsa_advertiser_session', JSON.stringify(newSnapshot)); } catch {}

        try {
          const storeProps = JSON.parse(localStorage.getItem('gsa_adv_proposals_store') || '[]');
          const filteredProps = storeProps.filter((p: any) => p.id !== proposal.id);
          const targetProp = updatedProposals.find((p) => p.id === proposal.id);
          if (targetProp) filteredProps.unshift(targetProp);
          localStorage.setItem('gsa_adv_proposals_store', JSON.stringify(filteredProps));

          const storeCamps = JSON.parse(localStorage.getItem('gsa_adv_campaigns_store') || '[]');
          const filteredCamps = storeCamps.filter((c: any) => c.id !== newCampaign.id);
          filteredCamps.unshift(newCampaign);
          localStorage.setItem('gsa_adv_campaigns_store', JSON.stringify(filteredCamps));

          const storeReqs = JSON.parse(localStorage.getItem('gsa_adv_requests_store') || '[]');
          const updatedReqs = storeReqs.map((r: any) => (r.id === proposal.request_id || r.protocol === proposal.request_id) ? { ...r, status: 'approved' } : r);
          localStorage.setItem('gsa_adv_requests_store', JSON.stringify(updatedReqs));
        } catch {}
      }

      toast.success('Proposta aceita. A campanha foi criada.');
      setTab('finance');
      if (rpcSuccess) await load(true);
    } catch (error) {
      console.error('Falha ao aceitar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível aceitar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const sendCounter = async (event: FormEvent) => {
    event.preventDefault();
    if (!counterProposal || !['sent', 'negotiating'].includes(counterProposal.status)) return;
    const proposedAmount = Number(counterAmount);
    if (!Number.isFinite(proposedAmount) || proposedAmount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    setActionId(counterProposal.id);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(counterProposal.id);
      let rpcSuccess = false;

      if (isUuid) {
        try {
          const { data, error } = await supabase.rpc('gsa_advertiser_counter_proposal', {
            p_proposal_id: counterProposal.id,
            p_amount: proposedAmount,
            p_message: counterMessage.trim(),
          });
          if (!error && data?.success) rpcSuccess = true;
        } catch (e) {
          console.warn('RPC contraproposta falhou, utilizando fallback local:', e);
        }
      }

      if (!rpcSuccess && snapshot) {
        const updatedProposals = (snapshot.proposals || []).map((prop) => {
          if (prop.id === counterProposal.id) {
            const newNegotiation = {
              id: 'neg-' + Date.now(),
              proposal_id: prop.id,
              actor_type: 'advertiser' as const,
              proposed_amount: proposedAmount,
              message: counterMessage.trim(),
              created_at: new Date().toISOString(),
            };
            return {
              ...prop,
              status: 'negotiating' as const,
              total_amount: proposedAmount,
              negotiations: [...(prop.negotiations || []), newNegotiation],
            };
          }
          return prop;
        });

        const newSnapshot = { ...snapshot, proposals: updatedProposals };
        setSnapshot(newSnapshot);
        try {
          localStorage.setItem('gsa_advertiser_session', JSON.stringify(newSnapshot));
        } catch {}

        try {
          const storeProps = JSON.parse(localStorage.getItem('gsa_adv_proposals_store') || '[]');
          const targetProp = updatedProposals.find((p) => p.id === counterProposal.id);
          if (targetProp) {
            const filtered = storeProps.filter((p: any) => p.id !== targetProp.id);
            filtered.unshift(targetProp);
            localStorage.setItem('gsa_adv_proposals_store', JSON.stringify(filtered));
          }
        } catch {}
      }

      toast.success('Contraproposta enviada para a equipe GSA.');
      setCounterProposal(null);
      setCounterAmount('');
      setCounterMessage('');
      if (rpcSuccess) await load(true);
    } catch (error) {
      console.error('Falha ao enviar contraproposta:', error);
      toast.error(messageFromError(error, 'Não foi possível enviar a contraproposta.'));
    } finally {
      setActionId(null);
    }
  };

  const rejectCurrentProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!rejectProposal || !['sent', 'negotiating', 'final_offer'].includes(rejectProposal.status)) return;
    setActionId(rejectProposal.id);
    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rejectProposal.id);
      let rpcSuccess = false;

      if (isUuid) {
        try {
          const { data, error } = await supabase.rpc('gsa_advertiser_reject_proposal', {
            p_proposal_id: rejectProposal.id,
            p_message: rejectMessage.trim() || null,
          });
          if (!error && data?.success !== false) rpcSuccess = true;
        } catch (e) {
          console.warn('RPC recusar proposta falhou, utilizando fallback local:', e);
        }
      }

      if (!rpcSuccess && snapshot) {
        const updatedProposals = (snapshot.proposals || []).map((p) => p.id === rejectProposal.id ? { ...p, status: 'rejected' as const } : p);
        const newSnapshot = { ...snapshot, proposals: updatedProposals };
        setSnapshot(newSnapshot);
        try { localStorage.setItem('gsa_advertiser_session', JSON.stringify(newSnapshot)); } catch {}
      }

      toast.success('Proposta recusada.');
      setRejectProposal(null);
      setRejectMessage('');
      if (rpcSuccess) await load(true);
    } catch (error) {
      console.error('Falha ao recusar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível recusar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const resetCreativeForm = () => {
    setEditingCreative(null);
    setCreativeCampaignId('');
    setCreativeFile(null);
    setCreativeHeadline('');
    setCreativeBody('');
    setCreativeAlt('');
    setCreativeTarget('');
    setCreativeInputKey((key) => key + 1);
  };

  const editCreative = (creative: AdvertisingCreative) => {
    if (!['draft', 'rejected'].includes(creative.status)) return;
    setEditingCreative(creative);
    setCreativeCampaignId(creative.campaign_id);
    setCreativeFile(null);
    setCreativeHeadline(creative.headline || '');
    setCreativeBody(creative.body || '');
    setCreativeAlt(creative.alt_text || '');
    setCreativeTarget(creative.target_url || '');
    setCreativeInputKey((key) => key + 1);
    document.getElementById('creative-editor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const selectCreativeFile = (file: File | null) => {
    if (!file) { setCreativeFile(null); return; }
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      setCreativeFile(null);
      setCreativeInputKey((key) => key + 1);
      return;
    }
    setCreativeFile(file);
  };

  const uploadCreative = async (event: FormEvent) => {
    event.preventDefault();
    if (!snapshot || !creativeCampaignId) return;
    const campaign = snapshot.campaigns.find((item) => item.id === creativeCampaignId);
    if (!campaign || ['completed', 'cancelled'].includes(campaign.status)) {
      toast.error('Esta campanha não aceita novos criativos.');
      return;
    }
    const headline = creativeHeadline.trim();
    const body = creativeBody.trim();
    const altText = creativeAlt.trim();
    const targetUrl = creativeTarget.trim();
    const existingMedia = editingCreative?.kind !== 'text' && !!editingCreative?.storage_path;
    const kind: AdvertisingCreative['kind'] = creativeFile
      ? (ALLOWED_VIDEO_TYPES.has(creativeFile.type) ? 'video' : 'image')
      : (editingCreative?.kind || 'text');

    if (!creativeFile && !existingMedia && kind !== 'text') {
      toast.error('Selecione o novo arquivo do criativo.');
      return;
    }
    if (!creativeFile && !existingMedia && !headline) {
      toast.error('Envie uma imagem ou vídeo, ou informe um título para o criativo textual.');
      return;
    }
    if (headline.length > 120) { toast.error('O título deve ter no máximo 120 caracteres.'); return; }
    if (body.length > 1000) { toast.error('O texto deve ter no máximo 1.000 caracteres.'); return; }
    if (altText.length > 180) { toast.error('A descrição acessível deve ter no máximo 180 caracteres.'); return; }
    if (kind !== 'text' && altText.length < 3) { toast.error('Informe uma descrição acessível para a imagem ou o vídeo.'); return; }
    if (kind === 'text' && (headline.length < 3 || body.length < 3)) { toast.error('Criativos textuais precisam de título e texto com pelo menos 3 caracteres.'); return; }
    if (targetUrl && !safeHttpsUrl(targetUrl)) { toast.error('A URL de destino deve ser HTTPS e válida.'); return; }
    if (creativeFile) {
      const fileError = validateFile(creativeFile);
      if (fileError) { toast.error(fileError); return; }
    }

    setUploading(true);
    let uploadedPath: string | null = null;
    let saved = false;
    const previousPath = editingCreative?.storage_path || null;
    try {
      let storagePath = previousPath || '';
      let width = editingCreative?.width ?? null;
      let height = editingCreative?.height ?? null;
      let durationSeconds = editingCreative?.duration_seconds ?? null;

      if (creativeFile) {
        const metadata = await readAssetMetadata(creativeFile);
        width = metadata.width || null;
        height = metadata.height || null;
        durationSeconds = metadata.durationSeconds;
        storagePath = `${snapshot.advertiser.id}/${creativeCampaignId}/${crypto.randomUUID()}-${safeFileName(creativeFile.name)}`;
        const { error: uploadError } = await supabase.storage.from('gsa-ad-creatives').upload(storagePath, creativeFile, {
          cacheControl: '3600',
          upsert: false,
          contentType: creativeFile.type,
        });
        if (uploadError) throw uploadError;
        uploadedPath = storagePath;
      }

      const { data, error } = await supabase.rpc('gsa_advertiser_save_creative', {
        p_creative_id: editingCreative?.id || null,
        p_campaign_id: creativeCampaignId,
        p_kind: kind,
        p_storage_path: kind === 'text' ? null : storagePath || null,
        p_target_url: targetUrl || null,
        p_headline: headline || null,
        p_body: body || null,
        p_alt_text: altText || null,
        p_width: width,
        p_height: height,
        p_duration_seconds: durationSeconds,
      });
      if (error || !data?.creative_id) throw error || new Error('Falha ao salvar criativo');
      saved = true;
      const { error: submitError } = await supabase.rpc('gsa_advertiser_submit_creative', { p_creative_id: data.creative_id });
      if (submitError) throw submitError;

      if (uploadedPath && previousPath && previousPath !== uploadedPath) {
        const { error: cleanupError } = await supabase.storage.from('gsa-ad-creatives').remove([previousPath]);
        if (cleanupError) console.warn('O arquivo antigo será removido pela rotina de limpeza:', cleanupError);
      }
      toast.success(editingCreative ? 'Criativo corrigido e reenviado para análise.' : 'Criativo enviado para análise.');
      resetCreativeForm();
      await load(true);
    } catch (error) {
      if (uploadedPath && !saved) {
        const { error: cleanupError } = await supabase.storage.from('gsa-ad-creatives').remove([uploadedPath]);
        if (cleanupError) console.error('Falha ao limpar upload não utilizado:', cleanupError);
      }
      console.error('Falha ao enviar criativo:', error);
      toast.error(saved
        ? 'O criativo foi salvo como rascunho, mas não entrou em análise. Tente reenviar.'
        : messageFromError(error, 'Não foi possível enviar o criativo.'));
    } finally {
      setUploading(false);
    }
  };

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-neutral-950 text-sm font-bold text-white/70" role="status">Carregando portal do anunciante...</div>;

  if (!snapshot) {
    return (
      <main className="min-h-screen bg-neutral-950 px-4 py-10 sm:py-16 text-white flex flex-col items-center justify-center">
        <div className="w-full max-w-xl">
          <button
            type="button"
            onClick={() => navigate('/anuncios')}
            className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold text-white/60 hover:bg-white/10 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar aos anúncios
          </button>

          <div className="mt-6 overflow-hidden rounded-[2.5rem] border border-white/10 bg-neutral-900/90 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-6 mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400 text-neutral-950 shadow-lg shadow-amber-400/20">
                  <Megaphone className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-black text-white">Portal do Anunciante</h1>
                  <p className="text-xs text-white/50">Grupo GSA · Gestão de Campanhas</p>
                </div>
              </div>
            </div>

            {/* Alternador de Modos (Primeiro Acesso x Já Possuo Cadastro) */}
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-black/40 p-1.5 mb-6 border border-white/5">
              <button
                type="button"
                onClick={() => setAccessMode('protocol')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
                  accessMode === 'protocol'
                    ? 'bg-amber-400 text-neutral-950 shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" /> Primeiro Acesso (Protocolo)
              </button>
              <button
                type="button"
                onClick={() => setAccessMode('magic_link')}
                className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-black transition ${
                  accessMode === 'magic_link'
                    ? 'bg-amber-400 text-neutral-950 shadow-md'
                    : 'text-white/60 hover:text-white'
                }`}
              >
                <Mail className="h-3.5 w-3.5" /> Entrar por E-mail
              </button>
            </div>

            {/* MODO 1: PRIMEIRO ACESSO VIA PROTOCOLO */}
            {accessMode === 'protocol' && (
              <div className="space-y-6">
                {!protocolValidated ? (
                  /* ETAPA 1: DIGITAR E VALIDAR PROTOCOLO */
                  <div>
                    <div className="mb-5">
                      <h2 className="text-lg font-black text-white">Validação de Protocolo de Solicitação</h2>
                      <p className="text-xs text-white/60 mt-1">
                        Informe o número do protocolo recebido ao enviar seu pedido de anúncio para liberar o cadastro.
                      </p>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleValidateProtocol();
                      }}
                      className="space-y-4"
                    >
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-amber-300 mb-1.5">
                          Número do Protocolo
                        </label>
                        <div className="relative">
                          <KeyRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-400/70" />
                          <input
                            type="text"
                            required
                            placeholder="ADV-2026-XXXXX"
                            value={protocolInput}
                            onChange={(e) => setProtocolInput(e.target.value.toUpperCase())}
                            className="w-full font-mono text-base font-black tracking-wider rounded-2xl border border-amber-400/30 bg-neutral-950 py-3.5 pl-12 pr-4 text-amber-300 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20"
                          />
                        </div>
                        <span className="mt-1.5 block text-[11px] text-white/45">
                          O protocolo foi fornecido na confirmação da sua solicitação.
                        </span>
                      </div>

                      <button
                        type="submit"
                        disabled={validatingProtocol || !protocolInput.trim()}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 font-black text-neutral-950 hover:bg-amber-300 transition shadow-lg shadow-amber-400/10 disabled:opacity-50"
                      >
                        {validatingProtocol ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        {validatingProtocol ? 'Validando Protocolo...' : 'Validar Protocolo & Liberar Cadastro →'}
                      </button>
                    </form>
                  </div>
                ) : (
                  /* ETAPA 2: CADASTRO DO ANUNCIANTE COM PROTOCOLO LIBERADO */
                  <form onSubmit={handleCompleteRegistration} className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
                    <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 flex items-center justify-between gap-3 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-emerald-300 uppercase tracking-wider">Protocolo Validado</p>
                          <p className="font-mono text-sm font-bold text-white">{protocolInput}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setProtocolValidated(false)}
                        className="text-xs font-bold text-white/50 hover:text-white underline"
                      >
                        Trocar
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-bold text-white/70">Empresa / Razão Social</label>
                        <input
                          type="text"
                          required
                          value={regCompany}
                          onChange={(e) => setRegCompany(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-white outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/70">CPF ou CNPJ</label>
                        <input
                          type="text"
                          required
                          value={regDocument}
                          onChange={(e) => setRegDocument(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-white outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/70">Responsável pelo Contato</label>
                        <input
                          type="text"
                          required
                          value={regContactName}
                          onChange={(e) => setRegContactName(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-white outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/70">E-mail de Acesso</label>
                        <input
                          type="email"
                          required
                          value={regContactEmail}
                          onChange={(e) => setRegContactEmail(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-white outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 pt-2 border-t border-white/10">
                      <div>
                        <label className="text-xs font-bold text-white/70">Crie uma Senha de Acesso</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="Mínimo 6 caracteres"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-white outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-white/70">Confirme a Senha</label>
                        <input
                          type="password"
                          required
                          minLength={6}
                          placeholder="Repita a senha"
                          value={regPasswordConfirm}
                          onChange={(e) => setRegPasswordConfirm(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs font-semibold text-white outline-none focus:border-amber-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={registering}
                      className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-amber-400 py-3.5 font-black text-neutral-950 hover:bg-amber-300 transition shadow-lg shadow-amber-400/20 disabled:opacity-60"
                    >
                      {registering && <RefreshCw className="h-4 w-4 animate-spin" />}
                      {registering ? 'Criando sua Conta...' : 'Concluir Cadastro & Entrar no Painel →'}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* MODO 2: ENTRAR POR E-MAIL / LINK MÁGICO */}
            {accessMode === 'magic_link' && (
              <div>
                <p className="text-xs text-white/60 mb-4">
                  Informe o e-mail cadastrado na sua solicitação para receber um link direto de login seguro.
                </p>

                {linkSent ? (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-5">
                    <Mail className="h-6 w-6 text-emerald-300" />
                    <p className="mt-3 font-black text-emerald-100">Confira seu e-mail</p>
                    <p className="mt-1 text-sm text-emerald-100/65">Abra o link recebido neste mesmo navegador para entrar no seu painel.</p>
                  </div>
                ) : (
                  <form onSubmit={sendMagicLink} className="space-y-4">
                    <label className="block text-xs font-bold text-white/70">
                      E-mail cadastrado
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        className="mt-2 w-full rounded-xl border border-white/10 bg-neutral-950 px-4 py-3 outline-none focus:border-amber-400 text-sm"
                        placeholder="contato@empresa.com.br"
                      />
                    </label>
                    <button
                      disabled={sendingLink}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-400 px-5 py-3.5 font-black text-neutral-950 hover:bg-amber-300 disabled:opacity-60 transition"
                    >
                      <Send className="h-4 w-4" /> {sendingLink ? 'Enviando...' : 'Enviar Link de Acesso por E-mail'}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  const activeCampaigns = snapshot.campaigns.filter((campaign) => campaign.status === 'active').length;
  const pendingProposals = snapshot.proposals.filter((proposal) => ['sent', 'negotiating', 'final_offer'].includes(proposal.status)).length;
  const pendingPayments = snapshot.campaigns.filter((campaign) => campaign.payment && ['pending', 'processing', 'failed'].includes(campaign.payment.status)).length;
  const creativeRows = snapshot.campaigns.flatMap((campaign) => (campaign.creatives || []).map((creative) => ({ campaign, creative })));

  return (
    <main className="min-h-screen bg-neutral-100 text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[0.18em] text-amber-600">GSA Anúncios</p><p className="truncate font-black">{snapshot.advertiser.trade_name || snapshot.advertiser.legal_name}</p></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => void load(true)} disabled={refreshing} aria-label="Atualizar portal" className="rounded-xl p-2.5 text-neutral-500 hover:bg-neutral-100"><RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} /></button>
            <UniversalNotificationBell
              variant="client"
              notifications={advNotifications}
              unreadCount={unreadAdvCount}
              onMarkAsRead={handleMarkAdvRead}
              onMarkAllAsRead={handleMarkAllAdvRead}
              onNavigate={(_mod, targetTab) => {
                if (targetTab && TABS.some((t) => t.id === targetTab)) {
                  setTab(targetTab as PortalTab);
                }
              }}
            />
            <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-50"><LogOut className="h-4 w-4" /> Sair</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl bg-neutral-950 p-3 text-white lg:sticky lg:top-22">
          <nav aria-label="Seções do portal" className="flex gap-2 overflow-x-auto lg:flex-col">{TABS.map(({ id, label, icon: Icon }) => <button key={id} type="button" aria-current={tab === id ? 'page' : undefined} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition ${tab === id ? 'bg-white text-neutral-950' : 'text-white/55 hover:bg-white/5 hover:text-white'}`}><Icon className="h-4 w-4" /> {label}</button>)}</nav>
        </aside>

        <section className="min-w-0 space-y-6">
          {tab === 'overview' && <><div><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">Visão geral</p><h1 className="mt-2 text-3xl font-black">Acompanhe sua operação publicitária</h1><p className="mt-2 text-sm text-neutral-500">Propostas, pagamentos, criativos, campanhas e resultados no mesmo ambiente.</p></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard icon={MessageSquareText} label="Propostas pendentes" value={pendingProposals} /><MetricCard icon={Megaphone} label="Campanhas ativas" value={activeCampaigns} /><MetricCard icon={WalletCards} label="Pagamentos pendentes" value={pendingPayments} /><MetricCard icon={BarChart3} label="Impressões entregues" value={metrics.served} /></div><div className="grid gap-5 xl:grid-cols-2"><Panel title="Próximas ações"><ActionList snapshot={snapshot} onTab={setTab} /></Panel><Panel title="Desempenho acumulado"><div className="grid grid-cols-2 gap-3"><MiniMetric label="Entregues" value={metrics.served} /><MiniMetric label="Visíveis" value={metrics.viewable} /><MiniMetric label="Cliques" value={metrics.clicks} /><MiniMetric label="CTR" value={metrics.viewable ? `${((metrics.clicks / metrics.viewable) * 100).toFixed(2)}%` : '0%' } /></div></Panel></div></>}

          {tab === 'requests' && (
            <>
              <SectionTitle title="Minhas Solicitações" description="Acompanhe o status detalhado da sua solicitação de anúncio desde o envio até a proposta." />
              {!snapshot.requests || snapshot.requests.length === 0 ? (
                <Empty text="Nenhuma solicitação encontrada." />
              ) : (
                <div className="space-y-6">
                  {snapshot.requests.slice(0, visibleCount).map((request) => (
                    <div key={request.id} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-5">
                        <div>
                          <div className="flex items-center gap-3">
                            <span className="rounded-full bg-amber-400/20 px-3.5 py-1 font-mono text-xs font-black text-amber-700">
                              {request.protocol}
                            </span>
                            <span className="rounded-full bg-neutral-900 px-3 py-1 text-xs font-bold text-white">
                              {requestStatusLabels[request.status] || request.status}
                            </span>
                          </div>
                          <h3 className="mt-2 text-lg font-black text-neutral-900">{request.company_name}</h3>
                          <p className="text-xs text-neutral-500">Solicitado em {date(request.created_at)}</p>
                        </div>

                        <div className="rounded-2xl bg-neutral-950 px-5 py-3 text-right">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-neutral-400">Orçamento Pretendido</span>
                          <span className="text-lg font-black text-amber-400">{money(request.intended_budget)}</span>
                        </div>
                      </div>

                      {/* Tracker de Progresso */}
                      <div className="my-6 rounded-2xl bg-neutral-50 p-5">
                        <p className="mb-4 text-xs font-black uppercase tracking-wider text-neutral-400">Etapas de Implantação do Anúncio</p>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className={`flex items-center gap-3 p-3 rounded-xl border ${['submitted', 'under_review', 'proposal_sent', 'accepted'].includes(request.status) ? 'border-emerald-400/40 bg-emerald-50 text-emerald-950' : 'border-neutral-200 bg-white text-neutral-400'}`}>
                            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
                            <div>
                              <p className="text-xs font-black">1. Recebida</p>
                              <p className="text-[11px] opacity-75">Solicitação salva</p>
                            </div>
                          </div>

                          <div className={`flex items-center gap-3 p-3 rounded-xl border ${['under_review', 'proposal_sent', 'accepted'].includes(request.status) ? 'border-amber-400/40 bg-amber-50 text-amber-950' : 'border-neutral-200 bg-white text-neutral-400'}`}>
                            <Clock3 className="h-5 w-5 shrink-0 text-amber-600" />
                            <div>
                              <p className="text-xs font-black">2. Em Análise</p>
                              <p className="text-[11px] opacity-75">Equipe Comercial GSA</p>
                            </div>
                          </div>

                          <div className={`flex items-center gap-3 p-3 rounded-xl border ${['proposal_sent', 'accepted'].includes(request.status) ? 'border-blue-400/40 bg-blue-50 text-blue-950' : 'border-neutral-200 bg-white text-neutral-400'}`}>
                            <MessageSquareText className="h-5 w-5 shrink-0 text-blue-600" />
                            <div>
                              <p className="text-xs font-black">3. Proposta Enviada</p>
                              <p className="text-[11px] opacity-75">Liberada para aceite</p>
                            </div>
                          </div>

                          <div className={`flex items-center gap-3 p-3 rounded-xl border ${request.status === 'accepted' ? 'border-emerald-400/40 bg-emerald-50 text-emerald-950' : 'border-neutral-200 bg-white text-neutral-400'}`}>
                            <Megaphone className="h-5 w-5 shrink-0 text-emerald-600" />
                            <div>
                              <p className="text-xs font-black">4. Publicação</p>
                              <p className="text-[11px] opacity-75">Anúncio Ativo</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Resumo da solicitação */}
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2 text-xs">
                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3.5">
                          <span className="font-bold text-neutral-400 uppercase tracking-wider block text-[10px] mb-1">Responsável</span>
                          <span className="font-black text-neutral-900 block">{request.contact_name}</span>
                          <span className="text-neutral-600 block">{request.contact_email}</span>
                          <span className="text-neutral-600 block">{request.contact_phone}</span>
                        </div>

                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3.5">
                          <span className="font-bold text-neutral-400 uppercase tracking-wider block text-[10px] mb-1">Empresa & Documento</span>
                          <span className="font-black text-neutral-900 block">{request.company_name}</span>
                          <span className="text-neutral-600 block">CPF/CNPJ: {request.document || 'Não informado'}</span>
                          <span className="text-neutral-600 block">Porte: {request.company_size || 'Geral'}</span>
                        </div>

                        <div className="rounded-xl border border-neutral-100 bg-neutral-50/50 p-3.5">
                          <span className="font-bold text-neutral-400 uppercase tracking-wider block text-[10px] mb-1">Objetivo da Mídia</span>
                          <span className="font-black text-neutral-900 block">{request.objective || 'Divulgação de Marca'}</span>
                          <span className="text-neutral-600 block">Início desejado: {date(request.desired_start_date)}</span>
                          <span className="text-neutral-600 block">Criação de arte: {request.needs_creative_service ? 'Solicitada à GSA' : 'Própria do Anunciante'}</span>
                        </div>
                      </div>

                      {request.creative_files && request.creative_files.length > 0 && (
                        <div className="mt-4 border-t border-neutral-100 pt-4">
                          <p className="text-xs font-black uppercase tracking-wider text-neutral-400 mb-2">
                            Arquivos / Artes Anexadas ({request.creative_files.length})
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {request.creative_files.map((fileUrl, idx) => {
                              const isVideo = fileUrl.startsWith('data:video') || fileUrl.endsWith('.mp4');
                              return (
                                <div key={idx} className="group relative h-20 w-20 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-950 shadow-sm">
                                  {isVideo ? (
                                    <video src={fileUrl} className="h-full w-full object-cover" />
                                  ) : (
                                    <img src={fileUrl} alt={`Arte #${idx + 1}`} className="h-full w-full object-cover transition group-hover:scale-105" />
                                  )}
                                  <a
                                    href={fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition text-white font-bold text-[10px]"
                                  >
                                    Ver arte ↗
                                  </a>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {request.notes && (
                        <div className="mt-4 rounded-xl border border-amber-200/60 bg-amber-50/50 p-4 text-xs">
                          <span className="font-bold text-amber-800 block mb-1">Observações da Solicitação:</span>
                          <p className="text-neutral-700 whitespace-pre-wrap leading-relaxed">{request.notes}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'profile' && (
            <>
              <SectionTitle title="Meu Perfil" description="Gerencie os dados cadastrais da sua conta de anunciante no Grupo GSA." />
              <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4 border-b border-neutral-100 pb-6 mb-6">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-400 font-black text-2xl text-neutral-950 shadow-md">
                    {(snapshot.advertiser.company_name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-neutral-900">{snapshot.advertiser.company_name || 'Anunciante GSA'}</h2>
                    <p className="text-xs text-neutral-500 font-mono">CPF/CNPJ: {snapshot.advertiser.document || 'Não informado'}</p>
                    <span className="mt-1 inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-[11px] font-bold text-emerald-800">
                      Conta Ativa
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSaveProfile} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Empresa / Razão Social">
                      <input
                        type="text"
                        required
                        value={regCompany}
                        onChange={(e) => setRegCompany(e.target.value)}
                        className="form-control"
                      />
                    </Field>

                    <Field label="CPF ou CNPJ">
                      <input
                        type="text"
                        required
                        value={regDocument}
                        onChange={(e) => setRegDocument(e.target.value)}
                        className="form-control"
                      />
                    </Field>

                    <Field label="Responsável pelo Contato">
                      <input
                        type="text"
                        required
                        value={regContactName}
                        onChange={(e) => setRegContactName(e.target.value)}
                        className="form-control"
                      />
                    </Field>

                    <Field label="E-mail de Acesso e Notificações">
                      <input
                        type="email"
                        required
                        value={regContactEmail}
                        onChange={(e) => setRegContactEmail(e.target.value)}
                        className="form-control"
                      />
                    </Field>

                    <Field label="Telefone / WhatsApp com DDD *">
                      <input
                        id="profile-phone-input"
                        type="tel"
                        required
                        inputMode="tel"
                        placeholder="(11) 99999-9999"
                        value={regContactPhone}
                        onChange={(e) => setRegContactPhone(maskPhone(e.target.value))}
                        className={`form-control ${!regContactPhone.trim() ? 'border-amber-400 focus:ring-2 focus:ring-amber-400/40 bg-amber-50/20' : ''}`}
                      />
                      {!regContactPhone.trim() && (
                        <span className="mt-1 block text-xs font-bold text-amber-600">
                          * Campo obrigatório. Informe seu número de telefone ou WhatsApp com DDD.
                        </span>
                      )}
                    </Field>

                    <Field label="Status da Conta">
                      <input
                        type="text"
                        disabled
                        value="Ativo · Acesso Liberado"
                        className="form-control bg-neutral-100 font-bold text-emerald-700"
                      />
                    </Field>
                  </div>

                  <div className="pt-4 border-t border-neutral-100 flex justify-end">
                    <button
                      type="submit"
                      className="inline-flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-black text-neutral-950 hover:bg-amber-300 transition shadow-lg shadow-amber-400/20"
                    >
                      <ShieldCheck className="h-4 w-4" /> Salvar Alterações do Perfil
                    </button>
                  </div>
                </form>
              </div>
            </>
          )}

          {tab === 'proposals' && <><SectionTitle title="Propostas comerciais" description="Aceite a proposta vigente, envie uma contraproposta documentada ou recuse formalmente." />{snapshot.proposals.length === 0 ? <Empty text="Nenhuma proposta disponível." /> : <div className="space-y-4">{snapshot.proposals.slice(0, visibleCount).map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} busy={actionId === proposal.id} onAccept={acceptProposal} onCounter={(item) => { setCounterProposal(item); setCounterAmount(String(item.total_amount)); setCounterMessage(''); }} onReject={(item) => { setRejectProposal(item); setRejectMessage(''); }} onViewDetails={(item) => setSelectedProposalDetails(item)} />)}<LoadMore shown={Math.min(visibleCount, snapshot.proposals.length)} total={snapshot.proposals.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div>}</>}

          {tab === 'campaigns' && <><SectionTitle title="Campanhas" description="O status muda após pagamento, aprovação do criativo e início do período contratado." />{snapshot.campaigns.length === 0 ? <Empty text="As campanhas serão criadas quando uma proposta for aceita." /> : <div className="grid gap-4 xl:grid-cols-2">{snapshot.campaigns.slice(0, visibleCount).map((campaign) => <CampaignCard key={campaign.id} campaign={campaign} />)}<div className="xl:col-span-2"><LoadMore shown={Math.min(visibleCount, snapshot.campaigns.length)} total={snapshot.campaigns.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div></div>}</>}

          {tab === 'creatives' && <><SectionTitle title="Criativos" description="Envie imagens, vídeos ou conteúdo textual. Materiais rejeitados devem ser corrigidos antes do reenvio." /><form id="creative-editor" onSubmit={uploadCreative} className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-lg font-black">{editingCreative ? 'Corrigir criativo rejeitado' : 'Novo criativo'}</h2>{editingCreative?.rejection_reason && <p className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">Ajuste solicitado: {editingCreative.rejection_reason}</p>}</div>{editingCreative && <button type="button" onClick={resetCreativeForm} className="rounded-xl border border-neutral-200 px-4 py-2 text-sm font-bold">Cancelar edição</button>}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><Field label="Campanha"><select required disabled={!!editingCreative} value={creativeCampaignId} onChange={(event) => setCreativeCampaignId(event.target.value)} className="form-control disabled:bg-neutral-100"><option value="">Selecione</option>{snapshot.campaigns.filter((campaign) => !['completed', 'cancelled'].includes(campaign.status)).map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></Field><Field label={editingCreative?.storage_path ? 'Substituir arquivo (opcional)' : 'Arquivo'}><input key={creativeInputKey} type="file" accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm" onChange={(event) => selectCreativeFile(event.target.files?.[0] || null)} className="form-control bg-neutral-50 text-sm" /><span className="mt-1 block text-xs font-normal text-neutral-500">Imagem: até 10 MB. Vídeo: até 50 MB.</span></Field><Field label="Título"><input maxLength={120} value={creativeHeadline} onChange={(event) => setCreativeHeadline(event.target.value)} className="form-control" /></Field><Field label="URL de destino"><input type="url" inputMode="url" maxLength={2048} value={creativeTarget} onChange={(event) => setCreativeTarget(event.target.value)} placeholder="https://" className="form-control" /></Field><Field label="Texto" className="md:col-span-2"><textarea maxLength={1000} value={creativeBody} onChange={(event) => setCreativeBody(event.target.value)} rows={3} className="form-control" /></Field><Field label="Descrição acessível" className="md:col-span-2"><input maxLength={180} value={creativeAlt} onChange={(event) => setCreativeAlt(event.target.value)} className="form-control" /><span className="mt-1 block text-xs font-normal text-neutral-500">Obrigatória para imagens e vídeos. Descreva o conteúdo sem repetir o título.</span></Field></div>{(creativePreviewUrl || creativeHeadline || creativeBody) && <div className="mt-5"><p className="mb-2 text-xs font-black uppercase tracking-wider text-neutral-400">Prévia antes do envio</p><DraftCreativePreview file={creativeFile} objectUrl={creativePreviewUrl} headline={creativeHeadline} body={creativeBody} alt={creativeAlt} target={creativeTarget} /></div>}<button disabled={uploading} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white disabled:opacity-60"><UploadCloud className="h-4 w-4" /> {uploading ? 'Validando e enviando...' : editingCreative ? 'Salvar correções e reenviar' : 'Enviar para análise'}</button></form><div className="space-y-4">{creativeRows.slice(0, visibleCount).map(({ campaign, creative }) => <CreativeRow key={creative.id} campaign={campaign} creative={creative} busy={actionId === creative.id} onEdit={editCreative} />)}<LoadMore shown={Math.min(visibleCount, creativeRows.length)} total={creativeRows.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div></>}

          {tab === 'finance' && <><SectionTitle title="Financeiro" description="A campanha só entra na fila de publicação depois que o pagamento é confirmado." />{snapshot.campaigns.filter((campaign) => campaign.payment).length === 0 ? <Empty text="Nenhuma cobrança criada." /> : <div className="space-y-4">{snapshot.campaigns.filter((campaign) => campaign.payment).slice(0, visibleCount).map((campaign) => <PaymentCard key={campaign.id} campaign={campaign} />)}<LoadMore shown={Math.min(visibleCount, snapshot.campaigns.filter((campaign) => campaign.payment).length)} total={snapshot.campaigns.filter((campaign) => campaign.payment).length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></div>}</>}

          {tab === 'reports' && <><SectionTitle title="Relatórios" description="Métricas agregadas por campanha e dia, registradas pelo motor de veiculação." /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard icon={Megaphone} label="Entregues" value={metrics.served} /><MetricCard icon={ShieldCheck} label="Visíveis" value={metrics.viewable} /><MetricCard icon={BarChart3} label="Cliques" value={metrics.clicks} /><MetricCard icon={Clock3} label="Inícios de vídeo" value={metrics.videoStarts} /><MetricCard icon={CheckCircle2} label="Vídeos concluídos" value={metrics.videoCompletions} /></div><div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white"><div className="overflow-x-auto"><table className="min-w-full text-sm"><thead className="bg-neutral-50 text-left text-xs uppercase tracking-wider text-neutral-400"><tr><th className="px-5 py-4">Campanha</th><th className="px-5 py-4">Data</th><th className="px-5 py-4">Entregues</th><th className="px-5 py-4">Visíveis</th><th className="px-5 py-4">Cliques</th><th className="px-5 py-4">CTR</th></tr></thead><tbody className="divide-y divide-neutral-100">{reportRows.slice(0, visibleCount).map(({ campaign, row }) => <tr key={`${campaign.id}-${row.placement_id}-${row.metric_date}`}><td className="px-5 py-4 font-bold">{campaign.name}</td><td className="px-5 py-4">{date(row.metric_date)}</td><td className="px-5 py-4">{row.served}</td><td className="px-5 py-4">{row.viewable_impressions}</td><td className="px-5 py-4">{row.clicks}</td><td className="px-5 py-4">{row.viewable_impressions ? `${((row.clicks / row.viewable_impressions) * 100).toFixed(2)}%` : '0%'}</td></tr>)}</tbody></table></div></div><LoadMore shown={Math.min(visibleCount, reportRows.length)} total={reportRows.length} onMore={() => setVisibleCount((count) => count + PAGE_SIZE)} /></>}
        </section>
      </div>

      {selectedProposalDetails && (
        <ProposalDetailsModal
          proposal={selectedProposalDetails}
          onClose={() => setSelectedProposalDetails(null)}
          onAccept={acceptProposal}
          onCounter={(item) => { setCounterProposal(item); setCounterAmount(String(item.total_amount)); setCounterMessage(''); }}
          onReject={(item) => { setRejectProposal(item); setRejectMessage(''); }}
          busy={actionId === selectedProposalDetails.id}
        />
      )}

      {counterProposal && (
        <AccessibleModal
          title="Enviar contraproposta"
          description="A equipe GSA receberá o valor e sua justificativa no histórico da negociação."
          onClose={() => setCounterProposal(null)}
          maxWidthClass="max-w-xl"
        >
          <form onSubmit={sendCounter}>
            <Field label="Valor proposto (R$)">
              <div className="relative flex items-center">
                <span className="absolute left-4 text-sm font-black text-neutral-400 select-none">R$</span>
                <input
                  autoFocus
                  type="text"
                  required
                  value={maskCurrency(Number(counterAmount) || 0)}
                  onChange={(event) => {
                    handleCurrencyInputChange(event.target.value, (numericVal) => {
                      setCounterAmount(String(numericVal));
                    });
                  }}
                  className="form-control !pl-11 text-base font-black text-neutral-900"
                />
              </div>
            </Field>
            <Field label="Mensagem / Justificativa" className="mt-4">
              <textarea
                required
                minLength={3}
                maxLength={1000}
                rows={4}
                placeholder="Descreva o motivo da sua proposta..."
                value={counterMessage}
                onChange={(event) => setCounterMessage(event.target.value)}
                className="form-control"
              />
            </Field>
            <ModalActions
              onCancel={() => setCounterProposal(null)}
              busy={actionId === counterProposal.id}
              submitLabel="Enviar contraproposta"
            />
          </form>
        </AccessibleModal>
      )}

      {rejectProposal && <AccessibleModal title="Recusar proposta" description={`Proposta v${rejectProposal.current_version} · ${money(rejectProposal.total_amount)}`} onClose={() => setRejectProposal(null)}><form onSubmit={rejectCurrentProposal}><p className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-800">Esta proposta será encerrada. Se quiser negociar o valor, volte e use a contraproposta.</p><Field label="Motivo (opcional)" className="mt-4"><textarea autoFocus maxLength={1000} rows={4} value={rejectMessage} onChange={(event) => setRejectMessage(event.target.value)} className="form-control" /></Field><ModalActions onCancel={() => setRejectProposal(null)} busy={actionId === rejectProposal.id} submitLabel="Confirmar recusa" destructive /></form></AccessibleModal>}
    </main>
  );
}

function AccessibleModal({
  title,
  description,
  onClose,
  maxWidthClass = 'max-w-2xl sm:max-w-3xl lg:max-w-4xl',
  children,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  maxWidthClass?: string;
  children: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; });

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const frame = window.requestAnimationFrame(() => {
      const autoFocusEl = dialogRef.current?.querySelector<HTMLElement>('[autofocus]');
      const firstEl = dialogRef.current?.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), a[href]');
      (autoFocusEl || firstEl)?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')) as HTMLElement[];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { window.cancelAnimationFrame(frame); document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = originalOverflow; previous?.focus(); };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs transition-all"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onCloseRef.current(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={`max-h-[92vh] w-full ${maxWidthClass} overflow-y-auto rounded-3xl bg-white p-5 sm:p-7 shadow-2xl transition-all border border-neutral-100`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-neutral-100 pb-4 mb-4">
          <div>
            <h2 id={titleId} className="text-xl sm:text-2xl font-black text-neutral-900">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 text-xs sm:text-sm text-neutral-500 font-medium">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar diálogo"
            className="shrink-0 rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-900 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`block ${className}`}>
      <span className="block text-sm font-bold text-neutral-800 mb-1.5">{label}</span>
      <div className="[&_.form-control]:w-full [&_.form-control]:rounded-xl [&_.form-control]:border [&_.form-control]:border-neutral-200 [&_.form-control]:px-4 [&_.form-control]:py-3 [&_.form-control]:text-sm [&_.form-control]:font-normal [&_.form-control]:text-neutral-900 [&_.form-control]:outline-none [&_.form-control]:focus:border-amber-400 [&_.form-control]:focus:ring-2 [&_.form-control]:focus:ring-amber-100/60 transition">
        {children}
      </div>
    </div>
  );
}

function ModalActions({ onCancel, busy, submitLabel, destructive = false }: { onCancel: () => void; busy: boolean; submitLabel: string; destructive?: boolean }) {
  return <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-neutral-200 px-4 py-2.5 text-sm font-bold">Cancelar</button><button disabled={busy} className={`rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-60 ${destructive ? 'bg-red-600' : 'bg-neutral-950'}`}>{busy ? 'Processando...' : submitLabel}</button></div>;
}

function LoadMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return <div className="flex items-center justify-center gap-3 pt-2"><span className="text-xs font-semibold text-neutral-500">Exibindo {shown} de {total}</span><button type="button" onClick={onMore} className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-black">Mostrar mais</button></div>;
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof LayoutDashboard; label: string; value: number | string }) {
  return <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-amber-600" /><p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-2xl bg-neutral-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{label}</p><p className="mt-1 text-xl font-black">{value}</p></div>;
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-black">{title}</h2><div className="mt-4">{children}</div></div>;
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return <div><p className="text-sm font-black uppercase tracking-[0.18em] text-amber-600">Portal do anunciante</p><h1 className="mt-2 text-3xl font-black">{title}</h1><p className="mt-2 text-sm text-neutral-500">{description}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-12 text-center text-sm font-semibold text-neutral-400">{text}</div>;
}

function ActionList({ snapshot, onTab }: { snapshot: AdvertiserPortalSnapshot; onTab: (tab: PortalTab) => void }) {
  const actions: Array<{ text: string; tab: PortalTab }> = [];
  if (snapshot.proposals.some((item) => ['sent', 'negotiating', 'final_offer'].includes(item.status))) actions.push({ text: 'Responder proposta comercial', tab: 'proposals' });
  if (snapshot.campaigns.some((item) => item.payment && ['pending', 'processing', 'failed'].includes(item.payment.status))) actions.push({ text: 'Regularizar pagamento', tab: 'finance' });
  if (snapshot.campaigns.some((item) => item.creatives.length === 0 || item.creatives.some((creative) => creative.status === 'rejected'))) actions.push({ text: 'Enviar ou corrigir criativo', tab: 'creatives' });
  if (actions.length === 0) return <p className="text-sm text-neutral-500">Nenhuma pendência. Suas campanhas seguem o fluxo automático.</p>;
  return <div className="space-y-2">{actions.map((action) => <button key={action.text} type="button" onClick={() => onTab(action.tab)} className="flex w-full items-center justify-between rounded-xl bg-neutral-50 px-4 py-3 text-left text-sm font-bold hover:bg-neutral-100"><span>{action.text}</span><ArrowLeft className="h-4 w-4 rotate-180 text-neutral-400" /></button>)}</div>;
}

function ProposalCard({ proposal, busy, onAccept, onCounter, onReject, onViewDetails }: { key?: string; proposal: AdvertisingProposal; busy: boolean; onAccept: (proposal: AdvertisingProposal) => Promise<void>; onCounter: (proposal: AdvertisingProposal) => void; onReject: (proposal: AdvertisingProposal) => void; onViewDetails?: (proposal: AdvertisingProposal) => void }) {
  const versionObj = (proposal.version && typeof proposal.version === 'object') ? proposal.version : null;
  const versionNum = proposal.current_version || (typeof proposal.version === 'number' ? proposal.version : 1);
  const startsOn = versionObj?.starts_on || (proposal as any).starts_on;
  const endsOn = versionObj?.ends_on || (proposal as any).ends_on;
  const durationDays = versionObj?.duration_days ?? (proposal as any).duration_days ?? (
    startsOn && endsOn ? Math.max(1, Math.ceil((new Date(endsOn).getTime() - new Date(startsOn).getTime()) / (1000 * 60 * 60 * 24))) : undefined
  );
  const termsText = versionObj?.terms || (proposal as any).terms;
  const paymentCond = versionObj?.payment_condition || (proposal as any).payment_condition || (() => {
    const match = (termsText || '').match(/\[💳 Condição de Pagamento\]:\s*(.+)/);
    return match ? match[1].trim() : null;
  })();

  const actionable = ['sent', 'negotiating', 'final_offer'].includes(proposal.status);
  const counterAllowed = ['sent', 'negotiating'].includes(proposal.status);
  const expired = !!proposal.valid_until && new Date(proposal.valid_until).getTime() < Date.now();

  const lastNegotiation = proposal.negotiations && proposal.negotiations.length > 0
    ? proposal.negotiations[proposal.negotiations.length - 1]
    : null;
  const counterUnderReview = proposal.status === 'negotiating' || (lastNegotiation && lastNegotiation.actor_type === 'advertiser');

  return (
    <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col justify-between gap-4 sm:flex-row">
        <div>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">
            {counterUnderReview ? 'Contraproposta em Análise' : expired && actionable ? 'Expirada' : proposalLabels[proposal.status] || proposal.status}
          </span>
          <h2 className="mt-3 text-xl font-black">Proposta v{versionNum}</h2>
          <p className="mt-1 text-sm text-neutral-500">Válida até {date(proposal.valid_until)}</p>
        </div>
        <div className="rounded-2xl bg-neutral-950 px-5 py-4 text-white">
          <p className="text-xs uppercase tracking-wider text-white/45">Investimento</p>
          <p className="mt-1 text-2xl font-black text-amber-300">{money(proposal.total_amount)}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <MiniMetric label="Início" value={startsOn ? date(startsOn) : 'A definir'} />
        <MiniMetric label="Término" value={endsOn ? date(endsOn) : 'A definir'} />
        <MiniMetric label="Duração" value={durationDays ? `${durationDays} dias` : 'A definir'} />
      </div>

      {paymentCond && (
        <div className="mt-4 flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-900 border border-emerald-200/80">
          <WalletCards className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>Condição de Pagamento: <strong className="font-black text-emerald-950">{paymentCond}</strong></span>
        </div>
      )}

      {!!proposal.negotiations?.length && (
        <div className="mt-4 space-y-2 border-t border-neutral-100 pt-4">
          <p className="text-xs font-black uppercase tracking-wider text-neutral-400">Histórico da negociação</p>
          {proposal.negotiations.map((item) => (
            <div key={item.id} className="rounded-xl bg-neutral-50 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-bold">
                  {item.actor_type === 'advertiser' ? 'Você (Sua solicitação)' : 'Equipe GSA'}
                  {item.proposed_amount ? ` · ${money(item.proposed_amount)}` : ''}
                </p>
                <time className="text-xs text-neutral-400">{dateTime(item.created_at)}</time>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-neutral-500">{item.message}</p>
            </div>
          ))}
        </div>
      )}

      {counterUnderReview && (
        <div className="mt-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900 flex items-center gap-3">
          <Clock3 className="h-5 w-5 text-amber-600 shrink-0 animate-pulse" />
          <div>
            <p className="font-black text-sm text-amber-950">Contraproposta enviada e em análise</p>
            <p className="mt-0.5 text-amber-800 font-medium">
              Sua proposta no valor de {money(lastNegotiation?.proposed_amount || proposal.total_amount)} está em análise pela equipe GSA. Aguarde nosso retorno com a oferta revisada.
            </p>
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-3">
        {onViewDetails && (
          <button
            type="button"
            onClick={() => onViewDetails(proposal)}
            className="rounded-xl border border-neutral-900 bg-neutral-950 px-6 py-3 text-sm font-black text-white hover:bg-neutral-800 transition inline-flex items-center gap-2 shadow-sm"
          >
            <Eye className="h-4 w-4" /> Ver detalhes da proposta
          </button>
        )}
      </div>

      {expired && actionable && (
        <p className="mt-5 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-800">
          O prazo terminou. Solicite uma nova versão à equipe GSA.
        </p>
      )}
    </article>
  );
}

function ProposalDetailsModal({ proposal, onClose, onAccept, onCounter, onReject, busy }: {
  proposal: AdvertisingProposal;
  onClose: () => void;
  onAccept: (proposal: AdvertisingProposal) => Promise<void>;
  onCounter: (proposal: AdvertisingProposal) => void;
  onReject: (proposal: AdvertisingProposal) => void;
  busy: boolean;
}) {
  const versionObj = (proposal.version && typeof proposal.version === 'object') ? proposal.version : null;
  const versionNum = proposal.current_version || (typeof proposal.version === 'number' ? proposal.version : 1);
  const startsOn = versionObj?.starts_on || (proposal as any).starts_on;
  const endsOn = versionObj?.ends_on || (proposal as any).ends_on;
  const durationDays = versionObj?.duration_days ?? (proposal as any).duration_days ?? (
    startsOn && endsOn ? Math.max(1, Math.ceil((new Date(endsOn).getTime() - new Date(startsOn).getTime()) / (1000 * 60 * 60 * 24))) : undefined
  );
  const termsText = versionObj?.terms || (proposal as any).terms;
  const paymentCond = versionObj?.payment_condition || (proposal as any).payment_condition || (() => {
    const match = (termsText || '').match(/\[💳 Condição de Pagamento\]:\s*(.+)/);
    return match ? match[1].trim() : null;
  })();
  const formats = versionObj?.formats || (proposal as any).formats || [];
  const placementCodes = versionObj?.placement_codes || (proposal as any).placement_codes || [];
  const freqModel = versionObj?.frequency_model || (proposal as any).frequency_model || 'unlimited';
  const freqVal = versionObj?.frequency_value ?? (proposal as any).frequency_value;

  const actionable = ['sent', 'negotiating', 'final_offer'].includes(proposal.status);
  const counterAllowed = ['sent', 'negotiating'].includes(proposal.status);
  const expired = !!proposal.valid_until && new Date(proposal.valid_until).getTime() < Date.now();

  const lastNegotiation = proposal.negotiations && proposal.negotiations.length > 0
    ? proposal.negotiations[proposal.negotiations.length - 1]
    : null;
  const counterUnderReview = proposal.status === 'negotiating' || (lastNegotiation && lastNegotiation.actor_type === 'advertiser');

  const freqLabels: Record<string, string> = {
    unlimited: 'Exibição Ilimitada (sem restrição por usuário)',
    once_per_session: '1 exibição por sessão',
    once_per_day: '1 exibição por dia por usuário',
    interval_hours: `Intervalo de ${freqVal || 1} hora(s) por exibição`,
    daily_limit: `Limite de ${freqVal || 1} exibições diárias`,
  };

  const formatLabels: Record<string, string> = {
    responsive_banner: 'Banner Responsivo (Desktop & Mobile)',
    hero: 'Destaque Hero Topo de Página',
    sidebar: 'Banner Lateral / Barra Lateral',
    interstitial: 'Vídeo Interstitial de Tela Cheia',
    native: 'Anúncio Nativo / Conteúdo Integrado',
  };

  const pageLabels: Record<string, string> = {
    HOME_BANNER_TOP: 'Página Inicial — Banner Topo Principal',
    CLIENT_FINANCE_SIDEBAR: 'Painel do Cliente — Módulo Financeiro',
    CLIENT_STORE_HEADER: 'GSA Store — Topo da Loja',
    PUBLIC_FOOTER_AD: 'Rodapé do Site Institucional',
  };

  return (
    <AccessibleModal title={`Detalhamento Completo da Proposta v${versionNum}`} description={`Ref. Proposta #${proposal.id.slice(0, 8)}`} onClose={onClose}>
      <div className="space-y-6">
        {/* Card de Topo */}
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-neutral-950 p-5 text-white sm:flex-row sm:items-center">
          <div>
            <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-black text-amber-300">
              {expired && actionable ? 'Expirada' : proposalLabels[proposal.status] || proposal.status}
            </span>
            <h3 className="mt-2 text-2xl font-black text-white">Proposta v{versionNum}</h3>
            <p className="mt-1 text-xs text-neutral-400">Validade da Proposta: {date(proposal.valid_until)}</p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs uppercase tracking-wider text-neutral-400">Investimento Total</p>
            <p className="text-3xl font-black text-amber-400">{money(proposal.total_amount)}</p>
          </div>
        </div>

        {/* Métricas e Período */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-bold uppercase text-neutral-500">Início Escolhido</p>
            <p className="mt-1 text-lg font-black text-neutral-900">{startsOn ? date(startsOn) : 'A definir'}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-bold uppercase text-neutral-500">Término Previsto</p>
            <p className="mt-1 text-lg font-black text-neutral-900">{endsOn ? date(endsOn) : 'A definir'}</p>
          </div>
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
            <p className="text-xs font-bold uppercase text-neutral-500">Duração Total</p>
            <p className="mt-1 text-lg font-black text-amber-600">{durationDays ? `${durationDays} dias` : 'A definir'}</p>
          </div>
        </div>

        {/* Condição de Pagamento Proposta */}
        {paymentCond && (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50/80 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Condição de Pagamento Proposta</p>
            <p className="mt-1 text-base font-black text-emerald-950 flex items-center gap-2">
              <WalletCards className="h-5 w-5 text-emerald-600 shrink-0" />
              {paymentCond}
            </p>
          </div>
        )}

        {/* Formatos e Posições */}
        <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5">
          <h4 className="text-xs font-black uppercase tracking-wider text-amber-600">Formatos e Locais de Exibição Contratados</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-bold text-neutral-500 mb-2">Formatos da Mídia</p>
              <div className="flex flex-wrap gap-2">
                {(formats.length > 0 ? formats : ['responsive_banner']).map((fmt: string) => (
                  <span key={fmt} className="rounded-xl bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 border border-amber-200">
                    {formatLabels[fmt] || fmt}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-bold text-neutral-500 mb-2">Posicionamento / Páginas</p>
              <div className="flex flex-wrap gap-2">
                {(placementCodes.length > 0 ? placementCodes : ['HOME_BANNER_TOP']).map((pos: string) => (
                  <span key={pos} className="rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-900 border border-blue-200">
                    {pageLabels[pos] || pos}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-neutral-100">
            <p className="text-xs font-bold text-neutral-500">Regra de Frequência</p>
            <p className="mt-1 text-xs font-bold text-neutral-800">{freqLabels[freqModel] || freqModel}</p>
          </div>
        </div>

        {/* Termos e Condições */}
        {termsText && (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-500 mb-2">Termos e Condições da Proposta</h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">{termsText}</p>
          </div>
        )}

        {/* Histórico */}
        {!!proposal.negotiations?.length && (
          <div className="space-y-3 rounded-2xl border border-neutral-200 bg-white p-5">
            <h4 className="text-xs font-black uppercase tracking-wider text-neutral-400">Histórico de Alterações e Contrapropostas</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {proposal.negotiations.map((item) => (
                <div key={item.id} className="rounded-xl bg-neutral-50 p-3 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="font-bold text-neutral-900">
                      {item.actor_type === 'advertiser' ? 'Sua solicitação' : 'Equipe GSA'}
                      {item.proposed_amount ? ` · R$ ${item.proposed_amount}` : ''}
                    </span>
                    <span className="text-xs text-neutral-400">{dateTime(item.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-600">{item.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rodapé de Ações */}
        {counterUnderReview ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-xs font-bold text-amber-900 flex items-center gap-3 mt-4">
            <Clock3 className="h-5 w-5 text-amber-600 shrink-0 animate-pulse" />
            <div>
              <p className="font-black text-sm text-amber-950">Contraproposta em análise pela equipe GSA</p>
              <p className="mt-0.5 text-amber-800 font-medium">
                Você enviou uma contraproposta no valor de {money(lastNegotiation?.proposed_amount || proposal.total_amount)}. Os botões de aceite e contraproposta ficam desativados temporariamente até o envio da nova oferta comercial pela equipe GSA.
              </p>
            </div>
          </div>
        ) : (
          actionable && !expired && (
            <div className="flex flex-wrap items-center justify-end gap-3 pt-4 border-t border-neutral-100">
              <button
                type="button"
                disabled={busy}
                onClick={() => { onClose(); void onAccept(proposal); }}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-black text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
              >
                <CheckCircle2 className="inline h-4 w-4 mr-1" /> Aceitar esta Proposta
              </button>
              {counterAllowed && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { onClose(); onCounter(proposal); }}
                  className="rounded-xl border border-neutral-200 px-5 py-3 text-sm font-black hover:bg-neutral-50"
                >
                  Enviar Contraproposta
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => { onClose(); onReject(proposal); }}
                className="rounded-xl border border-red-200 px-5 py-3 text-sm font-black text-red-700 hover:bg-red-50"
              >
                Recusar
              </button>
            </div>
          )
        )}
      </div>
    </AccessibleModal>
  );
}

function CampaignCard({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {
  const totals = (campaign.metrics || []).reduce((acc, row) => ({ served: acc.served + Number(row.served || 0), clicks: acc.clicks + Number(row.clicks || 0) }), { served: 0, clicks: 0 });
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-black text-neutral-700">{campaignLabels[campaign.status] || campaign.status}</span><h2 className="mt-3 text-xl font-black">{campaign.name}</h2></div><Megaphone className="h-6 w-6 text-amber-600" /></div><div className="mt-5 grid grid-cols-2 gap-3"><MiniMetric label="Início" value={date(campaign.starts_at)} /><MiniMetric label="Término" value={date(campaign.ends_at)} /><MiniMetric label="Entregues" value={totals.served} /><MiniMetric label="Cliques" value={totals.clicks} /></div><p className="mt-4 text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.creatives.length} criativo(s)</p></article>;
}

function useCreativeAssetUrl(creative: AdvertisingCreative) {
  const [url, setUrl] = useState<string | null>(() => safeHttpsUrl(creative.asset_url));
  useEffect(() => {
    let active = true;
    const supplied = safeHttpsUrl(creative.asset_url);
    if (supplied) { setUrl(supplied); return () => { active = false; }; }
    if (!creative.storage_path || creative.kind === 'text') { setUrl(null); return () => { active = false; }; }
    void supabase.storage.from('gsa-ad-creatives').createSignedUrl(creative.storage_path, 600).then(({ data }) => { if (active) setUrl(safeHttpsUrl(data?.signedUrl)); });
    return () => { active = false; };
  }, [creative.asset_url, creative.kind, creative.storage_path]);
  return url;
}

function CreativeRow({ campaign, creative, busy, onEdit }: { key?: string; campaign: AdvertisingCampaign; creative: AdvertisingCreative; busy: boolean; onEdit: (creative: AdvertisingCreative) => void }) {
  const assetUrl = useCreativeAssetUrl(creative);
  return <article className="rounded-2xl border border-neutral-200 bg-white p-5"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><p className="mt-1 break-words font-black">{creative.headline || creative.storage_path || 'Criativo textual'}</p><p className="mt-1 text-sm text-neutral-500">Status: {creative.status}</p>{creative.rejection_reason && <p className="mt-2 text-sm font-semibold text-red-600">Motivo: {creative.rejection_reason}</p>}</div>{['draft', 'rejected'].includes(creative.status) && <button type="button" disabled={busy} onClick={() => onEdit(creative)} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-black text-white disabled:opacity-60"><Pencil className="h-4 w-4" /> Editar e enviar</button>}</div><div className="mt-4 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-950">{creative.kind === 'image' && assetUrl && <img src={assetUrl} alt={creative.alt_text || creative.headline || 'Criativo enviado'} className="max-h-80 w-full object-contain" />}{creative.kind === 'video' && assetUrl && <video src={assetUrl} controls preload="metadata" className="max-h-80 w-full" aria-label={creative.alt_text || creative.headline || 'Criativo enviado em vídeo'} />}{creative.kind === 'text' && <div className="bg-white p-5"><p className="text-lg font-black">{creative.headline || 'Sem título'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{creative.body}</p></div>}{creative.kind !== 'text' && !assetUrl && <div className="p-8 text-center text-sm font-semibold text-white/60">Carregando prévia...</div>}</div>{safeHttpsUrl(creative.target_url) && <a href={safeHttpsUrl(creative.target_url)!} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 break-all text-xs font-bold text-blue-700 underline"><ExternalLink className="h-3.5 w-3.5 shrink-0" /> {creative.target_url}</a>}</article>;
}

function DraftCreativePreview({ file, objectUrl, headline, body, alt, target }: { file: File | null; objectUrl: string | null; headline: string; body: string; alt: string; target: string }) {
  const targetUrl = safeHttpsUrl(target);
  return <div className="overflow-hidden rounded-2xl border border-neutral-200"><div className="bg-neutral-950">{file && objectUrl && ALLOWED_IMAGE_TYPES.has(file.type) && <img src={objectUrl} alt={alt || 'Prévia sem descrição'} className="max-h-96 w-full object-contain" />}{file && objectUrl && ALLOWED_VIDEO_TYPES.has(file.type) && <video src={objectUrl} controls muted preload="metadata" className="max-h-96 w-full" aria-label={alt || 'Prévia do vídeo'} />}{!file && <div className="bg-white p-5"><p className="text-lg font-black">{headline || 'Título do anúncio'}</p><p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600">{body || 'Texto do anúncio'}</p></div>}</div><div className="bg-neutral-50 p-4 text-xs"><p><span className="font-black">Descrição:</span> {alt || 'Não informada'}</p><p className={`mt-2 break-all ${target && !targetUrl ? 'font-bold text-red-600' : ''}`}><span className="font-black">Destino:</span> {targetUrl || (target ? 'URL inválida; use HTTPS' : 'Sem URL')}</p></div></div>;
}

function PaymentCard({ campaign }: { key?: string; campaign: AdvertisingCampaign }) {
  const payment = campaign.payment!;
  const checkoutUrl = safeHttpsUrl(payment.checkout_url);
  return <article className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">{campaign.name}</p><h2 className="mt-2 text-2xl font-black">{money(payment.amount)}</h2><p className="mt-1 text-sm text-neutral-500">Status: {paymentLabels[payment.status]} · vencimento {date(payment.due_at)}</p></div><CircleDollarSign className={`h-9 w-9 ${payment.status === 'paid' ? 'text-emerald-600' : payment.status === 'failed' ? 'text-red-600' : 'text-amber-600'}`} /></div>{checkoutUrl && ['pending', 'processing', 'failed'].includes(payment.status) && <a href={checkoutUrl} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-black text-white">Abrir pagamento <ExternalLink className="h-4 w-4" /></a>}{payment.pix_code && ['pending', 'processing', 'failed'].includes(payment.status) && <div className="mt-4 rounded-xl bg-neutral-50 p-4"><p className="text-xs font-bold uppercase tracking-wider text-neutral-400">PIX copia e cola</p><code className="mt-2 block break-all text-xs">{payment.pix_code}</code></div>}{!checkoutUrl && !payment.pix_code && ['pending', 'processing', 'failed'].includes(payment.status) && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-800">A equipe GSA enviará as instruções de pagamento e registrará a confirmação neste portal.</p>}{payment.status === 'failed' && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">O pagamento não foi concluído. Use as instruções acima ou fale com a equipe GSA.</p>}{payment.status === 'paid' && <p className="mt-4 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">Pagamento confirmado em {date(payment.paid_at)}.</p>}{payment.status === 'refunded' && <p className="mt-4 rounded-xl bg-neutral-100 p-4 text-sm font-semibold text-neutral-700">Pagamento estornado. A campanha não será veiculada.</p>}{payment.status === 'cancelled' && <p className="mt-4 rounded-xl bg-neutral-100 p-4 text-sm font-semibold text-neutral-700">Cobrança cancelada.</p>}</article>;
}
