from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
changed: list[str] = []


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    if path not in changed:
        changed.append(path)


def replace_once(path: str, old: str, new: str) -> None:
    content = read(path)
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: esperado 1 marcador, encontrado {count}: {old[:100]!r}")
    write(path, content.replace(old, new, 1))


def replace_count(path: str, old: str, new: str, expected: int) -> None:
    content = read(path)
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f"{path}: esperado {expected} marcadores, encontrado {count}: {old[:100]!r}")
    write(path, content.replace(old, new))


def sub_once(path: str, pattern: str, replacement: str, flags: int = re.DOTALL) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, count=1, flags=flags)
    if count != 1:
        raise RuntimeError(f"{path}: padrão não encontrado ou duplicado: {pattern[:120]!r}")
    write(path, updated)


# Operações centralizadas do prestador.
replace_once(
    "src/lib/providerOperations.ts",
    """  async financialSnapshot() {
    const { data, error } = await supabase.rpc('gsa_provider_financial_snapshot');
    return assertSuccess(data, error, 'Não foi possível carregar o saldo.');
  },
""",
    """  async financialSnapshot() {
    const { data, error } = await supabase.rpc('gsa_provider_financial_snapshot');
    return assertSuccess(data, error, 'Não foi possível carregar o saldo.');
  },

  async dashboardSnapshot() {
    const { data, error } = await supabase.rpc('gsa_provider_dashboard_snapshot');
    return assertSuccess(data, error, 'Não foi possível carregar os indicadores.');
  },

  async pendencySnapshot() {
    const { data, error } = await supabase.rpc('gsa_provider_pendency_snapshot');
    return assertSuccess(data, error, 'Não foi possível carregar as pendências.');
  },
""",
)
replace_once(
    "src/lib/providerOperations.ts",
    """  async markNotificationRead(notificationId: string) {
""",
    """  async createTicket(subject: string, description: string, deduplicate = false) {
    const { data, error } = await supabase.rpc('gsa_provider_create_ticket', {
      p_subject: subject,
      p_description: description,
      p_deduplicate: deduplicate,
    });
    return assertSuccess(data, error, 'Não foi possível abrir o atendimento.');
  },

  async sendTicketMessage(input: {
    ticketId: string;
    message?: string;
    attachmentReference?: string | null;
    attachmentType?: string | null;
  }) {
    const { data, error } = await supabase.rpc('gsa_provider_send_ticket_message', {
      p_ticket_id: input.ticketId,
      p_message: input.message || null,
      p_attachment_reference: input.attachmentReference || null,
      p_attachment_type: input.attachmentType || null,
    });
    return assertSuccess(data, error, 'Não foi possível enviar a mensagem.');
  },

  async requestProfileChange(field: 'nome_razao' | 'documento' | 'email', newValue: string, reason: string) {
    const { data, error } = await supabase.rpc('gsa_provider_request_profile_change', {
      p_field: field,
      p_new_value: newValue,
      p_reason: reason,
    });
    return assertSuccess(data, error, 'Não foi possível enviar a solicitação cadastral.');
  },

  async requestDemandSupport(demandId: string, message: string) {
    const { data, error } = await supabase.rpc('gsa_provider_request_demand_support', {
      p_demand_id: demandId,
      p_message: message,
    });
    return assertSuccess(data, error, 'Não foi possível solicitar suporte para a demanda.');
  },

  async markNotificationRead(notificationId: string) {
""",
)

