BEGIN;

CREATE TABLE IF NOT EXISTS public.loja_credito_contestacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo text NOT NULL UNIQUE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  movimentacao_id uuid NOT NULL REFERENCES public.loja_credito_movimentacoes(id) ON DELETE RESTRICT,
  orcamento_id uuid REFERENCES public.orcamentos(id) ON DELETE SET NULL,
  codigo_compra text,
  descricao_compra text NOT NULL,
  valor_compra numeric(14,2) NOT NULL CHECK (valor_compra > 0),
  valor_contestado numeric(14,2) NOT NULL CHECK (valor_contestado > 0),
  motivo text NOT NULL,
  descricao text NOT NULL,
  anexos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'aberta',
  prazo_limite timestamptz NOT NULL,
  valor_deferido numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_deferido >= 0),
  motivo_decisao text,
  analisada_por uuid,
  analisada_por_tipo text,
  analisada_por_nome text,
  analisada_em timestamptz,
  estorno_movimentacao_id uuid REFERENCES public.loja_credito_movimentacoes(id) ON DELETE SET NULL,
  reembolso_id uuid REFERENCES public.loja_reembolsos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.loja_credito_contestacoes
  DROP CONSTRAINT IF EXISTS loja_credito_contestacoes_status_check;
ALTER TABLE public.loja_credito_contestacoes
  ADD CONSTRAINT loja_credito_contestacoes_status_check CHECK (status IN (
    'aberta', 'em_analise', 'aguardando_documentos', 'deferida',
    'parcialmente_deferida', 'indeferida', 'cancelada_cliente',
    'resolvida_por_estorno'
  ));

ALTER TABLE public.loja_credito_contestacoes
  DROP CONSTRAINT IF EXISTS loja_credito_contestacoes_motivo_check;
