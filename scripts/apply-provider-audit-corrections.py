from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding='utf-8')


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding='utf-8')


def replace(path: str, old: str, new: str, expected: int = 1) -> None:
    content = read(path)
    count = content.count(old)
    if count != expected:
        raise RuntimeError(f'{path}: esperado {expected} ocorrência(s), encontrado {count}: {old[:100]!r}')
    write(path, content.replace(old, new))


def regex(path: str, pattern: str, replacement: str, expected: int = 1, flags: int = re.S) -> None:
    content = read(path)
    updated, count = re.subn(pattern, replacement, content, flags=flags)
    if count != expected:
        raise RuntimeError(f'{path}: regex esperava {expected}, encontrou {count}: {pattern[:120]}')
    write(path, updated)


# Corrige detalhes da migration antes da validação.
migration = 'supabase/migrations/20260720235900_provider_portal_audit_hardening.sql'
replace(migration, "AND (storage.foldername(name))[2] = 'documents' AND public.gsa_admin_has_module('cadastro')", "AND (storage.foldername(name))[2] = 'documentos' AND public.gsa_admin_has_module('cadastro')")
replace(
    migration,
    "  IF EXISTS (\n    SELECT 1 FROM public.tickets\n    WHERE prestador_id = v_provider_id\n      AND assunto = trim(p_subject)\n      AND status <> 'concluido'\n  ) THEN\n    RAISE EXCEPTION 'Já existe um atendimento aberto com este assunto';\n  END IF;",
    "  SELECT id INTO v_ticket_id FROM public.tickets\n  WHERE prestador_id = v_provider_id\n    AND assunto = trim(p_subject)\n    AND status <> 'concluido'\n  ORDER BY data_abertura DESC\n  LIMIT 1;\n  IF v_ticket_id IS NOT NULL THEN\n    RETURN jsonb_build_object('success', true, 'ticket_id', v_ticket_id, 'existing', true);\n  END IF;"
)
regex(
    migration,
    r"CREATE OR REPLACE FUNCTION public\.gsa_provider_operation_event\(\).*?\n\$\$;",
    r'''CREATE OR REPLACE FUNCTION public.gsa_provider_operation_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_provider_id uuid;
  v_action text;
  v_title text;
  v_message text;
  v_module text;
  v_item_id uuid;
BEGIN
  IF public.gsa_current_actor_type() <> 'prestador' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  IF TG_TABLE_NAME = 'prestador_saques' THEN
    v_provider_id := COALESCE(NEW.prestador_id, OLD.prestador_id);
    v_item_id := COALESCE(NEW.id, OLD.id);
    IF TG_OP = 'INSERT' THEN
      v_action := 'WITHDRAWAL_REQUESTED'; v_title := 'Novo saque solicitado';
      v_message := 'Um prestador solicitou saque de R$ ' || NEW.valor::text || '.'; v_module := 'financeiro';
    ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'cancelado' THEN
      v_action := 'WITHDRAWAL_CANCELLED'; v_title := 'Saque cancelado pelo prestador';
      v_message := 'O prestador cancelou uma solicitação de saque.'; v_module := 'financeiro';
    ELSE RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'prestador_vouchers' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'pago' THEN
    v_provider_id := NEW.prestador_id; v_item_id := NEW.id;
    v_action := 'VOUCHER_REDEEMED'; v_title := 'Voucher resgatado pelo prestador';
    v_message := 'Voucher ' || COALESCE(NEW.codigo, NEW.id::text) || ' resgatado e creditado.'; v_module := 'vouchers';
  ELSIF TG_TABLE_NAME = 'prestador_premios' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'resgatado' THEN
    v_provider_id := NEW.prestador_id; v_item_id := NEW.id;
    v_action := 'PRIZE_REDEEMED'; v_title := 'Prêmio resgatado pelo prestador';
    v_message := 'O prêmio "' || COALESCE(NEW.titulo, NEW.id::text) || '" foi resgatado.'; v_module := 'premios';
  ELSIF TG_TABLE_NAME = 'prestador_promocoes_ativacoes' AND (TG_OP = 'INSERT' OR NEW.ativa IS DISTINCT FROM OLD.ativa) AND NEW.ativa THEN
    v_provider_id := NEW.prestador_id; v_item_id := NEW.promocao_id;
    v_action := 'PROMOTION_ACTIVATED'; v_title := 'Participação em promoção';
    v_message := 'Um prestador confirmou participação em uma promoção.'; v_module := 'promocoes';
  ELSIF TG_TABLE_NAME = 'prestador_agendamentos' THEN
    IF TG_OP = 'DELETE' THEN
      v_provider_id := OLD.prestador_id; v_item_id := OLD.id;
      v_action := 'SCHEDULE_DELETED'; v_title := 'Agendamento removido'; v_message := 'Um agendamento foi removido pelo prestador.';
    ELSE
      v_provider_id := NEW.prestador_id; v_item_id := NEW.id;
      IF TG_OP = 'INSERT' THEN
        v_action := 'SCHEDULE_CREATED'; v_title := 'Novo agendamento do prestador'; v_message := 'Um novo agendamento foi criado.';
      ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'concluido' THEN
        v_action := 'SCHEDULE_COMPLETED'; v_title := 'Agendamento concluído'; v_message := 'Um agendamento foi concluído pelo prestador.';
      ELSE RETURN NEW; END IF;
    END IF;
    v_module := 'servicos';
  ELSIF TG_TABLE_NAME = 'prestador_documentos' AND NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'em_analise' THEN
    v_provider_id := NEW.prestador_id; v_item_id := NEW.id;
    v_action := 'DOCUMENT_SUBMITTED'; v_title := 'Documento de prestador enviado';
    v_message := 'O prestador enviou o documento "' || COALESCE(NEW.nome, NEW.id::text) || '" para análise.'; v_module := 'cadastro';
  ELSIF TG_TABLE_NAME = 'prestador_demandas' AND NEW.status IS DISTINCT FROM OLD.status THEN
    v_provider_id := OLD.prestador_id; v_item_id := NEW.id; v_module := 'demandas';
    IF NEW.status = 'ativa' THEN
      v_action := 'DEMAND_ACCEPTED'; v_title := 'Demanda aceita pelo prestador'; v_message := 'Uma demanda foi aceita e iniciada.';
    ELSIF NEW.status = 'contraproposta_prestador' THEN
      v_action := 'DEMAND_COUNTEROFFERED'; v_title := 'Contraproposta do prestador'; v_message := 'O prestador enviou uma contraproposta.';
    ELSIF NEW.status = 'em_analise' THEN
      v_action := 'DEMAND_DELIVERED'; v_title := 'Demanda entregue pelo prestador'; v_message := 'A demanda foi entregue e aguarda análise.';
      IF NEW.os_id IS NOT NULL THEN INSERT INTO public.os_notas(os_id, nota) VALUES (NEW.os_id, 'Serviço entregue pelo prestador e enviado para análise.'); END IF;
    ELSIF NEW.status = 'aguardando_atribuicao' AND NEW.prestador_id IS NULL THEN
      v_action := CASE WHEN OLD.status IN ('aguardando_aceite', 'aberta', 'em_negociacao', 'contraproposta_admin_final') THEN 'DEMAND_REJECTED' ELSE 'DEMAND_RETURNED' END;
      v_title := CASE WHEN v_action = 'DEMAND_REJECTED' THEN 'Demanda recusada pelo prestador' ELSE 'Demanda devolvida pelo prestador' END;
      v_message := CASE WHEN v_action = 'DEMAND_REJECTED' THEN 'Uma demanda foi recusada pelo prestador.' ELSE 'Uma demanda foi devolvida para reatribuição.' END;
      IF v_action = 'DEMAND_RETURNED' AND NEW.os_id IS NOT NULL THEN INSERT INTO public.os_notas(os_id, nota) VALUES (NEW.os_id, 'Demanda devolvida pelo prestador para reatribuição.'); END IF;
    ELSE RETURN NEW; END IF;
  ELSE
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;

  PERFORM public.gsa_provider_write_audit(v_provider_id, v_action, TG_TABLE_NAME, v_item_id,
    jsonb_build_object('operation', TG_OP));
  PERFORM public.gsa_provider_notify_admin(v_title, v_message, v_module, lower(v_action), v_item_id,
    CASE WHEN v_action IN ('DEMAND_DELIVERED', 'DEMAND_RETURNED') THEN 'alta' ELSE 'normal' END,
    jsonb_build_object('prestador_id', v_provider_id));
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;'''
)