# Dashboard usa snapshots e RPCs, sem escritas diretas.
replace_once("src/pages/Prestador/PrestadorDashboard.tsx", "import { supabase } from '../../lib/supabase';\n", "")
replace_once("src/pages/Prestador/PrestadorDashboard.tsx", "import { createNotification } from '../../lib/notifications';\n", "")
sub_once(
    "src/pages/Prestador/PrestadorDashboard.tsx",
    r"""        const \[snapshot, demands, schedules, documents\] = await Promise\.all\(\[.*?        setMetrics\(\{.*?        \}\);""",
    """        const snapshot = await providerOperations.dashboardSnapshot();
        if (cancelled) return;
        setSaldo(Number(snapshot?.saldo || 0));
        setMetrics({
          demandasConcluidas: Number(snapshot?.demandas_concluidas || 0),
          agendamentosConcluidos: Number(snapshot?.agendamentos_concluidos || 0),
          documentosAprovados: Number(snapshot?.documentos_aprovados || 0),
        });""",
)
sub_once(
    "src/pages/Prestador/PrestadorDashboard.tsx",
    r"""  const submitChangeRequest = async \(\) => \{.*?\n  \};\n\n  const openPendingSupport""",
    """  const submitChangeRequest = async () => {
    if (!requestField || !requestValue.trim() || !requestReason.trim() || requestSubmitting) return;
    const fieldMap: Record<string, 'nome_razao' | 'documento' | 'email'> = {
      'Nome / Razão Social': 'nome_razao',
      Documento: 'documento',
      'E-mail': 'email',
    };
    const field = fieldMap[requestField.label];
    if (!field) {
      toast.error('Campo cadastral inválido.');
      return;
    }
    setRequestSubmitting(true);
    try {
      await providerOperations.requestProfileChange(field, requestValue.trim(), requestReason.trim());
      toast.success('Solicitação enviada para análise.');
      setRequestField(null);
      setRequestValue('');
      setRequestReason('');
    } catch (submitError: any) {
      toast.error(submitError?.message || 'Não foi possível enviar a solicitação.');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const openPendingSupport""",
)
sub_once(
    "src/pages/Prestador/PrestadorDashboard.tsx",
    r"""  const openPendingSupport = async \(\) => \{.*?\n  \};\n\n  if \(loading\)""",
    """  const openPendingSupport = async () => {
    if (!prestador || supportSubmitting) return;
    setSupportSubmitting(true);
    try {
      await providerOperations.createTicket(
        'Análise de cadastro pendente',
        `Solicito informações sobre a análise do cadastro de ${prestador.nome_razao}.`,
        true,
      );
      navigate(routes.provider.support());
    } catch (supportError: any) {
      toast.error(supportError?.message || 'Não foi possível abrir o suporte.');
    } finally {
      setSupportSubmitting(false);
    }
  };

  if (loading)""",
)

# Suporte protegido por RPC e limpeza de upload em caso de erro.
replace_once("src/components/prestador/PrestadorSuporte.tsx", "import { notificationService } from '../../lib/notificationService';\n", "import { providerOperations } from '../../lib/providerOperations';\n")
replace_once(
    "src/components/prestador/PrestadorSuporte.tsx",
    "import { resolveProviderFileUrl, uploadProviderPrivateFile } from '../../lib/providerStorage';\n",
    "import { removeProviderPrivateFile, resolveProviderFileUrl, uploadProviderPrivateFile } from '../../lib/providerStorage';\n",
)
replace_once(
    "src/components/prestador/PrestadorSuporte.tsx",
    ".order('data_abertura', { ascending: false });",
    ".order('data_abertura', { ascending: false })\n        .limit(100);",
)
replace_once(
    "src/components/prestador/PrestadorSuporte.tsx",
    ".order('data_envio', { ascending: true });",
    ".order('data_envio', { ascending: true })\n        .limit(200);",
)
sub_once(
    "src/components/prestador/PrestadorSuporte.tsx",
    r"""  const createTicket = async \(event: React\.FormEvent\) => \{.*?\n  \};\n\n  const sendMessage""",
    """  const createTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subject.trim() || !description.trim() || submitting) return;
    setSubmitting(true);
    try {
      await providerOperations.createTicket(subject.trim(), description.trim());
      toast.success('Atendimento aberto com sucesso.');
      setCreateOpen(false);
      setSubject('');
      setDescription('');
      setActiveTab('aberto');
      await loadTickets();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível abrir o atendimento.');
    } finally {
      setSubmitting(false);
    }
  };

  const sendMessage""",
)
sub_once(
    "src/components/prestador/PrestadorSuporte.tsx",
    r"""  const sendMessage = async \(\) => \{.*?\n  \};\n\n  const openAttachment""",
    """  const sendMessage = async () => {
    if (!selectedTicket || (!newMessage.trim() && !attachment) || submitting) return;
    setSubmitting(true);
    let attachmentReference: string | null = null;
    try {
      if (attachment) {
        attachmentReference = await uploadProviderPrivateFile({
          bucket: 'documentos_prestador',
          providerId: prestadorId,
          scope: `chat/${selectedTicket.id}`,
          file: attachment,
          maxSizeMb: 15,
        });
      }
      await providerOperations.sendTicketMessage({
        ticketId: selectedTicket.id,
        message: newMessage.trim(),
        attachmentReference,
        attachmentType: attachment?.type || null,
      });
      setNewMessage('');
      setAttachment(null);
      await loadMessages(selectedTicket.id);
    } catch (error: any) {
      if (attachmentReference) await Promise.allSettled([removeProviderPrivateFile(attachmentReference)]);
      toast.error(error?.message || 'Não foi possível enviar a mensagem.');
    } finally {
      setSubmitting(false);
    }
  };

  const openAttachment""",
)

