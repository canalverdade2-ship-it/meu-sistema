-- Estrutura operacional completa e idempotente do módulo Classificados.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Garantir colunas essenciais dos anúncios.
ALTER TABLE public.classificados_anuncios
  ADD COLUMN IF NOT EXISTS cliente_id uuid,
  ADD COLUMN IF NOT EXISTS categoria text,
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS preco numeric(14,2),
  ADD COLUMN IF NOT EXISTS cidade text,
  ADD COLUMN IF NOT EXISTS estado text,
  ADD COLUMN IF NOT EXISTS bairro text,
  ADD COLUMN IF NOT EXISTS detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS comissao_percentual numeric(5,2),
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aguardando_revisao',
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS ux_classificados_anuncios_slug
  ON public.classificados_anuncios(slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_classificados_anuncios_cliente_status
  ON public.classificados_anuncios(cliente_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.classificados_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id uuid NOT NULL REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE,
  comprador_id uuid NOT NULL,
  vendedor_id uuid NOT NULL,
  valor_proposta numeric(14,2) NOT NULL CHECK (valor_proposta > 0),
  valor_contraproposta numeric(14,2),
  status text NOT NULL DEFAULT 'nova',
  mensagem_inicial text,
  motivo_rejeicao text,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classificados_propostas_partes_diferentes CHECK (comprador_id <> vendedor_id),
  CONSTRAINT classificados_propostas_status_check CHECK (status IN (
    'nova','em_analise_gsa','aguardando_vendedor','aguardando_comprador',
    'contraproposta','aceita','rejeitada','cancelada','expirada'
  ))
);

ALTER TABLE public.classificados_propostas
  ADD COLUMN IF NOT EXISTS anuncio_id uuid,
  ADD COLUMN IF NOT EXISTS comprador_id uuid,
  ADD COLUMN IF NOT EXISTS vendedor_id uuid,
  ADD COLUMN IF NOT EXISTS valor_proposta numeric(14,2),
  ADD COLUMN IF NOT EXISTS valor_contraproposta numeric(14,2),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'nova',
  ADD COLUMN IF NOT EXISTS mensagem_inicial text,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.classificados_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.classificados_propostas(id) ON DELETE CASCADE,
  remetente_id uuid NOT NULL,
  conteudo text NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  moderada_por uuid,
  moderada_em timestamptz,
  motivo_rejeicao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classificados_mensagens_status_check CHECK (status IN ('pendente','aprovada','rejeitada')),
  CONSTRAINT classificados_mensagens_conteudo_check CHECK (length(trim(conteudo)) BETWEEN 1 AND 2000)
);

ALTER TABLE public.classificados_mensagens
  ADD COLUMN IF NOT EXISTS proposta_id uuid,
  ADD COLUMN IF NOT EXISTS remetente_id uuid,
  ADD COLUMN IF NOT EXISTS conteudo text,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS moderada_por uuid,
  ADD COLUMN IF NOT EXISTS moderada_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.classificados_transacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposta_id uuid NOT NULL REFERENCES public.classificados_propostas(id) ON DELETE RESTRICT,
  anuncio_id uuid NOT NULL REFERENCES public.classificados_anuncios(id) ON DELETE RESTRICT,
  comprador_id uuid NOT NULL,
  vendedor_id uuid NOT NULL,
  valor_final numeric(14,2) NOT NULL CHECK (valor_final > 0),
  valor_total numeric(14,2) NOT NULL CHECK (valor_total > 0),
  valor_comissao numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_comissao >= 0),
  status text NOT NULL DEFAULT 'criada',
  comprovante_url text,
  pagamento_confirmado_em timestamptz,
  entrega_confirmada_em timestamptz,
  concluida_em timestamptz,
  cancelada_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classificados_transacoes_status_check CHECK (status IN (
    'criada','pendente_pagamento','aguardando_pagamento_ao_vendedor','comprovante_enviado',
    'pagamento_confirmado','em_entrega_ou_transferencia','aguardando_confirmacao_comprador',
    'contestada','concluida','cancelada','reembolsada'
  ))
);