# Operações RPC do frontend.
path = 'src/lib/providerOperations.ts'
content = read(path)
insert = '''

  async dashboardSnapshot() {
    const { data, error } = await supabase.rpc('gsa_provider_dashboard_snapshot');
    return assertSuccess(data, error, 'Não foi possível carregar o resumo do painel.');
  },

  async pendencySnapshot() {
    const { data, error } = await supabase.rpc('gsa_provider_pendency_snapshot');
    return assertSuccess(data, error, 'Não foi possível carregar as pendências.');
  },

  async createTicket(subject: string, description: string) {
    const { data, error } = await supabase.rpc('gsa_provider_create_ticket', {
      p_subject: subject,
      p_description: description,
    });
    return assertSuccess(data, error, 'Não foi possível abrir o atendimento.');
  },

  async sendTicketMessage(input: { ticketId: string; message?: string; attachment?: string | null; attachmentType?: string | null }) {
    const { data, error } = await supabase.rpc('gsa_provider_send_ticket_message', {
      p_ticket_id: input.ticketId,
      p_message: input.message || null,
      p_attachment: input.attachment || null,
      p_attachment_type: input.attachmentType || null,
    });
    return assertSuccess(data, error, 'Não foi possível enviar a mensagem.');
  },

  async requestProfileChange(input: { label: string; currentValue: string; newValue: string; reason: string }) {
    const { data, error } = await supabase.rpc('gsa_provider_request_profile_change', {
      p_label: input.label,
      p_current_value: input.currentValue,
      p_new_value: input.newValue,
      p_reason: input.reason,
    });
    return assertSuccess(data, error, 'Não foi possível solicitar a alteração.');
  },

  async requestDemandSupport(demandId: string, message: string) {
    const { data, error } = await supabase.rpc('gsa_provider_request_demand_support', {
      p_demanda_id: demandId,
      p_message: message,
    });
    return assertSuccess(data, error, 'Não foi possível solicitar suporte.');
  },
'''
content = content.replace('\n  async financialSnapshot() {', insert + '\n  async financialSnapshot() {', 1)
write(path, content)

