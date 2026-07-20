-- Torna documentos, contratos e anexos do cliente privados.
-- O acesso depende da identidade GSA presente no JWT autenticado.

UPDATE storage.buckets
SET public = false
WHERE id = 'documentos_cliente';

-- Remove qualquer política histórica que mencione este bucket, inclusive regras
-- antigas com escopo amplo para authenticated.
DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (
        COALESCE(qual, '') ILIKE '%documentos_cliente%'
        OR COALESCE(with_check, '') ILIKE '%documentos_cliente%'
        OR policyname IN (
          'GSA acessa documentos privados do cliente',
          'GSA envia documentos privados do cliente',
          'GSA atualiza documentos privados do cliente',
          'GSA exclui documentos privados do cliente'
        )
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_record.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "GSA acessa documentos privados do cliente"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_jwt_actor_type() IN ('cliente', 'prestador')
      AND string_to_array(name, '/') @> ARRAY[public.gsa_jwt_actor_id()::TEXT]
    )
  )
);

CREATE POLICY "GSA envia documentos privados do cliente"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_jwt_actor_type() IN ('cliente', 'prestador')
      AND string_to_array(name, '/') @> ARRAY[public.gsa_jwt_actor_id()::TEXT]
    )
  )
);

CREATE POLICY "GSA atualiza documentos privados do cliente"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_jwt_actor_type() IN ('cliente', 'prestador')
      AND string_to_array(name, '/') @> ARRAY[public.gsa_jwt_actor_id()::TEXT]
    )
  )
)
WITH CHECK (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_jwt_actor_type() IN ('cliente', 'prestador')
      AND string_to_array(name, '/') @> ARRAY[public.gsa_jwt_actor_id()::TEXT]
    )
  )
);

CREATE POLICY "GSA exclui documentos privados do cliente"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR (
      public.gsa_jwt_actor_type() IN ('cliente', 'prestador')
      AND string_to_array(name, '/') @> ARRAY[public.gsa_jwt_actor_id()::TEXT]
    )
  )
);
