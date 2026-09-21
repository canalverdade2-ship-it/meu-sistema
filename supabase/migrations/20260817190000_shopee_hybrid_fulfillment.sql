-- Hybrid Shopee fulfillment: the VPS owns the durable queue and a trusted
-- workstation claims assisted browser tasks. Payment remains a human action.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.shopee_automation_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'pausado', 'revogado')),
  modo text NOT NULL DEFAULT 'assistido' CHECK (modo IN ('assistido', 'observacao')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz,
  last_ip inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.shopee_fulfillment_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  orcamento_id uuid NOT NULL UNIQUE REFERENCES public.orcamentos(id) ON DELETE RESTRICT,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'fila' CHECK (status IN (
    'fila', 'reservado', 'validando', 'divergencia', 'preparando_carrinho',
    'aguardando_pagamento', 'comprado', 'acompanhando', 'enviado',
    'em_rota', 'entregue', 'falha', 'cancelado'
  )),
  prioridade smallint NOT NULL DEFAULT 100 CHECK (prioridade BETWEEN 1 AND 999),
  tentativas integer NOT NULL DEFAULT 0 CHECK (tentativas >= 0),
  max_tentativas integer NOT NULL DEFAULT 3 CHECK (max_tentativas BETWEEN 1 AND 20),
  worker_id uuid REFERENCES public.shopee_automation_workers(id) ON DELETE SET NULL,
  reserved_at timestamptz,
  lease_expires_at timestamptz,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  divergencias jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_error_code text,
  last_error_message text,
  checkout_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  shopee_order_sn text,
  shopee_checkout_url text,
  shopee_status text,
  tracking_code text,
  carrier text,
  purchased_at timestamptz,
  last_synced_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shopee_fulfillment_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.shopee_fulfillment_jobs(id) ON DELETE CASCADE,
  ordem_compra_id uuid NOT NULL UNIQUE REFERENCES public.ordens_compra(id) ON DELETE RESTRICT,
  produto_id uuid NOT NULL REFERENCES public.produtos(id) ON DELETE RESTRICT,
  produto_variante_id uuid REFERENCES public.produto_variantes(id) ON DELETE RESTRICT,
  produto_nome text NOT NULL,
  produto_codigo text,
  sku text,
  quantidade integer NOT NULL CHECK (quantidade > 0),
  source_url text NOT NULL,
  variacao_selecionada jsonb NOT NULL DEFAULT '{}'::jsonb,
  valor_venda_unitario numeric(14,2),
  valor_custo_esperado numeric(14,2),
  imagem_url text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN (
    'pendente', 'validado', 'divergencia', 'adicionado', 'indisponivel', 'cancelado'
  )),
  supplier_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.shopee_fulfillment_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES public.shopee_fulfillment_jobs(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  actor_type text NOT NULL DEFAULT 'system',
  actor_id text,
  actor_name text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopee_jobs_claim
  ON public.shopee_fulfillment_jobs(status, next_attempt_at, prioridade, created_at)
  WHERE status IN ('fila', 'falha');
CREATE INDEX IF NOT EXISTS idx_shopee_jobs_worker_lease
  ON public.shopee_fulfillment_jobs(worker_id, lease_expires_at)
  WHERE worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shopee_jobs_order_sn
  ON public.shopee_fulfillment_jobs(shopee_order_sn)
  WHERE shopee_order_sn IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shopee_job_items_job
  ON public.shopee_fulfillment_job_items(job_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shopee_events_job
  ON public.shopee_fulfillment_events(job_id, created_at DESC);

ALTER TABLE public.shopee_automation_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_fulfillment_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_fulfillment_job_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopee_fulfillment_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.shopee_automation_workers FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.shopee_fulfillment_jobs FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.shopee_fulfillment_job_items FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.shopee_fulfillment_events FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_shopee_worker_by_token(p_worker_token text)
RETURNS public.shopee_automation_workers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker public.shopee_automation_workers%rowtype;
BEGIN
  IF length(coalesce(p_worker_token, '')) < 32 THEN
    RAISE EXCEPTION 'Credencial do executor invalida.';
  END IF;

  SELECT * INTO v_worker
  FROM public.shopee_automation_workers
  WHERE token_hash = encode(extensions.digest(p_worker_token, 'sha256'), 'hex')
    AND status = 'ativo'
    AND revoked_at IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Executor nao autorizado.';
  END IF;
  RETURN v_worker;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_shopee_enqueue_paid_order(p_orcamento_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_cliente_id uuid;
BEGIN
  IF p_orcamento_id IS NULL THEN RETURN NULL; END IF;

  SELECT o.cliente_id INTO v_cliente_id
  FROM public.orcamentos o
  WHERE o.id = p_orcamento_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- A queue only starts after authoritative financial approval.
  IF NOT EXISTS (
    SELECT 1 FROM public.faturas f
    WHERE f.orcamento_id = p_orcamento_id AND f.status = 'pago'
  ) THEN
    RETURN NULL;
  END IF;

  -- Do not create empty jobs for local suppliers or services.
  IF NOT EXISTS (
    SELECT 1
    FROM public.ordens_compra oc
    JOIN public.produto_fornecedor_config pfc ON pfc.produto_id = oc.produto_id
    WHERE oc.orcamento_id = p_orcamento_id
      AND pfc.fornecimento_externo_ativo
      AND pfc.url_produto IS NOT NULL
      AND (pfc.url_produto ILIKE '%shopee.%' OR pfc.url_produto ILIKE '%shope.ee/%')
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.shopee_fulfillment_jobs(orcamento_id, cliente_id)
  VALUES (p_orcamento_id, v_cliente_id)
  ON CONFLICT (orcamento_id) DO NOTHING
  RETURNING id INTO v_job_id;

  IF v_job_id IS NULL THEN
    SELECT id INTO v_job_id
    FROM public.shopee_fulfillment_jobs
    WHERE orcamento_id = p_orcamento_id;
  ELSE
    INSERT INTO public.shopee_fulfillment_events(
      job_id, event_type, to_status, actor_type, actor_name, details
    ) VALUES (
      v_job_id, 'job_enqueued', 'fila', 'system', 'Pagamento GSA',
      jsonb_build_object('orcamento_id', p_orcamento_id)
    );
  END IF;

  INSERT INTO public.shopee_fulfillment_job_items(
    job_id, ordem_compra_id, produto_id, produto_variante_id,
    produto_nome, produto_codigo, sku, quantidade, source_url,
    variacao_selecionada, valor_venda_unitario, valor_custo_esperado,
    imagem_url, supplier_snapshot
  )
  SELECT
    v_job_id, oc.id, oc.produto_id, oc.produto_variante_id,
    coalesce(oc.nome_produto_contratado, p.nome), p.codigo_produto,
    coalesce(pv.sku, p.codigo_produto), greatest(oc.quantidade, 1), pfc.url_produto,
    coalesce(oc.variacao_selecionada, '{}'::jsonb),
    coalesce(oc.valor_unitario_contratado, pv.valor, p.valor),
    coalesce(pv.valor_custo, p.valor_custo),
    coalesce(pv.imagem_url, p.imagem_url),
    jsonb_build_object(
      'nome_fornecedor', pfc.nome_fornecedor,
      'tipo_fornecedor', pfc.tipo_fornecedor,
      'fornecimento_externo_ativo', pfc.fornecimento_externo_ativo
    )
  FROM public.ordens_compra oc
  JOIN public.produtos p ON p.id = oc.produto_id
  JOIN public.produto_fornecedor_config pfc ON pfc.produto_id = oc.produto_id
  LEFT JOIN public.produto_variantes pv ON pv.id = oc.produto_variante_id
  WHERE oc.orcamento_id = p_orcamento_id
    AND pfc.fornecimento_externo_ativo
    AND pfc.url_produto IS NOT NULL
    AND (pfc.url_produto ILIKE '%shopee.%' OR pfc.url_produto ILIKE '%shope.ee/%')
  ON CONFLICT (ordem_compra_id) DO NOTHING;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_shopee_enqueue_from_paid_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_orcamento_id uuid;
BEGIN
  IF NEW.status <> 'pago' OR (TG_OP = 'UPDATE' AND OLD.status = 'pago') THEN
    RETURN NEW;
  END IF;

  v_orcamento_id := NEW.orcamento_id;
  IF v_orcamento_id IS NULL AND NEW.ordem_compra_id IS NOT NULL THEN
    SELECT orcamento_id INTO v_orcamento_id
    FROM public.ordens_compra WHERE id = NEW.ordem_compra_id;
  END IF;
  PERFORM public.gsa_shopee_enqueue_paid_order(v_orcamento_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shopee_enqueue_paid_invoice ON public.faturas;
CREATE TRIGGER trg_shopee_enqueue_paid_invoice
AFTER INSERT OR UPDATE OF status ON public.faturas
FOR EACH ROW EXECUTE FUNCTION public.gsa_shopee_enqueue_from_paid_invoice();

CREATE OR REPLACE FUNCTION public.gsa_shopee_worker_claim(
  p_worker_token text,
  p_lease_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker public.shopee_automation_workers%rowtype;
  v_job public.shopee_fulfillment_jobs%rowtype;
  v_payload jsonb;
BEGIN
  v_worker := public.gsa_shopee_worker_by_token(p_worker_token);
  p_lease_minutes := least(greatest(coalesce(p_lease_minutes, 30), 5), 120);

  UPDATE public.shopee_automation_workers
  SET last_seen_at = now(), updated_at = now()
  WHERE id = v_worker.id;

  -- One Shopee buyer account has one shared cart. Never mix two GSA customers
  -- while a previous cart is being prepared or waiting for human payment.
  IF EXISTS (
    SELECT 1 FROM public.shopee_fulfillment_jobs
    WHERE status IN ('reservado','validando','preparando_carrinho','aguardando_pagamento')
      AND (lease_expires_at IS NULL OR lease_expires_at > now())
  ) THEN
    RETURN jsonb_build_object(
      'success', true,
      'job', NULL,
      'blocked_reason', 'active_cart_or_payment_pending'
    );
  END IF;

  SELECT * INTO v_job
  FROM public.shopee_fulfillment_jobs j
  WHERE (
      j.status = 'fila'
      OR (j.status = 'falha' AND j.tentativas < j.max_tentativas)
      OR (j.status = 'reservado' AND j.lease_expires_at < now())
    )
    AND j.next_attempt_at <= now()
  ORDER BY j.prioridade ASC, j.created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'job', NULL);
  END IF;

  UPDATE public.shopee_fulfillment_jobs
  SET status = 'reservado', worker_id = v_worker.id, reserved_at = now(),
      lease_expires_at = now() + make_interval(mins => p_lease_minutes),
      tentativas = tentativas + 1, updated_at = now()
  WHERE id = v_job.id
  RETURNING * INTO v_job;

  INSERT INTO public.shopee_fulfillment_events(
    job_id, event_type, from_status, to_status, actor_type, actor_id, actor_name
  ) VALUES (
    v_job.id, 'job_claimed', NULL, 'reservado', 'worker', v_worker.id::text, v_worker.nome
  );

  SELECT jsonb_build_object(
    'success', true,
    'job', jsonb_build_object(
      'id', v_job.id,
      'orcamento_id', v_job.orcamento_id,
      'status', v_job.status,
      'attempt', v_job.tentativas,
      'lease_expires_at', v_job.lease_expires_at,
      'customer', jsonb_build_object(
        'id', c.id, 'name', c.nome, 'email', c.email, 'phone', c.telefone,
        'document', coalesce(c.cpf, c.cnpj), 'address', o.endereco_entrega
      ),
      'order', jsonb_build_object(
        'code', o.codigo_orcamento, 'total', o.total,
        'payment_method', o.forma_pagamento_loja
      ),
      'items', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'order_item_id', i.ordem_compra_id,
          'product_id', i.produto_id, 'variant_id', i.produto_variante_id,
          'name', i.produto_nome, 'code', i.produto_codigo, 'sku', i.sku,
          'quantity', i.quantidade, 'source_url', i.source_url,
          'variation', i.variacao_selecionada,
          'sale_unit_price', i.valor_venda_unitario,
          'expected_cost', i.valor_custo_esperado,
          'image_url', i.imagem_url, 'status', i.status
        ) ORDER BY i.created_at)
        FROM public.shopee_fulfillment_job_items i WHERE i.job_id = v_job.id
      ), '[]'::jsonb)
    )
  ) INTO v_payload
  FROM public.orcamentos o
  JOIN public.clientes c ON c.id = o.cliente_id
  WHERE o.id = v_job.orcamento_id;

  RETURN v_payload;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_shopee_worker_heartbeat(
  p_worker_token text,
  p_job_id uuid DEFAULT NULL,
  p_lease_minutes integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_worker public.shopee_automation_workers%rowtype;
BEGIN
  v_worker := public.gsa_shopee_worker_by_token(p_worker_token);
  UPDATE public.shopee_automation_workers
  SET last_seen_at = now(), updated_at = now()
  WHERE id = v_worker.id;

  IF p_job_id IS NOT NULL THEN
    UPDATE public.shopee_fulfillment_jobs
    SET lease_expires_at = now() + make_interval(mins => least(greatest(coalesce(p_lease_minutes, 30), 5), 120)),
        updated_at = now()
    WHERE id = p_job_id AND worker_id = v_worker.id
      AND status NOT IN ('entregue', 'cancelado');
  END IF;
  RETURN jsonb_build_object('success', true, 'worker_id', v_worker.id, 'server_time', now());
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_shopee_worker_update_job(
  p_worker_token text,
  p_job_id uuid,
  p_status text,
  p_patch jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_worker public.shopee_automation_workers%rowtype;
  v_job public.shopee_fulfillment_jobs%rowtype;
  v_old_status text;
  v_status text := lower(trim(coalesce(p_status, '')));
BEGIN
  v_worker := public.gsa_shopee_worker_by_token(p_worker_token);
  IF v_status NOT IN (
    'validando', 'divergencia', 'preparando_carrinho', 'aguardando_pagamento',
    'comprado', 'acompanhando', 'enviado', 'em_rota', 'entregue', 'falha'
  ) THEN RAISE EXCEPTION 'Status de executor invalido.'; END IF;

  SELECT * INTO v_job FROM public.shopee_fulfillment_jobs
  WHERE id = p_job_id AND worker_id = v_worker.id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa nao reservada por este executor.'; END IF;
  v_old_status := v_job.status;

  UPDATE public.shopee_fulfillment_jobs
  SET status = v_status,
      lease_expires_at = CASE WHEN v_status IN ('falha','aguardando_pagamento','comprado','entregue') THEN NULL ELSE lease_expires_at END,
      next_attempt_at = CASE WHEN v_status = 'falha' THEN now() + interval '10 minutes' ELSE next_attempt_at END,
      divergencias = CASE WHEN p_patch ? 'divergences' THEN p_patch->'divergences' ELSE divergencias END,
      checkout_snapshot = CASE WHEN p_patch ? 'checkout_snapshot' THEN p_patch->'checkout_snapshot' ELSE checkout_snapshot END,
      shopee_order_sn = coalesce(nullif(p_patch->>'shopee_order_sn',''), shopee_order_sn),
      shopee_checkout_url = coalesce(nullif(p_patch->>'checkout_url',''), shopee_checkout_url),
      shopee_status = coalesce(nullif(p_patch->>'shopee_status',''), shopee_status),
      tracking_code = coalesce(nullif(p_patch->>'tracking_code',''), tracking_code),
      carrier = coalesce(nullif(p_patch->>'carrier',''), carrier),
      last_error_code = CASE WHEN v_status='falha' THEN p_patch->>'error_code' ELSE NULL END,
      last_error_message = CASE WHEN v_status='falha' THEN left(p_patch->>'error_message', 2000) ELSE NULL END,
      purchased_at = CASE WHEN v_status='comprado' THEN coalesce(purchased_at, now()) ELSE purchased_at END,
      last_synced_at = CASE WHEN v_status IN ('acompanhando','enviado','em_rota','entregue') THEN now() ELSE last_synced_at END,
      completed_at = CASE WHEN v_status='entregue' THEN now() ELSE completed_at END,
      updated_at = now()
  WHERE id = p_job_id
  RETURNING * INTO v_job;

  INSERT INTO public.shopee_fulfillment_events(
    job_id, event_type, from_status, to_status, actor_type, actor_id, actor_name, details
  ) VALUES (
    v_job.id, 'worker_status', v_old_status, v_status,
    'worker', v_worker.id::text, v_worker.nome, coalesce(p_patch, '{}'::jsonb)
  );
  RETURN jsonb_build_object('success', true, 'job_id', v_job.id, 'status', v_job.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_shopee_queue(
  p_sessao_id uuid,
  p_session_token text,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor record; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'queue', count(*) FILTER (WHERE j.status IN ('fila','reservado','validando','preparando_carrinho')),
      'attention', count(*) FILTER (WHERE j.status IN ('divergencia','falha')),
      'payment', count(*) FILTER (WHERE j.status='aguardando_pagamento'),
      'tracking', count(*) FILTER (WHERE j.status IN ('comprado','acompanhando','enviado','em_rota')),
      'done', count(*) FILTER (WHERE j.status='entregue')
    ),
    'jobs', coalesce(jsonb_agg(jsonb_build_object(
      'id', j.id, 'status', j.status, 'priority', j.prioridade,
      'order_id', j.orcamento_id, 'order_code', o.codigo_orcamento,
      'customer_name', c.nome, 'total', o.total,
      'items_count', (SELECT count(*) FROM public.shopee_fulfillment_job_items i WHERE i.job_id=j.id),
      'worker_name', w.nome, 'lease_expires_at', j.lease_expires_at,
      'attempts', j.tentativas, 'max_attempts', j.max_tentativas,
      'divergences', j.divergencias, 'last_error', j.last_error_message,
      'shopee_order_sn', j.shopee_order_sn, 'shopee_status', j.shopee_status,
      'tracking_code', j.tracking_code, 'carrier', j.carrier,
      'created_at', j.created_at, 'updated_at', j.updated_at
    ) ORDER BY j.prioridade, j.created_at DESC) FILTER (
      WHERE p_status IS NULL OR p_status='' OR j.status=p_status
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.shopee_fulfillment_jobs j
  JOIN public.orcamentos o ON o.id=j.orcamento_id
  JOIN public.clientes c ON c.id=j.cliente_id
  LEFT JOIN public.shopee_automation_workers w ON w.id=j.worker_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_shopee_job(
  p_sessao_id uuid,
  p_session_token text,
  p_job_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor record; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  SELECT jsonb_build_object(
    'job', to_jsonb(j),
    'order', jsonb_build_object('code',o.codigo_orcamento,'total',o.total,'address',o.endereco_entrega),
    'customer', jsonb_build_object('name',c.nome,'email',c.email,'phone',c.telefone),
    'items', coalesce((SELECT jsonb_agg(to_jsonb(i) ORDER BY i.created_at) FROM public.shopee_fulfillment_job_items i WHERE i.job_id=j.id),'[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at DESC) FROM public.shopee_fulfillment_events e WHERE e.job_id=j.id),'[]'::jsonb)
  ) INTO v_result
  FROM public.shopee_fulfillment_jobs j
  JOIN public.orcamentos o ON o.id=j.orcamento_id
  JOIN public.clientes c ON c.id=j.cliente_id
  WHERE j.id=p_job_id;
  IF v_result IS NULL THEN RAISE EXCEPTION 'Tarefa Shopee nao encontrada.'; END IF;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_shopee_update_job(
  p_sessao_id uuid,
  p_session_token text,
  p_job_id uuid,
  p_status text,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor record; v_old text; v_status text := lower(trim(coalesce(p_status,'')));
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id, p_session_token) LIMIT 1;
  IF v_status NOT IN ('fila','divergencia','aguardando_pagamento','comprado','acompanhando','enviado','em_rota','entregue','falha','cancelado') THEN
    RAISE EXCEPTION 'Status administrativo invalido.';
  END IF;
  SELECT status INTO v_old FROM public.shopee_fulfillment_jobs WHERE id=p_job_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Tarefa Shopee nao encontrada.'; END IF;
  UPDATE public.shopee_fulfillment_jobs SET
    status=v_status,
    worker_id=CASE WHEN v_status='fila' THEN NULL ELSE worker_id END,
    lease_expires_at=CASE WHEN v_status='fila' THEN NULL ELSE lease_expires_at END,
    next_attempt_at=CASE WHEN v_status='fila' THEN now() ELSE next_attempt_at END,
    completed_at=CASE WHEN v_status='entregue' THEN now() ELSE completed_at END,
    updated_at=now()
  WHERE id=p_job_id;
  INSERT INTO public.shopee_fulfillment_events(job_id,event_type,from_status,to_status,actor_type,actor_id,actor_name,details)
  VALUES(p_job_id,'admin_status',v_old,v_status,v_actor.ator_tipo,v_actor.ator_id::text,v_actor.ator_nome,jsonb_build_object('note',left(coalesce(p_note,''),2000)));
  RETURN jsonb_build_object('success',true,'job_id',p_job_id,'status',v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_shopee_create_worker(
  p_sessao_id uuid,
  p_session_token text,
  p_nome text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor record; v_id uuid; v_token text;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  v_token := 'gsa_shp_' || rtrim(translate(encode(extensions.gen_random_bytes(32),'base64'),'+/','-_'),'=');
  INSERT INTO public.shopee_automation_workers(nome,token_hash)
  VALUES(left(coalesce(nullif(trim(p_nome),''),'Executor Shopee'),120),encode(extensions.digest(v_token,'sha256'),'hex'))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'worker_id',v_id,'token',v_token,
    'warning','Este token sera exibido apenas agora. Guarde no arquivo local do executor.');
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_shopee_workers(
  p_sessao_id uuid,
  p_session_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_actor record; v_result jsonb;
BEGIN
  SELECT * INTO v_actor FROM public.gsa_admin_session_actor(p_sessao_id,p_session_token) LIMIT 1;
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'name',nome,'status',status,'mode',modo,'last_seen_at',last_seen_at,
    'created_at',created_at,'revoked_at',revoked_at
  ) ORDER BY created_at DESC),'[]'::jsonb) INTO v_result
  FROM public.shopee_automation_workers;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.gsa_shopee_worker_by_token(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_shopee_enqueue_paid_order(uuid) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.gsa_shopee_worker_claim(text, integer) FROM public;
REVOKE ALL ON FUNCTION public.gsa_shopee_worker_heartbeat(text, uuid, integer) FROM public;
REVOKE ALL ON FUNCTION public.gsa_shopee_worker_update_job(text, uuid, text, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.gsa_shopee_worker_claim(text, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_shopee_worker_heartbeat(text, uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.gsa_shopee_worker_update_job(text, uuid, text, jsonb) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.gsa_admin_shopee_queue(uuid,text,text) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_shopee_job(uuid,text,uuid) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_shopee_update_job(uuid,text,uuid,text,text) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_shopee_create_worker(uuid,text,text) FROM public,anon,authenticated;
REVOKE ALL ON FUNCTION public.gsa_admin_shopee_workers(uuid,text) FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_shopee_queue(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_shopee_job(uuid,text,uuid) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_shopee_update_job(uuid,text,uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_shopee_create_worker(uuid,text,text) TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.gsa_admin_shopee_workers(uuid,text) TO authenticated,service_role;

COMMENT ON TABLE public.shopee_fulfillment_jobs IS 'Durable, idempotent queue for assisted Shopee purchasing and tracking.';
COMMENT ON FUNCTION public.gsa_shopee_worker_claim(text,integer) IS 'Claims one paid Shopee task using a short lease and returns the minimum checkout payload.';
