BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('gsa-private-documents', 'gsa-private-documents', false, 10485760)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit;

CREATE OR REPLACE FUNCTION public.gsa_admin_private_document_allowed(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_scope text := split_part(COALESCE(p_name, ''), '/', 1);
  v_type text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
BEGIN
  IF v_type = 'admin' THEN
    PERFORM public.gsa_admin_context();
    RETURN v_scope IN ('fiscal', 'emprestimos');
  END IF;

  IF v_type <> 'colaborador' THEN
    RETURN false;
  END IF;

  IF v_scope = 'fiscal' THEN
    RETURN public.gsa_admin_has_module('fiscal');
  END IF;

  IF v_scope = 'emprestimos' THEN
    RETURN public.gsa_admin_has_module('emprestimos');
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_private_document_read_allowed(p_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_scope text := split_part(COALESCE(p_name, ''), '/', 1);
  v_owner_id text := split_part(COALESCE(p_name, ''), '/', 2);
  v_type text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_type', '');
  v_actor_id text := COALESCE(auth.jwt() -> 'app_metadata' ->> 'gsa_actor_id', '');
BEGIN
  IF public.gsa_admin_private_document_allowed(p_name) THEN
    RETURN true;
  END IF;

  -- O caminho é scope/ownerId/context/contextId/arquivo. Clientes podem
  -- somente ler documentos fiscais ou contratos cujo ownerId seja o próprio
  -- identificador autenticado. Eles nunca recebem INSERT/UPDATE/DELETE.
  IF v_type = 'cliente'
     AND v_scope IN ('fiscal', 'emprestimos')
     AND v_actor_id <> ''
     AND v_owner_id = v_actor_id THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_private_document_allowed(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.gsa_private_document_read_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_private_document_allowed(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_private_document_read_allowed(text) TO authenticated, service_role;

DROP POLICY IF EXISTS gsa_admin_private_documents_select ON storage.objects;
CREATE POLICY gsa_admin_private_documents_select
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND public.gsa_private_document_read_allowed(name)
);

DROP POLICY IF EXISTS gsa_admin_private_documents_insert ON storage.objects;
CREATE POLICY gsa_admin_private_documents_insert
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'gsa-private-documents'
  AND public.gsa_admin_private_document_allowed(name)
);

DROP POLICY IF EXISTS gsa_admin_private_documents_update ON storage.objects;
CREATE POLICY gsa_admin_private_documents_update
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND public.gsa_admin_private_document_allowed(name)
)
WITH CHECK (
  bucket_id = 'gsa-private-documents'
  AND public.gsa_admin_private_document_allowed(name)
);

DROP POLICY IF EXISTS gsa_admin_private_documents_delete ON storage.objects;
CREATE POLICY gsa_admin_private_documents_delete
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'gsa-private-documents'
  AND public.gsa_admin_private_document_allowed(name)
);

COMMIT;
