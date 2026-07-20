-- Segurança e consistência operacional do Portal do Prestador
-- Todas as operações sensíveis usam a identidade emitida pela sessão GSA/Supabase.

BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_current_actor_type()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
$$;

CREATE OR REPLACE FUNCTION public.gsa_current_actor_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id text;
BEGIN
  v_actor_id := auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id';
  IF v_actor_id IS NULL OR v_actor_id = '' THEN
    RETURN NULL;
  END IF;
  RETURN v_actor_id::uuid;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_assert_current_provider()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid;
BEGIN
  IF public.gsa_current_actor_type() <> 'prestador' THEN
    RAISE EXCEPTION 'Acesso permitido somente ao prestador autenticado';
  END IF;

  v_provider_id := public.gsa_current_actor_id();
  IF v_provider_id IS NULL THEN
    RAISE EXCEPTION 'Sessão do prestador inválida';
  END IF;

  RETURN v_provider_id;
END;
$$;

-- Leitura individual de notificações broadcast.
CREATE TABLE IF NOT EXISTS public.notificacao_leituras (
  notificacao_id uuid NOT NULL REFERENCES public.notificacoes(id) ON DELETE CASCADE,
  ator_tipo text NOT NULL,
  ator_id uuid NOT NULL,
  lida_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notificacao_id, ator_tipo, ator_id)
);

ALTER TABLE public.notificacao_leituras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS notificacao_leituras_select_own ON public.notificacao_leituras;
CREATE POLICY notificacao_leituras_select_own
ON public.notificacao_leituras FOR SELECT TO authenticated
USING (
  ator_tipo = public.gsa_current_actor_type()
  AND ator_id = public.gsa_current_actor_id()
);

DROP POLICY IF EXISTS notificacao_leituras_insert_own ON public.notificacao_leituras;
CREATE POLICY notificacao_leituras_insert_own
ON public.notificacao_leituras FOR INSERT TO authenticated
WITH CHECK (
  ator_tipo = public.gsa_current_actor_type()
  AND ator_id = public.gsa_current_actor_id()
);

CREATE OR REPLACE FUNCTION public.gsa_provider_mark_notification_read(p_notificacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.notificacoes n
    WHERE n.id = p_notificacao_id
      AND (
        n.prestador_id = v_provider_id
        OR n.destinatario_tipo IN ('broadcast_prestadores', 'broadcast_todos')
      )
  ) THEN
    RAISE EXCEPTION 'Notificação não encontrada para este prestador';
  END IF;

  INSERT INTO public.notificacao_leituras (notificacao_id, ator_tipo, ator_id)
  VALUES (p_notificacao_id, 'prestador', v_provider_id)
  ON CONFLICT (notificacao_id, ator_tipo, ator_id)
  DO UPDATE SET lida_em = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  INSERT INTO public.notificacao_leituras (notificacao_id, ator_tipo, ator_id)
  SELECT n.id, 'prestador', v_provider_id
  FROM public.notificacoes n
  WHERE n.prestador_id = v_provider_id
     OR n.destinatario_tipo IN ('broadcast_prestadores', 'broadcast_todos')
  ON CONFLICT (notificacao_id, ator_tipo, ator_id)
  DO UPDATE SET lida_em = now();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Snapshot financeiro calculado exclusivamente no banco.
CREATE OR REPLACE FUNCTION public.gsa_provider_financial_snapshot()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_balance numeric := 0;
  v_pending numeric := 0;
