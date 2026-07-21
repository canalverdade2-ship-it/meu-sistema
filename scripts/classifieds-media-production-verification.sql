DO $verification$
DECLARE
  v_bucket storage.buckets%rowtype;
  v_policy_count integer;
BEGIN
  SELECT *
  INTO v_bucket
  FROM storage.buckets
  WHERE id = 'classificados-midias';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Bucket classificados-midias não existe.';
  END IF;

  IF v_bucket.public IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Bucket classificados-midias não está público para exibição dos anúncios.';
  END IF;

  IF v_bucket.file_size_limit IS DISTINCT FROM 8388608 THEN
    RAISE EXCEPTION 'Limite do bucket classificados-midias é diferente de 8 MB.';
  END IF;

  IF NOT (v_bucket.allowed_mime_types @> ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]) THEN
    RAISE EXCEPTION 'Tipos permitidos do bucket classificados-midias estão incompletos.';
  END IF;

  SELECT count(*)
  INTO v_policy_count
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname IN (
      'classificados_midias_leitura_publica',
      'classificados_midias_inserir_proprio_diretorio',
      'classificados_midias_atualizar_proprio_diretorio',
      'classificados_midias_excluir_proprio_diretorio'
    );

  IF v_policy_count <> 4 THEN
    RAISE EXCEPTION 'Políticas do bucket classificados-midias incompletas: % de 4.', v_policy_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'classificados_midias_inserir_proprio_diretorio'
      AND roles @> ARRAY['authenticated']::name[]
      AND with_check ILIKE '%gsa_jwt_session_is_valid%'
      AND with_check ILIKE '%gsa_jwt_actor_id%'
  ) THEN
    RAISE EXCEPTION 'Política de upload não valida sessão e identidade GSA.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname <> 'classificados_midias_leitura_publica'
      AND roles && ARRAY['anon', 'public']::name[]
      AND (qual ILIKE '%classificados-midias%' OR with_check ILIKE '%classificados-midias%')
  ) THEN
    RAISE EXCEPTION 'Existe política de escrita anônima no bucket classificados-midias.';
  END IF;

  RAISE NOTICE 'CLASSIFIEDS_MEDIA_STORAGE_VERIFIED';
END;
$verification$;
