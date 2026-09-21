BEGIN;

ALTER TABLE public.loja_credito_solicitacoes
  DROP CONSTRAINT IF EXISTS loja_credito_solicitacoes_status_check;
ALTER TABLE public.loja_credito_solicitacoes
  ADD CONSTRAINT loja_credito_solicitacoes_status_check
  CHECK (status IN (
    'analise', 'documentos_pendentes', 'pre_aprovado',
    'contrato_pendente_assinatura', 'contrato_assinado',
    'liberado', 'negado', 'cancelado'
  ));

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_credit_increase_request(
  p_sessao_id uuid,
  p_session_token text,
  p_solicitacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_request public.loja_credito_solicitacoes%rowtype;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_request
  FROM public.loja_credito_solicitacoes
  WHERE id = p_solicitacao_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;

  IF v_request.id IS NULL THEN
    RAISE EXCEPTION 'Solicitacao de credito nao encontrada.';
  END IF;
  IF v_request.tipo_solicitacao <> 'alteracao' THEN
    RAISE EXCEPTION 'Somente solicitacoes de aumento de credito podem ser canceladas por esta operacao.';
  END IF;
  IF v_request.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'cancelado');
  END IF;
  IF v_request.status <> 'analise' THEN
    RAISE EXCEPTION 'A solicitacao so pode ser cancelada enquanto estiver em analise.';
  END IF;

  UPDATE public.loja_credito_solicitacoes
  SET status = 'cancelado', updated_at = now()
  WHERE id = v_request.id;

  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    NULL,
    'Aumento de credito cancelado pelo cliente',
    format('O cliente cancelou a solicitacao de aumento de limite no valor de R$ %s.', to_char(coalesce(v_request.limite_solicitado, 0), 'FM999G999G990D00')),
    'credito_loja', 'solicitacoes', v_request.id::text,
    'admin', 'normal', 'aumento_credito_cancelado_cliente',
    jsonb_build_object('solicitacao_id', v_request.id, 'cliente_id', v_actor.cliente_id, 'limite_solicitado', v_request.limite_solicitado)
  );

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'cancelado');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_cancel_credit_increase_request(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_credit_increase_request(uuid, text, uuid) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