BEGIN
  SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -valor END), 0)
  INTO v_balance
  FROM public.prestador_transacoes
  WHERE prestador_id = v_provider_id
    AND status = 'concluido';

  SELECT COALESCE(SUM(valor), 0)
  INTO v_pending
  FROM public.prestador_saques
  WHERE prestador_id = v_provider_id
    AND status = 'pendente';

  RETURN jsonb_build_object(
    'success', true,
    'saldo', v_balance,
    'saques_pendentes', v_pending
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_request_withdrawal(
  p_valor numeric,
  p_tipo_chave_pix text,
  p_chave_pix text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_balance numeric := 0;
  v_saque_id uuid;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor de saque inválido';
  END IF;
  IF COALESCE(trim(p_tipo_chave_pix), '') = '' OR COALESCE(trim(p_chave_pix), '') = '' THEN
    RAISE EXCEPTION 'Informe os dados PIX';
  END IF;

  -- Serializa solicitações do mesmo prestador.
  PERFORM 1 FROM public.prestadores WHERE id = v_provider_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prestador não encontrado'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.prestador_saques
    WHERE prestador_id = v_provider_id AND status = 'pendente'
  ) THEN
    RAISE EXCEPTION 'Já existe um saque pendente';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN tipo = 'credito' THEN valor ELSE -valor END), 0)
  INTO v_balance
  FROM public.prestador_transacoes
  WHERE prestador_id = v_provider_id AND status = 'concluido';

  IF p_valor > v_balance THEN
    RAISE EXCEPTION 'Saldo insuficiente';
  END IF;

  INSERT INTO public.prestador_saques (
    prestador_id, valor, valor_liquido, taxa_aplicada,
    tipo_chave_pix, chave_pix, status, data_vencimento
  ) VALUES (
    v_provider_id, p_valor, p_valor, 0,
    trim(p_tipo_chave_pix), trim(p_chave_pix), 'pendente',
    now() + interval '7 days'
  ) RETURNING id INTO v_saque_id;

  INSERT INTO public.prestador_transacoes (
    prestador_id, tipo, valor, descricao, status, saque_id
  ) VALUES (
    v_provider_id, 'debito', p_valor,
    'Solicitação de saque via PIX', 'concluido', v_saque_id
  );

  RETURN jsonb_build_object('success', true, 'saque_id', v_saque_id, 'saldo_anterior', v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_cancel_withdrawal(
  p_saque_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_saque public.prestador_saques%ROWTYPE;
BEGIN
  IF COALESCE(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento';
  END IF;

  SELECT * INTO v_saque
  FROM public.prestador_saques
  WHERE id = p_saque_id AND prestador_id = v_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Saque não encontrado'; END IF;
  IF v_saque.status <> 'pendente' THEN RAISE EXCEPTION 'Este saque não pode mais ser cancelado'; END IF;

  UPDATE public.prestador_saques
  SET status = 'cancelado', motivo_cancelamento = trim(p_motivo), observacao = trim(p_motivo)
  WHERE id = p_saque_id;

  INSERT INTO public.prestador_transacoes (
    prestador_id, tipo, valor, descricao, status, saque_id
  ) VALUES (
    v_provider_id, 'credito', v_saque.valor,
    'Estorno de saque cancelado', 'concluido', p_saque_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_redeem_voucher(p_voucher_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_voucher public.prestador_vouchers%ROWTYPE;
BEGIN
  SELECT * INTO v_voucher
  FROM public.prestador_vouchers
  WHERE id = p_voucher_id AND prestador_id = v_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Voucher não encontrado'; END IF;
  IF v_voucher.status NOT IN ('ativo', 'disponivel') THEN
    RAISE EXCEPTION 'Voucher já utilizado ou indisponível';
  END IF;

  UPDATE public.prestador_vouchers
  SET status = 'pago', updated_at = now()
  WHERE id = p_voucher_id;

  INSERT INTO public.prestador_transacoes (
    prestador_id, tipo, valor, descricao, status, ref_id
  ) VALUES (
    v_provider_id, 'credito', v_voucher.valor,
    'Resgate de Voucher: ' || COALESCE(v_voucher.codigo, p_voucher_id::text),
    'concluido', p_voucher_id
  );

  RETURN jsonb_build_object('success', true, 'valor', v_voucher.valor);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_redeem_prize(p_premio_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_title text;
  v_status text;
BEGIN
  SELECT titulo, status INTO v_title, v_status
  FROM public.prestador_premios
  WHERE id = p_premio_id AND prestador_id = v_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Prêmio não encontrado'; END IF;
  IF v_status <> 'disponivel' THEN RAISE EXCEPTION 'Prêmio já resgatado ou indisponível'; END IF;

  UPDATE public.prestador_premios
  SET status = 'resgatado', data_resgate = now()
  WHERE id = p_premio_id;

  RETURN jsonb_build_object('success', true, 'titulo', v_title);
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_prestador_promocao_ativacao
ON public.prestador_promocoes_ativacoes(prestador_id, promocao_id);

CREATE OR REPLACE FUNCTION public.gsa_provider_activate_promotion(p_promocao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.prestador_promocoes
    WHERE id = p_promocao_id
      AND status = 'ativa'
      AND (data_fim IS NULL OR data_fim >= current_date)
  ) THEN
    RAISE EXCEPTION 'Promoção não está disponível';
  END IF;

  INSERT INTO public.prestador_promocoes_ativacoes(prestador_id, promocao_id, ativa)
  VALUES (v_provider_id, p_promocao_id, true)
  ON CONFLICT (prestador_id, promocao_id)
  DO UPDATE SET ativa = true;

  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_update_profile(
  p_telefone text,
  p_cep text,
  p_numero text,
  p_area_servico text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  UPDATE public.prestadores
  SET telefone = NULLIF(regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g'), ''),
      cep = NULLIF(regexp_replace(COALESCE(p_cep, ''), '\D', '', 'g'), ''),
      numero = NULLIF(trim(COALESCE(p_numero, '')), ''),
      area_servico = NULLIF(trim(COALESCE(p_area_servico, '')), '')
  WHERE id = v_provider_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Prestador não encontrado'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_create_schedule(
  p_demanda_id uuid,
  p_data_inicio timestamptz,
  p_data_fim timestamptz,
  p_observacoes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_id uuid;
BEGIN
  IF p_data_inicio < now() THEN RAISE EXCEPTION 'Não é permitido agendar no passado'; END IF;
  IF p_data_fim <= p_data_inicio THEN RAISE EXCEPTION 'A data final deve ser posterior à inicial'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.prestador_demandas
    WHERE id = p_demanda_id AND prestador_id = v_provider_id
      AND status IN ('ativa', 'em_ajuste')
  ) THEN
    RAISE EXCEPTION 'Demanda não disponível para agendamento';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.prestador_agendamentos
    WHERE prestador_id = v_provider_id
      AND status = 'agendado'
      AND tstzrange(data_inicio, data_fim, '[)') && tstzrange(p_data_inicio, p_data_fim, '[)')
  ) THEN
    RAISE EXCEPTION 'Existe conflito com outro agendamento';
  END IF;

  INSERT INTO public.prestador_agendamentos(
    prestador_id, demanda_id, data_inicio, data_fim, observacoes, status
  ) VALUES (
    v_provider_id, p_demanda_id, p_data_inicio, p_data_fim, NULLIF(trim(COALESCE(p_observacoes, '')), ''), 'agendado'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('success', true, 'agendamento_id', v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_complete_schedule(p_agendamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  UPDATE public.prestador_agendamentos
  SET status = 'concluido'
  WHERE id = p_agendamento_id
    AND prestador_id = v_provider_id
    AND status = 'agendado';

  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado ou já finalizado'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_delete_schedule(p_agendamento_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  DELETE FROM public.prestador_agendamentos
  WHERE id = p_agendamento_id
    AND prestador_id = v_provider_id
    AND status = 'agendado';

  IF NOT FOUND THEN RAISE EXCEPTION 'Agendamento não encontrado ou não pode ser excluído'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_submit_document(
  p_documento_id uuid,
  p_urls text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
BEGIN
  IF COALESCE(array_length(p_urls, 1), 0) = 0 THEN RAISE EXCEPTION 'Nenhum arquivo enviado'; END IF;

  UPDATE public.prestador_documentos
  SET urls = p_urls, status = 'em_analise', motivo_rejeicao = NULL
  WHERE id = p_documento_id
    AND prestador_id = v_provider_id
    AND status IN ('pendente', 'reprovado');

  IF NOT FOUND THEN RAISE EXCEPTION 'Documento não encontrado ou não disponível para envio'; END IF;
  RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_provider_transition_demand(
  p_demanda_id uuid,
  p_action text,
  p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_provider_id uuid := public.gsa_assert_current_provider();
  v_demand public.prestador_demandas%ROWTYPE;
  v_value numeric;
  v_reason text;
  v_files text[];
  v_event text;
  v_history text;
BEGIN
  SELECT * INTO v_demand
  FROM public.prestador_demandas
  WHERE id = p_demanda_id AND prestador_id = v_provider_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Demanda não encontrada para este prestador'; END IF;

  CASE p_action
    WHEN 'accept' THEN
      IF v_demand.status NOT IN ('aguardando_aceite', 'aberta', 'contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para aceite';
      END IF;
      v_value := COALESCE(v_demand.valor_proposto_admin, v_demand.valor_final, 0);
      UPDATE public.prestador_demandas
      SET status = 'ativa', data_inicio = now(), valor_final = v_value
      WHERE id = p_demanda_id;
      v_event := 'aceite';
      v_history := 'Proposta aceita pelo prestador pelo valor de ' || v_value::text;

    WHEN 'reject' THEN
      IF v_demand.status NOT IN ('aguardando_aceite', 'aberta', 'em_negociacao', 'contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para recusa';
      END IF;
      v_reason := NULLIF(trim(p_payload ->> 'motivo'), '');
      IF v_reason IS NULL THEN RAISE EXCEPTION 'Informe o motivo da recusa'; END IF;
      UPDATE public.prestador_demandas
      SET status = 'aguardando_atribuicao', prestador_id = NULL
      WHERE id = p_demanda_id;
      v_event := 'recusa';
      v_history := 'Proposta recusada pelo prestador. Motivo: ' || v_reason;

    WHEN 'counteroffer' THEN
      IF v_demand.status NOT IN ('aguardando_aceite', 'aberta', 'em_negociacao', 'contraproposta_admin_final') THEN
        RAISE EXCEPTION 'A demanda não está disponível para negociação';
      END IF;
      v_value := NULLIF(p_payload ->> 'valor', '')::numeric;
      IF v_value IS NULL OR v_value <= 0 THEN RAISE EXCEPTION 'Valor da contraproposta inválido'; END IF;
      v_reason := NULLIF(trim(p_payload ->> 'motivo'), '');
      UPDATE public.prestador_demandas
      SET status = 'contraproposta_prestador', valor_proposto_prestador = v_value, motivo_negociacao = v_reason
      WHERE id = p_demanda_id;
      v_event := 'negociacao';
      v_history := 'Contraproposta do prestador: ' || v_value::text || COALESCE('. ' || v_reason, '');

    WHEN 'deliver' THEN
      IF v_demand.status NOT IN ('ativa', 'em_ajuste') THEN
        RAISE EXCEPTION 'A demanda não está disponível para entrega';
      END IF;
      v_files := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'arquivos', '[]'::jsonb)));
      UPDATE public.prestador_demandas
      SET status = 'em_analise',
          data_entrega_prestador = COALESCE(NULLIF(p_payload ->> 'data_entrega', '')::timestamptz, now()),
          observacao_entrega = NULLIF(trim(p_payload ->> 'observacao'), ''),
          link_resultado = NULLIF(trim(p_payload ->> 'link'), ''),
          arquivos_resultado = v_files,
          status_ajuste = CASE WHEN status_ajuste = 'solicitado' THEN 'entregue' ELSE status_ajuste END
      WHERE id = p_demanda_id;
      v_event := 'entrega';
      v_history := 'Entrega realizada pelo prestador e enviada para análise.';

    WHEN 'return' THEN
      IF v_demand.status NOT IN ('ativa', 'em_ajuste') THEN
        RAISE EXCEPTION 'A demanda não pode ser devolvida neste status';
      END IF;
      v_reason := NULLIF(trim(p_payload ->> 'motivo'), '');
      IF v_reason IS NULL THEN RAISE EXCEPTION 'Informe o motivo da devolução'; END IF;
      v_files := ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_payload -> 'arquivos', '[]'::jsonb)));
      UPDATE public.prestador_demandas
      SET prestador_id = NULL,
          status = 'aguardando_atribuicao',
          detalhes = COALESCE(detalhes, descricao, '') || E'\n\n--- DEVOLUÇÃO DO PRESTADOR ---\nMotivo: ' || v_reason,
          arquivos_transferencia = v_files
      WHERE id = p_demanda_id;
      v_event := 'transferencia';
      v_history := 'Demanda devolvida para a equipe interna. Motivo: ' || v_reason;

    ELSE
      RAISE EXCEPTION 'Ação de demanda inválida';
  END CASE;

  INSERT INTO public.prestador_demandas_historico(
    demanda_id, tipo_evento, motivo, prestador_origem_id, valor_proposto
  ) VALUES (
    p_demanda_id, v_event, v_history, v_provider_id,
    CASE WHEN p_action = 'counteroffer' THEN v_value ELSE NULL END
  );

  RETURN jsonb_build_object('success', true, 'action', p_action);
END;
$$;

-- Buckets privados. O frontend passa a armazenar storage://bucket/caminho e gera URL assinada sob demanda.
UPDATE storage.buckets
SET public = false
WHERE id IN ('documentos_prestador', 'entregas_demandas');

DROP POLICY IF EXISTS provider_private_files_select ON storage.objects;
CREATE POLICY provider_private_files_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND (
    public.gsa_current_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_current_actor_type() = 'prestador'
      AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
    )
  )
);

DROP POLICY IF EXISTS provider_private_files_insert ON storage.objects;
CREATE POLICY provider_private_files_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND public.gsa_current_actor_type() = 'prestador'
  AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
);

DROP POLICY IF EXISTS provider_private_files_update ON storage.objects;
CREATE POLICY provider_private_files_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND public.gsa_current_actor_type() = 'prestador'
  AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
)
WITH CHECK (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND public.gsa_current_actor_type() = 'prestador'
  AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
);

DROP POLICY IF EXISTS provider_private_files_delete ON storage.objects;
CREATE POLICY provider_private_files_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id IN ('documentos_prestador', 'entregas_demandas')
  AND public.gsa_current_actor_type() = 'prestador'
  AND (storage.foldername(name))[1] = public.gsa_current_actor_id()::text
);

GRANT EXECUTE ON FUNCTION public.gsa_provider_mark_notification_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_mark_all_notifications_read() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_financial_snapshot() TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_request_withdrawal(numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_cancel_withdrawal(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_redeem_voucher(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_redeem_prize(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_activate_promotion(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_update_profile(text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_create_schedule(uuid, timestamptz, timestamptz, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_complete_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_delete_schedule(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_submit_document(uuid, text[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_provider_transition_demand(uuid, text, jsonb) TO authenticated;

COMMIT;