# Validação forte de arquivos.
path = 'src/lib/providerStorage.ts'
content = read(path)
content = content.replace(
    "const PRIVATE_BUCKETS = new Set(['documentos_prestador', 'entregas_demandas']);",
    "const PRIVATE_BUCKETS = new Set(['documentos_prestador', 'entregas_demandas']);\nconst ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp', 'txt', 'zip', 'doc', 'docx', 'xls', 'xlsx']);"
)
content = content.replace(
    "  if (file.size > maxSizeMb * 1024 * 1024) {",
    "  const extension = safeExtension(file);\n  if (!file.type || !allowed.includes(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {\n    throw new Error(`O tipo do arquivo ${file.name} não é permitido.`);\n  }\n  if (file.size <= 0) {\n    throw new Error(`O arquivo ${file.name} está vazio.`);\n  }\n  if (file.size > maxSizeMb * 1024 * 1024) {"
)
content = content.replace(
    "  if (file.type && !allowed.includes(file.type)) {\n    throw new Error(`O tipo do arquivo ${file.name} não é permitido.`);\n  }\n",
    ""
)
write(path, content)

# Dashboard: snapshot seguro e tickets por RPC.
path = 'src/pages/Prestador/PrestadorDashboard.tsx'
content = read(path)
content = content.replace("import { supabase } from '../../lib/supabase';\n", '')
content = content.replace("import { createNotification } from '../../lib/notifications';\n", '')
content = re.sub(
    r"  useEffect\(\(\) => \{\n    let cancelled = false;\n    const load = async \(\) => \{.*?\n  \}, \[prestadorId, pendencies\.moduleDemandas, pendencies\.moduleFinanceiro, pendencies\.moduleDocumentos, pendencies\.moduleAgenda\]\);",
    '''  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const snapshot = await providerOperations.dashboardSnapshot();
        if (cancelled) return;
        setSaldo(Number(snapshot?.saldo || 0));
        setMetrics({
          demandasConcluidas: Number(snapshot?.demandas_concluidas || 0),
          agendamentosConcluidos: Number(snapshot?.agendamentos_concluidos || 0),
          documentosAprovados: Number(snapshot?.documentos_aprovados || 0),
        });
      } catch (loadError) {
        console.error('Erro ao carregar indicadores do prestador:', loadError);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [prestadorId, pendencies.total]);''',
    content,
    flags=re.S
)
content = re.sub(
    r"      const subject = `Solicitação de alteração: \$\{requestField\.label\}`;.*?      toast\.success\('Solicitação enviada para análise\.'\);",
    "      await providerOperations.requestProfileChange({\n        label: requestField.label,\n        currentValue: requestField.value,\n        newValue: requestValue.trim(),\n        reason: requestReason.trim(),\n      });\n      toast.success('Solicitação enviada para análise.');",
    content,
    flags=re.S
)
content = re.sub(
    r"      const subject = 'Análise de cadastro pendente';.*?      navigate\(routes\.provider\.support\(\)\);",
    "      await providerOperations.createTicket(\n        'Análise de cadastro pendente',\n        `Solicito informações sobre a análise do cadastro de ${prestador.nome_razao}.`,\n      );\n      navigate(routes.provider.support());",
    content,
    flags=re.S
)
write(path, content)

