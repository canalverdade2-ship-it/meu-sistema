from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_exact(path: str, old: str, new: str, expected: int = 1) -> None:
    content = read(path)
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: esperado {expected} trecho(s), encontrado(s) {count}: {old[:90]!r}")
    write(path, content.replace(old, new, expected))


def replace_regex(path: str, pattern: str, replacement: str, expected: int = 1) -> None:
    content = read(path)
    updated, count = re.subn(pattern, lambda _: replacement, content, flags=re.S)
    if count != expected:
        raise RuntimeError(f"{path}: regex esperava {expected} ocorrência(s), encontrou {count}: {pattern[:100]}")
    write(path, updated)


def assert_absent(path: str, values: list[str]) -> None:
    content = read(path)
    present = [value for value in values if value in content]
    if present:
        raise RuntimeError(f"{path}: referências operacionais locais ainda presentes: {present}")


# 1) Formulário público: somente confirma quando a Edge Function persistir no banco oficial.
PUBLIC_PAGE = "src/components/public/AdvertisingPage.tsx"
replace_regex(
    PUBLIC_PAGE,
    r"\nfunction saveLocalRequest\(protocolCode: string, payload: any\) \{.*?\n\}\n\ninterface AdvertisingPageProps",
    "\ninterface AdvertisingPageProps",
)
replace_exact(PUBLIC_PAGE, "      saveLocalRequest(data.protocol, payloadBody);\n", "")
replace_regex(
    PUBLIC_PAGE,
    r"\n\s*// Se falhar o envio pela Edge Function, gerar protocolo local de contingência para não perder o lead do anunciante.*?\n\s*return;",
    "\n      toast.error(errorMsg);",
)
assert_absent(PUBLIC_PAGE, ["gsa_adv_requests_store", "anunciantes_solicitacoes", "fallbackProtocol", "saveLocalRequest("])


# 2) Painel administrativo: banco oficial como fonte única da verdade.
ADMIN_PAGE = "src/components/admin/AdvertisingAdminModule.tsx"
admin_load = """  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_advertising_overview');
      if (error) throw error;
      const parsedOverview = (data || EMPTY_OVERVIEW) as AdvertisingAdminOverview;
      setOverview({
        requests: parsedOverview.requests || [],
        proposals: parsedOverview.proposals || [],
        campaigns: parsedOverview.campaigns || [],
        placements: parsedOverview.placements || [],
      });
    } catch (error) {
      console.error('Falha ao carregar operação de anúncios:', error);
      setOverview(EMPTY_OVERVIEW);
      toast.error(messageFromError(error, 'Não foi possível carregar o módulo de anúncios.'));
    } finally {
      setLoading(false);
    }
  }, []);"""
replace_regex(ADMIN_PAGE, r"  const load = useCallback\(async \(\) => \{.*?\n  \}, \[\]\);", admin_load)

admin_update_status = """  const updateStatus = async (requestId: string, nextStatus: AdvertisingRequestStatus) => {
    setActionId(requestId);
    try {
      const { data, error } = await supabase.rpc('gsa_admin_update_ad_request_status', {
        p_request_id: requestId,
        p_status: nextStatus,
      });
      if (error || data?.success === false) {
        throw error || new Error('A atualização foi recusada pelo servidor.');
      }
      await load();
      toast.success(`Solicitação atualizada para "${REQUEST_LABELS[nextStatus]}".`);
    } catch (error) {
      console.error('Falha ao atualizar solicitação:', error);
      toast.error(messageFromError(error, 'Não foi possível atualizar a solicitação. Tente novamente.'));
    } finally {
      setActionId(null);
    }
  };

  const openProposal"""
replace_regex(
    ADMIN_PAGE,
    r"  const updateStatus = async \(requestId: string, nextStatus: AdvertisingRequestStatus\) => \{.*?\n  \};\n\n  const openProposal",
    admin_update_status,
)

