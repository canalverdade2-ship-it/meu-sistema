BEGIN;

CREATE TABLE IF NOT EXISTS public.gsa_afiliado_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE,
  remetente_afiliado_id uuid NOT NULL REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  destinatario_afiliado_id uuid NOT NULL REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT,
  valor numeric(14,2) NOT NULL,
  status text NOT NULL DEFAULT 'concluida',
  codigo text NOT NULL UNIQUE,
  observacao text,
  remetente_saldo_antes numeric(14,2) NOT NULL DEFAULT 0,
  remetente_saldo_depois numeric(14,2) NOT NULL DEFAULT 0,
  destinatario_saldo_antes numeric(14,2) NOT NULL DEFAULT 0,
  destinatario_saldo_depois numeric(14,2) NOT NULL DEFAULT 0,
  concluida_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gsa_afiliado_transferencias_valor_check CHECK (valor > 0),
  CONSTRAINT gsa_afiliado_transferencias_status_check CHECK (status IN ('concluida','cancelada')),
  CONSTRAINT gsa_afiliado_transferencias_distintos_check CHECK (remetente_afiliado_id <> destinatario_afiliado_id),
  CONSTRAINT gsa_afiliado_transferencias_codigo_check CHECK (codigo ~ '^TRF-[0-9A-F]{12}$')
);

CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_transferencias_remetente
  ON public.gsa_afiliado_transferencias(remetente_afiliado_id, concluida_em DESC);

CREATE INDEX IF NOT EXISTS ix_gsa_afiliado_transferencias_destinatario
  ON public.gsa_afiliado_transferencias(destinatario_afiliado_id, concluida_em DESC);

DROP TRIGGER IF EXISTS trg_affiliate_touch_transferencias ON public.gsa_afiliado_transferencias;
CREATE TRIGGER trg_affiliate_touch_transferencias
BEFORE UPDATE ON public.gsa_afiliado_transferencias
FOR EACH ROW EXECUTE FUNCTION public.gsa_affiliate_touch_updated_at();

ALTER TABLE public.gsa_afiliado_transferencias ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gsa_afiliado_transferencias_no_direct_access ON public.gsa_afiliado_transferencias;
CREATE POLICY gsa_afiliado_transferencias_no_direct_access
ON public.gsa_afiliado_transferencias
FOR ALL
USING (false)
WITH CHECK (false);

GRANT ALL ON TABLE public.gsa_afiliado_transferencias TO authenticated, service_role;
REVOKE ALL ON TABLE public.gsa_afiliado_transferencias FROM anon;

CREATE OR REPLACE FUNCTION public.gsa_affiliate_available_balance(p_afiliado_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT greatest(
    coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = p_afiliado_id AND status = 'disponivel'), 0)
    + coalesce((SELECT c.saldo_carteira FROM public.gsa_afiliados a JOIN public.clientes c ON c.id = a.cliente_id WHERE a.id = p_afiliado_id), 0)
    - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = p_afiliado_id AND status IN ('solicitado','aprovado')), 0),
    0
  )::numeric(14,2);
$$;

