BEGIN;

-- Compatibiliza a tabela histórica de idempotência, criada originalmente com
-- nomes em português, com as RPCs mais novas que utilizam nomes em inglês.
ALTER TABLE public.gsa_admin_operation_requests
  ADD COLUMN IF NOT EXISTS actor_id uuid,
  ADD COLUMN IF NOT EXISTS actor_type text,
  ADD COLUMN IF NOT EXISTS operation text,
  ADD COLUMN IF NOT EXISTS resource_id uuid,
  ADD COLUMN IF NOT EXISTS result jsonb;

UPDATE public.gsa_admin_operation_requests
SET actor_id = COALESCE(actor_id, ator_id),
    actor_type = COALESCE(actor_type, ator_tipo),
    operation = COALESCE(operation, operacao),
    result = COALESCE(result, resultado);

CREATE OR REPLACE FUNCTION public.gsa_sync_admin_operation_request_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.actor_id IS DISTINCT FROM OLD.actor_id AND NEW.ator_id IS NOT DISTINCT FROM OLD.ator_id THEN
      NEW.ator_id := NEW.actor_id;
    ELSIF NEW.ator_id IS DISTINCT FROM OLD.ator_id AND NEW.actor_id IS NOT DISTINCT FROM OLD.actor_id THEN
      NEW.actor_id := NEW.ator_id;
    END IF;

    IF NEW.actor_type IS DISTINCT FROM OLD.actor_type AND NEW.ator_tipo IS NOT DISTINCT FROM OLD.ator_tipo THEN
      NEW.ator_tipo := NEW.actor_type;
    ELSIF NEW.ator_tipo IS DISTINCT FROM OLD.ator_tipo AND NEW.actor_type IS NOT DISTINCT FROM OLD.actor_type THEN
      NEW.actor_type := NEW.ator_tipo;
    END IF;

    IF NEW.operation IS DISTINCT FROM OLD.operation AND NEW.operacao IS NOT DISTINCT FROM OLD.operacao THEN
      NEW.operacao := NEW.operation;
    ELSIF NEW.operacao IS DISTINCT FROM OLD.operacao AND NEW.operation IS NOT DISTINCT FROM OLD.operation THEN
      NEW.operation := NEW.operacao;
    END IF;

    IF NEW.result IS DISTINCT FROM OLD.result AND NEW.resultado IS NOT DISTINCT FROM OLD.resultado THEN
      NEW.resultado := NEW.result;
    ELSIF NEW.resultado IS DISTINCT FROM OLD.resultado AND NEW.result IS NOT DISTINCT FROM OLD.result THEN
      NEW.result := NEW.resultado;
    END IF;
  END IF;

  NEW.actor_id := COALESCE(NEW.actor_id, NEW.ator_id);
  NEW.ator_id := COALESCE(NEW.ator_id, NEW.actor_id);
  NEW.actor_type := COALESCE(NEW.actor_type, NEW.ator_tipo);
  NEW.ator_tipo := COALESCE(NEW.ator_tipo, NEW.actor_type);
  NEW.operation := COALESCE(NEW.operation, NEW.operacao);
  NEW.operacao := COALESCE(NEW.operacao, NEW.operation);
  NEW.result := COALESCE(NEW.result, NEW.resultado);
  NEW.resultado := COALESCE(NEW.resultado, NEW.result);

  IF NEW.actor_id IS DISTINCT FROM NEW.ator_id
     OR NEW.actor_type IS DISTINCT FROM NEW.ator_tipo
     OR NEW.operation IS DISTINCT FROM NEW.operacao
     OR NEW.result IS DISTINCT FROM NEW.resultado THEN
    RAISE EXCEPTION 'Dados incompatíveis na requisição administrativa.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_sync_admin_operation_request_columns
  ON public.gsa_admin_operation_requests;
CREATE TRIGGER trg_gsa_sync_admin_operation_request_columns
BEFORE INSERT OR UPDATE ON public.gsa_admin_operation_requests
FOR EACH ROW EXECUTE FUNCTION public.gsa_sync_admin_operation_request_columns();

DO $$
DECLARE
  v_constraint record;
BEGIN
  FOR v_constraint IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'gsa_admin_operation_requests'
      AND c.contype = 'c'
      AND position('operacao' in lower(pg_get_constraintdef(c.oid))) > 0
  LOOP
    EXECUTE format(
      'ALTER TABLE public.gsa_admin_operation_requests DROP CONSTRAINT %I',
      v_constraint.conname
    );
  END LOOP;
END;
$$;

ALTER TABLE public.gsa_admin_operation_requests
  ALTER COLUMN actor_type SET NOT NULL,
  ALTER COLUMN operation SET NOT NULL;