admin_create_proposal = """  const createProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!proposalRequest) return;
    const numericAmount = unmaskCurrency(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      toast.error('Informe um valor de proposta válido.');
      return;
    }
    if (endsOn < startsOn) {
      toast.error('A data de término não pode ser anterior ao início.');
      return;
    }
    setActionId(proposalRequest.id);
    let finalTerms = terms.trim();

    const selectedPaymentCond = paymentCondition === 'outros'
      ? (customPaymentCondition.trim() || 'A combinar')
      : paymentCondition;

    if (!finalTerms.includes('[💳 Condição de Pagamento]')) {
      finalTerms = `[💳 Condição de Pagamento]: ${selectedPaymentCond}\n\n${finalTerms}`;
    }

    if (proposalRequest.needs_creative_service) {
      const feeNum = unmaskCurrency(creativeServiceFee);
      const feeText = feeNum > 0 ? `Taxa adicional de arte: R$ ${creativeServiceFee}` : 'Criação de arte inclusa no valor total da proposta';
      const daysText = creativeProductionDays ? `Prazo de produção da arte: ${creativeProductionDays} dia(s) útil(eis)` : '';
      const briefingText = creativeBriefing.trim() ? `Detalhes: ${creativeBriefing.trim()}` : '';
      const creativeSummary = `[🎨 Serviço de Criação GSA]: ${feeText}. ${daysText}. ${briefingText}`.trim();
      if (!finalTerms.includes('[🎨 Serviço de Criação GSA]')) {
        finalTerms = `${finalTerms}\n\n${creativeSummary}`;
      }
    }

    try {
      const { data, error } = await supabase.rpc('gsa_admin_create_ad_proposal', {
        p_request_id: proposalRequest.id,
        p_payload: {
          amount: numericAmount,
          starts_on: startsOn,
          ends_on: endsOn,
          valid_until: `${validUntil}T23:59:59-03:00`,
          formats: proposalRequest.desired_formats,
          placement_codes: proposalRequest.desired_pages,
          frequency_model: frequencyModel,
          frequency_value: frequencyModel === 'unlimited' ? null : Number(frequencyValue || 1),
          impression_limit: impressionLimit ? Number(impressionLimit) : null,
          terms: finalTerms,
          payment_condition: selectedPaymentCond,
          final_offer: finalOffer,
        },
      });
      if (error || !data?.success) {
        throw error || new Error('A proposta não foi gravada no servidor.');
      }

      const createdVersion = Number(data.version || 1);
      const invited = await inviteAdvertiser(proposalRequest.id, true);
      toast.success(invited
        ? `Proposta v${createdVersion} criada e liberada no portal.`
        : `Proposta v${createdVersion} criada. O convite do portal precisa ser reenviado.`);
      setProposalRequest(null);
      setTab('proposals');
      await load();
    } catch (error) {
      console.error('Falha ao criar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível criar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const reviewCreative"""
replace_regex(
    ADMIN_PAGE,
    r"  const createProposal = async \(event: FormEvent\) => \{.*?\n  \};\n\n  const reviewCreative",
    admin_create_proposal,
)
replace_exact(ADMIN_PAGE, "  scheduled: 'Agendada',\n", "  scheduled: 'Agendada',\n  payment_overdue: 'Pagamento vencido',\n")
replace_exact(ADMIN_PAGE, "  failed: 'Falhou',\n", "  failed: 'Falhou',\n  overdue: 'Vencido',\n")
assert_absent(
    ADMIN_PAGE,
    ["anunciantes_solicitacoes", "gsa_adv_requests_store", "gsa_adv_proposals_store", "gsa_adv_campaigns_store", "gsa_advertiser_session"],
)


# 3) Portal do anunciante: operações reais, acesso seguro por protocolo e perfil persistido.
PORTAL_PAGE = "src/pages/AdvertiserPortal.tsx"
replace_exact(PORTAL_PAGE, "  AdvertisingCampaign,\n", "")
replace_exact(PORTAL_PAGE, "  scheduled: 'Agendada',\n", "  scheduled: 'Agendada',\n  payment_overdue: 'Pagamento vencido',\n")
replace_exact(PORTAL_PAGE, "  failed: 'Falhou',\n", "  failed: 'Falhou',\n  overdue: 'Vencido',\n")

portal_load = """  const load = useCallback(async (silent = false) => {
    if (!silent) setChecking(true);
    else setRefreshing(true);
    try {
      const realSnapshot = await advertiserAccess.getSnapshot();
      setSnapshot(realSnapshot);
    } catch (error) {
      console.error('Falha ao carregar portal do anunciante:', error);
      setSnapshot(null);
      toast.error('Não foi possível carregar o portal do anunciante.');
    } finally {
      setChecking(false);
      setRefreshing(false);
    }
  }, []);"""
replace_regex(PORTAL_PAGE, r"  const load = useCallback\(async \(silent = false\) => \{.*?\n  \}, \[\]\);", portal_load)

portal_effect = """  useEffect(() => {
    void load();
    const interval = window.setInterval(() => { void load(true); }, 15_000);
    const { data } = supabase.auth.onAuthStateChange(() => { void load(true); });
    return () => {
      window.clearInterval(interval);
      data.subscription.unsubscribe();
    };
  }, [load]);"""