# Demandas: notificação, nota e suporte são transacionais no banco.
replace_once("src/components/prestador/PrestadorDemandas.tsx", "import { notificationService, type AcaoOrigem } from '../../lib/notificationService';\n", "")
sub_once(
    "src/components/prestador/PrestadorDemandas.tsx",
    r"""const NOTIFICATION_ACTIONS:.*?const NOTIFICATION_TITLES:.*?\n\};\n\n""",
    "",
)
replace_once(
    "src/components/prestador/PrestadorDemandas.tsx",
    ".order('created_at', { ascending: false });",
    ".order('created_at', { ascending: false })\n        .limit(100);",
)
sub_once(
    "src/components/prestador/PrestadorDemandas.tsx",
    r"""  const notifyAndLog = async \(action: ProviderDemandAction, demand: Demand, detail: string\) => \{.*?\n  \};""",
    """  const notifyAndLog = async (action: ProviderDemandAction, demand: Demand, detail: string) => {
    await logService.logAction({
      ator_tipo: 'prestador',
      ator_id: prestadorId,
      acao: `DEMANDA_${action.toUpperCase()}`,
      detalhes: `${demand.id}: ${detail}`,
    });
  };""",
)
sub_once(
    "src/components/prestador/PrestadorDemandas.tsx",
    r"""        if \(selected\.os_id\) \{\n          await supabase\.from\('os_notas'\)\.insert\(\{ os_id: selected\.os_id, nota: 'Serviço entregue pelo prestador e enviado para análise\.' \}\);\n        \}\n""",
    "",
)
sub_once(
    "src/components/prestador/PrestadorDemandas.tsx",
    r"""        if \(selected\.os_id\) \{\n          await supabase\.from\('os_notas'\)\.insert\(\{ os_id: selected\.os_id, nota: 'Demanda devolvida pelo prestador para reatribuição\.' \}\);\n        \}\n""",
    "",
)
sub_once(
    "src/components/prestador/PrestadorDemandas.tsx",
    r"""      \} else \{\n        if \(!supportMessage\.trim\(\)\) throw new Error\('Informe a mensagem de suporte\.'\);\n        const \{ error \} = await supabase\.from\('prestador_suporte_demandas'\)\.insert\(\{.*?        \);\n      \}""",
    """      } else {
        if (!supportMessage.trim()) throw new Error('Informe a mensagem de suporte.');
        await providerOperations.requestDemandSupport(selected.id, supportMessage.trim());
      }""",
)

# Financeiro sem notificação duplicada no navegador.
replace_once("src/components/prestador/PrestadorFinanceiro.tsx", "import { notificationService } from '../../lib/notificationService';\n", "")
replace_count(
    "src/components/prestador/PrestadorFinanceiro.tsx",
    ".order('created_at', { ascending: false }),",
    ".order('created_at', { ascending: false })\n          .limit(100),",
    2,
)
sub_once(
    "src/components/prestador/PrestadorFinanceiro.tsx",
    r"""      await Promise\.allSettled\(\[\n        logService\.logAction\(\{ ator_tipo: 'prestador'.*?\n      \]\);""",
    """      await logService.logAction({ ator_tipo: 'prestador', ator_id: prestadorId, acao: 'SOLICITAR_SAQUE', detalhes: `Solicitou saque de ${formatCurrency(value)} via PIX.` });""",
)