CREATE OR REPLACE FUNCTION public.gsa_client_lookup_affiliate_transfer_target(
  p_sessao_id uuid,
  p_session_token text,
  p_identificador text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
  v_identifier text := lower(trim(coalesce(p_identificador, '')));
  v_digits text := regexp_replace(coalesce(p_identificador, ''), '\D', '', 'g');
  v_sender public.gsa_afiliados%rowtype;
  v_target record;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_actor.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.';
  END IF;

  SELECT * INTO v_sender
  FROM public.gsa_afiliados
  WHERE cliente_id = v_actor.cliente_id AND status = 'ativo'
  LIMIT 1;

  IF v_sender.id IS NULL THEN
    RAISE EXCEPTION 'Perfil de afiliado ativo nao encontrado.';
  END IF;

  IF length(v_identifier) < 3 THEN
    RAISE EXCEPTION 'Informe codigo, email, telefone ou CPF do afiliado.';
  END IF;

  SELECT a.id, a.codigo_publico, a.nome_divulgacao, c.nome, c.email, c.telefone, c.cpf, c.cnpj
    INTO v_target
  FROM public.gsa_afiliados a
  JOIN public.clientes c ON c.id = a.cliente_id
  WHERE a.status = 'ativo'
    AND a.id <> v_sender.id
    AND (
      lower(a.codigo_publico) = v_identifier
      OR lower(coalesce(c.email, '')) = v_identifier
      OR (v_digits <> '' AND regexp_replace(coalesce(c.telefone, ''), '\D', '', 'g') = v_digits)
      OR (v_digits <> '' AND regexp_replace(coalesce(c.cpf, c.cnpj, ''), '\D', '', 'g') = v_digits)
    )
  ORDER BY a.created_at DESC
  LIMIT 1;

  IF v_target.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Afiliado destinatario nao encontrado ou inativo.');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'target', jsonb_build_object(
      'id', v_target.id,
      'codigo_publico', v_target.codigo_publico,
      'nome_divulgacao', v_target.nome_divulgacao,
      'nome_mascarado', left(coalesce(v_target.nome, v_target.nome_divulgacao), 1) || repeat('*', greatest(length(coalesce(v_target.nome, v_target.nome_divulgacao)) - 2, 2)) || right(coalesce(v_target.nome, v_target.nome_divulgacao), 1),
      'email_mascarado', CASE WHEN coalesce(v_target.email, '') LIKE '%@%' THEN left(v_target.email, 2) || '***@' || split_part(v_target.email, '@', 2) ELSE NULL END,
      'telefone_mascarado', CASE WHEN length(regexp_replace(coalesce(v_target.telefone, ''), '\D', '', 'g')) >= 4 THEN repeat('*', 4) || right(regexp_replace(v_target.telefone, '\D', '', 'g'), 4) ELSE NULL END
    )
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.gsa_client_transfer_affiliate_balance(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_destinatario_id uuid,
  p_valor numeric,
  p_observacao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
  v_sender public.gsa_afiliados%rowtype;
  v_receiver public.gsa_afiliados%rowtype;
  v_value numeric(14,2) := round(coalesce(p_valor, 0), 2);
  v_transfer public.gsa_afiliado_transferencias%rowtype;
  v_sender_before numeric(14,2);
  v_sender_after numeric(14,2);
  v_receiver_before numeric(14,2);
  v_receiver_after numeric(14,2);
  v_remaining numeric(14,2);
  v_take numeric(14,2);
  v_commission record;
  v_code text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_actor.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.';
  END IF;

  IF p_request_id IS NULL THEN
    RAISE EXCEPTION 'Identificador da transferencia obrigatorio.';
  END IF;

  IF v_value < 1 OR v_value > 1000000 THEN
    RAISE EXCEPTION 'Valor de transferencia invalido.';
  END IF;

  SELECT * INTO v_sender
  FROM public.gsa_afiliados
  WHERE cliente_id = v_actor.cliente_id AND status = 'ativo'
  FOR UPDATE;

  IF v_sender.id IS NULL THEN
    RAISE EXCEPTION 'Perfil de afiliado ativo nao encontrado.';
  END IF;

  SELECT * INTO v_receiver
  FROM public.gsa_afiliados
  WHERE id = p_destinatario_id AND status = 'ativo'
  FOR UPDATE;

  IF v_receiver.id IS NULL THEN
    RAISE EXCEPTION 'Afiliado destinatario nao encontrado ou inativo.';
  END IF;

  IF v_receiver.id = v_sender.id THEN
    RAISE EXCEPTION 'Nao e permitido transferir saldo para o proprio perfil.';
  END IF;

  SELECT * INTO v_transfer
  FROM public.gsa_afiliado_transferencias
  WHERE request_id = p_request_id
  FOR UPDATE;

  IF FOUND THEN
    IF v_transfer.remetente_afiliado_id <> v_sender.id OR v_transfer.destinatario_afiliado_id <> v_receiver.id OR v_transfer.valor <> v_value THEN
      RAISE EXCEPTION 'Identificador de transferencia ja utilizado em outra operacao.';
    END IF;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'transfer_id', v_transfer.id, 'codigo', v_transfer.codigo);
  END IF;

  PERFORM public.gsa_affiliate_release_due_commissions();

  v_sender_before := public.gsa_affiliate_available_balance(v_sender.id);
  v_receiver_before := public.gsa_affiliate_available_balance(v_receiver.id);

  IF v_value > v_sender_before THEN
    RAISE EXCEPTION 'Saldo disponivel insuficiente para transferencia.';
  END IF;

  v_remaining := v_value;

  FOR v_commission IN
    SELECT id, valor, pago_valor
    FROM public.gsa_afiliado_comissoes
    WHERE afiliado_id = v_sender.id AND status = 'disponivel' AND pago_valor < valor
    ORDER BY disponivel_em, created_at
    FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := least(v_remaining, v_commission.valor - v_commission.pago_valor);
    UPDATE public.gsa_afiliado_comissoes
       SET pago_valor = pago_valor + v_take,
           status = CASE WHEN pago_valor + v_take >= valor THEN 'paga' ELSE status END,
           paga_em = CASE WHEN pago_valor + v_take >= valor THEN now() ELSE paga_em END,
           updated_at = now()
     WHERE id = v_commission.id;
    v_remaining := round(v_remaining - v_take, 2);
  END LOOP;

  IF v_remaining > 0 THEN
    UPDATE public.clientes
       SET saldo_carteira = greatest(coalesce(saldo_carteira, 0) - v_remaining, 0),
           updated_at = now()
     WHERE id = v_sender.cliente_id;
  END IF;

  UPDATE public.clientes
     SET saldo_carteira = coalesce(saldo_carteira, 0) + v_value,
         updated_at = now()
   WHERE id = v_receiver.cliente_id;

  v_sender_after := public.gsa_affiliate_available_balance(v_sender.id);
  v_receiver_after := public.gsa_affiliate_available_balance(v_receiver.id);
  v_code := 'TRF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  INSERT INTO public.gsa_afiliado_transferencias(
    request_id, remetente_afiliado_id, destinatario_afiliado_id, valor, codigo, observacao,
    remetente_saldo_antes, remetente_saldo_depois, destinatario_saldo_antes, destinatario_saldo_depois
  ) VALUES (
    p_request_id, v_sender.id, v_receiver.id, v_value, v_code, nullif(left(trim(coalesce(p_observacao, '')), 500), ''),
    v_sender_before, v_sender_after, v_receiver_before, v_receiver_after
  ) RETURNING * INTO v_transfer;

  INSERT INTO public.gsa_afiliado_comissao_eventos(afiliado_id, tipo, valor_assinado, efetivo_em, metadata)
  VALUES
    (v_sender.id, 'ajuste', -v_value, now(), jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'direcao', 'saida', 'destinatario_id', v_receiver.id)),
    (v_receiver.id, 'ajuste', v_value, now(), jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'direcao', 'entrada', 'remetente_id', v_sender.id));

  PERFORM set_config('gsa.system_override', 'on', true);

  INSERT INTO public.notificacoes(cliente_id, titulo, mensagem, modulo, tab, item_id, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES
    (
      v_sender.cliente_id,
      'Transferencia de saldo enviada',
      format('Sua transferencia de R$ %s foi enviada com sucesso.', to_char(v_value, 'FM999G999G990D00')),
      'affiliates',
      'saques',
      v_transfer.id::text,
      'cliente',
      'normal',
      'transferencia_afiliado_enviada',
      jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'valor', v_value, 'destinatario_id', v_receiver.id)
    ),
    (
      v_receiver.cliente_id,
      'Transferencia de saldo recebida',
      format('Voce recebeu R$ %s em saldo de afiliado.', to_char(v_value, 'FM999G999G990D00')),
      'affiliates',
      'saques',
      v_transfer.id::text,
      'cliente',
      'normal',
      'transferencia_afiliado_recebida',
      jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'valor', v_value, 'remetente_id', v_sender.id)
    ),
    (
      NULL,
      'Transferencia entre afiliados',
      format('Transferencia de R$ %s registrada entre afiliados.', to_char(v_value, 'FM999G999G990D00')),
      'afiliados',
      'transferencias',
      v_transfer.id::text,
      'admin',
      'normal',
      'transferencia_afiliado_registrada',
      jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'valor', v_value, 'remetente_id', v_sender.id, 'destinatario_id', v_receiver.id)
    );

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'transfer_id', v_transfer.id, 'codigo', v_transfer.codigo);
END;
$function$;