replace_regex(
    PORTAL_PAGE,
    r"  useEffect\(\(\) => \{\n    void load\(\);\n    const handleStorageChange.*?\n  \}, \[load\]\);",
    portal_effect,
)
replace_exact(
    PORTAL_PAGE,
    "      setRegCompany(snapshot.advertiser.company_name || '');\n      setRegDocument(snapshot.advertiser.document || '');\n      setRegContactName(snapshot.advertiser.contact_name || '');\n      setRegContactEmail(snapshot.advertiser.contact_email || '');\n      setRegContactPhone(snapshot.advertiser.contact_phone || '');",
    "      setRegCompany(snapshot.advertiser.company_name || snapshot.advertiser.legal_name || '');\n      setRegDocument(snapshot.advertiser.document || '');\n      setRegContactName(snapshot.advertiser.contact_name || snapshot.advertiser.responsible_name || '');\n      setRegContactEmail(snapshot.advertiser.contact_email || snapshot.advertiser.responsible_email || '');\n      setRegContactPhone(snapshot.advertiser.contact_phone || snapshot.advertiser.responsible_phone || '');",
)

portal_profile = """  const handleSaveProfile = async (e: FormEvent) => {
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

    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_update_profile', {
        p_payload: {
          company_name: regCompany.trim(),
          document: regDocument.trim(),
          contact_name: regContactName.trim(),
          contact_email: regContactEmail.trim().toLowerCase(),
          contact_phone: phone,
        },
      });
      if (error || data?.success === false) {
        throw error || new Error('A atualização do perfil foi recusada.');
      }
      await load(true);
      toast.success('Alterações do perfil salvas com sucesso!');
    } catch (error) {
      console.error('Falha ao salvar perfil do anunciante:', error);
      toast.error(messageFromError(error, 'Não foi possível salvar as alterações do perfil.'));
    }
  };

  const handleValidateProtocol"""
replace_regex(
    PORTAL_PAGE,
    r"  const handleSaveProfile = \(e: FormEvent\) => \{.*?\n  \};\n\n  const handleValidateProtocol",
    portal_profile,
)

portal_validate = """  const handleValidateProtocol = async (protoToTest?: string) => {
    const targetProto = (protoToTest || protocolInput).trim().toUpperCase();
    if (!targetProto || targetProto.length < 8) {
      toast.error('Informe um número de protocolo válido.');
      return;
    }

    setValidatingProtocol(true);
    setProtocolValidated(false);
    try {
      const { data, error } = await supabase.functions.invoke('gsa-advertiser-access', {
        body: { action: 'validate', protocol: targetProto },
      });
      const response = data as { success?: boolean; request?: Record<string, string> } | null;
      if (error || !response?.success || !response.request) {
        throw error || new Error('Protocolo não encontrado ou indisponível.');
      }

      const lead = response.request;
      setProtocolInput(targetProto);
      setRegCompany(String(lead.company_name || ''));
      setRegDocument(String(lead.document || ''));
      setRegContactName(String(lead.contact_name || ''));
      setRegContactEmail(String(lead.contact_email || ''));
      setRegContactPhone(String(lead.contact_phone || ''));
      setProtocolValidated(true);
      toast.success(`Protocolo ${targetProto} validado com sucesso! Complete seu cadastro.`);
    } catch (error) {
      console.error('Falha ao validar protocolo:', error);
      setProtocolValidated(false);
      toast.error(messageFromError(error, 'Protocolo não encontrado ou não autorizado.'));
    } finally {
      setValidatingProtocol(false);
    }
  };

  // Auto-validar protocolo se veio preenchido na URL"""
replace_regex(
    PORTAL_PAGE,
    r"  const handleValidateProtocol = async \(protoToTest\?: string\) => \{.*?\n  \};\n\n  // Auto-validar protocolo se veio preenchido na URL",
    portal_validate,
)

portal_registration = """  const handleCompleteRegistration = async (e: FormEvent) => {
    e.preventDefault();
    if (!protocolValidated) {
      toast.error('Valide o protocolo antes de concluir o cadastro.');
      return;
    }
    if (!regPassword || regPassword.length < 8) {
      toast.error('Crie uma senha de acesso com no mínimo 8 caracteres.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    setRegistering(true);
    try {
      const emailToUse = regContactEmail.trim().toLowerCase();
      const { data, error } = await supabase.functions.invoke('gsa-advertiser-access', {
        body: {
          action: 'register',
          protocol: protocolInput.trim().toUpperCase(),
          document: regDocument,
          email: emailToUse,
          password: regPassword,
        },
      });
      const response = data as { success?: boolean; account_exists?: boolean } | null;
      if (error || !response?.success) {
        throw error || new Error('Não foi possível concluir o cadastro.');
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: regPassword,
      });
      if (signInError) {
        if (response.account_exists) {
          await advertiserAccess.requestMagicLink(emailToUse);
          setAccessMode('magic_link');
          setEmail(emailToUse);
          setLinkSent(true);
          toast.success('Esta conta já existia. Enviamos um link seguro de acesso para o e-mail cadastrado.');
          return;
        }
        throw signInError;
      }

      toast.success('Cadastro concluído com sucesso! Seja bem-vindo ao seu painel.');
      await load(true);
    } catch (error) {
      console.error('Erro no cadastro do anunciante:', error);
      toast.error(translateAuthError(error, 'Não foi possível concluir o cadastro. Verifique os dados informados.'));
    } finally {
      setRegistering(false);
    }
  };

  const sendMagicLink"""