# Financeiro: sem notificação/log fora da transação e consultas limitadas.
path = 'src/components/prestador/PrestadorFinanceiro.tsx'
content = read(path)
content = content.replace("import { notificationService } from '../../lib/notificationService';\n", '')
content = content.replace("import { logService } from '../../lib/logService';\n", '')
content = content.replace(".order('created_at', { ascending: false }),", ".order('created_at', { ascending: false }).limit(100),")
content = re.sub(r"      await Promise\.allSettled\(\[.*?\]\);\n      toast\.success\('Solicitação de saque enviada com segurança\.'\);", "      toast.success('Solicitação de saque enviada com segurança.');", content, flags=re.S)
content = re.sub(r"      await logService\.logAction\(.*?\);\n      toast\.success\('Saque cancelado e valor devolvido à carteira\.'\);", "      toast.success('Saque cancelado e valor devolvido à carteira.');", content, flags=re.S)
write(path, content)

# Demandas: tudo transacional na RPC.
path = 'src/components/prestador/PrestadorDemandas.tsx'
content = read(path)
content = content.replace("import { notificationService, type AcaoOrigem } from '../../lib/notificationService';\n", '')
content = content.replace("import { logService } from '../../lib/logService';\n", '')
content = re.sub(r"const NOTIFICATION_ACTIONS:.*?const NOTIFICATION_TITLES:.*?\n\};\n", '', content, flags=re.S)
content = content.replace(".order('created_at', { ascending: false });", ".order('created_at', { ascending: false }).limit(100);")
content = content.replace(".order('created_at', { ascending: true });", ".order('created_at', { ascending: true }).limit(200);")
content = re.sub(r"  const notifyAndLog = async .*?\n  \};\n\n", '', content, flags=re.S)
content = re.sub(r"\n      await notifyAndLog\('accept'.*?\);", '', content)
content = re.sub(r"\n        await notifyAndLog\('reject'.*?\);", '', content)
content = re.sub(r"\n        await notifyAndLog\('counteroffer'.*?\);", '', content)
content = re.sub(r"\n        if \(selected\.os_id\) \{.*?\n        \}\n        await notifyAndLog\('deliver'.*?\);", '', content, flags=re.S)
content = re.sub(r"\n        if \(selected\.os_id\) \{.*?\n        \}\n        await notifyAndLog\('return'.*?\);", '', content, flags=re.S)
content = re.sub(
    r"        const \{ error \} = await supabase\.from\('prestador_suporte_demandas'\)\.insert\(\{.*?\n        \);",
    "        await providerOperations.requestDemandSupport(selected.id, supportMessage.trim());",
    content,
    flags=re.S
)
write(path, content)

# Agenda: eventos no banco e consultas limitadas.
path = 'src/components/prestador/PrestadorAgenda.tsx'
content = read(path)
content = content.replace("import { notificationService } from '../../lib/notificationService';\n", '')
content = content.replace("import { logService } from '../../lib/logService';\n", '')
content = content.replace(".order('data_inicio', { ascending: true }),", ".order('data_inicio', { ascending: true }).limit(100),")
content = content.replace(".order('created_at', { ascending: false }),", ".order('created_at', { ascending: false }).limit(100),")
content = re.sub(r"      const selectedDemand = demands\.find.*?\n      await Promise\.allSettled\(\[.*?\]\);", '', content, flags=re.S)
content = re.sub(r"      await Promise\.allSettled\(\[.*?\]\);\n      toast\.success\('Agendamento concluído\.'\);", "      toast.success('Agendamento concluído.');", content, flags=re.S)
content = re.sub(r"      await logService\.logAction\(.*?\);\n      toast\.success\('Agendamento excluído\.'\);", "      toast.success('Agendamento excluído.');", content, flags=re.S)
write(path, content)

