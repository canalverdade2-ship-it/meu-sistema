BEGIN;

ALTER TABLE public.parceiros_resgates
  ADD COLUMN IF NOT EXISTS motivo_cancelamento text,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid;

CREATE OR REPLACE FUNCTION public.gsa_admin_cancel_partner_redemption(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_resgate_id uuid DEFAULT NULL,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id,p_session_token);
  v_resgate public.parceiros_resgates%ROWTYPE;
  v_reason text := nullif(trim(coalesce(p_motivo,'')),'');
  v_actor_id uuid;
  v_first_name text;
  v_previous_status text;
BEGIN
  PERFORM public.gsa_admin_assert_module('parceiros');
  IF v_context->>'actor_type' <> 'admin' THEN
    RAISE EXCEPTION 'Somente o administrador pode cancelar resgates.' USING ERRCODE='42501';
  END IF;
  IF p_resgate_id IS NULL OR char_length(coalesce(v_reason,'')) NOT BETWEEN 10 AND 2000 THEN
    RAISE EXCEPTION 'Informe um motivo de cancelamento com pelo menos 10 caracteres.' USING ERRCODE='22023';
  END IF;
  SELECT * INTO v_resgate FROM public.parceiros_resgates WHERE id=p_resgate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resgate não encontrado.' USING ERRCODE='P0002'; END IF;
  IF v_resgate.status='cancelado' THEN RAISE EXCEPTION 'Este resgate já está cancelado.' USING ERRCODE='55000'; END IF;
  IF EXISTS (SELECT 1 FROM public.parceiros_resgates_recursos WHERE resgate_id=p_resgate_id AND status='em_analise') THEN
    RAISE EXCEPTION 'Finalize o recurso em análise antes de cancelar o resgate.' USING ERRCODE='55000';
  END IF;
  v_previous_status := v_resgate.status;
  BEGIN v_actor_id := nullif(v_context->>'actor_id','')::uuid; EXCEPTION WHEN invalid_text_representation THEN v_actor_id := NULL; END;

  UPDATE public.parceiros_resgates SET
    status='cancelado', motivo_cancelamento=v_reason, data_cancelamento=now(),
    cancelado_por=v_actor_id, link_ativacao=NULL, updated_at=now()
  WHERE id=p_resgate_id RETURNING * INTO v_resgate;

  INSERT INTO public.parceiros_resgates_eventos(
    resgate_id,tipo,titulo,descricao_publica,detalhes_privados,ator_tipo,ator_id,idempotency_key
  ) VALUES (
    p_resgate_id,'solicitacao_cancelada','Resgate cancelado',
    'O resgate foi cancelado pelo atendimento administrativo.',
    jsonb_build_object('motivo',v_reason),'admin',v_actor_id,
    'admin-cancel:'||p_resgate_id::text||':'||extract(epoch from clock_timestamp())::text
  );

  v_first_name := split_part(trim(v_resgate.nome_completo),' ',1);
  INSERT INTO public.parceiros_resgates_notificacoes(resgate_id,tipo,telefone,mensagem,idempotency_key)
  VALUES (
    p_resgate_id,'resgate_cancelado_administrador',v_resgate.telefone,
    'Olá, *'||coalesce(nullif(v_first_name,''),'Cliente')||'*.'||E'\n\n'||
    'O resgate do protocolo *'||coalesce(v_resgate.codigo_gerado,p_resgate_id::text)||'* foi cancelado.'||E'\n\n'||
    '*Motivo:* '||v_reason,
    'admin-cancel-notification:'||p_resgate_id::text
  );

  PERFORM public.gsa_admin_write_audit('parceiros','CANCELAR_RESGATE','parceiros_resgates',p_resgate_id,
    jsonb_build_object('protocolo',v_resgate.codigo_gerado,'status_anterior',v_previous_status,'motivo',v_reason));
  RETURN jsonb_build_object('success',true,'redemption',to_jsonb(v_resgate));
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_delete_partner_redemption(
  p_sessao_id uuid DEFAULT NULL,
  p_session_token text DEFAULT NULL,
  p_resgate_id uuid DEFAULT NULL,
  p_confirmation text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp AS $$
DECLARE
  v_context jsonb := public.gsa_admin_validate_context(p_sessao_id,p_session_token);
  v_resgate public.parceiros_resgates%ROWTYPE;
  v_expected text;
BEGIN
  PERFORM public.gsa_admin_assert_module('parceiros');
  IF v_context->>'actor_type' <> 'admin' THEN
    RAISE EXCEPTION 'Somente o administrador pode excluir resgates.' USING ERRCODE='42501';
  END IF;
  SELECT * INTO v_resgate FROM public.parceiros_resgates WHERE id=p_resgate_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resgate não encontrado.' USING ERRCODE='P0002'; END IF;
  IF v_resgate.status<>'cancelado' OR nullif(trim(coalesce(v_resgate.motivo_cancelamento,'')),'') IS NULL THEN
    RAISE EXCEPTION 'O resgate precisa ser cancelado com motivo antes da exclusão.' USING ERRCODE='55000';
  END IF;
  v_expected := coalesce(nullif(trim(v_resgate.codigo_gerado),''),v_resgate.id::text);
  IF upper(trim(coalesce(p_confirmation,''))) <> upper(v_expected) THEN
    RAISE EXCEPTION 'A confirmação não corresponde ao protocolo do resgate.' USING ERRCODE='22023';
  END IF;

  PERFORM public.gsa_admin_write_audit('parceiros','EXCLUIR_RESGATE','parceiros_resgates',v_resgate.id,
    jsonb_build_object('protocolo',v_expected,'parceiro_id',v_resgate.parceiro_id,
      'status','cancelado','motivo_cancelamento',v_resgate.motivo_cancelamento,'excluido_em',now()));
  DELETE FROM public.parceiros_resgates WHERE id=v_resgate.id;
  RETURN jsonb_build_object('success',true,'deleted_id',v_resgate.id,'protocol',v_expected);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_cancel_partner_redemption(uuid,text,uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.gsa_admin_delete_partner_redemption(uuid,text,uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_cancel_partner_redemption(uuid,text,uuid,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_partner_redemption(uuid,text,uuid,text) TO authenticated,service_role;

NOTIFY pgrst,'reload schema';
COMMIT;
