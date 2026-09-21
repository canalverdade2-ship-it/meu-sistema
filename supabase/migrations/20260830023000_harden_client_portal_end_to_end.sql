-- Correção final da auditoria do Painel do Cliente.
-- Remove acessos públicos, preserva operação administrativa autenticada
-- e limita clientes/prestadores aos registros que lhes pertencem.

BEGIN;

DO $$
DECLARE
  v_table text;
  v_policy record;
  v_tables constant text[] := ARRAY[
    'clientes', 'carteira_lancamentos', 'pontos_movimentacoes',
    'emprestimos', 'loja_credito_solicitacoes', 'notificacoes',
    'tickets', 'cliente_documentos', 'faturas', 'transferencias', 'saques'
  ];
BEGIN
  FOREACH v_table IN ARRAY v_tables LOOP
    IF to_regclass('public.' || quote_ident(v_table)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon', v_table);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', v_table);
    EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', v_table);

    FOR v_policy IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = v_table
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy.policyname, v_table);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY gsa_management_%1$I ON public.%1$I FOR ALL TO authenticated USING (public.gsa_jwt_actor_type() IN (''admin'', ''colaborador'')) WITH CHECK (public.gsa_jwt_actor_type() IN (''admin'', ''colaborador''))',
      v_table
    );
    EXECUTE format(
      'CREATE POLICY gsa_service_role_%1$I ON public.%1$I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      v_table
    );
  END LOOP;
END;
$$;

CREATE POLICY gsa_client_own_profile_read ON public.clientes
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_client_own_wallet_read ON public.carteira_lancamentos
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_client_own_points_read ON public.pontos_movimentacoes
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_client_own_loans_read ON public.emprestimos
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_client_own_credit_requests_read ON public.loja_credito_solicitacoes
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_client_own_notifications_read ON public.notificacoes
FOR SELECT TO authenticated
USING (
  public.gsa_jwt_actor_type() = 'cliente'
  AND (
    cliente_id = public.gsa_jwt_actor_id()
    OR destinatario_tipo IN ('broadcast_clientes', 'broadcast_todos')
  )
);

CREATE POLICY gsa_provider_own_notifications_read ON public.notificacoes
FOR SELECT TO authenticated
USING (
  public.gsa_jwt_actor_type() = 'prestador'
  AND (
    prestador_id = public.gsa_jwt_actor_id()
    OR destinatario_tipo IN ('broadcast_prestadores', 'broadcast_todos')
  )
);

CREATE POLICY gsa_client_own_tickets_read ON public.tickets
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_provider_own_tickets_read ON public.tickets
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'prestador' AND prestador_id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_client_own_documents_read ON public.cliente_documentos
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_client_own_invoices_read ON public.faturas
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

CREATE POLICY gsa_client_own_transfers_read ON public.transferencias
FOR SELECT TO authenticated
USING (
  public.gsa_jwt_actor_type() = 'cliente'
  AND public.gsa_jwt_actor_id() IN (cliente_origem_id, cliente_destino_id)
);

CREATE POLICY gsa_client_own_withdrawals_read ON public.saques
FOR SELECT TO authenticated
USING (public.gsa_jwt_actor_type() = 'cliente' AND cliente_id = public.gsa_jwt_actor_id());

-- A implementação antiga aceitava qualquer cliente_id e movimentava saldo
-- como SECURITY DEFINER. Somente a RPC vinculada à sessão permanece pública.
REVOKE ALL ON FUNCTION public.processar_bonus_boas_vindas_seguro(uuid)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.processar_bonus_boas_vindas_seguro(uuid)
TO service_role;

REVOKE ALL ON FUNCTION public.gsa_client_process_welcome_bonus(uuid, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_process_welcome_bonus(uuid, text)
TO authenticated;

REVOKE ALL ON FUNCTION public.gsa_client_operational_write(uuid, text, text, text, jsonb, jsonb)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_operational_write(uuid, text, text, text, jsonb, jsonb)
TO authenticated;

REVOKE ALL ON FUNCTION public.cliente_operational_write(uuid, text, text, jsonb, jsonb)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cliente_operational_write(uuid, text, text, jsonb, jsonb)
TO service_role;

REVOKE ALL ON FUNCTION public.gsa_process_due_store_credit_releases()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_process_due_store_credit_releases()
TO service_role;

-- O bucket havia sido configurado apenas com UPDATE, portanto ambientes sem o
-- bucket nunca eram corrigidos. Esta inclusão torna a migration autocontida.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos_cliente',
  'documentos_cliente',
  false,
  10485760,
  ARRAY[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'text/plain', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DO $$
DECLARE v_policy record;
BEGIN
  FOR v_policy IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND (coalesce(qual, '') ILIKE '%documentos_cliente%'
        OR coalesce(with_check, '') ILIKE '%documentos_cliente%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', v_policy.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "GSA acessa documentos privados do cliente" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR split_part(name, '/', 1) = public.gsa_jwt_actor_id()::text
    OR split_part(name, '/', 2) = public.gsa_jwt_actor_id()::text
  )
);

CREATE POLICY "GSA envia documentos privados do cliente" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR split_part(name, '/', 1) = public.gsa_jwt_actor_id()::text
    OR split_part(name, '/', 2) = public.gsa_jwt_actor_id()::text
  )
);

CREATE POLICY "GSA atualiza documentos privados do cliente" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR split_part(name, '/', 1) = public.gsa_jwt_actor_id()::text
    OR split_part(name, '/', 2) = public.gsa_jwt_actor_id()::text
  )
)
WITH CHECK (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR split_part(name, '/', 1) = public.gsa_jwt_actor_id()::text
    OR split_part(name, '/', 2) = public.gsa_jwt_actor_id()::text
  )
);

CREATE POLICY "GSA exclui documentos privados do cliente" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'documentos_cliente'
  AND public.gsa_jwt_session_is_valid()
  AND (
    public.gsa_jwt_actor_type() IN ('admin', 'colaborador')
    OR split_part(name, '/', 1) = public.gsa_jwt_actor_id()::text
    OR split_part(name, '/', 2) = public.gsa_jwt_actor_id()::text
  )
);

-- Repara o único formato histórico que ficava sem data de estorno e
-- prejudicava a ordem cronológica do extrato.
UPDATE public.transferencias
SET data_estorno = COALESCE(data_analise, data_pagamento, data_solicitacao)
WHERE lower(COALESCE(status, '')) LIKE '%estorn%'
  AND data_estorno IS NULL;

COMMIT;