replace_regex(
    PORTAL_PAGE,
    r"  const handleCompleteRegistration = async \(e: FormEvent\) => \{.*?\n  \};\n\n  const sendMagicLink",
    portal_registration,
)
replace_exact(PORTAL_PAGE, "    localStorage.removeItem('gsa_advertiser_session');\n", "")

portal_accept = """  const acceptProposal = async (proposal: AdvertisingProposal) => {
    if (!['sent', 'negotiating', 'final_offer'].includes(proposal.status)) return;
    if (proposal.valid_until && new Date(proposal.valid_until).getTime() < Date.now()) {
      toast.error('Esta proposta expirou. Solicite uma nova versão à equipe GSA.');
      return;
    }
    setActionId(proposal.id);
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_accept_proposal', {
        p_proposal_id: proposal.id,
      });
      if (error || !data?.success) {
        throw error || new Error(data?.error || 'A proposta não pôde ser aceita.');
      }
      toast.success('Proposta aceita. A campanha foi criada no sistema.');
      setTab('finance');
      await load(true);
    } catch (error) {
      console.error('Falha ao aceitar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível aceitar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const sendCounter"""
replace_regex(
    PORTAL_PAGE,
    r"  const acceptProposal = async \(proposal: AdvertisingProposal\) => \{.*?\n  \};\n\n  const sendCounter",
    portal_accept,
)

portal_counter = """  const sendCounter = async (event: FormEvent) => {
    event.preventDefault();
    if (!counterProposal || !['sent', 'negotiating'].includes(counterProposal.status)) return;
    const proposedAmount = Number(counterAmount);
    if (!Number.isFinite(proposedAmount) || proposedAmount <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }
    if (counterMessage.trim().length < 3) {
      toast.error('Informe uma mensagem para a contraproposta.');
      return;
    }
    setActionId(counterProposal.id);
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_counter_proposal', {
        p_proposal_id: counterProposal.id,
        p_amount: proposedAmount,
        p_message: counterMessage.trim(),
      });
      if (error || !data?.success) {
        throw error || new Error('A contraproposta não foi gravada.');
      }
      toast.success('Contraproposta enviada para a equipe GSA.');
      setCounterProposal(null);
      setCounterAmount('');
      setCounterMessage('');
      await load(true);
    } catch (error) {
      console.error('Falha ao enviar contraproposta:', error);
      toast.error(messageFromError(error, 'Não foi possível enviar a contraproposta.'));
    } finally {
      setActionId(null);
    }
  };

  const rejectCurrentProposal"""
replace_regex(
    PORTAL_PAGE,
    r"  const sendCounter = async \(event: FormEvent\) => \{.*?\n  \};\n\n  const rejectCurrentProposal",
    portal_counter,
)

portal_reject = """  const rejectCurrentProposal = async (event: FormEvent) => {
    event.preventDefault();
    if (!rejectProposal || !['sent', 'negotiating', 'final_offer'].includes(rejectProposal.status)) return;
    setActionId(rejectProposal.id);
    try {
      const { data, error } = await supabase.rpc('gsa_advertiser_reject_proposal', {
        p_proposal_id: rejectProposal.id,
        p_message: rejectMessage.trim() || null,
      });
      if (error || data?.success === false) {
        throw error || new Error(data?.error || 'A recusa não foi gravada.');
      }
      toast.success('Proposta recusada.');
      setRejectProposal(null);
      setRejectMessage('');
      await load(true);
    } catch (error) {
      console.error('Falha ao recusar proposta:', error);
      toast.error(messageFromError(error, 'Não foi possível recusar a proposta.'));
    } finally {
      setActionId(null);
    }
  };

  const resetCreativeForm"""
