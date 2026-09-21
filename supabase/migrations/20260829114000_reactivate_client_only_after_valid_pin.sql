BEGIN;

DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.gsa_login_pin(text,text,text)'::regprocedure) INTO v_def;

  -- Remove a reativacao da etapa anterior a validacao criptografica do PIN.
  v_def := replace(v_def,
    'IF p_tipo = ''cliente'' AND v_record.status = ''inativo'' AND coalesce(v_record.cadastro_aprovado, true) THEN PERFORM public.gsa_reactivate_client_after_pin(v_record.id); v_record.status := ''ativo''; END IF;',
    'IF p_tipo = ''cliente'' AND v_record.status = ''inativo'' AND coalesce(v_record.cadastro_aprovado, true) AND v_record.pin_hash IS NULL THEN RETURN jsonb_build_object(''valid'', false, ''error'', ''primeiro_acesso'', ''nome'', v_record.nome); END IF;');

  -- Este ponto so e alcancado depois de extensions.crypt confirmar o PIN.
  v_def := replace(v_def,
    'IF p_tipo = ''cliente'' THEN UPDATE public.clientes SET pin_tentativas = 0 WHERE id = v_record.id;',
    'IF p_tipo = ''cliente'' AND v_record.status = ''inativo'' AND coalesce(v_record.cadastro_aprovado, true) THEN PERFORM public.gsa_reactivate_client_after_pin(v_record.id); v_record.status := ''ativo''; END IF;' || chr(10) ||
    '  IF p_tipo = ''cliente'' THEN UPDATE public.clientes SET pin_tentativas = 0 WHERE id = v_record.id;');
  EXECUTE v_def;
END;
$$;

COMMIT;
