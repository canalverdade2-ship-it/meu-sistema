BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_loan_under_review(
  p_sessao_id uuid,
  p_session_token text,
  p_emprestimo_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public','pg_temp'
AS $$
DECLARE
  v_actor record;
  v_loan public.emprestimos%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_loan FROM public.emprestimos
  WHERE id=p_emprestimo_id AND cliente_id=v_actor.cliente_id FOR UPDATE;
  IF v_loan.id IS NULL THEN RAISE EXCEPTION 'Empréstimo não encontrado.' USING ERRCODE='P0002'; END IF;
  IF v_loan.status='cancelado' THEN
    RETURN jsonb_build_object('success',true,'idempotent',true,'status','cancelado');
  END IF;
  IF v_loan.status NOT IN (
    'analise_inicial','pendencia_documentos','analise_documentos','proposta_enviada',
    'aguardando_dados_bancarios','analise_final','pendencia_assinatura',
    'analise_contrato','aguardando_pagamento_taxa','aprovado'
  ) THEN
    RAISE EXCEPTION 'Este empréstimo não está mais em uma etapa que permita cancelamento pelo cliente.' USING ERRCODE='22023';
  END IF;

  UPDATE public.emprestimos SET status='cancelado',updated_at=now() WHERE id=v_loan.id;

  INSERT INTO public.emprestimo_historico(
    emprestimo_id,tipo_acao,descricao,usuario_tipo,usuario_id,metadata
  ) VALUES (
    v_loan.id,'cancelamento_cliente','Cliente cancelou a solicitação durante a análise.',
    'cliente',v_actor.cliente_id,jsonb_build_object('status_anterior',v_loan.status,'cancelado_em',now())
  );

  IF v_loan.fatura_taxa_id IS NOT NULL THEN
    PERFORM set_config('gsa.system_override','on',true);
    UPDATE public.faturas SET status='cancelado',updated_at=now()
    WHERE id=v_loan.fatura_taxa_id AND cliente_id=v_actor.cliente_id
      AND status NOT IN ('pago','cancelado');
  END IF;

  PERFORM set_config('gsa.system_override','on',true);
  INSERT INTO public.notificacoes(
    cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto
  ) VALUES (
    NULL,'Empréstimo cancelado pelo cliente',
    format('%s cancelou a solicitação %s durante a análise.',v_actor.cliente_nome,v_loan.codigo_emprestimo),
    'emprestimos','solicitacoes',v_loan.id::text,'admin','normal','emprestimo_cancelado_cliente',
    jsonb_build_object('emprestimo_id',v_loan.id,'cliente_id',v_actor.cliente_id,'codigo',v_loan.codigo_emprestimo,'status_anterior',v_loan.status)
  );

  RETURN jsonb_build_object('success',true,'idempotent',false,'status','cancelado');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_cancel_loan_under_review(uuid,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_loan_under_review(uuid,text,uuid) TO anon,authenticated,service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