replace_regex(
    PORTAL_PAGE,
    r"  const rejectCurrentProposal = async \(event: FormEvent\) => \{.*?\n  \};\n\n  const resetCreativeForm",
    portal_reject,
)
assert_absent(
    PORTAL_PAGE,
    ["anunciantes_solicitacoes", "gsa_advertiser_session", "gsa_adv_requests_store", "gsa_adv_proposals_store", "gsa_adv_campaigns_store"],
)


# 4) Tipos compartilhados alinhados com o banco endurecido.
TYPES = "src/types/advertising.ts"
replace_exact(
    TYPES,
    "  | 'payment_pending'\n  | 'creative_review'",
    "  | 'payment_pending'\n  | 'payment_overdue'\n  | 'creative_review'",
)
replace_exact(
    TYPES,
    "export type AdvertisingPaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'cancelled';",
    "export type AdvertisingPaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'overdue' | 'refunded' | 'cancelled';",
)


# 5) Configuração da nova função pública protegida por validação, rate limit e banco canônico.
CONFIG = "supabase/config.toml"
replace_exact(
    CONFIG,
    "[functions.gsa-ad-delivery]\nenabled = true\nverify_jwt = false\n",
    "[functions.gsa-ad-delivery]\nenabled = true\nverify_jwt = false\n\n[functions.gsa-advertiser-access]\nenabled = true\nverify_jwt = false\n",
)

EDGE_FUNCTION = r'''import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';

type JsonRecord = Record<string, unknown>;
const MAX_BODY_BYTES = 8_000;
const DEFAULT_ALLOWED_ORIGINS = [
  'https://grupo-gsa.com.br',
  'https://www.grupo-gsa.com.br',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function configuredOrigins() {
  return (Deno.env.get('ALLOWED_ORIGINS') || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null) {
  const allowed = origin && configuredOrigins().includes(origin) ? origin : '';
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '86400',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    vary: 'Origin',
  };
}

function json(status: number, body: JsonRecord, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

async function digest(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function readJson(request: Request) {
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) throw new RangeError('payload_too_large');
  const value = JSON.parse(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SyntaxError('invalid_json');
  return value as JsonRecord;
}

function normalizeProtocol(value: unknown) {
  const protocol = String(value || '').trim().toUpperCase();
  return /^[A-Z]{3}-[A-Z0-9-]{8,40}$/.test(protocol) ? protocol : null;
}

function normalizeEmail(value: unknown) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length <= 254 ? email : null;
}

function normalizeDocument(value: unknown) {
  const document = String(value || '').replace(/\D/g, '');
  return document.length === 11 || document.length === 14 ? document : null;
}

async function findUserByEmail(admin: any, email: string) {
  for (let page = 1; page <= 100; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data?.users?.find((user: any) => String(user.email || '').toLowerCase() === email);
    if (match) return match;
    if ((data?.users?.length || 0) < 200) break;
  }
  return null;
}

export async function handleRequest(request: Request) {
  const origin = request.headers.get('origin');
  if (origin && !configuredOrigins().includes(origin)) return json(403, { error: 'origin_not_allowed' }, origin);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' }, origin);
  if (!(request.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return json(415, { error: 'unsupported_media_type' }, origin);
  }

  let body: JsonRecord;
  try {
    body = await readJson(request);
  } catch (error) {
    return json(error instanceof RangeError ? 413 : 400, { error: error instanceof RangeError ? 'payload_too_large' : 'invalid_json' }, origin);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return json(503, { error: 'server_not_configured' }, origin);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } }) as any;

  const action = String(body.action || '').trim();
  const protocol = normalizeProtocol(body.protocol);
  if (!protocol || !['validate', 'register'].includes(action)) return json(400, { error: 'invalid_request' }, origin);

  const ipHash = await digest(clientIp(request));
  const { data: rateLimit, error: rateError } = await admin.rpc('gsa_auth_rate_limit_check', {
    p_bucket_key: `ads:advertiser-access:${action}:${ipHash}`,
    p_limit: action === 'validate' ? 20 : 8,
    p_window_seconds: 3600,
    p_block_seconds: 7200,
  });
  if (rateError) return json(503, { error: 'rate_limit_unavailable' }, origin);
  if (rateLimit?.allowed === false) {
    const retryAfter = Number(rateLimit.retry_after || 3600);
    return json(429, { error: 'too_many_attempts', retry_after: retryAfter }, origin);
  }

  const { data: validation, error: validationError } = await admin.rpc('gsa_public_validate_advertising_protocol', {
    p_protocol: protocol,
  });
  if (validationError) {
    console.error('Protocol validation failed', validationError);
    return json(500, { error: 'validation_failed' }, origin);
  }
  if (!validation?.success || !validation?.request) return json(404, { error: 'protocol_not_found' }, origin);

  if (action === 'validate') {
    return json(200, { success: true, request: validation.request }, origin);
  }

  const email = normalizeEmail(body.email);
  const document = normalizeDocument(body.document);
  const password = String(body.password || '');
  if (!email || !document || password.length < 8 || password.length > 128) {
    return json(400, { error: 'invalid_registration' }, origin);
  }
  if (email !== String(validation.request.contact_email || '').toLowerCase()
      || document !== String(validation.request.document || '').replace(/\D/g, '')) {
    return json(403, { error: 'registration_data_mismatch' }, origin);
  }

  let user = await findUserByEmail(admin, email);
  const accountExists = Boolean(user);
  if (!user) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { gsa_role: 'advertiser', protocol },
    });
    if (createError || !created?.user) {
      console.error('Advertiser user creation failed', createError);
      return json(502, { error: 'account_creation_failed' }, origin);
    }
    user = created.user;
  }

  const { data: claimed, error: claimError } = await admin.rpc('gsa_ads_claim_protocol_for_user', {
    p_protocol: protocol,
    p_auth_user_id: user.id,
  });
  if (claimError || !claimed?.success) {
    console.error('Advertiser protocol claim failed', claimError);
    return json(409, { error: 'protocol_claim_failed' }, origin);
  }

  return json(200, { success: true, account_exists: accountExists }, origin);
}

if (import.meta.main) Deno.serve(handleRequest);
'''
write("supabase/functions/gsa-advertiser-access/index.ts", EDGE_FUNCTION)