# Agenda transacional e listas limitadas no servidor.
replace_once("src/components/prestador/PrestadorAgenda.tsx", "import { notificationService } from '../../lib/notificationService';\n", "")
replace_once(
    "src/components/prestador/PrestadorAgenda.tsx",
    ".order('data_inicio', { ascending: true }),",
    ".order('data_inicio', { ascending: true })\n          .limit(100),",
)
replace_once(
    "src/components/prestador/PrestadorAgenda.tsx",
    ".order('created_at', { ascending: false }),",
    ".order('created_at', { ascending: false })\n          .limit(100),",
)
sub_once(
    "src/components/prestador/PrestadorAgenda.tsx",
    r"""      await Promise\.allSettled\(\[\n        logService\.logAction\(\{ ator_tipo: 'prestador', ator_id: prestadorId, acao: 'CRIAR_AGENDAMENTO'.*?\n      \]\);""",
    """      await logService.logAction({ ator_tipo: 'prestador', ator_id: prestadorId, acao: 'CRIAR_AGENDAMENTO', detalhes: `Criou o agendamento ${result?.agendamento_id || ''} para a demanda ${demandId}.` });""",
)
sub_once(
    "src/components/prestador/PrestadorAgenda.tsx",
    r"""      await Promise\.allSettled\(\[\n        logService\.logAction\(\{ ator_tipo: 'prestador', ator_id: prestadorId, acao: 'CONCLUIR_AGENDAMENTO'.*?\n      \]\);""",
    """      await logService.logAction({ ator_tipo: 'prestador', ator_id: prestadorId, acao: 'CONCLUIR_AGENDAMENTO', detalhes: `Concluiu o agendamento ${schedule.id}.` });""",
)

# Documentos privados: remoção dos arquivos substituídos e notificação no banco.
replace_once("src/components/prestador/PrestadorDocumentos.tsx", "import { notificationService } from '../../lib/notificationService';\n", "")
replace_once(
    "src/components/prestador/PrestadorDocumentos.tsx",
    ".order('created_at', { ascending: false });",
    ".order('created_at', { ascending: false })\n        .limit(100);",
)
replace_once(
    "src/components/prestador/PrestadorDocumentos.tsx",
    "      await providerOperations.submitDocument(selected.id, uploaded);\n      setProgress(90);",
    "      const submission = await providerOperations.submitDocument(selected.id, uploaded);\n      await Promise.allSettled(((submission?.old_urls || []) as string[]).map((reference) => removeProviderPrivateFile(reference)));\n      setProgress(90);",
)
sub_once(
    "src/components/prestador/PrestadorDocumentos.tsx",
    r"""      await Promise\.allSettled\(\[\n        logService\.logAction\(.*?\n        notificationService\.notifyAdmin\(.*?\n        refreshCounts\(\),\n      \]\);""",
    """      await Promise.allSettled([
        logService.logAction({ ator_tipo: 'prestador', ator_id: prestadorId, acao: 'UPLOAD_DOCUMENTO', detalhes: `Enviou ${uploaded.length} arquivo(s) para ${selected.nome}.` }),
        refreshCounts(),
      ]);""",
)