CREATE OR REPLACE FUNCTION public.gsa_client_affiliate_transfers(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor record;
  v_affiliate public.gsa_afiliados%rowtype;
  v_items jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_actor.cliente_id IS NULL THEN
    RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.';
  END IF;

  SELECT * INTO v_affiliate
  FROM public.gsa_afiliados
  WHERE cliente_id = v_actor.cliente_id
  LIMIT 1;

  IF v_affiliate.id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'transfers', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.concluida_em DESC), '[]'::jsonb)
    INTO v_items
  FROM (
    SELECT
      t.id,
      t.codigo,
      t.valor,
      t.status,
      CASE WHEN t.remetente_afiliado_id = v_affiliate.id THEN 'enviada' ELSE 'recebida' END AS direcao,
      CASE WHEN t.remetente_afiliado_id = v_affiliate.id THEN rd.nome_divulgacao ELSE sd.nome_divulgacao END AS contraparte_nome,
      CASE WHEN t.remetente_afiliado_id = v_affiliate.id THEN rd.codigo_publico ELSE sd.codigo_publico END AS contraparte_codigo,
      t.observacao,
      t.concluida_em,
      t.created_at
    FROM public.gsa_afiliado_transferencias t
    JOIN public.gsa_afiliados sd ON sd.id = t.remetente_afiliado_id
    JOIN public.gsa_afiliados rd ON rd.id = t.destinatario_afiliado_id
    WHERE t.remetente_afiliado_id = v_affiliate.id
       OR t.destinatario_afiliado_id = v_affiliate.id
    ORDER BY t.concluida_em DESC
    LIMIT 200
  ) x;

  RETURN jsonb_build_object('success', true, 'transfers', v_items);
END;
$function$;

REVOKE ALL ON FUNCTION public.gsa_client_lookup_affiliate_transfer_target(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_lookup_affiliate_transfer_target(uuid,text,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_transfer_affiliate_balance(uuid,text,uuid,uuid,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_transfer_affiliate_balance(uuid,text,uuid,uuid,numeric,text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_client_affiliate_transfers(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_affiliate_transfers(uuid,text) TO authenticated, service_role;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication
    WHERE pubname = 'supabase_realtime'
      AND puballtables = false
  ) THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.gsa_afiliado_transferencias;
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    END;
  END IF;
END $$;

COMMIT;