# Documentos: remove referências substituídas e não duplica eventos.
path = 'src/components/prestador/PrestadorDocumentos.tsx'
content = read(path)
content = content.replace("import { notificationService } from '../../lib/notificationService';\n", '')
content = content.replace("import { logService } from '../../lib/logService';\n", '')
content = content.replace(".order('created_at', { ascending: false });", ".order('created_at', { ascending: false }).limit(100);")
content = content.replace("    const uploaded: string[] = [];", "    const uploaded: string[] = [];\n    const previousReferences = selected.urls || [];")
content = re.sub(
    r"      await Promise\.allSettled\(\[.*?\]\);\n      setProgress\(100\);",
    "      await Promise.allSettled(previousReferences.filter((reference) => !uploaded.includes(reference)).map((reference) => removeProviderPrivateFile(reference)));\n      await refreshCounts();\n      setProgress(100);",
    content,
    flags=re.S
)
write(path, content)

# Vouchers.
path = 'src/components/prestador/PrestadorVouchers.tsx'
content = read(path)
content = content.replace("import { notificationService } from '../../lib/notificationService';\n", '')
content = content.replace(".order('created_at', { ascending: false });", ".order('created_at', { ascending: false }).limit(100);")
content = re.sub(r"      await Promise\.allSettled\(\[.*?\]\);\n      toast\.success", "      await refreshCounts();\n      toast.success", content, flags=re.S)
write(path, content)

# Prêmios.
path = 'src/components/prestador/PrestadorPremios.tsx'
content = read(path)
content = content.replace("import { notificationService } from '../../lib/notificationService';\n", '')
content = content.replace(".order('created_at', { ascending: false });", ".order('created_at', { ascending: false }).limit(100);")
content = re.sub(r"      await Promise\.allSettled\(\[.*?\]\);\n      toast\.success", "      await refreshCounts();\n      toast.success", content, flags=re.S)
content = re.sub(
    r"      const subject = `Dúvida sobre o prêmio: \$\{prize\.titulo\}`;.*?      toast\.success\('Atendimento aberto com sucesso\.'\);",
    "      await providerOperations.createTicket(\n        `Dúvida sobre o prêmio: ${prize.titulo}`,\n        `Solicito informações sobre o prêmio \"${prize.titulo}\".`,\n      );\n      toast.success('Atendimento aberto com sucesso.');",
    content,
    flags=re.S
)
write(path, content)

# Promoções respeitam início e têm limite.
path = 'src/components/prestador/PrestadorPromocoes.tsx'
content = read(path)
content = content.replace(".order('created_at', { ascending: false }),", ".order('created_at', { ascending: false }).limit(100),")
content = content.replace(".eq('prestador_id', prestadorId),", ".eq('prestador_id', prestadorId).limit(100),")
content = content.replace(
    "    const ended = item.status !== 'ativa' || (!!item.data_fim && new Date(item.data_fim).getTime() < now);\n    return activeTab === 'ativas' ? !ended : ended || activeIds.has(item.id);",
    "    const notStarted = !!item.data_inicio && new Date(item.data_inicio).getTime() > now;\n    const ended = item.status !== 'ativa' || (!!item.data_fim && new Date(item.data_fim).getTime() < now);\n    return activeTab === 'ativas' ? !notStarted && !ended : notStarted || ended || activeIds.has(item.id);"
)
write(path, content)

