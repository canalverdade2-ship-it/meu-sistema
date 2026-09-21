BEGIN;

ALTER TABLE public.gsa_afiliado_transferencias
  ADD COLUMN IF NOT EXISTS estornada_em timestamptz,
  ADD COLUMN IF NOT EXISTS estornada_por_afiliado_id uuid REFERENCES public.gsa_afiliados(id) ON DELETE RESTRICT;

ALTER TABLE public.gsa_afiliado_transferencias DROP CONSTRAINT IF EXISTS gsa_afiliado_transferencias_status_check;
ALTER TABLE public.gsa_afiliado_transferencias ADD CONSTRAINT gsa_afiliado_transferencias_status_check
  CHECK (status IN ('concluida','cancelada','estornada'));

CREATE OR REPLACE FUNCTION public.gsa_client_reverse_received_affiliate_transfer(
  p_sessao_id uuid,
  p_session_token text,
  p_transferencia_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_receiver public.gsa_afiliados%rowtype;
  v_sender public.gsa_afiliados%rowtype;
  v_transfer public.gsa_afiliado_transferencias%rowtype;
  v_receiver_wallet numeric(14,2);
  v_receiver_available numeric(14,2);
  v_receiver_after numeric(14,2);
  v_sender_after numeric(14,2);
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_receiver FROM public.gsa_afiliados
   WHERE cliente_id = v_actor.cliente_id AND status = 'ativo' FOR UPDATE;
  IF v_receiver.id IS NULL THEN RAISE EXCEPTION 'Perfil de afiliado ativo nao encontrado.'; END IF;

  SELECT * INTO v_transfer FROM public.gsa_afiliado_transferencias
   WHERE id = p_transferencia_id FOR UPDATE;
  IF v_transfer.id IS NULL THEN RAISE EXCEPTION 'Transferencia nao encontrada.'; END IF;
  IF v_transfer.destinatario_afiliado_id <> v_receiver.id THEN
    RAISE EXCEPTION 'Somente o afiliado que recebeu a transferencia pode estorna-la.';
  END IF;
  IF v_transfer.status = 'estornada' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'transfer_id', v_transfer.id, 'status', v_transfer.status);
  END IF;
  IF v_transfer.status <> 'concluida' THEN RAISE EXCEPTION 'Esta transferencia nao pode mais ser estornada.'; END IF;

  SELECT * INTO v_sender FROM public.gsa_afiliados
   WHERE id = v_transfer.remetente_afiliado_id FOR UPDATE;
  IF v_sender.id IS NULL THEN RAISE EXCEPTION 'Afiliado remetente nao encontrado.'; END IF;

  v_receiver_available := public.gsa_affiliate_available_balance(v_receiver.id);
  SELECT coalesce(saldo_carteira, 0) INTO v_receiver_wallet
  FROM public.clientes WHERE id = v_receiver.cliente_id FOR UPDATE;
  PERFORM 1 FROM public.clientes WHERE id = v_sender.cliente_id FOR UPDATE;

  IF v_receiver_available < v_transfer.valor THEN
    RAISE EXCEPTION 'Saldo disponivel insuficiente para estornar esta transferencia.';
  END IF;
  IF v_receiver_wallet < v_transfer.valor THEN
    RAISE EXCEPTION 'O saldo recebido ja foi utilizado e nao pode ser estornado integralmente.';
  END IF;

  PERFORM set_config('gsa.credit_release', 'on', true);
  PERFORM set_config('my.app.bypass_saldo_check', 'on', true);
  PERFORM set_config('gsa.system_override', 'on', true);

  UPDATE public.clientes
     SET saldo_carteira = round(coalesce(saldo_carteira, 0) - v_transfer.valor, 2), updated_at = now()
   WHERE id = v_receiver.cliente_id
   RETURNING saldo_carteira INTO v_receiver_after;

  UPDATE public.clientes
     SET saldo_carteira = round(coalesce(saldo_carteira, 0) + v_transfer.valor, 2), updated_at = now()
   WHERE id = v_sender.cliente_id
   RETURNING saldo_carteira INTO v_sender_after;

  UPDATE public.gsa_afiliado_transferencias
     SET status = 'estornada', estornada_em = now(), estornada_por_afiliado_id = v_receiver.id, updated_at = now()
   WHERE id = v_transfer.id;

  INSERT INTO public.gsa_afiliado_comissao_eventos(afiliado_id, tipo, valor_assinado, efetivo_em, metadata)
  VALUES
    (v_receiver.id, 'ajuste', -v_transfer.valor, now(), jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'operacao', 'estorno_recebido')),
    (v_sender.id, 'ajuste', v_transfer.valor, now(), jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'operacao', 'estorno_devolvido'));

  INSERT INTO public.notificacoes(cliente_id, titulo, mensagem, modulo, tab, item_id, destinatario_tipo, prioridade, acao_origem, contexto)
  VALUES
    (v_receiver.cliente_id, 'Transferencia recebida estornada', format('O estorno de R$ %s foi concluido.', to_char(v_transfer.valor, 'FM999G999G990D00')), 'affiliates', 'saques', v_transfer.id::text, 'cliente', 'normal', 'transferencia_afiliado_estornada', jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'valor', v_transfer.valor)),
    (v_sender.cliente_id, 'Transferencia devolvida ao seu saldo', format('O destinatario estornou R$ %s para o seu saldo.', to_char(v_transfer.valor, 'FM999G999G990D00')), 'affiliates', 'saques', v_transfer.id::text, 'cliente', 'normal', 'transferencia_afiliado_devolvida', jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'valor', v_transfer.valor)),
    (NULL, 'Estorno de transferencia entre afiliados', format('A transferencia %s de R$ %s foi estornada pelo destinatario.', v_transfer.codigo, to_char(v_transfer.valor, 'FM999G999G990D00')), 'afiliados', 'transferencias', v_transfer.id::text, 'admin', 'normal', 'transferencia_afiliado_estornada', jsonb_build_object('transferencia_id', v_transfer.id, 'codigo', v_transfer.codigo, 'valor', v_transfer.valor));

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'transfer_id', v_transfer.id,
    'status', 'estornada',
    'destinatario_saldo', v_receiver_after,
    'remetente_saldo', v_sender_after
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_reverse_received_affiliate_transfer(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_reverse_received_affiliate_transfer(uuid, text, uuid) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