ALTER TABLE public.gsa_admin_operation_requests
  DROP CONSTRAINT IF EXISTS gsa_admin_operation_requests_operation_compat_check;
ALTER TABLE public.gsa_admin_operation_requests
  ADD CONSTRAINT gsa_admin_operation_requests_operation_compat_check CHECK (
    operation = operacao
    AND operation IN (
      'prorrogar_assinatura_admin',
      'cancelar_assinatura_admin',
      'adjust_product_stock',
      'transition_store_order',
      'cancel_store_order',
      'activate_subscription'
    )
  );

ALTER TABLE public.gsa_admin_operation_requests
  DROP CONSTRAINT IF EXISTS gsa_admin_operation_requests_actor_compat_check;
ALTER TABLE public.gsa_admin_operation_requests
  ADD CONSTRAINT gsa_admin_operation_requests_actor_compat_check CHECK (
    actor_type = ator_tipo AND actor_type IN ('admin', 'colaborador')
  );

CREATE INDEX IF NOT EXISTS idx_gsa_admin_operation_requests_operation_resource
  ON public.gsa_admin_operation_requests(operation, resource_id, created_at DESC);

-- Vincula obrigatoriamente a sessão informada ao JWT atual e impede que um
-- colaborador sem acesso a Catálogo/Loja/Operações invoque as RPCs diretamente.
CREATE OR REPLACE FUNCTION public.gsa_require_admin_actor(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS TABLE(actor_id uuid, actor_type text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_context jsonb;
BEGIN
  v_context := public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  IF v_context ->> 'actor_type' = 'colaborador'
     AND NOT (
       public.gsa_admin_has_module('catalogo')
       OR public.gsa_admin_has_module('loja')
       OR public.gsa_admin_has_module('operacoes')
     ) THEN
    RAISE EXCEPTION 'O colaborador não possui permissão para Produtos e Assinaturas.'
      USING ERRCODE = '42501';
  END IF;

  -- Serializa as operações do mesmo ator. Isso torna o uso do request_id
  -- determinístico inclusive em duplo clique e reenvio simultâneo.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(COALESCE(v_context ->> 'actor_id', ''), 20260721100000)
  );

  RETURN QUERY SELECT
    (v_context ->> 'actor_id')::uuid,
    v_context ->> 'actor_type';
END;
$$;

-- Validação central do catálogo, inclusive para gravações que não passam pela UI.
CREATE OR REPLACE FUNCTION public.gsa_validate_product_catalog_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('ativo', 'inativo') THEN
    RAISE EXCEPTION 'Status de produto inválido.' USING ERRCODE = '22023';
  END IF;
  IF NEW.tipo_cliente NOT IN ('pf', 'pj', 'ambos') THEN
    RAISE EXCEPTION 'Tipo de cliente do produto inválido.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(NEW.valor, 0) <= 0
     OR COALESCE(NEW.valor_custo, 0) < 0
     OR COALESCE(NEW.porcentagem_lucro, 0) < 0
     OR COALESCE(NEW.estoque_disponivel, 0) < 0 THEN
    RAISE EXCEPTION 'Valores ou estoque do produto são inválidos.' USING ERRCODE = '22023';
  END IF;
  IF NEW.identificador_preferencial IS NOT NULL
     AND NEW.identificador_preferencial NOT IN ('interno', 'codigo_barras') THEN
    RAISE EXCEPTION 'Identificador preferencial inválido.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(NEW.desconto_ativo, false)
     AND (
       NEW.valor_promocional IS NULL
       OR NEW.valor_promocional <= 0
       OR NEW.valor_promocional >= NEW.valor
     ) THEN
    RAISE EXCEPTION 'Preço promocional inválido.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(NEW.desconto_limite_quantidade_ativo, false)
     AND COALESCE(NEW.desconto_quantidade_limite, 0) <= 0 THEN
    RAISE EXCEPTION 'A quantidade promocional deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'inativo' THEN
    NEW.visivel_na_loja := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_validate_product_catalog_row ON public.produtos;
CREATE TRIGGER trg_gsa_validate_product_catalog_row
BEFORE INSERT OR UPDATE ON public.produtos
FOR EACH ROW EXECUTE FUNCTION public.gsa_validate_product_catalog_row();

CREATE OR REPLACE FUNCTION public.gsa_validate_subscription_catalog_row()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO public, pg_temp
AS $$
BEGIN
  IF NEW.status NOT IN ('ativo', 'inativo') THEN
    RAISE EXCEPTION 'Status de assinatura inválido.' USING ERRCODE = '22023';
  END IF;
  IF NEW.tipo_cliente NOT IN ('pf', 'pj', 'ambos') THEN
    RAISE EXCEPTION 'Tipo de cliente da assinatura inválido.' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(NEW.valor, 0) <= 0 THEN
    RAISE EXCEPTION 'O valor da assinatura deve ser maior que zero.' USING ERRCODE = '22023';
  END IF;
  IF NEW.status = 'inativo' THEN
    NEW.visivel_na_loja := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gsa_validate_subscription_catalog_row ON public.assinaturas;
CREATE TRIGGER trg_gsa_validate_subscription_catalog_row
BEFORE INSERT OR UPDATE ON public.assinaturas
FOR EACH ROW EXECUTE FUNCTION public.gsa_validate_subscription_catalog_row();

-- Impede ativação sem evidência financeira. Ordens já marcadas como pagas pelo
-- checkout seguro continuam aceitas; nos demais estados é exigida fatura paga.
CREATE OR REPLACE FUNCTION public.gsa_admin_activate_subscription(
  p_sessao_id uuid,
  p_session_token text,
  p_request_id uuid,
  p_ordem_assinatura_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_existing jsonb;
  v_ordem public.ordens_assinatura%ROWTYPE;
  v_nome text;
  v_invoice_count integer := 0;
  v_paid_count integer := 0;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_require_admin_actor(p_sessao_id, p_session_token);

  SELECT result INTO v_existing
  FROM public.gsa_admin_operation_requests
  WHERE request_id = p_request_id;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing || jsonb_build_object('already_processed', true);
  END IF;

  SELECT * INTO v_ordem
  FROM public.ordens_assinatura
  WHERE id = p_ordem_assinatura_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ordem de assinatura não encontrada.';
  END IF;
  IF v_ordem.status = 'concluido' THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_processed', true,
      'ordem_id', p_ordem_assinatura_id
    );
  END IF;
  IF v_ordem.status NOT IN ('em_analise', 'pendente', 'pago') THEN
    RAISE EXCEPTION 'A assinatura não pode ser ativada no estado atual.';
  END IF;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'pago')
  INTO v_invoice_count, v_paid_count
  FROM public.faturas
  WHERE ordem_assinatura_id = p_ordem_assinatura_id;

  IF v_ordem.status <> 'pago' AND v_paid_count = 0 THEN
    RAISE EXCEPTION 'A assinatura ainda não possui pagamento confirmado.';
  END IF;

  SELECT nome INTO v_nome
  FROM public.assinaturas
  WHERE id = v_ordem.assinatura_id;

  UPDATE public.ordens_assinatura
  SET status = 'concluido',
      motivo_cancelamento = NULL,
      data_cancelamento = NULL,
      data_conclusao = now()
  WHERE id = p_ordem_assinatura_id;

  INSERT INTO public.notificacoes(
    cliente_id, destinatario_tipo, titulo, mensagem, modulo, tipo, lida, data_criacao
  ) VALUES (
    v_ordem.cliente_id, 'cliente', 'Assinatura ativada',
    format('Sua assinatura %s foi ativada com sucesso.', COALESCE(v_nome, 'contratada')),
    'assinaturas', 'assinatura_criada', false, now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'ordem_id', p_ordem_assinatura_id,
    'status', 'concluido',
    'invoice_count', v_invoice_count,
    'paid_invoice_count', v_paid_count
  );

  INSERT INTO public.gsa_admin_operation_requests(
    request_id, actor_id, actor_type, operation, resource_id, result
  ) VALUES (
    p_request_id, v_actor.actor_id, v_actor.actor_type,
    'activate_subscription', p_ordem_assinatura_id, v_result
  );

  RETURN v_result;
END;
$$;

-- As constraints antigas eram NOT VALID; a auditoria final passa a exigir que
-- todo o catálogo histórico também esteja consistente.
ALTER TABLE public.produtos VALIDATE CONSTRAINT produtos_valor_positivo;
ALTER TABLE public.produtos VALIDATE CONSTRAINT produtos_custo_nao_negativo;
ALTER TABLE public.produtos VALIDATE CONSTRAINT produtos_margem_nao_negativa;
ALTER TABLE public.produtos VALIDATE CONSTRAINT produtos_estoque_nao_negativo;
ALTER TABLE public.assinaturas VALIDATE CONSTRAINT assinaturas_valor_positivo;

REVOKE ALL ON FUNCTION public.gsa_sync_admin_operation_request_columns() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_require_admin_actor(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_validate_product_catalog_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_validate_subscription_catalog_row() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.gsa_admin_activate_subscription(uuid, text, uuid, uuid) TO authenticated;

COMMIT;