# Suporte usa RPC e limpa upload órfão.
path = 'src/components/prestador/PrestadorSuporte.tsx'
content = read(path)
content = content.replace("import { notificationService } from '../../lib/notificationService';\n", '')
content = content.replace("import { resolveProviderFileUrl, uploadProviderPrivateFile } from '../../lib/providerStorage';", "import { removeProviderPrivateFile, resolveProviderFileUrl, uploadProviderPrivateFile } from '../../lib/providerStorage';")
content = content.replace("import { supabase } from '../../lib/supabase';\n", "import { supabase } from '../../lib/supabase';\nimport { providerOperations } from '../../lib/providerOperations';\n")
content = content.replace("const rows = (data || []) as ProviderTicket[];", "const rows = (data || []).slice(0, 100) as ProviderTicket[];")
content = content.replace(".order('data_envio', { ascending: true });", ".order('data_envio', { ascending: true }).limit(200);")
content = re.sub(
    r"      const \{ data, error \} = await supabase\.from\('tickets'\)\.insert\(\{.*?      await notificationService\.notifyAdmin\(.*?\);",
    "      await providerOperations.createTicket(subject.trim(), description.trim());",
    content,
    flags=re.S
)
content = re.sub(
    r"      const \{ data: provider, error: providerError \} = await supabase.*?      if \(error\) throw error;\n\n      await notificationService\.notifyAdmin\(.*?\);",
    "      await providerOperations.sendTicketMessage({\n        ticketId: selectedTicket.id,\n        message: newMessage.trim(),\n        attachment: attachmentReference,\n        attachmentType: attachment?.type || null,\n      });",
    content,
    flags=re.S
)
content = content.replace(
    "    } catch (error: any) {\n      toast.error(error?.message || 'Não foi possível enviar a mensagem.');",
    "    } catch (error: any) {\n      if (attachmentReference) await Promise.allSettled([removeProviderPrivateFile(attachmentReference)]);\n      toast.error(error?.message || 'Não foi possível enviar a mensagem.');",
    1
)
write(path, content)

# Contadores por RPC e polling reduzido.
path = 'src/hooks/useProviderNotifications.tsx'
content = read(path)
content = content.replace('const HEARTBEAT_INTERVAL_MS = 30_000;', 'const HEARTBEAT_INTERVAL_MS = 120_000;')
content = re.sub(
    r"    const \[\{ data: rpcData, error: rpcError \}, \{ data: demands, error: demandError \}\] = await Promise\.all\(\[.*?    if \(demandError\) throw demandError;\n\n    const source = Array\.isArray\(rpcData\) \? rpcData\[0\] \|\| \{\} : rpcData \|\| \{\};\n    const statuses = \(demands \|\| \[\]\)\.map\(\(item: any\) => item\.status\);\n    const novas = statuses\.filter\(\(status\) => \['aguardando_aceite', 'aberta'\]\.includes\(status\)\)\.length;\n    const negociacao = statuses\.filter\(\(status\) => \['em_negociacao', 'contraproposta_prestador', 'contraproposta_admin_final'\]\.includes\(status\)\)\.length;\n    const ativas = statuses\.filter\(\(status\) => \['ativa', 'em_analise', 'em_ajuste'\]\.includes\(status\)\)\.length;",
    "    const source = await providerOperations.pendencySnapshot();\n    const novas = Number(source?.demandas_novas || 0);\n    const negociacao = Number(source?.demandas_negociacao || 0);\n    const ativas = Number(source?.servicos_ativos || 0);",
    content,
    flags=re.S
)
old = "      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes' }, (payload) => {\n        const row = payload.new as any;\n        const isOwn = row.prestador_id && String(row.prestador_id) === String(prestadorId);\n        const isBroadcast = ['broadcast_prestadores', 'broadcast_todos'].includes(row.destinatario_tipo);\n        if (!isOwn && !isBroadcast) return;\n        playPremiumBeep();\n        showAnimatedToast(row.titulo || 'Nova notificação', row.mensagem || '', row.modulo || 'bell');\n        scheduleRefresh();\n      })"
new = "      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: `prestador_id=eq.${prestadorId}` }, (payload) => {\n        const row = payload.new as any;\n        playPremiumBeep();\n        showAnimatedToast(row.titulo || 'Nova notificação', row.mensagem || '', row.modulo || 'bell');\n        scheduleRefresh();\n      })\n      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notificacoes', filter: 'destinatario_tipo=in.(broadcast_prestadores,broadcast_todos)' }, (payload) => {\n        const row = payload.new as any;\n        playPremiumBeep();\n        showAnimatedToast(row.titulo || 'Nova notificação', row.mensagem || '', row.modulo || 'bell');\n        scheduleRefresh();\n      })"
if old not in content:
    raise RuntimeError('useProviderNotifications: canal de notificações não encontrado')
content = content.replace(old, new)
write(path, content)