# Vouchers e prêmios sem notificações duplicadas.
replace_once("src/components/prestador/PrestadorVouchers.tsx", "import { notificationService } from '../../lib/notificationService';\n", "")
replace_once(
    "src/components/prestador/PrestadorVouchers.tsx",
    ".order('created_at', { ascending: false });",
    ".order('created_at', { ascending: false })\n        .limit(100);",
)
sub_once(
    "src/components/prestador/PrestadorVouchers.tsx",
    r"""      await Promise\.allSettled\(\[.*?refreshCounts\(\),\n      \]\);""",
    """      await refreshCounts();""",
)
replace_once("src/components/prestador/PrestadorPremios.tsx", "import { notificationService } from '../../lib/notificationService';\n", "")
replace_once(
    "src/components/prestador/PrestadorPremios.tsx",
    ".order('created_at', { ascending: false });",
    ".order('created_at', { ascending: false })\n        .limit(100);",
)
sub_once(
    "src/components/prestador/PrestadorPremios.tsx",
    r"""      await Promise\.allSettled\(\[.*?refreshCounts\(\),\n      \]\);""",
    """      await refreshCounts();""",
)
sub_once(
    "src/components/prestador/PrestadorPremios.tsx",
    r"""  const openTicket = async \(prize: Prize\) => \{.*?\n  \};""",
    """  const openTicket = async (prize: Prize) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await providerOperations.createTicket(
        `Dúvida sobre o prêmio: ${prize.titulo}`,
        `Solicito informações sobre o prêmio "${prize.titulo}".`,
        true,
      );
      toast.success('Atendimento aberto com sucesso.');
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível abrir o atendimento.');
    } finally {
      setSubmitting(false);
    }
  };""",
)

# Promoções respeitam data de início e possuem consulta limitada.
replace_once(
    "src/components/prestador/PrestadorPromocoes.tsx",
    "supabase.from('prestador_promocoes').select('id,titulo,descricao,regras,status,data_inicio,data_fim,created_at').order('created_at', { ascending: false }),",
    "supabase.from('prestador_promocoes').select('id,titulo,descricao,regras,status,data_inicio,data_fim,created_at').order('created_at', { ascending: false }).limit(100),",
)
replace_once(
    "src/components/prestador/PrestadorPromocoes.tsx",
    "supabase.from('prestador_promocoes_ativacoes').select('promocao_id,ativa').eq('prestador_id', prestadorId),",
    "supabase.from('prestador_promocoes_ativacoes').select('promocao_id,ativa').eq('prestador_id', prestadorId).limit(100),",
)
replace_once(
    "src/components/prestador/PrestadorPromocoes.tsx",
    "    const ended = item.status !== 'ativa' || (!!item.data_fim && new Date(item.data_fim).getTime() < now);\n    return activeTab === 'ativas' ? !ended : ended || activeIds.has(item.id);",
    "    const notStarted = !!item.data_inicio && new Date(item.data_inicio).getTime() > now;\n    const ended = item.status !== 'ativa' || notStarted || (!!item.data_fim && new Date(item.data_fim).getTime() < now);\n    return activeTab === 'ativas' ? !ended : ended || activeIds.has(item.id);",
)

# Validação de arquivo endurecida.
sub_once(
    "src/lib/providerStorage.ts",
    r"""export function validateProviderFile\(file: File, options\?: \{ maxSizeMb\?: number; allowedMimeTypes\?: string\[\] \}\) \{.*?\n\}\n\nexport async function uploadProviderPrivateFile""",
    """export function validateProviderFile(file: File, options?: { maxSizeMb?: number; allowedMimeTypes?: string[] }) {
  const maxSizeMb = options?.maxSizeMb ?? 15;
  const allowed = options?.allowedMimeTypes ?? [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'application/zip',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  const allowedExtensions = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'zip', 'docx', 'xlsx']);
  const extension = safeExtension(file);

  if (!file.name || file.name.includes('\\0') || file.size <= 0) {
    throw new Error('O arquivo selecionado é inválido ou está vazio.');
  }
  if (file.size > maxSizeMb * 1024 * 1024) {
    throw new Error(`O arquivo ${file.name} ultrapassa ${maxSizeMb} MB.`);
  }
  if (!file.type || !allowed.includes(file.type) || !allowedExtensions.has(extension)) {
    throw new Error(`O tipo do arquivo ${file.name} não é permitido.`);
  }
}

export async function uploadProviderPrivateFile""",
)