# 6) Migração: validação canônica do protocolo, vínculo seguro e perfil persistido.
MIGRATION = r'''BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_public_validate_advertising_protocol(p_protocol text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_request jsonb;
BEGIN
  IF p_protocol IS NULL OR length(trim(p_protocol)) NOT BETWEEN 8 AND 50 THEN
    RETURN jsonb_build_object('success', false);
  END IF;

  SELECT jsonb_build_object(
    'id', r.id,
    'protocol', r.protocol,
    'company_name', r.company_name,
    'document', r.document,
    'contact_name', r.contact_name,
    'contact_email', r.contact_email,
    'contact_phone', r.contact_phone,
    'status', r.status
  )
  INTO v_request
  FROM public.gsa_ad_requests r
  WHERE upper(r.protocol) = upper(trim(p_protocol))
    AND r.status NOT IN ('rejected', 'cancelled')
  LIMIT 1;

  IF v_request IS NULL THEN
    RETURN jsonb_build_object('success', false);
  END IF;
  RETURN jsonb_build_object('success', true, 'request', v_request);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_ads_claim_protocol_for_user(p_protocol text, p_auth_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_request public.gsa_ad_requests;
  v_user_email text;
  v_advertiser public.gsa_advertisers;
BEGIN
  IF p_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario invalido' USING ERRCODE = '22023';
  END IF;
  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = p_auth_user_id;
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'Usuario nao encontrado' USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_request
  FROM public.gsa_ad_requests
  WHERE upper(protocol) = upper(trim(p_protocol))
    AND status NOT IN ('rejected', 'cancelled')
  FOR UPDATE;
  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Protocolo nao encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF lower(v_request.contact_email) <> v_user_email THEN
    RAISE EXCEPTION 'Email nao corresponde ao protocolo' USING ERRCODE = '42501';
  END IF;

  IF v_request.advertiser_id IS NOT NULL THEN
    SELECT * INTO v_advertiser FROM public.gsa_advertisers WHERE id = v_request.advertiser_id FOR UPDATE;
  ELSE
    SELECT * INTO v_advertiser
    FROM public.gsa_advertisers
    WHERE regexp_replace(document, '[^0-9]', '', 'g') = regexp_replace(v_request.document, '[^0-9]', '', 'g')
    LIMIT 1
    FOR UPDATE;
  END IF;

  IF v_advertiser.id IS NULL THEN
    INSERT INTO public.gsa_advertisers(
      auth_user_id, legal_name, trade_name, document, company_size, segment, website,
      responsible_name, responsible_email, responsible_phone, status, invited_at, last_access_at
    ) VALUES (
      p_auth_user_id, v_request.company_name, v_request.company_name, v_request.document,
      v_request.company_size, v_request.segment, v_request.website, v_request.contact_name,
      lower(v_request.contact_email), v_request.contact_phone, 'active', now(), now()
    ) RETURNING * INTO v_advertiser;
  ELSE
    IF v_advertiser.auth_user_id IS NOT NULL AND v_advertiser.auth_user_id <> p_auth_user_id THEN
      RAISE EXCEPTION 'Protocolo ja vinculado a outra conta' USING ERRCODE = '42501';
    END IF;
    UPDATE public.gsa_advertisers
       SET auth_user_id = p_auth_user_id,
           legal_name = v_request.company_name,
           trade_name = COALESCE(NULLIF(trade_name, ''), v_request.company_name),
           company_size = v_request.company_size,
           segment = v_request.segment,
           website = COALESCE(v_request.website, website),
           responsible_name = v_request.contact_name,
           responsible_email = lower(v_request.contact_email),
           responsible_phone = v_request.contact_phone,
           status = 'active',
           invited_at = COALESCE(invited_at, now()),
           last_access_at = now()
     WHERE id = v_advertiser.id
     RETURNING * INTO v_advertiser;
  END IF;

  UPDATE public.gsa_ad_requests SET advertiser_id = v_advertiser.id WHERE id = v_request.id;
  INSERT INTO public.gsa_ad_audit_logs(actor_type, actor_id, action, entity_type, entity_id, details)
  VALUES ('advertiser', v_advertiser.id, 'CLAIM_PROTOCOL', 'ad_request', v_request.id,
          jsonb_build_object('auth_user_id', p_auth_user_id));

  RETURN jsonb_build_object('success', true, 'advertiser_id', v_advertiser.id, 'request_id', v_request.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_advertiser_update_profile(p_payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_advertiser_id uuid := public.gsa_current_advertiser_id();
  v_advertiser public.gsa_advertisers;
  v_company text;
  v_contact text;
  v_email text;
  v_phone text;
  v_document text;
  v_auth_email text := lower(COALESCE(auth.jwt()->>'email', ''));
BEGIN
  IF v_advertiser_id IS NULL THEN
    RAISE EXCEPTION 'Conta de anunciante indisponivel' USING ERRCODE = '42501';
  END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' OR pg_column_size(p_payload) > 8192 THEN
    RAISE EXCEPTION 'Perfil invalido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_advertiser FROM public.gsa_advertisers WHERE id = v_advertiser_id FOR UPDATE;
  v_company := trim(COALESCE(p_payload->>'company_name', ''));
  v_contact := trim(COALESCE(p_payload->>'contact_name', ''));
  v_email := lower(trim(COALESCE(p_payload->>'contact_email', '')));
  v_phone := regexp_replace(COALESCE(p_payload->>'contact_phone', ''), '[^0-9]', '', 'g');
  v_document := regexp_replace(COALESCE(p_payload->>'document', ''), '[^0-9]', '', 'g');

  IF length(v_company) NOT BETWEEN 2 AND 180
     OR length(v_contact) NOT BETWEEN 2 AND 160
     OR length(v_phone) NOT BETWEEN 10 AND 15
     OR v_email <> v_auth_email
     OR v_document <> regexp_replace(v_advertiser.document, '[^0-9]', '', 'g') THEN
    RAISE EXCEPTION 'Dados do perfil invalidos ou imutaveis' USING ERRCODE = '22023';
  END IF;

  UPDATE public.gsa_advertisers
     SET legal_name = v_company,
         trade_name = CASE WHEN trade_name IS NULL OR trade_name = legal_name THEN v_company ELSE trade_name END,
         responsible_name = v_contact,
         responsible_email = v_email,
         responsible_phone = v_phone,
         last_access_at = now()
   WHERE id = v_advertiser_id;

  INSERT INTO public.gsa_ad_audit_logs(actor_type, actor_id, action, entity_type, entity_id, details)
  VALUES ('advertiser', v_advertiser_id, 'UPDATE_PROFILE', 'advertiser', v_advertiser_id,
          jsonb_build_object('email', v_email));
  RETURN jsonb_build_object('success', true, 'advertiser_id', v_advertiser_id);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_public_validate_advertising_protocol(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_public_validate_advertising_protocol(text) TO service_role;
REVOKE ALL ON FUNCTION public.gsa_ads_claim_protocol_for_user(text,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_ads_claim_protocol_for_user(text,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.gsa_advertiser_update_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_advertiser_update_profile(jsonb) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_advertiser_portal_snapshot() FROM anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_counter_proposal(uuid,numeric,text) FROM anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_reject_proposal(uuid,text) FROM anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_accept_proposal(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_save_creative(uuid,uuid,text,text,text,text,text,text,integer,integer,numeric) FROM anon;
REVOKE ALL ON FUNCTION public.gsa_advertiser_submit_creative(uuid) FROM anon;

COMMIT;
'''
write("supabase/migrations/20260722235900_fix_gsa_advertising_flow.sql", MIGRATION)


