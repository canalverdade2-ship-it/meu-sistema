-- Correções de segurança e integridade do GSA Viagens.
-- 1. Separa orçamento anônimo do orçamento autenticado.
-- 2. Registra e valida a quantidade esperada de passageiros.
-- 3. Bloqueia alterações de passageiros depois do pagamento.
-- 4. Restringe documentos aos estados operacionais editáveis.
-- 5. Remove metadados automaticamente quando o arquivo é excluído do Storage.

-- ---------------------------------------------------------------------------
-- ORÇAMENTO PÚBLICO E AUTENTICADO
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Cliente ou visitante insere orcamentos" ON public.viagens_orcamentos;
DROP POLICY IF EXISTS "Visitante insere orcamentos" ON public.viagens_orcamentos;
DROP POLICY IF EXISTS "Cliente insere seus orcamentos" ON public.viagens_orcamentos;

CREATE POLICY "Visitante insere orcamentos"
  ON public.viagens_orcamentos
  FOR INSERT
  TO anon
  WITH CHECK (
    cliente_id IS NULL
    AND NULLIF(trim(nome), '') IS NOT NULL
    AND NULLIF(trim(email), '') IS NOT NULL
    AND NULLIF(trim(telefone), '') IS NOT NULL
  );

CREATE POLICY "Cliente insere seus orcamentos"
  ON public.viagens_orcamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
  );