# Contrato de segurança do prestador.
test_content = r'''import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
async function file(path: string) { return readFile(resolve(root, path), 'utf8'); }
async function contains(path: string, values: string[]) {
  const content = await file(path);
  for (const value of values) assert.ok(content.includes(value), `${path}: contrato ausente: ${value}`);
  return content;
}
async function excludes(path: string, values: string[]) {
  const content = await file(path);
  for (const value of values) assert.ok(!content.includes(value), `${path}: padrão proibido presente: ${value}`);
}

async function main() {
  const migration = await contains('supabase/migrations/20260720235900_provider_portal_audit_hardening.sql', [
    'gsa_assert_current_provider_any_status',
    "COALESCE(v_status, '') <> 'ativo'",
    'gsa_provider_create_ticket',
    'gsa_provider_send_ticket_message',
    'gsa_provider_request_demand_support',
    'pg_advisory_xact_lock',
    "data_inicio <= now()",
    "data_inicio IS NULL OR data_inicio <= current_date",
    "v_link !~* '^https?://",
    'gsa_guard_provider_direct_insert',
    "gsa_admin_has_module('cadastro')",
    "gsa_admin_has_module('atendimento')",
    "gsa_admin_has_module('operacoes')",
    'gsa_provider_audit_events',
  ]);
  assert.ok(migration.indexOf('gsa_assert_current_provider_any_status') < migration.indexOf('gsa_assert_current_provider()'));

  await contains('src/lib/providerOperations.ts', [
    'gsa_provider_dashboard_snapshot', 'gsa_provider_pendency_snapshot',
    'gsa_provider_create_ticket', 'gsa_provider_send_ticket_message',
    'gsa_provider_request_profile_change', 'gsa_provider_request_demand_support',
  ]);
  await contains('src/lib/providerStorage.ts', ['ALLOWED_EXTENSIONS', '!file.type', 'file.size <= 0']);
  await contains('src/hooks/useProviderNotifications.tsx', ['120_000', 'pendencySnapshot', 'destinatario_tipo=in.']);
  await excludes('src/components/prestador/PrestadorSuporte.tsx', ["from('tickets').insert", "from('ticket_mensagens').insert", 'notificationService.notifyAdmin']);
  await excludes('src/components/prestador/PrestadorDemandas.tsx', ["from('prestador_suporte_demandas').insert", "from('os_notas').insert", 'notificationService.notifyAdmin']);
  await excludes('src/pages/Prestador/PrestadorDashboard.tsx', ["from('tickets').insert", 'createNotification(']);
  await contains('src/components/prestador/PrestadorDocumentos.tsx', ['previousReferences', 'removeProviderPrivateFile']);
  await contains('src/components/prestador/PrestadorPromocoes.tsx', ['notStarted']);
  console.log('Painel do Prestador: contratos de autorização, transação, Storage e suporte validados.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
'''
write('scripts/check-provider-portal-security-contracts.ts', test_content)

# Scripts e workflows permanentes.
path = 'package.json'
content = read(path)
content = content.replace('"test:client-security": "tsx scripts/check-client-portal-security-contracts.ts",', '"test:client-security": "tsx scripts/check-client-portal-security-contracts.ts",\n    "test:provider": "tsx scripts/check-provider-portal-security-contracts.ts",')
write(path, content)

path = '.github/workflows/quality.yml'
content = read(path)
needle = "      - name: GSA Viagens contracts\n        if: steps.typescript.outputs.exit_code == '0' && steps.client_security.outputs.exit_code == '0'\n        run: npm run test:travel"
replacement = "      - name: Provider portal security contracts\n        if: steps.typescript.outputs.exit_code == '0' && steps.client_security.outputs.exit_code == '0'\n        run: npm run test:provider\n\n" + needle
if needle not in content:
    raise RuntimeError('quality.yml: ponto de inserção não encontrado')
write(path, content.replace(needle, replacement))

path = '.github/workflows/provider-portal-validation.yml'
content = read(path)
content = content.replace("      - 'supabase/migrations/20260720210000_harden_provider_portal.sql'", "      - 'supabase/migrations/20260720210000_harden_provider_portal.sql'\n      - 'supabase/migrations/*provider*portal*.sql'\n      - 'scripts/check-provider-portal-security-contracts.ts'")
content = content.replace("      - name: Production build\n        run: npm run build", "      - name: Provider security contracts\n        run: npm run test:provider\n      - name: Production build\n        run: npm run build")
write(path, content)

print('Correções do Painel do Prestador aplicadas ao working tree.')