# Pendências são calculadas no banco, Realtime é filtrado e heartbeat é reduzido.
replace_once("src/hooks/useProviderNotifications.tsx", "const HEARTBEAT_INTERVAL_MS = 30_000;", "const HEARTBEAT_INTERVAL_MS = 60_000;")
sub_once(
    "src/hooks/useProviderNotifications.tsx",
    r"""  const fetchPendencies = useCallback\(async \(\) => \{.*?\n  \}, \[prestadorId\]\);""",
    """  const fetchPendencies = useCallback(async () => {
    if (!prestadorId) return;
    const source = await providerOperations.pendencySnapshot();
    const counts: ProviderPendencyCounts = {
      ...emptyCounts,
      ...source,
      demandas_novas: Number(source?.demandas_novas || 0),
      demandas_negociacao: Number(source?.demandas_negociacao || 0),
      demandas_pendentes: Number(source?.demandas_pendentes || 0),
      demandas_em_execucao: Number(source?.demandas_em_execucao || 0),
      servicos_ativos: Number(source?.servicos_ativos || 0),
      financeiro_saques_pendentes: Number(source?.financeiro_saques_pendentes || 0),
      vouchers_ativos: Number(source?.vouchers_ativos || 0),
      suporte_tickets_ativos: Number(source?.suporte_tickets_ativos || 0),
      suporte_mensagens_nao_lidas: Number(source?.suporte_mensagens_nao_lidas || 0),
      promocoes_ativas: Number(source?.promocoes_ativas || 0),
      total: Number(source?.total || 0),
      moduleDemandas: Number(source?.moduleDemandas || 0),
      moduleDemandasAbertas: Number(source?.moduleDemandasAbertas || 0),
      moduleDemandasAtivas: Number(source?.moduleDemandasAtivas || 0),
      moduleAgenda: Number(source?.moduleAgenda || 0),
      moduleFinanceiro: Number(source?.moduleFinanceiro || 0),
      moduleVouchers: Number(source?.moduleVouchers || 0),
      moduleSuporte: Number(source?.moduleSuporte || 0),
      moduleDocumentos: Number(source?.moduleDocumentos || 0),
      modulePremios: Number(source?.modulePremios || 0),
      modulePromocoes: Number(source?.modulePromocoes || 0),
    };
    if (mountedRef.current) setPendencies(counts);
  }, [prestadorId]);""",
)
replace_once("src/hooks/useProviderNotifications.tsx", ".limit(100),", ".limit(50),")
sub_once(
    "src/hooks/useProviderNotifications.tsx",
    r"""      \.on\('postgres_changes', \{ event: 'INSERT', schema: 'public', table: 'notificacoes' \}, \(payload\) => \{.*?      \}\)""",
    """      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `prestador_id=eq.${prestadorId}` }, (payload) => {
        const row = payload.new as any;
        playPremiumBeep();
        showAnimatedToast(row.titulo || 'Nova notificação', row.mensagem || '', row.modulo || 'bell');
        scheduleRefresh();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: 'destinatario_tipo=in.(broadcast_prestadores,broadcast_todos)' }, (payload) => {
        const row = payload.new as any;
        playPremiumBeep();
        showAnimatedToast(row.titulo || 'Nova notificação', row.mensagem || '', row.modulo || 'bell');
        scheduleRefresh();
      })""",
)