ALTER TABLE public.classificados_transacoes
  ADD COLUMN IF NOT EXISTS proposta_id uuid,
  ADD COLUMN IF NOT EXISTS anuncio_id uuid,
  ADD COLUMN IF NOT EXISTS comprador_id uuid,
  ADD COLUMN IF NOT EXISTS vendedor_id uuid,
  ADD COLUMN IF NOT EXISTS valor_final numeric(14,2),
  ADD COLUMN IF NOT EXISTS valor_total numeric(14,2),
  ADD COLUMN IF NOT EXISTS valor_comissao numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'criada',
  ADD COLUMN IF NOT EXISTS comprovante_url text,
  ADD COLUMN IF NOT EXISTS pagamento_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS entrega_confirmada_em timestamptz,
  ADD COLUMN IF NOT EXISTS concluida_em timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS public.classificados_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transacao_id uuid NOT NULL REFERENCES public.classificados_transacoes(id) ON DELETE RESTRICT,
  vendedor_id uuid NOT NULL,
  percentual numeric(5,2) NOT NULL CHECK (percentual > 0 AND percentual <= 100),
  valor_comissao numeric(14,2) NOT NULL CHECK (valor_comissao >= 0),
  status text NOT NULL DEFAULT 'nao_gerada',
  data_vencimento date,
  fatura_id uuid,
  paga_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT classificados_comissoes_status_check CHECK (status IN (
    'nao_gerada','pendente','paga','vencida','contestada','ajustada','cancelada'
  ))
);