-- ---------------------------------------------------------------------------
-- QUANTIDADE AUTORITATIVA DE PASSAGEIROS
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.gsa_travel_safe_nonnegative_int(p_value TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_value IS NULL OR p_value !~ '^\d+$' THEN
    RETURN 0;
  END IF;

  RETURN LEAST(p_value::INTEGER, 100);
EXCEPTION WHEN OTHERS THEN
  RETURN 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_travel_expected_passengers(p_snapshot JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_direct INTEGER := 0;
  v_top_level INTEGER := 0;
  v_quote INTEGER := 0;
  v_request INTEGER := 0;
  v_travelers_array INTEGER := 0;
BEGIN
  p_snapshot := COALESCE(p_snapshot, '{}'::JSONB);

  v_direct := GREATEST(
    public.gsa_travel_safe_nonnegative_int(p_snapshot->>'quantidade_passageiros'),
    public.gsa_travel_safe_nonnegative_int(p_snapshot->>'total_passageiros'),
    public.gsa_travel_safe_nonnegative_int(p_snapshot#>>'{orcamento,quantidade_passageiros}'),
    public.gsa_travel_safe_nonnegative_int(p_snapshot#>>'{solicitacao,quantidade_passageiros}')
  );

  v_top_level :=
    public.gsa_travel_safe_nonnegative_int(p_snapshot->>'adultos')
    + public.gsa_travel_safe_nonnegative_int(p_snapshot->>'criancas')
    + public.gsa_travel_safe_nonnegative_int(p_snapshot->>'bebes');

  v_quote :=
    public.gsa_travel_safe_nonnegative_int(p_snapshot#>>'{orcamento,adultos}')
    + public.gsa_travel_safe_nonnegative_int(p_snapshot#>>'{orcamento,criancas}')
    + public.gsa_travel_safe_nonnegative_int(p_snapshot#>>'{orcamento,bebes}');

  v_request :=
    public.gsa_travel_safe_nonnegative_int(p_snapshot#>>'{solicitacao,adultos}')
    + public.gsa_travel_safe_nonnegative_int(p_snapshot#>>'{solicitacao,criancas}')
    + public.gsa_travel_safe_nonnegative_int(p_snapshot#>>'{solicitacao,bebes}');

  IF jsonb_typeof(p_snapshot->'passageiros') = 'array' THEN
    v_travelers_array := LEAST(jsonb_array_length(p_snapshot->'passageiros'), 100);
  END IF;

  RETURN GREATEST(1, v_direct, v_top_level, v_quote, v_request, v_travelers_array);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_travel_safe_nonnegative_int(TEXT) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_travel_expected_passengers(JSONB) FROM public, anon, authenticated;

ALTER TABLE public.viagens_propostas
  ADD COLUMN IF NOT EXISTS quantidade_passageiros INTEGER;

UPDATE public.viagens_propostas
SET quantidade_passageiros = public.gsa_travel_expected_passengers(snapshot_completo)
WHERE quantidade_passageiros IS NULL
   OR quantidade_passageiros < 1;

ALTER TABLE public.viagens_propostas
  ALTER COLUMN quantidade_passageiros SET DEFAULT 1,
  ALTER COLUMN quantidade_passageiros SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'viagens_propostas_quantidade_passageiros_check'
      AND conrelid = 'public.viagens_propostas'::regclass
  ) THEN
    ALTER TABLE public.viagens_propostas
      ADD CONSTRAINT viagens_propostas_quantidade_passageiros_check
      CHECK (quantidade_passageiros BETWEEN 1 AND 100);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_set_travel_proposal_passenger_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  NEW.quantidade_passageiros := GREATEST(
    COALESCE(NEW.quantidade_passageiros, 0),
    public.gsa_travel_expected_passengers(NEW.snapshot_completo)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_set_travel_proposal_passenger_count ON public.viagens_propostas;
CREATE TRIGGER trg_gsa_set_travel_proposal_passenger_count
BEFORE INSERT OR UPDATE OF snapshot_completo, quantidade_passageiros
ON public.viagens_propostas
FOR EACH ROW
EXECUTE FUNCTION public.gsa_set_travel_proposal_passenger_count();

-- ---------------------------------------------------------------------------
-- PASSAGEIROS SOMENTE ENQUANTO A TRANSAÇÃO ESTIVER PENDENTE
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Cliente insere passageiros" ON public.viagens_passageiros;
DROP POLICY IF EXISTS "Cliente atualiza passageiros" ON public.viagens_passageiros;
DROP POLICY IF EXISTS "Cliente deleta passageiros" ON public.viagens_passageiros;

CREATE POLICY "Cliente insere passageiros"
  ON public.viagens_passageiros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
    AND EXISTS (
      SELECT 1
      FROM public.viagens_propostas proposta
      JOIN public.viagens_transacoes transacao
        ON transacao.proposta_id = proposta.id
      WHERE proposta.id = proposta_id
        AND proposta.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status = 'pendente'
    )
  );

CREATE POLICY "Cliente atualiza passageiros"
  ON public.viagens_passageiros
  FOR UPDATE
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
    AND EXISTS (
      SELECT 1
      FROM public.viagens_transacoes transacao
      WHERE transacao.proposta_id = proposta_id
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status = 'pendente'
    )
  )
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
    AND EXISTS (
      SELECT 1
      FROM public.viagens_transacoes transacao
      WHERE transacao.proposta_id = proposta_id
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status = 'pendente'
    )
  );

CREATE POLICY "Cliente deleta passageiros"
  ON public.viagens_passageiros
  FOR DELETE
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND cliente_id = public.gsa_jwt_actor_id()
    AND EXISTS (
      SELECT 1
      FROM public.viagens_transacoes transacao
      WHERE transacao.proposta_id = proposta_id
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status = 'pendente'
    )
  );

-- ---------------------------------------------------------------------------
-- DOCUMENTOS EDITÁVEIS SOMENTE ANTES DA DISPONIBILIZAÇÃO FINAL
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Cliente insere documentos passageiros" ON public.viagens_passageiro_documentos;
DROP POLICY IF EXISTS "Cliente deleta documentos passageiros" ON public.viagens_passageiro_documentos;

CREATE POLICY "Cliente insere documentos passageiros"
  ON public.viagens_passageiro_documentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      JOIN public.viagens_transacoes transacao
        ON transacao.proposta_id = passageiro.proposta_id
      WHERE passageiro.id = passageiro_id
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status IN (
          'pendente',
          'pagamento_confirmado',
          'compra_fornecedor_pendente',
          'compra_fornecedor_em_andamento',
          'pacote_adquirido',
          'emissao_em_andamento'
        )
    )
  );

CREATE POLICY "Cliente deleta documentos passageiros"
  ON public.viagens_passageiro_documentos
  FOR DELETE
  TO authenticated
  USING (
    public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      JOIN public.viagens_transacoes transacao
        ON transacao.proposta_id = passageiro.proposta_id
      WHERE passageiro.id = passageiro_id
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status IN (
          'pendente',
          'pagamento_confirmado',
          'compra_fornecedor_pendente',
          'compra_fornecedor_em_andamento',
          'pacote_adquirido',
          'emissao_em_andamento'
        )
    )
  );

DROP POLICY IF EXISTS "Cliente envia documentos de viagem" ON storage.objects;
DROP POLICY IF EXISTS "Cliente remove documentos de viagem" ON storage.objects;

CREATE POLICY "Cliente envia documentos de viagem"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'viagens-documentos'
    AND public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND public.gsa_jwt_actor_id()::TEXT = split_part(name, '/', 1)
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      JOIN public.viagens_transacoes transacao
        ON transacao.proposta_id = passageiro.proposta_id
      WHERE passageiro.id::TEXT = split_part(name, '/', 2)
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status IN (
          'pendente',
          'pagamento_confirmado',
          'compra_fornecedor_pendente',
          'compra_fornecedor_em_andamento',
          'pacote_adquirido',
          'emissao_em_andamento'
        )
    )
  );

CREATE POLICY "Cliente remove documentos de viagem"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'viagens-documentos'
    AND public.gsa_jwt_session_is_valid()
    AND public.gsa_jwt_actor_type() = 'cliente'
    AND public.gsa_jwt_actor_id()::TEXT = split_part(name, '/', 1)
    AND EXISTS (
      SELECT 1
      FROM public.viagens_passageiros passageiro
      JOIN public.viagens_transacoes transacao
        ON transacao.proposta_id = passageiro.proposta_id
      WHERE passageiro.id::TEXT = split_part(name, '/', 2)
        AND passageiro.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.cliente_id = public.gsa_jwt_actor_id()
        AND transacao.status IN (
          'pendente',
          'pagamento_confirmado',
          'compra_fornecedor_pendente',
          'compra_fornecedor_em_andamento',
          'pacote_adquirido',
          'emissao_em_andamento'
        )
    )
  );

