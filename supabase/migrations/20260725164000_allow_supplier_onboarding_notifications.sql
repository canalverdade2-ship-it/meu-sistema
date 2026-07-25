-- Allow supplier onboarding and public registration actions in client notification guard function.
-- Problem: When submitting a supplier pre-registration form (gsa_public_register_supplier),
-- the notification trigger raised "Ação de notificação administrativa não permitida." or "Sessão de cliente inválida para criar notificação."
-- because supplier onboarding actions were checked against client session constraints.

CREATE OR REPLACE FUNCTION public.gsa_guard_client_notification_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor_type TEXT;
  v_actor_id UUID;
  v_recent_count INTEGER;
  v_allowed_admin_actions CONSTANT TEXT[] := ARRAY[
    'ticket_aberto_cliente', 'ticket_mensagem_cliente_adm', 'documento_enviado_cliente',
    'comprovante_enviado', 'premio_resgate_solicitado', 'voucher_resgate_solicitado',
    'assinatura_cancelamento_solicitado', 'orcamento_criado', 'orcamento_negociacao',
    'ticket_aberto', 'ticket_mensagem_cliente', 'saque_solicitado',
    'transferencia_solicitada', 'cadastro_novo_cliente', 'exclusao_solicitada',
    'os_documento_enviado', 'emprestimo_comentario', 'emprestimo_aceito',
    'emprestimo_assinado', 'quitacao', 'emprestimo_criado',
    'documento_cliente_enviado', 'sistema',
    'cadastro_cliente', 'cadastro_prestador', 'cadastro_fornecedor',
    'cadastro_fornecedor_reenviado', 'perfil_fornecedor_atualizado'
  ];
BEGIN
  -- Permite notificações do sistema/onboarding para administradores geradas por fluxos públicos e RPCs
  IF NEW.destinatario_tipo = 'admin' AND COALESCE(NEW.acao_origem, '') IN (
    'cadastro_fornecedor', 'cadastro_fornecedor_reenviado', 'cadastro_prestador',
    'cadastro_cliente', 'orcamento_criado', 'perfil_fornecedor_atualizado'
  ) THEN
    NEW.prioridade := CASE WHEN NEW.prioridade = 'alta' THEN 'alta' ELSE 'normal' END;
    NEW.tipo := COALESCE(NULLIF(NEW.tipo, ''), 'sistema');
    NEW.lida := false;
    NEW.data_criacao := COALESCE(NEW.data_criacao, NOW());
    RETURN NEW;
  END IF;

  v_actor_type := public.gsa_jwt_actor_type();
  v_actor_id := public.gsa_jwt_actor_id();
  IF v_actor_type <> 'cliente' THEN RETURN NEW; END IF;
  IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida para criar notificação.'; END IF;

  NEW.titulo := left(trim(COALESCE(NEW.titulo, '')), 160);
  NEW.mensagem := left(trim(COALESCE(NEW.mensagem, '')), 2000);
  NEW.modulo := left(trim(COALESCE(NEW.modulo, 'sistema')), 80);
  NEW.contexto := COALESCE(NEW.contexto, '{}'::JSONB) || jsonb_build_object('actor_id', v_actor_id, 'actor_type', 'cliente');
  IF NEW.titulo = '' OR NEW.mensagem = '' THEN RAISE EXCEPTION 'Título e mensagem são obrigatórios.'; END IF;

  SELECT count(*) INTO v_recent_count
  FROM public.notificacoes n
  WHERE n.data_criacao >= NOW() - INTERVAL '1 minute'
    AND n.contexto ->> 'actor_id' = v_actor_id::TEXT;
  IF v_recent_count >= 20 THEN RAISE EXCEPTION 'Limite de notificações excedido. Aguarde antes de tentar novamente.'; END IF;

  IF NEW.destinatario_tipo IS NULL AND NEW.cliente_id = v_actor_id THEN NEW.destinatario_tipo := 'cliente'; END IF;
  IF NEW.destinatario_tipo = 'cliente' THEN
    IF NEW.cliente_id IS DISTINCT FROM v_actor_id OR NEW.prestador_id IS NOT NULL OR NEW.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'Cliente não pode criar notificação para outro usuário.';
    END IF;
  ELSIF NEW.destinatario_tipo = 'admin' THEN
    IF NEW.cliente_id IS NOT NULL OR NEW.prestador_id IS NOT NULL OR NEW.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'Notificação administrativa do cliente possui destinatário inválido.';
    END IF;
    IF COALESCE(NEW.acao_origem, 'sistema') <> ALL(v_allowed_admin_actions) THEN
      RAISE EXCEPTION 'Ação de notificação administrativa não permitida.';
    END IF;
    NEW.prioridade := CASE WHEN NEW.prioridade = 'alta' THEN 'alta' ELSE 'normal' END;
  ELSE
    RAISE EXCEPTION 'Tipo de destinatário não permitido para sessão de cliente.';
  END IF;
  NEW.tipo := COALESCE(NULLIF(NEW.tipo, ''), 'sistema');
  NEW.lida := false;
  NEW.data_criacao := COALESCE(NEW.data_criacao, NOW());
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_guard_client_notification_insert() FROM PUBLIC, anon, authenticated;
