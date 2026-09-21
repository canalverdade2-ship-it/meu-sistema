BEGIN;

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

  SELECT a.id, a.codigo_publico, a.nome_divulgacao, c.nome, c.email, c.telefone, c.cpf, c.cnpj, c.tipo_pessoa
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
      'nome_completo', coalesce(v_target.nome, v_target.nome_divulgacao),
      'email', v_target.email,
      'telefone', v_target.telefone,
      'documento', coalesce(v_target.cpf, v_target.cnpj),
      'tipo_pessoa', v_target.tipo_pessoa
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.gsa_client_lookup_affiliate_transfer_target(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_lookup_affiliate_transfer_target(uuid, text, text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