# Teste permanente do Painel do Prestador.
write(
    "scripts/check-provider-portal-security-contracts.ts",
    """import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

async function file(path: string) {
  return readFile(resolve(root, path), 'utf8');
}

async function includes(path: string, patterns: string[]) {
  const content = await file(path);
  for (const pattern of patterns) {
    assert.ok(content.includes(pattern), `${path}: contrato ausente: ${pattern}`);
  }
}

async function excludes(path: string, patterns: string[]) {
  const content = await file(path);
  for (const pattern of patterns) {
    assert.ok(!content.includes(pattern), `${path}: padrão inseguro ainda presente: ${pattern}`);
  }
}

async function main() {
  await includes('supabase/migrations/20260720233000_provider_portal_audit_hardening.sql', [
    'gsa_provider_context',
    "p_require_active AND COALESCE(v_provider.status, '') <> 'ativo'",
    'gsa_guard_provider_direct_write',
    'gsa_provider_create_ticket',
    'gsa_provider_send_ticket_message',
    'gsa_provider_request_demand_support',
    'pg_advisory_xact_lock',
    "NEW.link_resultado !~* '^https?://'",
    "v_promotion.data_inicio > current_date",
    "public.gsa_admin_has_module('operacoes')",
    "public.gsa_admin_has_module('atendimento')",
    'gsa_provider_audit_events',
  ]);

  await includes('supabase/migrations/20260720233100_provider_portal_secure_snapshots.sql', [
    'gsa_provider_pendency_snapshot',
    'moduleDemandasAbertas',
  ]);

  await includes('src/lib/providerOperations.ts', [
    'gsa_provider_dashboard_snapshot',
    'gsa_provider_pendency_snapshot',
    'gsa_provider_create_ticket',
    'gsa_provider_send_ticket_message',
    'gsa_provider_request_profile_change',
    'gsa_provider_request_demand_support',
  ]);

  await excludes('src/pages/Prestador/PrestadorDashboard.tsx', [
    ".from('tickets').insert",
    "createNotification(null",
  ]);
  await excludes('src/components/prestador/PrestadorSuporte.tsx', [
    ".from('ticket_mensagens').insert",
    ".from('tickets').insert",
    'notificationService.notifyAdmin',
  ]);
  await excludes('src/components/prestador/PrestadorDemandas.tsx', [
    ".from('prestador_suporte_demandas').insert",
    ".from('os_notas').insert",
    'notificationService.notifyAdmin',
  ]);

  await includes('src/lib/providerStorage.ts', [
    "if (!file.type || !allowed.includes(file.type) || !allowedExtensions.has(extension))",
    'file.size <= 0',
  ]);
  await includes('src/hooks/useProviderNotifications.tsx', [
    'const HEARTBEAT_INTERVAL_MS = 60_000;',
    'gsa_provider_pendency_snapshot',
    'destinatario_tipo=in.(broadcast_prestadores,broadcast_todos)',
  ]);

  console.log('Painel do Prestador: contratos de autorização, transação, privacidade e desempenho aprovados.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
""",
)

# Scripts e workflows permanentes.
replace_once(
    "package.json",
    '    "test:client-security": "tsx scripts/check-client-portal-security-contracts.ts",\n',
    '    "test:client-security": "tsx scripts/check-client-portal-security-contracts.ts",\n    "test:provider": "tsx scripts/check-provider-portal-security-contracts.ts",\n',
)
replace_once(
    ".github/workflows/quality.yml",
    """      - name: GSA Viagens contracts
        if: steps.typescript.outputs.exit_code == '0' && steps.client_security.outputs.exit_code == '0'
        run: npm run test:travel
""",
    """      - name: Provider portal security contracts
        if: steps.typescript.outputs.exit_code == '0' && steps.client_security.outputs.exit_code == '0'
        run: npm run test:provider

      - name: GSA Viagens contracts
        if: steps.typescript.outputs.exit_code == '0' && steps.client_security.outputs.exit_code == '0'
        run: npm run test:travel
""",
)
replace_once(
    ".github/workflows/provider-portal-validation.yml",
    """      - 'supabase/migrations/20260720210000_harden_provider_portal.sql'
      - '.github/workflows/provider-portal-validation.yml'
""",
    """      - 'supabase/migrations/20260720210000_harden_provider_portal.sql'
      - 'supabase/migrations/20260720233*_provider_portal*.sql'
      - 'scripts/check-provider-portal-security-contracts.ts'
      - '.github/workflows/provider-portal-validation.yml'
""",
)
replace_once(
    ".github/workflows/provider-portal-validation.yml",
    """      - name: TypeScript validation
        run: npm run lint
      - name: Production build
        run: npm run build
""",
    """      - name: TypeScript validation
        run: npm run lint
      - name: Provider portal security contracts
        run: npm run test:provider
      - name: Production build
        run: npm run build
""",
)

print('Arquivos corrigidos:')
for path in changed:
    print(f'- {path}')
