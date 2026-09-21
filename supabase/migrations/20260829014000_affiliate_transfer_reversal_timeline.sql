BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_client_affiliate_transfers(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_affiliate public.gsa_afiliados%rowtype;
  v_items jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_actor.cliente_id IS NULL THEN RAISE EXCEPTION 'Sessao de cliente invalida ou expirada.'; END IF;

  SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_actor.cliente_id LIMIT 1;
  IF v_affiliate.id IS NULL THEN RETURN jsonb_build_object('success', true, 'transfers', '[]'::jsonb); END IF;

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
      t.estornada_em,
      t.created_at
    FROM public.gsa_afiliado_transferencias t
    JOIN public.gsa_afiliados sd ON sd.id = t.remetente_afiliado_id
    JOIN public.gsa_afiliados rd ON rd.id = t.destinatario_afiliado_id
    WHERE t.remetente_afiliado_id = v_affiliate.id OR t.destinatario_afiliado_id = v_affiliate.id
    ORDER BY t.concluida_em DESC
    LIMIT 200
  ) x;

  RETURN jsonb_build_object('success', true, 'transfers', v_items);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_affiliate_transfers(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_affiliate_transfers(uuid, text) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';

COMMIT;