ALTER TABLE public.classificados_comissoes
  ADD COLUMN IF NOT EXISTS transacao_id uuid,
  ADD COLUMN IF NOT EXISTS vendedor_id uuid,
  ADD COLUMN IF NOT EXISTS percentual numeric(5,2),
  ADD COLUMN IF NOT EXISTS valor_comissao numeric(14,2),
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'nao_gerada',
  ADD COLUMN IF NOT EXISTS data_vencimento date,
  ADD COLUMN IF NOT EXISTS fatura_id uuid,
  ADD COLUMN IF NOT EXISTS paga_em timestamptz,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Chaves estrangeiras faltantes, adicionadas apenas quando ainda inexistentes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classificados_propostas_anuncio_id_fkey') THEN
    ALTER TABLE public.classificados_propostas ADD CONSTRAINT classificados_propostas_anuncio_id_fkey
      FOREIGN KEY (anuncio_id) REFERENCES public.classificados_anuncios(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classificados_mensagens_proposta_id_fkey') THEN
    ALTER TABLE public.classificados_mensagens ADD CONSTRAINT classificados_mensagens_proposta_id_fkey
      FOREIGN KEY (proposta_id) REFERENCES public.classificados_propostas(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classificados_transacoes_proposta_id_fkey') THEN
    ALTER TABLE public.classificados_transacoes ADD CONSTRAINT classificados_transacoes_proposta_id_fkey
      FOREIGN KEY (proposta_id) REFERENCES public.classificados_propostas(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classificados_transacoes_anuncio_id_fkey') THEN
    ALTER TABLE public.classificados_transacoes ADD CONSTRAINT classificados_transacoes_anuncio_id_fkey
      FOREIGN KEY (anuncio_id) REFERENCES public.classificados_anuncios(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'classificados_comissoes_transacao_id_fkey') THEN
    ALTER TABLE public.classificados_comissoes ADD CONSTRAINT classificados_comissoes_transacao_id_fkey
      FOREIGN KEY (transacao_id) REFERENCES public.classificados_transacoes(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS ux_classificados_transacoes_proposta
  ON public.classificados_transacoes(proposta_id) WHERE proposta_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_classificados_comissoes_transacao
  ON public.classificados_comissoes(transacao_id) WHERE transacao_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_classificados_propostas_comprador ON public.classificados_propostas(comprador_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_classificados_propostas_vendedor ON public.classificados_propostas(vendedor_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_classificados_mensagens_proposta ON public.classificados_mensagens(proposta_id, created_at ASC);
CREATE INDEX IF NOT EXISTS ix_classificados_transacoes_vendedor ON public.classificados_transacoes(vendedor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_classificados_transacoes_comprador ON public.classificados_transacoes(comprador_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_classificados_comissoes_vendedor ON public.classificados_comissoes(vendedor_id, created_at DESC);

-- Atualização uniforme de updated_at.
CREATE OR REPLACE FUNCTION public.gsa_touch_classified_row()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['classificados_anuncios','classificados_propostas','classificados_mensagens','classificados_transacoes','classificados_comissoes']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_%I ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_touch_%I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.gsa_touch_classified_row()', t, t);
  END LOOP;
END $$;

-- Segurança por identidade real do ator GSA.
ALTER TABLE public.classificados_anuncios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_midias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_propostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classificados_comissoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS classificados_anuncios_publicados_select ON public.classificados_anuncios;
CREATE POLICY classificados_anuncios_publicados_select ON public.classificados_anuncios
FOR SELECT TO anon, authenticated
USING (status IN ('publicado','reservado','vendido') OR cliente_id = public.gsa_jwt_actor_id());

DROP POLICY IF EXISTS classificados_midias_visiveis_select ON public.classificados_midias;
CREATE POLICY classificados_midias_visiveis_select ON public.classificados_midias
FOR SELECT TO anon, authenticated
USING (EXISTS (
  SELECT 1 FROM public.classificados_anuncios a
  WHERE a.id = anuncio_id
    AND (a.status IN ('publicado','reservado','vendido') OR a.cliente_id = public.gsa_jwt_actor_id())
));

DROP POLICY IF EXISTS classificados_propostas_participantes_select ON public.classificados_propostas;
CREATE POLICY classificados_propostas_participantes_select ON public.classificados_propostas
FOR SELECT TO authenticated
USING (public.gsa_jwt_session_is_valid() AND public.gsa_jwt_actor_id() IN (comprador_id, vendedor_id));

DROP POLICY IF EXISTS classificados_mensagens_participantes_select ON public.classificados_mensagens;
CREATE POLICY classificados_mensagens_participantes_select ON public.classificados_mensagens
FOR SELECT TO authenticated
USING (public.gsa_jwt_session_is_valid() AND EXISTS (
  SELECT 1 FROM public.classificados_propostas p
  WHERE p.id = proposta_id AND public.gsa_jwt_actor_id() IN (p.comprador_id, p.vendedor_id)
));

DROP POLICY IF EXISTS classificados_transacoes_participantes_select ON public.classificados_transacoes;
CREATE POLICY classificados_transacoes_participantes_select ON public.classificados_transacoes
FOR SELECT TO authenticated
USING (public.gsa_jwt_session_is_valid() AND public.gsa_jwt_actor_id() IN (comprador_id, vendedor_id));

DROP POLICY IF EXISTS classificados_comissoes_vendedor_select ON public.classificados_comissoes;
CREATE POLICY classificados_comissoes_vendedor_select ON public.classificados_comissoes
FOR SELECT TO authenticated
USING (public.gsa_jwt_session_is_valid() AND vendedor_id = public.gsa_jwt_actor_id());

REVOKE ALL ON public.classificados_propostas, public.classificados_mensagens,
  public.classificados_transacoes, public.classificados_comissoes FROM PUBLIC, anon;
GRANT SELECT ON public.classificados_propostas, public.classificados_mensagens,
  public.classificados_transacoes, public.classificados_comissoes TO authenticated;
GRANT ALL ON public.classificados_propostas, public.classificados_mensagens,
  public.classificados_transacoes, public.classificados_comissoes TO service_role;

-- Criar proposta de forma segura e sem escrita direta do navegador.
CREATE OR REPLACE FUNCTION public.rpc_criar_proposta_classificado(
  p_anuncio_id uuid,
  p_comprador_id uuid,
  p_valor_proposta numeric,
  p_mensagem text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := public.gsa_jwt_actor_id();
  v_anuncio public.classificados_anuncios%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.gsa_jwt_session_is_valid() OR v_actor IS NULL OR v_actor <> p_comprador_id THEN
    RAISE EXCEPTION 'Sessão de cliente inválida.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_anuncio FROM public.classificados_anuncios WHERE id = p_anuncio_id AND status = 'publicado';
  IF NOT FOUND THEN RAISE EXCEPTION 'Anúncio indisponível.' USING ERRCODE = 'P0002'; END IF;
  IF v_anuncio.cliente_id = v_actor THEN RAISE EXCEPTION 'Você não pode propor em seu próprio anúncio.' USING ERRCODE = '22023'; END IF;
  IF p_valor_proposta IS NULL OR p_valor_proposta <= 0 THEN RAISE EXCEPTION 'Valor de proposta inválido.' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.classificados_propostas(anuncio_id, comprador_id, vendedor_id, valor_proposta, status, mensagem_inicial)
  VALUES (v_anuncio.id, v_actor, v_anuncio.cliente_id, round(p_valor_proposta,2), 'nova', NULLIF(trim(p_mensagem),''))
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id,'status','nova');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_enviar_mensagem_classificado(
  p_proposta_id uuid,
  p_remetente_id uuid,
  p_conteudo text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_actor uuid := public.gsa_jwt_actor_id(); v_id uuid; v_prop public.classificados_propostas%ROWTYPE;
BEGIN
  IF NOT public.gsa_jwt_session_is_valid() OR v_actor IS NULL OR v_actor <> p_remetente_id THEN
    RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_prop FROM public.classificados_propostas WHERE id = p_proposta_id;
  IF NOT FOUND OR v_actor NOT IN (v_prop.comprador_id, v_prop.vendedor_id) THEN
    RAISE EXCEPTION 'Proposta não encontrada.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(COALESCE(p_conteudo,''))) NOT BETWEEN 1 AND 2000 THEN
    RAISE EXCEPTION 'Mensagem inválida.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.classificados_mensagens(proposta_id, remetente_id, conteudo, status)
  VALUES (p_proposta_id, v_actor, trim(p_conteudo), 'pendente') RETURNING id INTO v_id;
  RETURN jsonb_build_object('success',true,'id',v_id,'status','pendente');
END;
$$;

CREATE OR REPLACE FUNCTION public.rpc_responder_proposta_classificado(
  p_proposta_id uuid,
  p_acao text,
  p_valor_contraproposta numeric DEFAULT NULL,
  p_motivo text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_actor uuid := public.gsa_jwt_actor_id();
  v_prop public.classificados_propostas%ROWTYPE;
  v_anuncio public.classificados_anuncios%ROWTYPE;
  v_final numeric(14,2);
  v_percent numeric(5,2);
  v_transacao uuid;
  v_comissao numeric(14,2);
  v_acao text := lower(trim(COALESCE(p_acao,'')));
BEGIN
  IF NOT public.gsa_jwt_session_is_valid() OR v_actor IS NULL THEN RAISE EXCEPTION 'Sessão inválida.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_prop FROM public.classificados_propostas WHERE id = p_proposta_id FOR UPDATE;
  IF NOT FOUND OR v_actor NOT IN (v_prop.comprador_id,v_prop.vendedor_id) THEN RAISE EXCEPTION 'Proposta não encontrada.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_anuncio FROM public.classificados_anuncios WHERE id = v_prop.anuncio_id FOR UPDATE;

  IF v_acao = 'aceitar' THEN
    IF v_actor <> v_prop.vendedor_id THEN RAISE EXCEPTION 'Somente o vendedor pode aceitar.' USING ERRCODE='42501'; END IF;
    v_final := COALESCE(v_prop.valor_contraproposta, v_prop.valor_proposta);
    v_percent := COALESCE(v_anuncio.comissao_percentual, 0);
    v_comissao := round(v_final * v_percent / 100, 2);
    UPDATE public.classificados_propostas SET status='aceita' WHERE id=v_prop.id;
    UPDATE public.classificados_anuncios SET status='reservado' WHERE id=v_anuncio.id;
    INSERT INTO public.classificados_transacoes(proposta_id,anuncio_id,comprador_id,vendedor_id,valor_final,valor_total,valor_comissao,status)
    VALUES(v_prop.id,v_anuncio.id,v_prop.comprador_id,v_prop.vendedor_id,v_final,v_final,v_comissao,'criada')
    ON CONFLICT (proposta_id) DO UPDATE SET updated_at=now()
    RETURNING id INTO v_transacao;
    INSERT INTO public.classificados_comissoes(transacao_id,vendedor_id,percentual,valor_comissao,status,data_vencimento)
    VALUES(v_transacao,v_prop.vendedor_id,v_percent,v_comissao,'nao_gerada',NULL)
    ON CONFLICT (transacao_id) DO NOTHING;
  ELSIF v_acao = 'rejeitar' THEN
    IF v_actor <> v_prop.vendedor_id THEN RAISE EXCEPTION 'Somente o vendedor pode rejeitar.' USING ERRCODE='42501'; END IF;
    UPDATE public.classificados_propostas SET status='rejeitada',motivo_rejeicao=NULLIF(trim(p_motivo),'') WHERE id=v_prop.id;
  ELSIF v_acao = 'contrapropor' THEN
    IF p_valor_contraproposta IS NULL OR p_valor_contraproposta <= 0 THEN RAISE EXCEPTION 'Valor inválido.' USING ERRCODE='22023'; END IF;
    UPDATE public.classificados_propostas SET valor_contraproposta=round(p_valor_contraproposta,2),status='contraproposta' WHERE id=v_prop.id;
  ELSIF v_acao = 'cancelar' THEN
    IF v_actor <> v_prop.comprador_id THEN RAISE EXCEPTION 'Somente o comprador pode cancelar.' USING ERRCODE='42501'; END IF;
    UPDATE public.classificados_propostas SET status='cancelada' WHERE id=v_prop.id;
  ELSE
    RAISE EXCEPTION 'Ação inválida.' USING ERRCODE='22023';
  END IF;
  RETURN jsonb_build_object('success',true,'status',(SELECT status FROM public.classificados_propostas WHERE id=v_prop.id),'transacao_id',v_transacao);
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_criar_proposta_classificado(uuid,uuid,numeric,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_enviar_mensagem_classificado(uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.rpc_responder_proposta_classificado(uuid,text,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_criar_proposta_classificado(uuid,uuid,numeric,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_enviar_mensagem_classificado(uuid,uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_responder_proposta_classificado(uuid,text,numeric,text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