-- A exclusão pelo Storage remove o metadado na mesma transação do catálogo de objetos.
CREATE OR REPLACE FUNCTION public.gsa_cleanup_deleted_travel_document_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, storage, pg_temp
AS $$
BEGIN
  IF OLD.bucket_id = 'viagens-documentos' THEN
    DELETE FROM public.viagens_passageiro_documentos
    WHERE storage_path = OLD.name;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_cleanup_deleted_travel_document_metadata ON storage.objects;
CREATE TRIGGER trg_gsa_cleanup_deleted_travel_document_metadata
AFTER DELETE ON storage.objects
FOR EACH ROW
EXECUTE FUNCTION public.gsa_cleanup_deleted_travel_document_metadata();

-- ---------------------------------------------------------------------------
-- CHECKOUT EXIGE EXATAMENTE A QUANTIDADE CONTRATADA
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.gsa_client_checkout_travel(
  p_sessao_id UUID,
  p_session_token TEXT,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_cliente_id UUID;
  v_proposta_id UUID;
  v_forma_pagamento TEXT;
  v_proposta public.viagens_propostas%ROWTYPE;
  v_fatura_id UUID;
  v_transacao_id UUID;
  v_passageiros_count INTEGER;
  v_expected_passageiros INTEGER;
BEGIN
  SELECT actor.cliente_id
    INTO v_cliente_id
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token) actor
  LIMIT 1;

  IF v_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Cliente autenticado não encontrado.';
  END IF;

  v_proposta_id := (p_payload->>'proposta_id')::UUID;
  v_forma_pagamento := COALESCE(NULLIF(p_payload->>'forma_pagamento', ''), 'outros');

  IF v_proposta_id IS NULL THEN
    RAISE EXCEPTION 'Proposta de viagem não informada.';
  END IF;

  SELECT * INTO v_proposta
  FROM public.viagens_propostas
  WHERE id = v_proposta_id
    AND cliente_id = v_cliente_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proposta não encontrada ou não pertence a este cliente.';
  END IF;

  IF v_proposta.status <> 'aceita' THEN
    RAISE EXCEPTION 'A proposta precisa ser aceita antes do pagamento.';
  END IF;

  IF NOW() > v_proposta.prazo_pagamento THEN
    UPDATE public.viagens_propostas
    SET status = 'expirada', updated_at = NOW()
    WHERE id = v_proposta_id;
    RAISE EXCEPTION 'O prazo de pagamento desta proposta expirou.';
  END IF;

  v_expected_passageiros := GREATEST(COALESCE(v_proposta.quantidade_passageiros, 1), 1);

  SELECT COUNT(*) INTO v_passageiros_count
  FROM public.viagens_passageiros
  WHERE proposta_id = v_proposta_id
    AND cliente_id = v_cliente_id;

  IF v_passageiros_count <> v_expected_passageiros THEN
    RAISE EXCEPTION 'Cadastre exatamente % passageiro(s) antes do pagamento. Atualmente: %.',
      v_expected_passageiros,
      v_passageiros_count;
  END IF;

  SELECT id, fatura_id INTO v_transacao_id, v_fatura_id
  FROM public.viagens_transacoes
  WHERE proposta_id = v_proposta_id
    AND cliente_id = v_cliente_id
  FOR UPDATE;

  IF v_transacao_id IS NULL THEN
    INSERT INTO public.viagens_transacoes (
      proposta_id, cliente_id, valor_pago, forma_pagamento, status
    ) VALUES (
      v_proposta_id, v_cliente_id, v_proposta.valor_total, v_forma_pagamento, 'pendente'
    ) RETURNING id INTO v_transacao_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.viagens_transacoes
    WHERE id = v_transacao_id
      AND status <> 'pendente'
  ) THEN
    RAISE EXCEPTION 'Esta viagem não está mais aguardando pagamento.';
  END IF;

  IF v_fatura_id IS NULL THEN
    INSERT INTO public.faturas (
      cliente_id,
      valor_total,
      status,
      data_vencimento,
      tipo,
      metadata
    ) VALUES (
      v_cliente_id,
      v_proposta.valor_total,
      'pendente',
      CURRENT_DATE,
      'compra_viagem',
      jsonb_build_object(
        'proposta_id', v_proposta_id,
        'transacao_id', v_transacao_id,
        'pacote', v_proposta.snapshot_completo->>'titulo',
        'forma_pagamento', v_forma_pagamento,
        'quantidade_passageiros', v_expected_passageiros
      )
    ) RETURNING id INTO v_fatura_id;
  END IF;

  UPDATE public.viagens_transacoes
  SET fatura_id = v_fatura_id,
      forma_pagamento = v_forma_pagamento,
      valor_pago = v_proposta.valor_total,
      updated_at = NOW()
  WHERE id = v_transacao_id
    AND status = 'pendente';

  RETURN jsonb_build_object(
    'success', true,
    'transacao_id', v_transacao_id,
    'fatura_id', v_fatura_id,
    'quantidade_passageiros', v_expected_passageiros
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_checkout_travel(UUID, TEXT, JSONB) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_checkout_travel(UUID, TEXT, JSONB) TO authenticated;