# 7) Deploy: aplicar hardening reconciliado, nova migração e nova Edge Function; origem de produção nunca vazia.
DEPLOY = ".github/workflows/deploy-advertising-platform.yml"
replace_exact(
    DEPLOY,
    "      ADVERTISING_ALLOWED_ORIGINS: ${{ vars.ADVERTISING_ALLOWED_ORIGINS }}",
    "      ADVERTISING_ALLOWED_ORIGINS: ${{ vars.ADVERTISING_ALLOWED_ORIGINS || 'https://grupo-gsa.com.br,https://www.grupo-gsa.com.br' }}",
)
replace_exact(
    DEPLOY,
    "      - 'supabase/migrations/20260721223500_schedule_advertising_campaigns.sql'\n",
    "      - 'supabase/migrations/20260721223500_schedule_advertising_campaigns.sql'\n      - 'supabase/migrations/20260722040000_harden_advertising_backend.sql'\n      - 'supabase/migrations/20260722235900_fix_gsa_advertising_flow.sql'\n",
)
replace_exact(
    DEPLOY,
    "      - 'supabase/functions/gsa-advertiser-admin/**'\n",
    "      - 'supabase/functions/gsa-advertiser-admin/**'\n      - 'supabase/functions/gsa-advertiser-access/**'\n",
)
replace_exact(
    DEPLOY,
    "          deno check supabase/functions/gsa-advertiser-admin/index.ts\n",
    "          deno check supabase/functions/gsa-advertiser-admin/index.ts\n          deno check supabase/functions/gsa-advertiser-access/index.ts\n",
)
replace_exact(
    DEPLOY,
    "           : > advertising-migrations-apply.log\n\n           for spec in \\\n",
    "           : > advertising-migrations-apply.log\n\n           cp supabase/migrations/20260722040000_harden_advertising_backend.sql /tmp/advertising-backend-reconciled.sql\n           printf '\\nCOMMIT;\\n' >> /tmp/advertising-backend-reconciled.sql\n\n           for spec in \\\n             '20260722120100:/tmp/advertising-backend-reconciled.sql' \\\n",
)
replace_exact(
    DEPLOY,
    "             '20260721223500:supabase/migrations/20260721223500_schedule_advertising_campaigns.sql'\n",
    "             '20260721223500:supabase/migrations/20260721223500_schedule_advertising_campaigns.sql' \\\n             '20260722235900:supabase/migrations/20260722235900_fix_gsa_advertising_flow.sql'\n",
)
replace_exact(
    DEPLOY,
    "           for version in 20260721210100 20260721223100 20260721223500\n",
    "           for version in 20260721210100 20260721223100 20260721223500 20260722120100 20260722235900\n",
)
replace_exact(
    DEPLOY,
    "             gsa-public-advertising \\\n             gsa-ad-delivery \\\n",
    "             gsa-public-advertising \\\n             gsa-advertiser-access \\\n             gsa-ad-delivery \\\n",
)
replace_exact(
    DEPLOY,
    "                OR to_regprocedure('public.gsa_ads_record_event(uuid,text)') IS NULL THEN",
    "                OR to_regprocedure('public.gsa_ads_record_event(uuid,text)') IS NULL\n                OR to_regprocedure('public.gsa_advertiser_update_profile(jsonb)') IS NULL\n                OR to_regprocedure('public.gsa_public_validate_advertising_protocol(text)') IS NULL THEN",
)
replace_exact(
    DEPLOY,
    "           for function_name in gsa-public-advertising gsa-advertiser-admin gsa-ad-delivery gsa-advertising-webhook gsa-advertising-scheduler\n",
    "           for function_name in gsa-public-advertising gsa-advertiser-admin gsa-advertiser-access gsa-ad-delivery gsa-advertising-webhook gsa-advertising-scheduler\n",
)
replace_exact(
    DEPLOY,
    '            "migrations": ["20260721210100", "20260721223100", "20260721223500"],',
    '            "migrations": ["20260721210100", "20260721223100", "20260721223500", "20260722120100", "20260722235900"],',
)
replace_exact(
    DEPLOY,
    '            "edge_functions": ["gsa-public-advertising", "gsa-advertiser-admin", "gsa-ad-delivery", "gsa-advertising-webhook", "gsa-advertising-scheduler"]',
    '            "edge_functions": ["gsa-public-advertising", "gsa-advertiser-admin", "gsa-advertiser-access", "gsa-ad-delivery", "gsa-advertising-webhook", "gsa-advertising-scheduler"]',
)

print("Correções do fluxo GSA Anúncios aplicadas com sucesso aos arquivos de trabalho.")