ALTER TABLE public.loja_credito_contestacoes
  ADD CONSTRAINT loja_credito_contestacoes_motivo_check CHECK (motivo IN (
    'nao_reconheco', 'nao_recebido', 'produto_divergente', 'cobranca_duplicada',
    'valor_incorreto', 'cancelada_sem_estorno', 'problema_fornecedor', 'outro'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS uq_credito_contestacao_ativa_movimento
  ON public.loja_credito_contestacoes(movimentacao_id)
  WHERE status IN ('aberta', 'em_analise', 'aguardando_documentos');
CREATE INDEX IF NOT EXISTS idx_credito_contestacoes_cliente_data
  ON public.loja_credito_contestacoes(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credito_contestacoes_status_data
  ON public.loja_credito_contestacoes(status, created_at DESC);
CREATE TABLE IF NOT EXISTS public.loja_credito_contestacao_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contestacao_id uuid NOT NULL REFERENCES public.loja_credito_contestacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  ator_tipo text NOT NULL DEFAULT 'sistema',
  ator_id uuid,
  ator_nome text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ocorrido_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credito_contestacao_eventos_timeline
  ON public.loja_credito_contestacao_eventos(contestacao_id, ocorrido_em, id);

ALTER TABLE public.loja_credito_contestacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_credito_contestacao_eventos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loja_credito_contestacoes_no_direct_access ON public.loja_credito_contestacoes;
CREATE POLICY loja_credito_contestacoes_no_direct_access
  ON public.loja_credito_contestacoes FOR ALL USING (false) WITH CHECK (false);
DROP POLICY IF EXISTS loja_credito_contestacao_eventos_no_direct_access ON public.loja_credito_contestacao_eventos;
CREATE POLICY loja_credito_contestacao_eventos_no_direct_access
  ON public.loja_credito_contestacao_eventos FOR ALL USING (false) WITH CHECK (false);
REVOKE ALL ON public.loja_credito_contestacoes, public.loja_credito_contestacao_eventos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loja_credito_contestacoes, public.loja_credito_contestacao_eventos TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_credit_dispute_purchase_code(p_descricao text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT substring(COALESCE(p_descricao, '') FROM '(ODC-[A-Za-z0-9]+|PED-LOJA-[A-Za-z0-9]+)')
$$;

CREATE OR REPLACE FUNCTION public.gsa_credit_dispute_order_id(
  p_cliente_id uuid,
  p_descricao text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
  SELECT o.id
  FROM public.orcamentos o
  WHERE o.cliente_id = p_cliente_id
    AND o.codigo_orcamento = public.gsa_credit_dispute_purchase_code(p_descricao)
  ORDER BY o.data_criacao DESC
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.gsa_credit_dispute_purchase_code(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_credit_dispute_order_id(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_credit_dispute_purchase_code(text), public.gsa_credit_dispute_order_id(uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_create_credit_dispute(
  p_sessao_id uuid,
  p_session_token text,
  p_movimentacao_id uuid,
  p_motivo text,
  p_descricao text,
  p_anexos jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_mov public.loja_credito_movimentacoes%rowtype;
  v_order public.orcamentos%rowtype;
  v_dispute public.loja_credito_contestacoes%rowtype;
  v_reason text := lower(trim(COALESCE(p_motivo, '')));
  v_description text := trim(COALESCE(p_descricao, ''));
  v_code text;
  v_protocol text;
  v_deadline timestamptz;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT * INTO v_mov
  FROM public.loja_credito_movimentacoes
  WHERE id = p_movimentacao_id
    AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF v_mov.id IS NULL OR v_mov.tipo <> 'compra' THEN
    RAISE EXCEPTION 'A movimentação informada não é uma compra contestável.' USING ERRCODE = '22023';
  END IF;
  IF v_mov.created_at IS NULL THEN
    RAISE EXCEPTION 'A compra não possui data válida para cálculo do prazo.' USING ERRCODE = '22023';
  END IF;

  v_deadline := v_mov.created_at + interval '90 days';
  IF now() > v_deadline THEN
    RAISE EXCEPTION 'O prazo de 90 dias para contestar esta compra foi encerrado.' USING ERRCODE = '22023';
  END IF;
  IF v_reason NOT IN (
    'nao_reconheco', 'nao_recebido', 'produto_divergente', 'cobranca_duplicada',
    'valor_incorreto', 'cancelada_sem_estorno', 'problema_fornecedor', 'outro'
  ) THEN
    RAISE EXCEPTION 'Selecione um motivo válido para a contestação.' USING ERRCODE = '22023';
  END IF;
  IF length(v_description) < 10 THEN
    RAISE EXCEPTION 'Descreva o problema com pelo menos 10 caracteres.' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_anexos, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'Formato de anexos inválido.' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.loja_credito_contestacoes c
    WHERE c.movimentacao_id = v_mov.id
      AND c.status IN ('aberta', 'em_analise', 'aguardando_documentos')
  ) THEN
    RAISE EXCEPTION 'Já existe uma contestação ativa para esta compra.' USING ERRCODE = '23505';
  END IF;
  v_code := public.gsa_credit_dispute_purchase_code(v_mov.descricao);
  IF v_code IS NOT NULL THEN
    SELECT * INTO v_order
    FROM public.orcamentos o
    WHERE o.cliente_id = v_actor.cliente_id
      AND o.codigo_orcamento = v_code
    ORDER BY o.data_criacao DESC
    LIMIT 1;
  END IF;

  IF v_order.id IS NOT NULL AND v_order.status = 'cancelado' THEN
    RAISE EXCEPTION 'Esta compra já foi cancelada ou estornada.' USING ERRCODE = '22023';
  END IF;
  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.loja_credito_movimentacoes e
    WHERE e.cliente_id = v_actor.cliente_id
      AND e.tipo = 'estorno_compra'
      AND e.created_at >= v_mov.created_at
      AND public.gsa_credit_dispute_purchase_code(e.descricao) = v_code
  ) THEN
    RAISE EXCEPTION 'Esta compra já possui estorno registrado.' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.loja_credito_contestacoes c
    WHERE c.movimentacao_id = v_mov.id
      AND c.status IN ('deferida', 'parcialmente_deferida', 'resolvida_por_estorno')
  ) THEN
    RAISE EXCEPTION 'Esta compra já possui contestação finalizada com estorno.' USING ERRCODE = '22023';
  END IF;

  LOOP
    v_protocol := 'CONT-' || to_char(clock_timestamp(), 'YYYY') || '-' ||
      upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.loja_credito_contestacoes WHERE protocolo = v_protocol
    );
  END LOOP;
  INSERT INTO public.loja_credito_contestacoes(
    protocolo, cliente_id, movimentacao_id, orcamento_id, codigo_compra,
    descricao_compra, valor_compra, valor_contestado, motivo, descricao,
    anexos, status, prazo_limite
  ) VALUES (
    v_protocol, v_actor.cliente_id, v_mov.id, v_order.id, v_code,
    COALESCE(v_mov.descricao, 'Compra no Crédito GSA'), round(abs(v_mov.valor), 2),
    round(abs(v_mov.valor), 2), v_reason, left(v_description, 3000),
    COALESCE(p_anexos, '[]'::jsonb), 'aberta', v_deadline
  ) RETURNING * INTO v_dispute;

  INSERT INTO public.loja_credito_contestacao_eventos(
    contestacao_id, tipo, titulo, descricao, ator_tipo, ator_id, ator_nome
  ) VALUES (
    v_dispute.id, 'abertura', 'Contestação registrada',
    'A compra foi contestada pelo cliente e aguarda análise administrativa.',
    'cliente', v_actor.cliente_id, v_actor.cliente_nome
  );

  PERFORM set_config('gsa.system_override', 'on', true);
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES
  (v_actor.cliente_id, 'Contestação registrada',
   format('Sua contestação %s foi registrada e está aguardando análise.', v_protocol),
   'financeiro', 'contestacoes', v_dispute.id::text,
   'cliente', 'normal', 'contestacao_credito_aberta',
   jsonb_build_object('contestacao_id', v_dispute.id, 'protocolo', v_protocol)),
  (NULL, 'Nova contestação de compra',
   format('O cliente %s contestou uma compra de R$ %s. Protocolo %s.',
     v_actor.cliente_nome, to_char(v_dispute.valor_contestado, 'FM999G999G990D00'), v_protocol),
   'financeiro', 'contestacoes', v_dispute.id::text,
   'admin', 'alta', 'contestacao_credito_aberta',
   jsonb_build_object('contestacao_id', v_dispute.id, 'cliente_id', v_actor.cliente_id, 'protocolo', v_protocol));

  RETURN jsonb_build_object(
    'success', true,
    'contestacao_id', v_dispute.id,
    'protocolo', v_dispute.protocolo,
    'status', v_dispute.status,
    'prazo_limite', v_dispute.prazo_limite,
    'valor_contestado', v_dispute.valor_contestado
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_create_credit_dispute(uuid,text,uuid,text,text,jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_create_credit_dispute(uuid,text,uuid,text,text,jsonb)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_credit_disputes(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id, 'protocolo', c.protocolo, 'movimentacao_id', c.movimentacao_id,
      'orcamento_id', c.orcamento_id, 'codigo_compra', c.codigo_compra,
      'descricao_compra', c.descricao_compra, 'valor_compra', c.valor_compra,
      'valor_contestado', c.valor_contestado, 'motivo', c.motivo,
      'descricao', c.descricao, 'anexos', c.anexos, 'status', c.status,
      'prazo_limite', c.prazo_limite, 'valor_deferido', c.valor_deferido,
      'motivo_decisao', c.motivo_decisao, 'created_at', c.created_at,
      'updated_at', c.updated_at, 'analisada_em', c.analisada_em
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.loja_credito_contestacoes c
  WHERE c.cliente_id = v_actor.cliente_id;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_credit_disputes(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_credit_disputes(uuid,text) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_credit_dispute_details(
  p_sessao_id uuid,
  p_session_token text,
  p_contestacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_dispute public.loja_credito_contestacoes%rowtype;
  v_events jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;
  SELECT * INTO v_dispute
  FROM public.loja_credito_contestacoes
  WHERE id = p_contestacao_id AND cliente_id = v_actor.cliente_id;
  IF v_dispute.id IS NULL THEN
    RAISE EXCEPTION 'Contestação não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', e.id, 'tipo', e.tipo, 'titulo', e.titulo, 'descricao', e.descricao,
      'ator_tipo', e.ator_tipo, 'ator_nome', e.ator_nome,
      'metadata', e.metadata, 'ocorrido_em', e.ocorrido_em
    ) ORDER BY e.ocorrido_em, e.id
  ), '[]'::jsonb) INTO v_events
  FROM public.loja_credito_contestacao_eventos e
  WHERE e.contestacao_id = v_dispute.id;

  RETURN to_jsonb(v_dispute) || jsonb_build_object('eventos', v_events);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_credit_dispute_details(uuid,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_credit_dispute_details(uuid,text,uuid)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_cancel_credit_dispute(
  p_sessao_id uuid,
  p_session_token text,
  p_contestacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_dispute public.loja_credito_contestacoes%rowtype;
BEGIN  SELECT * INTO v_actor
  FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;
  SELECT * INTO v_dispute
  FROM public.loja_credito_contestacoes
  WHERE id = p_contestacao_id AND cliente_id = v_actor.cliente_id
  FOR UPDATE;
  IF v_dispute.id IS NULL THEN
    RAISE EXCEPTION 'Contestação não encontrada.' USING ERRCODE = 'P0002';
  END IF;
  IF v_dispute.status = 'cancelada_cliente' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'cancelada_cliente');
  END IF;
  IF v_dispute.status NOT IN ('aberta', 'em_analise', 'aguardando_documentos') THEN
    RAISE EXCEPTION 'Esta contestação não pode mais ser cancelada pelo cliente.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.loja_credito_contestacoes
  SET status = 'cancelada_cliente', updated_at = now()
  WHERE id = v_dispute.id;
  INSERT INTO public.loja_credito_contestacao_eventos(
    contestacao_id, tipo, titulo, descricao, ator_tipo, ator_id, ator_nome
  ) VALUES (
    v_dispute.id, 'cancelamento_cliente', 'Contestação cancelada',
    'O cliente cancelou a contestação antes da decisão administrativa.',
    'cliente', v_actor.cliente_id, v_actor.cliente_nome
  );

  PERFORM set_config('gsa.system_override', 'on', true);
  INSERT INTO public.notificacoes(
    cliente_id, titulo, mensagem, modulo, tab, item_id,
    destinatario_tipo, prioridade, acao_origem, contexto
  ) VALUES (
    NULL, 'Contestação cancelada pelo cliente',
    format('A contestação %s foi cancelada pelo cliente.', v_dispute.protocolo),
    'financeiro', 'contestacoes', v_dispute.id::text, 'admin', 'normal',
    'contestacao_credito_cancelada_cliente', jsonb_build_object('contestacao_id', v_dispute.id)
  );
  RETURN jsonb_build_object('success', true, 'idempotent', false, 'status', 'cancelada_cliente');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_client_cancel_credit_dispute(uuid,text,uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_cancel_credit_dispute(uuid,text,uuid)
  TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_credit_disputes(
  p_sessao_id uuid,
  p_session_token text,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_result jsonb;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token)
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', c.id, 'protocolo', c.protocolo, 'cliente_id', c.cliente_id,
      'cliente_nome', cli.nome, 'cliente_email', cli.email, 'cliente_telefone', cli.telefone,
      'movimentacao_id', c.movimentacao_id, 'orcamento_id', c.orcamento_id,
      'codigo_compra', c.codigo_compra, 'descricao_compra', c.descricao_compra,
      'valor_compra', c.valor_compra, 'valor_contestado', c.valor_contestado,
      'motivo', c.motivo, 'descricao', c.descricao, 'anexos', c.anexos,
      'status', c.status, 'prazo_limite', c.prazo_limite,
      'valor_deferido', c.valor_deferido, 'motivo_decisao', c.motivo_decisao,
      'analisada_por_nome', c.analisada_por_nome, 'analisada_em', c.analisada_em,
      'created_at', c.created_at, 'updated_at', c.updated_at
    ) ORDER BY c.created_at DESC
  ), '[]'::jsonb) INTO v_result
  FROM public.loja_credito_contestacoes c
  JOIN public.clientes cli ON cli.id = c.cliente_id
  WHERE p_status IS NULL OR c.status = p_status;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_credit_disputes(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_credit_disputes(uuid,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_review_credit_dispute(
  p_sessao_id uuid,
  p_session_token text,
  p_contestacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_dispute public.loja_credito_contestacoes%rowtype;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT * INTO v_dispute FROM public.loja_credito_contestacoes
  WHERE id = p_contestacao_id FOR UPDATE;
  IF v_dispute.id IS NULL THEN RAISE EXCEPTION 'Contestação não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_dispute.status = 'em_analise' THEN
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'status', 'em_analise');
  END IF;
  IF v_dispute.status <> 'aberta' THEN
    RAISE EXCEPTION 'A contestação não pode ser colocada em análise neste status.' USING ERRCODE='22023';
  END IF;

  UPDATE public.loja_credito_contestacoes
  SET status='em_analise', analisada_por=v_actor.ator_id, analisada_por_tipo=v_actor.ator_tipo,
      analisada_por_nome=v_actor.ator_nome, analisada_em=now(), updated_at=now()
  WHERE id=v_dispute.id;
  INSERT INTO public.loja_credito_contestacao_eventos(
    contestacao_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome
  ) VALUES (v_dispute.id,'inicio_analise','Contestação em análise',
    'A equipe iniciou a análise da contestação.',v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome);
  PERFORM set_config('gsa.system_override','on',true);
  INSERT INTO public.notificacoes(
    cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto
  ) VALUES (
    v_dispute.cliente_id,'Contestação em análise',
    format('A contestação %s entrou em análise pela equipe GSA.',v_dispute.protocolo),
    'financeiro','contestacoes',v_dispute.id::text,'cliente','normal',
    'contestacao_credito_em_analise',jsonb_build_object('contestacao_id',v_dispute.id)
  );
  RETURN jsonb_build_object('success',true,'idempotent',false,'status','em_analise');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_review_credit_dispute(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_review_credit_dispute(uuid,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_request_credit_dispute_documents(
  p_sessao_id uuid,
  p_session_token text,
  p_contestacao_id uuid,
  p_mensagem text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_dispute public.loja_credito_contestacoes%rowtype;
  v_message text := trim(COALESCE(p_mensagem,''));
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  IF length(v_message) < 5 THEN RAISE EXCEPTION 'Informe quais documentos são necessários.' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_dispute FROM public.loja_credito_contestacoes
  WHERE id=p_contestacao_id FOR UPDATE;
  IF v_dispute.id IS NULL THEN RAISE EXCEPTION 'Contestação não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_dispute.status NOT IN ('aberta','em_analise','aguardando_documentos') THEN
    RAISE EXCEPTION 'Não é possível solicitar documentos neste status.' USING ERRCODE='22023';
  END IF;
  UPDATE public.loja_credito_contestacoes
  SET status='aguardando_documentos',analisada_por=v_actor.ator_id,
      analisada_por_tipo=v_actor.ator_tipo,analisada_por_nome=v_actor.ator_nome,
      analisada_em=COALESCE(analisada_em,now()),updated_at=now()
  WHERE id=v_dispute.id;
  INSERT INTO public.loja_credito_contestacao_eventos(
    contestacao_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome
  ) VALUES (v_dispute.id,'documentos_solicitados','Documentos solicitados',left(v_message,2000),
    v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome);
  PERFORM set_config('gsa.system_override','on',true);
  INSERT INTO public.notificacoes(
    cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto
  ) VALUES (v_dispute.cliente_id,'Documentos necessários para a contestação',
    left(v_message,2000),'financeiro','contestacoes',v_dispute.id::text,'cliente','alta',
    'contestacao_credito_documentos',jsonb_build_object('contestacao_id',v_dispute.id,'protocolo',v_dispute.protocolo));
  RETURN jsonb_build_object('success',true,'status','aguardando_documentos');
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_request_credit_dispute_documents(uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_request_credit_dispute_documents(uuid,text,uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_decide_credit_dispute(
  p_sessao_id uuid,
  p_session_token text,
  p_contestacao_id uuid,
  p_decisao text,
  p_valor_deferido numeric DEFAULT NULL,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_dispute public.loja_credito_contestacoes%rowtype;
  v_mov public.loja_credito_movimentacoes%rowtype;
  v_order public.orcamentos%rowtype;
  v_client public.clientes%rowtype;
  v_decision text := lower(trim(COALESCE(p_decisao,'')));
  v_reason text := trim(COALESCE(p_motivo,''));
  v_approved numeric := round(COALESCE(p_valor_deferido,0),2);
  v_outstanding numeric := 0;
  v_paid_total numeric := 0;
  v_debt_reduction numeric := 0;
  v_refund_amount numeric := 0;
  v_remaining numeric := 0;
  v_take numeric := 0;
  v_limit_before numeric := 0;
  v_limit_after numeric := 0;
  v_estorno_id uuid;
  v_refund_id uuid;
  v_refund_code text;
  v_first_purchase uuid;
  v_first_subscription uuid;
  v_has_invoices boolean := false;
  v_invoice record;
BEGIN  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT * INTO v_dispute FROM public.loja_credito_contestacoes
  WHERE id=p_contestacao_id FOR UPDATE;
  IF v_dispute.id IS NULL THEN RAISE EXCEPTION 'Contestação não encontrada.' USING ERRCODE='P0002'; END IF;
  IF v_dispute.status IN ('deferida','parcialmente_deferida','indeferida','resolvida_por_estorno') THEN
    RETURN jsonb_build_object(
      'success',true,'idempotent',true,'status',v_dispute.status,
      'valor_deferido',v_dispute.valor_deferido
    );
  END IF;
  IF v_dispute.status = 'cancelada_cliente' THEN
    RAISE EXCEPTION 'A contestação foi cancelada pelo cliente.' USING ERRCODE='22023';
  END IF;
  IF v_decision NOT IN ('deferido','parcialmente_deferido','indeferido') THEN
    RAISE EXCEPTION 'Decisão inválida.' USING ERRCODE='22023';
  END IF;

  IF v_decision = 'indeferido' THEN
    IF length(v_reason) < 5 THEN RAISE EXCEPTION 'Informe o motivo do indeferimento.' USING ERRCODE='22023'; END IF;
    UPDATE public.loja_credito_contestacoes
    SET status='indeferida',valor_deferido=0,motivo_decisao=left(v_reason,2000),
        analisada_por=v_actor.ator_id,analisada_por_tipo=v_actor.ator_tipo,
        analisada_por_nome=v_actor.ator_nome,analisada_em=now(),updated_at=now()
    WHERE id=v_dispute.id;
    INSERT INTO public.loja_credito_contestacao_eventos(
      contestacao_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome
    ) VALUES (v_dispute.id,'indeferimento','Contestação não aprovada',left(v_reason,2000),
      v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome);
    PERFORM set_config('gsa.system_override','on',true);
    INSERT INTO public.notificacoes(
      cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto
    ) VALUES (v_dispute.cliente_id,'Contestação não aprovada',
      format('A contestação %s foi analisada e não aprovada. Consulte o protocolo para ver o motivo.',v_dispute.protocolo),
      'financeiro','contestacoes',v_dispute.id::text,'cliente','alta',
      'contestacao_credito_indeferida',jsonb_build_object('contestacao_id',v_dispute.id,'protocolo',v_dispute.protocolo));
    RETURN jsonb_build_object('success',true,'status','indeferida','valor_deferido',0);
  END IF;

  IF v_decision = 'deferido' THEN
    v_approved := v_dispute.valor_contestado;
  ELSE
    IF v_approved <= 0 OR v_approved >= v_dispute.valor_contestado THEN
      RAISE EXCEPTION 'Na aprovação parcial, informe um valor maior que zero e menor que o valor contestado.' USING ERRCODE='22023';
    END IF;
  END IF;
  IF length(v_reason) < 3 THEN
    RAISE EXCEPTION 'Informe a justificativa da decisão.' USING ERRCODE='22023';
  END IF;

  SELECT * INTO v_mov FROM public.loja_credito_movimentacoes
  WHERE id=v_dispute.movimentacao_id AND cliente_id=v_dispute.cliente_id
  FOR UPDATE;
  IF v_mov.id IS NULL OR v_mov.tipo <> 'compra' THEN
    RAISE EXCEPTION 'A compra original não está disponível para liquidação.';
  END IF;
  IF v_dispute.orcamento_id IS NOT NULL THEN
    SELECT * INTO v_order FROM public.orcamentos
    WHERE id=v_dispute.orcamento_id AND cliente_id=v_dispute.cliente_id
    FOR UPDATE;
  END IF;

  IF (v_order.id IS NOT NULL AND v_order.status='cancelado') OR
     (v_dispute.codigo_compra IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.loja_credito_movimentacoes e
       WHERE e.cliente_id=v_dispute.cliente_id
         AND e.tipo='estorno_compra'
         AND e.created_at >= v_mov.created_at
         AND public.gsa_credit_dispute_purchase_code(e.descricao)=v_dispute.codigo_compra
     )) THEN
    UPDATE public.loja_credito_contestacoes
    SET status='resolvida_por_estorno',valor_deferido=0,
        motivo_decisao='Compra já cancelada ou estornada por outro fluxo.',
        analisada_por=v_actor.ator_id,analisada_por_tipo=v_actor.ator_tipo,
        analisada_por_nome=v_actor.ator_nome,analisada_em=now(),updated_at=now()
    WHERE id=v_dispute.id;
    INSERT INTO public.loja_credito_contestacao_eventos(
      contestacao_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome
    ) VALUES (v_dispute.id,'resolvida_por_estorno','Resolvida por estorno anterior',
      'A compra já havia sido cancelada ou estornada por outro fluxo; nenhum crédito adicional foi gerado.',
      v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome);
    PERFORM set_config('gsa.system_override','on',true);
    INSERT INTO public.notificacoes(
      cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto
    ) VALUES (v_dispute.cliente_id,'Contestação resolvida por estorno',
      format('A compra da contestação %s já possui cancelamento ou estorno registrado.',v_dispute.protocolo),
      'financeiro','contestacoes',v_dispute.id::text,'cliente','normal',
      'contestacao_credito_resolvida_estorno',jsonb_build_object('contestacao_id',v_dispute.id));
    RETURN jsonb_build_object('success',true,'status','resolvida_por_estorno','valor_deferido',0);
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('gsa-store-credit:' || v_dispute.cliente_id::text,0));
  SELECT * INTO v_client FROM public.clientes WHERE id=v_dispute.cliente_id FOR UPDATE;
  IF v_client.id IS NULL THEN RAISE EXCEPTION 'Cliente da contestação não encontrado.'; END IF;

  IF v_order.id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM public.faturas f
      WHERE f.orcamento_id=v_order.id AND COALESCE(f.is_amortizacao_credito,false)
    ) INTO v_has_invoices;
    SELECT COALESCE(sum(greatest(COALESCE(f.valor_final_pendente,0),0)),0),
           COALESCE(sum(greatest(COALESCE(f.valor_pago,0),0)),0)
      INTO v_outstanding,v_paid_total
    FROM public.faturas f
    WHERE f.orcamento_id=v_order.id
      AND COALESCE(f.is_amortizacao_credito,false)
      AND f.status <> 'cancelado';
  END IF;

  IF v_has_invoices THEN
    v_debt_reduction := least(v_approved,v_outstanding);
    v_refund_amount := least(greatest(v_approved-v_debt_reduction,0),v_paid_total);
    IF abs(v_approved-v_debt_reduction-v_refund_amount) > 0.01 THEN
      RAISE EXCEPTION 'A composição financeira da compra está inconsistente. Revise faturas e pagamentos antes de concluir.';
    END IF;
  ELSE
    v_debt_reduction := v_approved;
    v_refund_amount := 0;
  END IF;

  PERFORM set_config('gsa.credit_release','on',true);
  PERFORM set_config('gsa.system_override','on',true);
  v_remaining := v_debt_reduction;
  IF v_order.id IS NOT NULL AND v_remaining > 0 THEN
    FOR v_invoice IN
      SELECT f.id,f.valor_final_pendente,f.status,f.desconto_manual,f.historico_ajustes,f.metadata,f.observacoes
      FROM public.faturas f
      WHERE f.orcamento_id=v_order.id
        AND COALESCE(f.is_amortizacao_credito,false)
        AND f.status <> 'cancelado'
        AND COALESCE(f.valor_final_pendente,0) > 0
      ORDER BY f.data_vencimento,f.created_at,f.id
      FOR UPDATE
    LOOP
      EXIT WHEN v_remaining <= 0;
      v_take := least(v_remaining,COALESCE(v_invoice.valor_final_pendente,0));
      UPDATE public.faturas
      SET valor_final_pendente=greatest(COALESCE(valor_final_pendente,0)-v_take,0),
          desconto_manual=COALESCE(desconto_manual,0)+v_take,
          historico_ajustes=COALESCE(historico_ajustes,'[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'tipo','contestacao_credito','contestacao_id',v_dispute.id,
            'protocolo',v_dispute.protocolo,'valor',v_take,'data',now()
          )),
          metadata=COALESCE(metadata,'{}'::jsonb) || jsonb_build_object(
            'ultima_contestacao_id',v_dispute.id,'ultima_contestacao_protocolo',v_dispute.protocolo
          ),
          observacoes=concat_ws(E'\n',NULLIF(observacoes,''),
            format('Ajuste de R$ %s por contestação %s.',to_char(v_take,'FM999G999G990D00'),v_dispute.protocolo)),
          status=CASE WHEN greatest(COALESCE(valor_final_pendente,0)-v_take,0)=0 THEN 'revisada' ELSE status END
      WHERE id=v_invoice.id;
      v_remaining := round(v_remaining-v_take,2);
    END LOOP;
  END IF;
  IF v_remaining > 0.01 THEN
    RAISE EXCEPTION 'Não foi possível aplicar integralmente o ajuste nas faturas da compra.';
  END IF;

  IF v_debt_reduction > 0 THEN
    v_limit_before := COALESCE(v_client.limite_credito_disponivel,0);
    v_limit_after := least(COALESCE(v_client.limite_credito_total,0),round(v_limit_before+v_debt_reduction,2));
    UPDATE public.clientes
    SET limite_credito_disponivel=v_limit_after
    WHERE id=v_dispute.cliente_id;

    INSERT INTO public.loja_credito_movimentacoes(
      cliente_id,tipo,valor,
      limite_total_anterior,limite_total_novo,
      limite_disponivel_anterior,limite_disponivel_novo,descricao
    ) VALUES (
      v_dispute.cliente_id,'estorno_compra',v_debt_reduction,
      COALESCE(v_client.limite_credito_total,0),COALESCE(v_client.limite_credito_total,0),
      v_limit_before,v_limit_after,
      format('Estorno por Contestação %s%s',v_dispute.protocolo,
        CASE WHEN v_dispute.codigo_compra IS NOT NULL THEN ' - Compra ' || v_dispute.codigo_compra ELSE '' END)
    ) RETURNING id INTO v_estorno_id;
  END IF;

  IF v_refund_amount > 0 THEN
    IF v_order.id IS NULL THEN
      RAISE EXCEPTION 'Não foi possível vincular o valor já pago ao pedido original para reembolso.';
    END IF;
    SELECT id INTO v_first_purchase FROM public.ordens_compra
    WHERE orcamento_id=v_order.id ORDER BY data_criacao,id LIMIT 1;
    SELECT id INTO v_first_subscription FROM public.ordens_assinatura
    WHERE orcamento_id=v_order.id ORDER BY data_criacao,id LIMIT 1;
    v_refund_code := public.gsa_generate_code('REEMB');
    INSERT INTO public.loja_reembolsos(
      codigo_reembolso,ordem_compra_id,ordem_assinatura_id,cliente_id,
      valor_reembolso,motivo_cancelamento,prazo_pagamento,status,
      colaborador_id,observacoes_pagamento
    ) VALUES (
      v_refund_code,v_first_purchase,v_first_subscription,v_dispute.cliente_id,
      v_refund_amount,
      format('Contestação %s deferida: %s',v_dispute.protocolo,left(v_reason,1000)),
      now()+interval '3 days','pendente',
      CASE WHEN v_actor.ator_tipo='colaborador' THEN v_actor.ator_id ELSE NULL END,
      format('Reembolso do valor já amortizado/pago da contestação %s.',v_dispute.protocolo)
    ) RETURNING id INTO v_refund_id;
  END IF;

  UPDATE public.loja_credito_contestacoes
  SET status=CASE WHEN v_decision='deferido' THEN 'deferida' ELSE 'parcialmente_deferida' END,
      valor_deferido=v_approved,motivo_decisao=left(v_reason,2000),
      analisada_por=v_actor.ator_id,analisada_por_tipo=v_actor.ator_tipo,
      analisada_por_nome=v_actor.ator_nome,analisada_em=now(),updated_at=now(),
      estorno_movimentacao_id=v_estorno_id,reembolso_id=v_refund_id
  WHERE id=v_dispute.id;

  INSERT INTO public.loja_credito_contestacao_eventos(
    contestacao_id,tipo,titulo,descricao,ator_tipo,ator_id,ator_nome,metadata
  ) VALUES (
    v_dispute.id,
    CASE WHEN v_decision='deferido' THEN 'deferimento' ELSE 'deferimento_parcial' END,
    CASE WHEN v_decision='deferido' THEN 'Contestação aprovada' ELSE 'Contestação parcialmente aprovada' END,
    left(v_reason,2000),v_actor.ator_tipo,v_actor.ator_id,v_actor.ator_nome,
    jsonb_build_object('valor_deferido',v_approved,'abatimento_divida',v_debt_reduction,
      'reembolso_pago',v_refund_amount,'estorno_movimentacao_id',v_estorno_id,'reembolso_id',v_refund_id)
  );

  INSERT INTO public.notificacoes(
    cliente_id,titulo,mensagem,modulo,tab,item_id,destinatario_tipo,prioridade,acao_origem,contexto
  ) VALUES (
    v_dispute.cliente_id,
    CASE WHEN v_decision='deferido' THEN 'Contestação aprovada' ELSE 'Contestação parcialmente aprovada' END,
    CASE WHEN v_refund_amount > 0 THEN
      format('A contestação %s foi aprovada no valor de R$ %s. R$ %s foram ajustados no Crédito GSA e R$ %s seguiram para reembolso.',
        v_dispute.protocolo,to_char(v_approved,'FM999G999G990D00'),
        to_char(v_debt_reduction,'FM999G999G990D00'),to_char(v_refund_amount,'FM999G999G990D00'))
    ELSE
      format('A contestação %s foi aprovada no valor de R$ %s e o ajuste foi aplicado ao seu Crédito GSA.',
        v_dispute.protocolo,to_char(v_approved,'FM999G999G990D00'))
    END,
    'financeiro','contestacoes',v_dispute.id::text,'cliente','alta',
    'contestacao_credito_deferida',jsonb_build_object(
      'contestacao_id',v_dispute.id,'protocolo',v_dispute.protocolo,
      'valor_deferido',v_approved,'abatimento_divida',v_debt_reduction,'reembolso',v_refund_amount
    )
  );

  RETURN jsonb_build_object(
    'success',true,
    'status',CASE WHEN v_decision='deferido' THEN 'deferida' ELSE 'parcialmente_deferida' END,
    'valor_deferido',v_approved,
    'abatimento_divida',v_debt_reduction,
    'valor_reembolso',v_refund_amount,
    'estorno_movimentacao_id',v_estorno_id,
    'reembolso_id',v_refund_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_admin_decide_credit_dispute(uuid,text,uuid,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_decide_credit_dispute(uuid,text,uuid,text,numeric,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_admin_credit_dispute_details(
  p_sessao_id uuid,
  p_session_token text,
  p_contestacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_actor record;
  v_data jsonb;
  v_events jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT to_jsonb(c) || jsonb_build_object(
    'cliente_nome',cli.nome,'cliente_email',cli.email,'cliente_telefone',cli.telefone,
    'compra_data',m.created_at
  ) INTO v_data
  FROM public.loja_credito_contestacoes c
  JOIN public.clientes cli ON cli.id=c.cliente_id
  JOIN public.loja_credito_movimentacoes m ON m.id=c.movimentacao_id
  WHERE c.id=p_contestacao_id;
  IF v_data IS NULL THEN RAISE EXCEPTION 'Contestação não encontrada.' USING ERRCODE='P0002'; END IF;
  SELECT COALESCE(jsonb_agg(to_jsonb(e) ORDER BY e.ocorrido_em,e.id),'[]'::jsonb)
    INTO v_events
  FROM public.loja_credito_contestacao_eventos e
  WHERE e.contestacao_id=p_contestacao_id;
  RETURN v_data || jsonb_build_object('eventos',v_events);
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_admin_credit_dispute_details(uuid,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_admin_credit_dispute_details(uuid,text,uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
