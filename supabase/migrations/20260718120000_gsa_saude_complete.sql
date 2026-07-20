-- GSA Saúde: catálogo de parceiros, funil de contratação, assessoria e pós-venda.
-- Mensalidades são pagas diretamente à operadora e nunca são receita da GSA.

CREATE TABLE IF NOT EXISTS public.saude_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome_comercial text NOT NULL DEFAULT 'GSA Saúde',
  taxa_assessoria_habilitada boolean NOT NULL DEFAULT false, taxa_assessoria_padrao numeric(12,2),
  termos_assessoria text, canais_atendimento jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_parceiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text NOT NULL, documento text, registro_ans text,
  site text, contato text, comissao_tipo text NOT NULL DEFAULT 'porcentagem' CHECK (comissao_tipo IN ('porcentagem','valor')),
  comissao_valor numeric(12,2) NOT NULL DEFAULT 0, observacoes text, status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_produtos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parceiro_id uuid REFERENCES public.saude_parceiros(id) ON DELETE RESTRICT,
  nome text NOT NULL, slug text NOT NULL UNIQUE, categoria text NOT NULL CHECK (categoria IN ('individual-familiar','empresarial','odontologico')),
  resumo text, imagem_url text, preco_referencia numeric(12,2), abrangencia text, acomodacao text,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb, carencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  elegibilidade jsonb NOT NULL DEFAULT '{}'::jsonb, destaque boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','publicado','pausado','arquivado')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_produto_redes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), produto_id uuid NOT NULL REFERENCES public.saude_produtos(id) ON DELETE CASCADE,
  nome text NOT NULL, tipo text, cidade text, uf text, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  produto_id uuid REFERENCES public.saude_produtos(id) ON DELETE SET NULL, protocolo text NOT NULL UNIQUE,
  categoria text NOT NULL, localidade text, inicio_desejado date, dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  consentimento_em timestamptz NOT NULL DEFAULT now(), idempotency_key uuid,
  status text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','em_analise','aguardando_dados','cotando_com_parceiros','propostas_disponiveis','encerrada','cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(cliente_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS public.saude_cotacao_beneficiarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_id uuid NOT NULL REFERENCES public.saude_cotacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'titular', nome text, data_nascimento date, parentesco text, dados_saude jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_propostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cotacao_id uuid NOT NULL REFERENCES public.saude_cotacoes(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE, parceiro_id uuid NOT NULL REFERENCES public.saude_parceiros(id),
  produto_id uuid REFERENCES public.saude_produtos(id), protocolo text NOT NULL UNIQUE, titulo text,
  mensalidade_operadora numeric(12,2) NOT NULL, taxa_assessoria_gsa numeric(12,2) NOT NULL DEFAULT 0,
  validade_ate timestamptz NOT NULL, condicoes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviada','visualizada','aceita','recusada','expirada','cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_aceites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid NOT NULL UNIQUE REFERENCES public.saude_propostas(id) ON DELETE CASCADE,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE, termos_versao text NOT NULL,
  snapshot jsonb NOT NULL, ip inet, user_agent text, aceito_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), proposta_id uuid REFERENCES public.saude_propostas(id), cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL REFERENCES public.saude_parceiros(id), produto_id uuid REFERENCES public.saude_produtos(id),
  numero text, titulo text, vigencia_inicio date, vigencia_fim date, mensalidade_operadora numeric(12,2),
  status text NOT NULL DEFAULT 'em_implantacao' CHECK (status IN ('em_implantacao','ativo','suspenso','encerrado','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_dependentes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  contrato_id uuid REFERENCES public.saude_contratos(id) ON DELETE SET NULL, nome text NOT NULL, parentesco text,
  data_nascimento date, cpf text, status text NOT NULL DEFAULT 'em_cadastro',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  proposta_id uuid REFERENCES public.saude_propostas(id) ON DELETE SET NULL, contrato_id uuid REFERENCES public.saude_contratos(id) ON DELETE SET NULL,
  titulo text NOT NULL, tipo text NOT NULL, storage_path text NOT NULL, status text NOT NULL DEFAULT 'enviado',
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_assessorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  proposta_id uuid REFERENCES public.saude_propostas(id), descricao text NOT NULL, valor numeric(12,2) NOT NULL DEFAULT 0,
  termos text NOT NULL, aceita boolean NOT NULL DEFAULT false, aceita_em timestamptz, fatura_id uuid REFERENCES public.faturas(id),
  status text NOT NULL DEFAULT 'oferecida' CHECK (status IN ('oferecida','aceita','cobranca_pendente','paga','cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), parceiro_id uuid NOT NULL REFERENCES public.saude_parceiros(id),
  contrato_id uuid REFERENCES public.saude_contratos(id), cliente_id uuid REFERENCES public.clientes(id),
  base_calculo numeric(12,2), porcentagem numeric(8,4), valor numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'prevista' CHECK (status IN ('prevista','confirmada','recebida','estornada','cancelada')),
  competencia date, recebida_em timestamptz, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_atendimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  protocolo text NOT NULL UNIQUE, assunto text NOT NULL, mensagem text NOT NULL, prioridade text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_atendimento','aguardando_cliente','resolvido','encerrado')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_atendimento_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), atendimento_id uuid NOT NULL REFERENCES public.saude_atendimentos(id) ON DELETE CASCADE,
  autor_tipo text NOT NULL, autor_id uuid, mensagem text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.saude_auditoria (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, ator_tipo text, ator_id uuid, acao text NOT NULL,
  entidade text NOT NULL, entidade_id uuid, dados jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saude_produtos_publicacao ON public.saude_produtos(status, categoria, destaque);
CREATE INDEX IF NOT EXISTS idx_saude_cotacoes_cliente ON public.saude_cotacoes(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saude_propostas_cliente ON public.saude_propostas(cliente_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saude_contratos_cliente ON public.saude_contratos(cliente_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_saude_contrato_proposta ON public.saude_contratos(proposta_id) WHERE proposta_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_saude_comissao_contrato ON public.saude_comissoes(contrato_id) WHERE contrato_id IS NOT NULL;

CREATE OR REPLACE VIEW public.saude_planos_publicos WITH (security_barrier = true) AS
SELECT p.id, p.slug, p.nome, p.categoria, p.resumo, p.imagem_url, p.preco_referencia, p.abrangencia,
       p.acomodacao, p.detalhes, p.destaque, pa.nome AS parceiro_nome
FROM public.saude_produtos p JOIN public.saude_parceiros pa ON pa.id = p.parceiro_id
WHERE p.status = 'publicado' AND pa.status = 'ativo';

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['saude_configuracoes','saude_parceiros','saude_produtos','saude_produto_redes','saude_cotacoes','saude_cotacao_beneficiarios','saude_propostas','saude_aceites','saude_contratos','saude_dependentes','saude_documentos','saude_assessorias','saude_comissoes','saude_atendimentos','saude_atendimento_mensagens','saude_auditoria']
  LOOP EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t); END LOOP;
END $$;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['saude_configuracoes','saude_parceiros','saude_produtos','saude_produto_redes','saude_cotacoes','saude_cotacao_beneficiarios','saude_propostas','saude_aceites','saude_contratos','saude_dependentes','saude_documentos','saude_assessorias','saude_comissoes','saude_atendimentos','saude_atendimento_mensagens','saude_auditoria']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (coalesce(auth.jwt()->''app_metadata''->>''gsa_actor_type'','''') IN (''admin'',''colaborador'')) WITH CHECK (coalesce(auth.jwt()->''app_metadata''->>''gsa_actor_type'','''') IN (''admin'',''colaborador''))', 'saude_admin_' || t, t);
  END LOOP;
END $$;

GRANT SELECT ON public.saude_planos_publicos TO anon, authenticated;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['saude_configuracoes','saude_parceiros','saude_produtos','saude_produto_redes','saude_cotacoes','saude_cotacao_beneficiarios','saude_propostas','saude_aceites','saude_contratos','saude_dependentes','saude_documentos','saude_assessorias','saude_comissoes','saude_atendimentos','saude_atendimento_mensagens','saude_auditoria']
  LOOP EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t); END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_client_saude_criar_cotacao(p_sessao_id uuid, p_session_token text, p_payload jsonb, p_idempotency_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_cliente uuid; v_id uuid; v_protocolo text; v_produto uuid;
BEGIN
  SELECT ator_id INTO v_cliente FROM public.gsa_validate_session(p_sessao_id,p_session_token) WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.'; END IF;
  IF coalesce(p_payload->>'categoria','') = '' OR coalesce(p_payload->>'consentimento','') <> 'sim' THEN RAISE EXCEPTION 'Categoria e consentimento são obrigatórios.'; END IF;
  SELECT id, protocolo INTO v_id, v_protocolo FROM public.saude_cotacoes WHERE cliente_id=v_cliente AND idempotency_key=p_idempotency_key;
  IF v_id IS NOT NULL THEN RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocolo,'idempotent',true); END IF;
  v_protocolo := 'SAU-' || to_char(now(),'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
  SELECT id INTO v_produto FROM saude_produtos WHERE id::text=coalesce(p_payload->>'oferta_id','') OR slug=coalesce(p_payload->>'oferta_slug','') LIMIT 1;
  INSERT INTO public.saude_cotacoes(cliente_id,produto_id,protocolo,categoria,localidade,inicio_desejado,dados,idempotency_key)
  VALUES(v_cliente,v_produto,v_protocolo,p_payload->>'categoria',p_payload->>'localidade',nullif(p_payload->>'inicio_desejado','')::date,p_payload,p_idempotency_key) RETURNING id INTO v_id;
  INSERT INTO public.saude_auditoria(ator_tipo,ator_id,acao,entidade,entidade_id) VALUES('cliente',v_cliente,'criar_cotacao','saude_cotacoes',v_id);
  RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocolo);
END $$;

CREATE OR REPLACE FUNCTION public.gsa_client_saude_listar(p_sessao_id uuid, p_session_token text, p_recurso text, p_item_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE v_cliente uuid; v_result jsonb;
BEGIN
  SELECT ator_id INTO v_cliente FROM public.gsa_validate_session(p_sessao_id,p_session_token) WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.'; END IF;
  CASE p_recurso
    WHEN 'cotacoes' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO v_result FROM (SELECT id,protocolo,categoria,localidade,status,created_at,updated_at FROM saude_cotacoes WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id) ORDER BY created_at DESC) x;
    WHEN 'propostas' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO v_result FROM (SELECT p.id,p.protocolo,p.titulo,p.mensalidade_operadora,p.taxa_assessoria_gsa,p.validade_ate,p.status,p.created_at,pa.nome parceiro_nome FROM saude_propostas p JOIN saude_parceiros pa ON pa.id=p.parceiro_id WHERE p.cliente_id=v_cliente AND (p_item_id IS NULL OR p.id=p_item_id) ORDER BY p.created_at DESC) x;
    WHEN 'contratos' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO v_result FROM (SELECT c.id,c.numero,c.titulo,c.vigencia_inicio,c.vigencia_fim,c.mensalidade_operadora,c.status,c.created_at,pa.nome parceiro_nome FROM saude_contratos c JOIN saude_parceiros pa ON pa.id=c.parceiro_id WHERE c.cliente_id=v_cliente AND (p_item_id IS NULL OR c.id=p_item_id) ORDER BY c.created_at DESC) x;
    WHEN 'dependentes' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO v_result FROM (SELECT id,nome,parentesco,data_nascimento,status,created_at FROM saude_dependentes WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id) ORDER BY nome) x;
    WHEN 'documentos' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO v_result FROM (SELECT id,titulo,tipo,status,created_at FROM saude_documentos WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id) ORDER BY created_at DESC) x;
    WHEN 'assessorias' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO v_result FROM (SELECT id,descricao,valor,termos,aceita,aceita_em,status,created_at FROM saude_assessorias WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id) ORDER BY created_at DESC) x;
    WHEN 'suporte' THEN SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO v_result FROM (SELECT id,protocolo,assunto,status,created_at,updated_at FROM saude_atendimentos WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id) ORDER BY created_at DESC) x;
    ELSE RAISE EXCEPTION 'Recurso inválido.';
  END CASE;
  RETURN v_result;
END $$;

CREATE OR REPLACE FUNCTION public.gsa_client_saude_abrir_atendimento(p_sessao_id uuid,p_session_token text,p_assunto text,p_mensagem text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cliente uuid; v_id uuid; v_protocolo text;
BEGIN
 SELECT ator_id INTO v_cliente FROM gsa_validate_session(p_sessao_id,p_session_token) WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
 IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
 IF length(trim(p_assunto))<3 OR length(trim(p_mensagem))<5 THEN RAISE EXCEPTION 'Preencha assunto e mensagem.'; END IF;
 v_protocolo := 'SAU-AT-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));
 INSERT INTO saude_atendimentos(cliente_id,protocolo,assunto,mensagem) VALUES(v_cliente,v_protocolo,trim(p_assunto),trim(p_mensagem)) RETURNING id INTO v_id;
 RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocolo);
END $$;

CREATE OR REPLACE FUNCTION public.gsa_client_saude_aceitar_proposta(p_sessao_id uuid,p_session_token text,p_proposta_id uuid,p_termos_versao text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cliente uuid; v_proposta saude_propostas%rowtype; v_fatura uuid;
BEGIN
 SELECT ator_id INTO v_cliente FROM gsa_validate_session(p_sessao_id,p_session_token) WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
 SELECT * INTO v_proposta FROM saude_propostas WHERE id=p_proposta_id AND cliente_id=v_cliente FOR UPDATE;
 IF NOT FOUND OR v_proposta.status NOT IN ('enviada','visualizada') THEN RAISE EXCEPTION 'Proposta indisponível para aceite.'; END IF;
 IF v_proposta.validade_ate < now() THEN UPDATE saude_propostas SET status='expirada' WHERE id=p_proposta_id; RAISE EXCEPTION 'Proposta expirada.'; END IF;
 INSERT INTO saude_aceites(proposta_id,cliente_id,termos_versao,snapshot) VALUES(p_proposta_id,v_cliente,p_termos_versao,to_jsonb(v_proposta));
 UPDATE saude_propostas SET status='aceita',updated_at=now() WHERE id=p_proposta_id;
 INSERT INTO saude_contratos(proposta_id,cliente_id,parceiro_id,produto_id,titulo,mensalidade_operadora)
 VALUES(v_proposta.id,v_cliente,v_proposta.parceiro_id,v_proposta.produto_id,v_proposta.titulo,v_proposta.mensalidade_operadora)
 ON CONFLICT DO NOTHING;
 IF v_proposta.taxa_assessoria_gsa > 0 THEN
   INSERT INTO faturas(cliente_id,codigo_fatura,valor_total,valor_final_pendente,status,tipo,data_vencimento,itens_faturados)
   VALUES(v_cliente,'ASSESS-SAU-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),v_proposta.taxa_assessoria_gsa,v_proposta.taxa_assessoria_gsa,'pendente','avulsa',current_date+3,jsonb_build_array(jsonb_build_object('descricao','Assessoria e suporte GSA Saúde','origem','assessoria_saude','valor',v_proposta.taxa_assessoria_gsa))) RETURNING id INTO v_fatura;
   INSERT INTO saude_assessorias(cliente_id,proposta_id,descricao,valor,termos,aceita,aceita_em,fatura_id,status)
   VALUES(v_cliente,v_proposta.id,'Assessoria e suporte na contratação',v_proposta.taxa_assessoria_gsa,p_termos_versao,true,now(),v_fatura,'cobranca_pendente');
 END IF;
 RETURN jsonb_build_object('success',true,'proposta_id',p_proposta_id);
END $$;

CREATE OR REPLACE FUNCTION public.gsa_saude_registrar_comissao_ativacao() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_parceiro saude_parceiros%rowtype;v_valor numeric;
BEGIN
 IF NEW.status='ativo' AND OLD.status IS DISTINCT FROM 'ativo' THEN
   SELECT * INTO v_parceiro FROM saude_parceiros WHERE id=NEW.parceiro_id;
   v_valor:=CASE WHEN v_parceiro.comissao_tipo='porcentagem' THEN round(coalesce(NEW.mensalidade_operadora,0)*v_parceiro.comissao_valor/100,2) ELSE v_parceiro.comissao_valor END;
   INSERT INTO saude_comissoes(parceiro_id,contrato_id,cliente_id,base_calculo,porcentagem,valor,status,competencia)
   VALUES(NEW.parceiro_id,NEW.id,NEW.cliente_id,NEW.mensalidade_operadora,CASE WHEN v_parceiro.comissao_tipo='porcentagem' THEN v_parceiro.comissao_valor END,v_valor,'prevista',date_trunc('month',current_date)::date) ON CONFLICT DO NOTHING;
 END IF; RETURN NEW;
END $$;
CREATE TRIGGER trg_saude_comissao_ativacao AFTER UPDATE OF status ON public.saude_contratos FOR EACH ROW EXECUTE FUNCTION public.gsa_saude_registrar_comissao_ativacao();

CREATE OR REPLACE FUNCTION public.gsa_client_saude_registrar_documento(p_sessao_id uuid,p_session_token text,p_titulo text,p_tipo text,p_storage_path text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE v_cliente uuid;v_id uuid;
BEGIN
 SELECT ator_id INTO v_cliente FROM gsa_validate_session(p_sessao_id,p_session_token) WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
 IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão inválida.'; END IF;
 IF p_storage_path NOT LIKE v_cliente::text||'/%' THEN RAISE EXCEPTION 'Caminho de arquivo inválido.'; END IF;
 INSERT INTO saude_documentos(cliente_id,titulo,tipo,storage_path) VALUES(v_cliente,left(trim(p_titulo),200),left(trim(p_tipo),60),p_storage_path) RETURNING id INTO v_id;
 RETURN jsonb_build_object('success',true,'id',v_id);
END $$;

REVOKE ALL ON FUNCTION public.gsa_client_saude_criar_cotacao(uuid,text,jsonb,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_client_saude_listar(uuid,text,text,uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_client_saude_abrir_atendimento(uuid,text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_client_saude_aceitar_proposta(uuid,text,uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_client_saude_registrar_documento(uuid,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_criar_cotacao(uuid,text,jsonb,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_listar(uuid,text,text,uuid) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_abrir_atendimento(uuid,text,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_aceitar_proposta(uuid,text,uuid,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_registrar_documento(uuid,text,text,text,text) TO anon,authenticated;

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('gsa-saude-documentos','gsa-saude-documentos',false,10485760,ARRAY['application/pdf','image/jpeg','image/png','image/webp'])
ON CONFLICT(id) DO UPDATE SET public=false;

CREATE POLICY gsa_saude_documentos_cliente_upload ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id='gsa-saude-documentos' AND (storage.foldername(name))[1]=coalesce(auth.jwt()->'app_metadata'->>'gsa_actor_id',''));
CREATE POLICY gsa_saude_documentos_cliente_read ON storage.objects FOR SELECT TO authenticated
USING (bucket_id='gsa-saude-documentos' AND ((storage.foldername(name))[1]=coalesce(auth.jwt()->'app_metadata'->>'gsa_actor_id','') OR coalesce(auth.jwt()->'app_metadata'->>'gsa_actor_type','') IN ('admin','colaborador')));
CREATE POLICY gsa_saude_documentos_admin_manage ON storage.objects FOR ALL TO authenticated
USING (bucket_id='gsa-saude-documentos' AND coalesce(auth.jwt()->'app_metadata'->>'gsa_actor_type','') IN ('admin','colaborador'))
WITH CHECK (bucket_id='gsa-saude-documentos' AND coalesce(auth.jwt()->'app_metadata'->>'gsa_actor_type','') IN ('admin','colaborador'));
