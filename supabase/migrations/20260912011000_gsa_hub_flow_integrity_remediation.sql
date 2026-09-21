BEGIN;

CREATE OR REPLACE FUNCTION public.gsa_client_notify_admin(
  p_sessao_id uuid,
  p_session_token text,
  p_titulo text,
  p_mensagem text,
  p_modulo text DEFAULT 'sistema',
  p_acao_origem text DEFAULT 'sistema',
  p_tab text DEFAULT NULL,
  p_item_id text DEFAULT NULL,
  p_prioridade text DEFAULT 'normal',
  p_contexto jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor record;
  v_count integer;
  v_priority text;
BEGIN
  SELECT * INTO v_actor
  FROM public.gsa_validate_session(p_sessao_id, p_session_token)
  WHERE is_valid AND ator_tipo = 'cliente' LIMIT 1;  IF v_actor.ator_id IS NULL THEN
    RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.' USING ERRCODE = '42501';
  END IF;
  IF length(trim(coalesce(p_titulo, ''))) < 2 OR length(trim(coalesce(p_mensagem, ''))) < 2 THEN
    RAISE EXCEPTION 'Título e mensagem são obrigatórios.' USING ERRCODE = '22023';
  END IF;
  v_priority := CASE WHEN lower(trim(coalesce(p_prioridade, ''))) = 'alta' THEN 'alta' ELSE 'normal' END;
  SELECT count(*) INTO v_count
  FROM public.notificacoes n
  WHERE n.data_criacao >= now() - interval '1 minute'
    AND n.contexto ->> 'actor_id' = v_actor.ator_id::text;
  IF v_count >= 20 THEN
    RAISE EXCEPTION 'Limite de notificações excedido. Aguarde antes de tentar novamente.' USING ERRCODE = '42900';
  END IF;
  PERFORM set_config('gsa.system_override', 'on', true);
  INSERT INTO public.notificacoes(
    titulo, mensagem, modulo, tab, item_id, destinatario_tipo,
    prioridade, acao_origem, contexto, tipo, lida, data_criacao
  ) VALUES (
    left(trim(p_titulo), 160), left(trim(p_mensagem), 2000),
    left(trim(coalesce(p_modulo, 'sistema')), 80), nullif(trim(coalesce(p_tab, '')), ''),
    nullif(trim(coalesce(p_item_id, '')), ''), 'admin', v_priority,
    left(trim(coalesce(p_acao_origem, 'sistema')), 120),
    coalesce(p_contexto, '{}'::jsonb) || jsonb_build_object('actor_id', v_actor.ator_id, 'actor_type', 'cliente'),
    'sistema', false, now()
  );  INSERT INTO public.sistema_logs(ator_tipo, ator_id, ator_nome, acao, detalhes, sessao_id)
  VALUES ('cliente', v_actor.ator_id, v_actor.ator_nome, 'NOTIFICAR_ADMIN',
          format('%s | %s', left(trim(coalesce(p_modulo, 'sistema')), 80), left(trim(coalesce(p_acao_origem, 'sistema')), 120)),
          p_sessao_id);
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_notify_admin(uuid,text,text,text,text,text,text,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_notify_admin(uuid,text,text,text,text,text,text,text,text,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_saude_listar(
  p_sessao_id uuid, p_session_token text, p_recurso text, p_item_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_cliente uuid; v_result jsonb; v_resource text := lower(trim(coalesce(p_recurso,'')));
BEGIN
  SELECT ator_id INTO v_cliente FROM public.gsa_validate_session(p_sessao_id,p_session_token)
  WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.' USING ERRCODE='42501'; END IF;
  CASE v_resource
    WHEN 'cotacoes' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_result
      FROM (SELECT id,protocolo,categoria,tipo_pessoa,estado,cidade,quantidade_vidas,status,observacoes,created_at,updated_at
            FROM public.saude_cotacoes WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id)) x;    WHEN 'propostas' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_result
      FROM (SELECT id,cotacao_id,titulo,operadora_nome,operadora_registro_ans,plano_nome,plano_registro_ans,
                   valor_estimado,valor_confirmado,tipo_valor,validade_proposta,status,observacoes,created_at,updated_at
            FROM public.saude_propostas WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id)) x;
    WHEN 'contratos' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_result
      FROM (SELECT id,cotacao_id,operadora_nome,plano_nome,numero_carteirinha,numero_contrato,registro_ans,
                   data_inicio,data_fim,status,observacoes,created_at,updated_at
            FROM public.saude_contratos WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id)) x;
    WHEN 'dependentes' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.nome),'[]'::jsonb) INTO v_result
      FROM (SELECT id,contrato_id,nome,data_nascimento,faixa_etaria,parentesco,numero_carteirinha,status,created_at,updated_at
            FROM public.saude_dependentes WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id)) x;
    WHEN 'documentos' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_result
      FROM (SELECT id,contrato_id,cotacao_id,nome,descricao,obrigatorio,status,motivo_recusa,instrucoes_correcao,enviado_em,created_at,updated_at
            FROM public.saude_documentos WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id)) x;
    WHEN 'assessorias' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_result
      FROM (SELECT id,contrato_id,cotacao_id,valor,versao_termo,aceite_checkbox,aceite_em,status,fatura_id,created_at,updated_at
            FROM public.saude_assessorias WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id)) x;    WHEN 'suporte' THEN
      SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_result
      FROM (SELECT id,protocolo,assunto,descricao,categoria,cotacao_id,contrato_id,status,prioridade,created_at,updated_at,fechado_em
            FROM public.saude_atendimentos WHERE cliente_id=v_cliente AND (p_item_id IS NULL OR id=p_item_id)) x;
    ELSE RAISE EXCEPTION 'Recurso de Saúde inválido.' USING ERRCODE='22023';
  END CASE;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_saude_listar(uuid,text,text,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_listar(uuid,text,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_saude_abrir_atendimento(
  p_sessao_id uuid,p_session_token text,p_assunto text,p_mensagem text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_cliente uuid; v_nome text; v_id uuid; v_protocolo text;
BEGIN
  SELECT ator_id,ator_nome INTO v_cliente,v_nome FROM public.gsa_validate_session(p_sessao_id,p_session_token)
  WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(p_assunto,'')))<3 OR length(trim(coalesce(p_mensagem,'')))<5 THEN
    RAISE EXCEPTION 'Preencha assunto e mensagem.' USING ERRCODE='22023'; END IF;
  v_protocolo := 'SAU-AT-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,5));  INSERT INTO public.saude_atendimentos(cliente_id,protocolo,assunto,descricao,categoria,status,prioridade)
  VALUES(v_cliente,v_protocolo,left(trim(p_assunto),200),left(trim(p_mensagem),4000),'outro','aberto','normal')
  RETURNING id INTO v_id;
  INSERT INTO public.saude_atendimento_mensagens(atendimento_id,autor_tipo,autor_nome,mensagem)
  VALUES(v_id,'cliente',v_nome,left(trim(p_mensagem),4000));
  INSERT INTO public.saude_auditoria(ator_tipo,ator_id,ator_nome,acao,tabela,registro_id,detalhes)
  VALUES('cliente',v_cliente,v_nome,'ABRIR_ATENDIMENTO','saude_atendimentos',v_id,jsonb_build_object('protocolo',v_protocolo));
  RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocolo);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_saude_abrir_atendimento(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_abrir_atendimento(uuid,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_saude_registrar_documento(
  p_sessao_id uuid,p_session_token text,p_titulo text,p_tipo text,p_storage_path text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE v_cliente uuid; v_nome text; v_id uuid;
BEGIN
  SELECT ator_id,ator_nome INTO v_cliente,v_nome FROM public.gsa_validate_session(p_sessao_id,p_session_token)
  WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.' USING ERRCODE='42501'; END IF;
  IF p_storage_path NOT LIKE v_cliente::text||'/%' THEN RAISE EXCEPTION 'Caminho de arquivo inválido.' USING ERRCODE='42501'; END IF;
  IF length(trim(coalesce(p_titulo,'')))<1 THEN RAISE EXCEPTION 'Nome do documento é obrigatório.' USING ERRCODE='22023'; END IF;  INSERT INTO public.saude_documentos(cliente_id,nome,descricao,storage_path,nome_arquivo,status,enviado_em)
  VALUES(v_cliente,left(trim(p_titulo),200),left(trim(coalesce(p_tipo,'documento_cliente')),200),p_storage_path,left(trim(p_titulo),200),'enviado',now())
  RETURNING id INTO v_id;
  INSERT INTO public.saude_auditoria(ator_tipo,ator_id,ator_nome,acao,tabela,registro_id,detalhes)
  VALUES('cliente',v_cliente,v_nome,'ENVIAR_DOCUMENTO','saude_documentos',v_id,jsonb_build_object('storage_path',p_storage_path));
  RETURN jsonb_build_object('success',true,'id',v_id);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_saude_registrar_documento(uuid,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_registrar_documento(uuid,text,text,text,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gsa_client_saude_aceitar_proposta(
  p_sessao_id uuid,p_session_token text,p_proposta_id uuid,p_termos_versao text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  v_cliente uuid; v_nome text; v_proposta public.saude_propostas%rowtype;
  v_aceite_id uuid; v_contrato_id uuid;
BEGIN
  SELECT ator_id,ator_nome INTO v_cliente,v_nome FROM public.gsa_validate_session(p_sessao_id,p_session_token)
  WHERE is_valid AND ator_tipo='cliente' LIMIT 1;
  IF v_cliente IS NULL THEN RAISE EXCEPTION 'Sessão de cliente inválida ou expirada.' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_proposta FROM public.saude_propostas
  WHERE id=p_proposta_id AND cliente_id=v_cliente FOR UPDATE;  IF NOT FOUND OR v_proposta.status NOT IN ('enviada','visualizada') THEN
    RAISE EXCEPTION 'Proposta indisponível para aceite.' USING ERRCODE='22023';
  END IF;
  IF v_proposta.validade_proposta < now() THEN
    UPDATE public.saude_propostas SET status='expirada',updated_at=now() WHERE id=p_proposta_id;
    RAISE EXCEPTION 'Proposta expirada.' USING ERRCODE='22023';
  END IF;
  INSERT INTO public.saude_aceites(proposta_id,cotacao_id,cliente_id,snapshot_proposta,versao_termo,aceito_em)
  VALUES(v_proposta.id,v_proposta.cotacao_id,v_cliente,to_jsonb(v_proposta),left(trim(coalesce(p_termos_versao,'2026-09-11')),80),now())
  RETURNING id INTO v_aceite_id;
  UPDATE public.saude_propostas SET status='aceita',aceita_em=now(),updated_at=now() WHERE id=v_proposta.id;
  UPDATE public.saude_cotacoes SET status='proposta_aceita',updated_at=now() WHERE id=v_proposta.cotacao_id;
  INSERT INTO public.saude_contratos(
    aceite_id,cotacao_id,cliente_id,produto_id,operadora_nome,plano_nome,registro_ans,status,created_at,updated_at
  ) VALUES(
    v_aceite_id,v_proposta.cotacao_id,v_cliente,v_proposta.produto_id,v_proposta.operadora_nome,v_proposta.plano_nome,
    coalesce(v_proposta.plano_registro_ans,v_proposta.operadora_registro_ans),'ativo',now(),now()
  ) RETURNING id INTO v_contrato_id;
  INSERT INTO public.saude_auditoria(ator_tipo,ator_id,ator_nome,acao,tabela,registro_id,detalhes)
  VALUES('cliente',v_cliente,v_nome,'ACEITAR_PROPOSTA','saude_propostas',v_proposta.id,
         jsonb_build_object('aceite_id',v_aceite_id,'contrato_id',v_contrato_id));
  RETURN jsonb_build_object('success',true,'proposta_id',v_proposta.id,'aceite_id',v_aceite_id,'contrato_id',v_contrato_id);
END;
$$;
REVOKE ALL ON FUNCTION public.gsa_client_saude_aceitar_proposta(uuid,text,uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gsa_client_saude_aceitar_proposta(uuid,text,uuid,text) TO authenticated, service_role;
CREATE OR REPLACE FUNCTION public.gsa_admin_save_protection_entity(
  p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,p_domain text DEFAULT NULL,
  p_kind text DEFAULT NULL,p_id uuid DEFAULT NULL,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  v_domain text:=lower(trim(coalesce(p_domain,''))); v_kind text:=lower(trim(coalesce(p_kind,'')));
  v_id uuid:=p_id; v_name text:=trim(coalesce(p_payload->>'nome','')); v_table text;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id,p_session_token);
  IF v_domain NOT IN ('saude','seguros') THEN RAISE EXCEPTION 'Domínio de proteção inválido.' USING ERRCODE='22023'; END IF;
  PERFORM public.gsa_admin_assert_module(v_domain);
  IF v_kind='parceiro' THEN
    IF length(v_name)<2 THEN RAISE EXCEPTION 'Informe o nome do parceiro.' USING ERRCODE='22023'; END IF;
    v_table:=v_domain||'_parceiros';
    IF v_domain='saude' THEN
      IF v_id IS NULL THEN
        INSERT INTO public.saude_parceiros(tipo,razao_social,nome_comercial,cnpj,site_oficial,email_contato,observacoes_internas,status)
        VALUES(coalesce(nullif(trim(p_payload->>'tipo'),''),'operadora'),v_name,v_name,
               nullif(trim(p_payload->>'documento'),''),nullif(trim(p_payload->>'site'),''),nullif(trim(p_payload->>'contato'),''),
               nullif(trim(p_payload->>'observacoes'),''),coalesce(nullif(trim(p_payload->>'status'),''),'ativo'))
        RETURNING id INTO v_id;      ELSE
        UPDATE public.saude_parceiros SET
          tipo=coalesce(nullif(trim(p_payload->>'tipo'),''),tipo),
          razao_social=v_name,nome_comercial=v_name,
          cnpj=nullif(trim(p_payload->>'documento'),''),site_oficial=nullif(trim(p_payload->>'site'),''),
          email_contato=nullif(trim(p_payload->>'contato'),''),observacoes_internas=nullif(trim(p_payload->>'observacoes'),''),
          status=coalesce(nullif(trim(p_payload->>'status'),''),status),updated_at=now()
        WHERE id=v_id;
      END IF;
    ELSE
      IF v_id IS NULL THEN
        INSERT INTO public.seguros_parceiros(nome,documento,site,contato,comissao_tipo,comissao_valor,observacoes,status)
        VALUES(v_name,nullif(trim(p_payload->>'documento'),''),nullif(trim(p_payload->>'site'),''),nullif(trim(p_payload->>'contato'),''),
               coalesce(nullif(trim(p_payload->>'comissao_tipo'),''),'porcentagem'),coalesce(nullif(p_payload->>'comissao_valor','')::numeric,0),
               nullif(trim(p_payload->>'observacoes'),''),coalesce(nullif(trim(p_payload->>'status'),''),'ativo'))
        RETURNING id INTO v_id;
      ELSE
        UPDATE public.seguros_parceiros SET nome=v_name,documento=nullif(trim(p_payload->>'documento'),''),
          site=nullif(trim(p_payload->>'site'),''),contato=nullif(trim(p_payload->>'contato'),''),
          comissao_tipo=coalesce(nullif(trim(p_payload->>'comissao_tipo'),''),comissao_tipo),
          comissao_valor=coalesce(nullif(p_payload->>'comissao_valor','')::numeric,comissao_valor),
          observacoes=nullif(trim(p_payload->>'observacoes'),''),status=coalesce(nullif(trim(p_payload->>'status'),''),status),updated_at=now()
        WHERE id=v_id;
      END IF;
    END IF;  ELSIF v_kind='produto' THEN
    IF v_domain='saude' THEN
      RAISE EXCEPTION 'O catálogo administrativo de produtos de Saúde está descontinuado neste módulo.' USING ERRCODE='0A000';
    END IF;
    v_table:='seguros_produtos';
    IF length(v_name)<2 THEN RAISE EXCEPTION 'Informe o nome do produto.' USING ERRCODE='22023'; END IF;
    IF v_id IS NULL THEN
      INSERT INTO public.seguros_produtos(nome,slug,parceiro_id,categoria,imagem_url,preco_referencia,resumo,destaque,status)
      VALUES(v_name,lower(coalesce(nullif(trim(p_payload->>'slug'),''),regexp_replace(unaccent(v_name),'[^a-zA-Z0-9]+','-','g'))),
             nullif(p_payload->>'parceiro_id','')::uuid,nullif(trim(p_payload->>'categoria'),''),nullif(trim(p_payload->>'imagem_url'),''),
             nullif(p_payload->>'preco_referencia','')::numeric,nullif(trim(p_payload->>'resumo'),''),
             coalesce((p_payload->>'destaque')::boolean,false),coalesce(nullif(trim(p_payload->>'status'),''),'rascunho'))
      RETURNING id INTO v_id;
    ELSE
      UPDATE public.seguros_produtos SET nome=v_name,
        slug=lower(coalesce(nullif(trim(p_payload->>'slug'),''),regexp_replace(unaccent(v_name),'[^a-zA-Z0-9]+','-','g'))),
        parceiro_id=nullif(p_payload->>'parceiro_id','')::uuid,categoria=nullif(trim(p_payload->>'categoria'),''),
        imagem_url=nullif(trim(p_payload->>'imagem_url'),''),preco_referencia=nullif(p_payload->>'preco_referencia','')::numeric,
        resumo=nullif(trim(p_payload->>'resumo'),''),destaque=coalesce((p_payload->>'destaque')::boolean,false),
        status=coalesce(nullif(trim(p_payload->>'status'),''),status),updated_at=now() WHERE id=v_id;
    END IF;
  ELSE RAISE EXCEPTION 'Tipo de entidade de proteção inválido.' USING ERRCODE='22023'; END IF;
  IF NOT FOUND AND p_id IS NOT NULL THEN RAISE EXCEPTION 'Registro não encontrado.' USING ERRCODE='P0002'; END IF;
  PERFORM public.gsa_admin_write_audit(v_domain,CASE WHEN p_id IS NULL THEN 'CRIAR' ELSE 'EDITAR' END,v_table,v_id,jsonb_build_object('kind',v_kind));
  RETURN jsonb_build_object('success',true,'id',v_id);
END; $$;
CREATE OR REPLACE FUNCTION public.gsa_admin_create_protection_proposal(
  p_sessao_id uuid DEFAULT NULL,p_session_token text DEFAULT NULL,p_domain text DEFAULT NULL,p_payload jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp
AS $$
DECLARE
  v_domain text:=lower(trim(coalesce(p_domain,''))); v_quote_id uuid:=nullif(p_payload->>'cotacao_id','')::uuid;
  v_partner_id uuid:=nullif(p_payload->>'parceiro_id','')::uuid; v_amount numeric:=nullif(p_payload->>'valor','')::numeric;
  v_validity integer:=least(greatest(coalesce((p_payload->>'validade_dias')::integer,5),1),90);
  v_quote jsonb; v_partner jsonb; v_id uuid; v_protocol text; v_title text;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id,p_session_token);
  IF v_domain NOT IN ('saude','seguros') THEN RAISE EXCEPTION 'Domínio de proteção inválido.' USING ERRCODE='22023'; END IF;
  PERFORM public.gsa_admin_assert_module(v_domain);
  IF v_quote_id IS NULL OR v_partner_id IS NULL OR v_amount IS NULL OR v_amount<=0 THEN
    RAISE EXCEPTION 'Cotação, parceiro e valor são obrigatórios.' USING ERRCODE='22023'; END IF;
  v_protocol:=upper(CASE WHEN v_domain='saude' THEN 'SAU' ELSE 'SEG' END||'-PROP-'||substr(encode(gen_random_bytes(8),'hex'),1,12));
  v_title:=coalesce(nullif(trim(p_payload->>'titulo'),''),'Proposta '||v_protocol);
  IF v_domain='saude' THEN
    SELECT to_jsonb(q) INTO v_quote FROM public.saude_cotacoes q WHERE q.id=v_quote_id FOR UPDATE;
    SELECT to_jsonb(p) INTO v_partner FROM public.saude_parceiros p WHERE p.id=v_partner_id AND p.status='ativo';
    IF v_quote IS NULL THEN RAISE EXCEPTION 'Cotação não encontrada.' USING ERRCODE='P0002'; END IF;
    IF v_partner IS NULL THEN RAISE EXCEPTION 'Parceiro de Saúde ativo não encontrado.' USING ERRCODE='P0002'; END IF;    INSERT INTO public.saude_propostas(
      cotacao_id,cliente_id,titulo,operadora_nome,operadora_registro_ans,plano_nome,
      valor_confirmado,tipo_valor,validade_proposta,status,observacoes
    ) VALUES(
      v_quote_id,(v_quote->>'cliente_id')::uuid,v_title,
      coalesce(v_partner->>'nome_comercial',v_partner->>'razao_social','Parceiro Saúde'),
      nullif(v_partner->>'registro_ans',''),coalesce(nullif(trim(p_payload->>'plano_nome'),''),v_title),
      v_amount,'confirmado',now()+make_interval(days=>v_validity),'enviada',nullif(trim(p_payload->>'observacoes'),'')
    ) RETURNING id INTO v_id;
    UPDATE public.saude_cotacoes SET status='propostas_disponiveis',updated_at=now() WHERE id=v_quote_id;
  ELSE
    SELECT to_jsonb(q) INTO v_quote FROM public.seguros_cotacoes q WHERE q.id=v_quote_id FOR UPDATE;
    SELECT to_jsonb(p) INTO v_partner FROM public.seguros_parceiros p WHERE p.id=v_partner_id AND p.status='ativo';
    IF v_quote IS NULL THEN RAISE EXCEPTION 'Cotação não encontrada.' USING ERRCODE='P0002'; END IF;
    IF v_partner IS NULL THEN RAISE EXCEPTION 'Parceiro de Seguros ativo não encontrado.' USING ERRCODE='P0002'; END IF;
    INSERT INTO public.seguros_propostas(
      cotacao_id,cliente_id,parceiro_id,protocolo,titulo,premio_seguradora,franquia,taxa_assessoria_gsa,validade_ate,status
    ) VALUES(
      v_quote_id,(v_quote->>'cliente_id')::uuid,v_partner_id,v_protocol,v_title,v_amount,
      nullif(p_payload->>'franquia','')::numeric,coalesce(nullif(p_payload->>'taxa_assessoria_gsa','')::numeric,0),
      now()+make_interval(days=>v_validity),'enviada'
    ) RETURNING id INTO v_id;
    UPDATE public.seguros_cotacoes SET status='propostas_disponiveis',updated_at=now() WHERE id=v_quote_id;
  END IF;  PERFORM public.gsa_admin_write_audit(v_domain,'CRIAR_PROPOSTA',v_domain||'_propostas',v_id,
    jsonb_build_object('quote_id',v_quote_id,'partner_id',v_partner_id,'amount',v_amount));
  RETURN jsonb_build_object('success',true,'id',v_id,'protocolo',v_protocol);
END;
$$;

DROP POLICY IF EXISTS "Acesso total avaliacoes" ON public.loja_avaliacoes;
DROP POLICY IF EXISTS "Clientes inserem avaliacoes" ON public.loja_avaliacoes;
CREATE POLICY loja_avaliacoes_client_insert ON public.loja_avaliacoes
  FOR INSERT TO authenticated
  WITH CHECK (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
CREATE POLICY loja_avaliacoes_admin_manage ON public.loja_avaliacoes
  FOR ALL TO authenticated
  USING (public.gsa_jwt_actor_type() IN ('admin','colaborador'))
  WITH CHECK (public.gsa_jwt_actor_type() IN ('admin','colaborador'));

DROP POLICY IF EXISTS "Favoritos por cliente" ON public.loja_favoritos;
CREATE POLICY loja_favoritos_client_select ON public.loja_favoritos
  FOR SELECT TO authenticated
  USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
CREATE POLICY loja_favoritos_client_insert ON public.loja_favoritos
  FOR INSERT TO authenticated
  WITH CHECK (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());
CREATE POLICY loja_favoritos_client_delete ON public.loja_favoritos
  FOR DELETE TO authenticated
  USING (public.gsa_jwt_actor_type()='cliente' AND cliente_id=public.gsa_jwt_actor_id());DROP POLICY IF EXISTS loja_avaliacoes_admin_manage ON public.loja_avaliacoes;
CREATE POLICY loja_avaliacoes_admin_manage ON public.loja_avaliacoes
  FOR ALL TO authenticated
  USING (
    public.gsa_jwt_actor_type()='admin'
    OR (public.gsa_jwt_actor_type()='colaborador' AND public.gsa_collaborator_has_module('operacoes'))
  )
  WITH CHECK (
    public.gsa_jwt_actor_type()='admin'
    OR (public.gsa_jwt_actor_type()='colaborador' AND public.gsa_collaborator_has_module('operacoes'))
  );

ALTER TABLE public.loja_avaliacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loja_favoritos ENABLE ROW LEVEL SECURITY;

COMMIT;
