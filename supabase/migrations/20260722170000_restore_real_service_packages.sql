BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.servicos
  ADD COLUMN IF NOT EXISTS ordem_exibicao integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS orcamento_disponivel boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.gsa_service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  titulo text NOT NULL,
  subtitulo text NOT NULL DEFAULT '',
  descricao text NOT NULL DEFAULT '',
  publico text NOT NULL CHECK (publico IN ('pf','pj','ambos')),
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','inativo')),
  visivel_publico boolean NOT NULL DEFAULT true,
  orcamento_disponivel boolean NOT NULL DEFAULT true,
  ordem_exibicao integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gsa_service_package_items (
  pacote_id uuid NOT NULL REFERENCES public.gsa_service_packages(id) ON DELETE CASCADE,
  servico_id uuid NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  nome_snapshot text NOT NULL,
  descricao_snapshot text NOT NULL DEFAULT '',
  ordem_exibicao integer NOT NULL DEFAULT 0,
  PRIMARY KEY (pacote_id, servico_id)
);

CREATE INDEX IF NOT EXISTS idx_gsa_service_packages_public
  ON public.gsa_service_packages (status, visivel_publico, publico, ordem_exibicao);
CREATE INDEX IF NOT EXISTS idx_gsa_service_package_items_order
  ON public.gsa_service_package_items (pacote_id, ordem_exibicao);

ALTER TABLE public.gsa_service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gsa_service_package_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gsa_service_packages FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.gsa_service_package_items FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gsa_service_catalog_package_json(p_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'id', p.id,
    'code', p.codigo,
    'title', p.titulo,
    'subtitle', p.subtitulo,
    'description', p.descricao,
    'audience', upper(p.publico),
    'serviceIds', COALESCE((
      SELECT jsonb_agg(i.servico_id ORDER BY i.ordem_exibicao)
      FROM public.gsa_service_package_items i
      WHERE i.pacote_id = p.id
    ), '[]'::jsonb),
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.servico_id,
        'name', i.nome_snapshot,
        'desc', i.descricao_snapshot
      ) ORDER BY i.ordem_exibicao)
      FROM public.gsa_service_package_items i
      WHERE i.pacote_id = p.id
    ), '[]'::jsonb),
    'status', p.status,
    'publicVisible', p.visivel_publico,
    'quoteAvailable', p.orcamento_disponivel,
    'order', p.ordem_exibicao
  )
  FROM public.gsa_service_packages p
  WHERE p.id = p_id
$$;

CREATE OR REPLACE FUNCTION public.gsa_public_service_catalog(p_audience text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_audience text := CASE WHEN lower(COALESCE(p_audience,'')) IN ('pf','pj') THEN lower(p_audience) ELSE NULL END;
  v_services jsonb;
  v_packages jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'code', s.codigo_servico,
    'name', s.nome,
    'title', s.nome,
    'subtitle', s.categoria,
    'description', COALESCE(s.descricao,''),
    'audience', upper(s.tipo_cliente),
    'price', s.valor,
    'hidePrice', COALESCE(s.ocultar_valor,false),
    'status', COALESCE(s.status,'ativo'),
    'publicVisible', COALESCE(s.visivel_na_loja,false),
    'quoteAvailable', COALESCE(s.orcamento_disponivel,true),
    'order', COALESCE(s.ordem_exibicao,0)
  ) ORDER BY COALESCE(s.ordem_exibicao,0), s.nome), '[]'::jsonb)
  INTO v_services
  FROM public.servicos s
  WHERE lower(COALESCE(s.status,'ativo')) = 'ativo'
    AND COALESCE(s.visivel_na_loja,false)
    AND (v_audience IS NULL OR lower(s.tipo_cliente) IN (v_audience,'ambos'));

  SELECT COALESCE(jsonb_agg(public.gsa_service_catalog_package_json(p.id)
    ORDER BY p.ordem_exibicao, p.titulo), '[]'::jsonb)
  INTO v_packages
  FROM public.gsa_service_packages p
  WHERE p.status='ativo'
    AND p.visivel_publico
    AND (v_audience IS NULL OR p.publico IN (v_audience,'ambos'));

  RETURN jsonb_build_object('services', v_services, 'packages', v_packages);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_service_catalog_snapshot(
  p_sessao_id uuid,
  p_session_token text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_services jsonb;
  v_packages jsonb;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'code', s.codigo_servico, 'name', s.nome, 'title', s.nome,
    'subtitle', s.categoria, 'description', COALESCE(s.descricao,''),
    'audience', upper(s.tipo_cliente), 'price', s.valor,
    'hidePrice', COALESCE(s.ocultar_valor,false), 'status', COALESCE(s.status,'ativo'),
    'publicVisible', COALESCE(s.visivel_na_loja,false),
    'quoteAvailable', COALESCE(s.orcamento_disponivel,true),
    'order', COALESCE(s.ordem_exibicao,0)
  ) ORDER BY COALESCE(s.ordem_exibicao,0), s.nome), '[]'::jsonb)
  INTO v_services FROM public.servicos s;

  SELECT COALESCE(jsonb_agg(public.gsa_service_catalog_package_json(p.id)
    ORDER BY p.ordem_exibicao, p.titulo), '[]'::jsonb)
  INTO v_packages FROM public.gsa_service_packages p;

  RETURN jsonb_build_object('services', v_services, 'packages', v_packages);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_save_service_package(
  p_sessao_id uuid,
  p_session_token text,
  p_package_id uuid,
  p_payload jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid := COALESCE(p_package_id, gen_random_uuid());
  v_publico text := lower(COALESCE(p_payload->>'audience','pf'));

  v_service_id uuid;
  v_order integer := 0;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  IF v_publico NOT IN ('pf','pj','ambos') THEN RAISE EXCEPTION 'Público inválido'; END IF;
  IF btrim(COALESCE(p_payload->>'title',''))='' THEN RAISE EXCEPTION 'Nome do pacote obrigatório'; END IF;

  INSERT INTO public.gsa_service_packages (
    id,codigo,titulo,subtitulo,descricao,publico,status,visivel_publico,
    orcamento_disponivel,ordem_exibicao,updated_at
  ) VALUES (
    v_id,
    COALESCE((SELECT codigo FROM public.gsa_service_packages WHERE id=v_id),
      'PAC-' || upper(v_publico) || '-' || substr(replace(v_id::text,'-',''),1,8)),
    btrim(p_payload->>'title'),
    COALESCE(p_payload->>'subtitle',''),
    COALESCE(p_payload->>'description',''),
    v_publico,
    CASE WHEN lower(COALESCE(p_payload->>'status','ativo'))='inativo' THEN 'inativo' ELSE 'ativo' END,
    COALESCE((p_payload->>'publicVisible')::boolean,true),
    COALESCE((p_payload->>'quoteAvailable')::boolean,true),
    COALESCE((p_payload->>'order')::integer,0),
    now()
  )
  ON CONFLICT (id) DO UPDATE SET
    titulo=EXCLUDED.titulo, subtitulo=EXCLUDED.subtitulo, descricao=EXCLUDED.descricao,
    publico=EXCLUDED.publico, status=EXCLUDED.status, visivel_publico=EXCLUDED.visivel_publico,
    orcamento_disponivel=EXCLUDED.orcamento_disponivel, ordem_exibicao=EXCLUDED.ordem_exibicao,
    updated_at=now();

  DELETE FROM public.gsa_service_package_items WHERE pacote_id=v_id;
  FOR v_service_id IN
    SELECT value::text::uuid FROM jsonb_array_elements(COALESCE(p_payload->'serviceIds','[]'::jsonb))
  LOOP
    INSERT INTO public.gsa_service_package_items(
      pacote_id,servico_id,nome_snapshot,descricao_snapshot,ordem_exibicao
    )
    SELECT v_id,s.id,s.nome,COALESCE(s.descricao,''),v_order
    FROM public.servicos s WHERE s.id=v_service_id;
    v_order := v_order + 1;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.gsa_service_package_items WHERE pacote_id=v_id) THEN
    RAISE EXCEPTION 'Selecione ao menos um serviço';
  END IF;
  RETURN public.gsa_service_catalog_package_json(v_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_delete_service_package(
  p_sessao_id uuid,
  p_session_token text,
  p_package_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id, p_session_token);
  DELETE FROM public.gsa_service_packages WHERE id=p_package_id;
  RETURN jsonb_build_object('success', FOUND);
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_seed_default_service_catalog(p_packages jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_package jsonb;
  v_service jsonb;
  v_package_id uuid;
  v_service_id uuid;
  v_package_order integer := 0;
  v_service_order integer;
  v_audience text;
  v_code text;
BEGIN
  FOR v_package IN SELECT value FROM jsonb_array_elements(COALESCE(p_packages,'[]'::jsonb))
  LOOP
    v_audience := lower(v_package->>'audience');
    SELECT id INTO v_package_id FROM public.gsa_service_packages
      WHERE lower(titulo)=lower(v_package->>'title') LIMIT 1;
    IF v_package_id IS NULL THEN v_package_id := gen_random_uuid(); END IF;
    v_code := 'PAC-' || upper(v_audience) || '-' || lpad((v_package_order+1)::text,3,'0');

    INSERT INTO public.gsa_service_packages(
      id,codigo,titulo,subtitulo,descricao,publico,status,visivel_publico,
      orcamento_disponivel,ordem_exibicao,updated_at
    ) VALUES (
      v_package_id,v_code,v_package->>'title',COALESCE(v_package->>'subtitle',''),
      COALESCE(v_package->>'description',''),v_audience,'ativo',true,true,v_package_order,now()
    )
    ON CONFLICT (id) DO UPDATE SET
      titulo=EXCLUDED.titulo,subtitulo=EXCLUDED.subtitulo,descricao=EXCLUDED.descricao,
      publico=EXCLUDED.publico,status='ativo',visivel_publico=true,
      orcamento_disponivel=true,ordem_exibicao=EXCLUDED.ordem_exibicao,updated_at=now();

    DELETE FROM public.gsa_service_package_items WHERE pacote_id=v_package_id;
    v_service_order := 0;
    FOR v_service IN SELECT value FROM jsonb_array_elements(v_package->'services')
    LOOP
      SELECT id INTO v_service_id FROM public.servicos
       WHERE lower(nome)=lower(v_service->>'name')
         AND lower(tipo_cliente) IN (v_audience,'ambos')
       ORDER BY CASE WHEN lower(tipo_cliente)=v_audience THEN 0 ELSE 1 END
       LIMIT 1;

      IF v_service_id IS NULL THEN
        v_service_id := gen_random_uuid();
        INSERT INTO public.servicos(
          id,codigo_servico,nome,descricao,valor,status,ocultar_valor,tipo_cliente,
          categoria,visivel_na_loja,ordem_exibicao,orcamento_disponivel
        ) VALUES (
          v_service_id,
          'SRV-' || upper(v_audience) || '-' || substr(replace(v_service_id::text,'-',''),1,8),
          v_service->>'name',COALESCE(v_service->>'desc',''),0,'ativo',true,
          v_audience,v_package->>'subtitle',true,v_package_order*10+v_service_order,true
        );
      ELSE
        UPDATE public.servicos SET
          descricao=COALESCE(v_service->>'desc',descricao), status='ativo',
          visivel_na_loja=true, orcamento_disponivel=true
        WHERE id=v_service_id;
      END IF;

      INSERT INTO public.gsa_service_package_items(
        pacote_id,servico_id,nome_snapshot,descricao_snapshot,ordem_exibicao
      ) VALUES (
        v_package_id,v_service_id,v_service->>'name',COALESCE(v_service->>'desc',''),v_service_order
      );
      v_service_order := v_service_order+1;
    END LOOP;
    v_package_order := v_package_order+1;
  END LOOP;
  RETURN v_package_order;
END;
$$;

CREATE OR REPLACE FUNCTION public.gsa_admin_import_service_catalog(
  p_sessao_id uuid,
  p_session_token text,
  p_packages jsonb
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_count integer;
BEGIN
  PERFORM public.gsa_admin_validate_context(p_sessao_id,p_session_token);

  v_count := public.gsa_seed_default_service_catalog(p_packages);
  RETURN jsonb_build_object('success',true,'importedPackages',v_count);
END;
$$;

SELECT public.gsa_seed_default_service_catalog($catalog$[{"audience": "pf", "title": "Pacote Futuro Garantido", "subtitle": "Soluções previdenciárias e benefícios INSS", "description": "Planejamento previdenciário, aposentadorias, benefícios por incapacidade, BPC/LOAS, pensão por morte e recursos administrativos.", "services": [{"name": "Planejamento Previdenciário", "desc": "Cálculo de tempo de contribuição, simulação de valores e análise do melhor momento."}, {"name": "Aposentadorias", "desc": "Idade, tempo de contribuição, especial, rural e pessoa com deficiência."}, {"name": "Benefícios por Incapacidade", "desc": "Auxílio-doença e aposentadoria por invalidez."}, {"name": "Benefícios Assistenciais e Pensão", "desc": "BPC/LOAS, pensão por morte e salário-maternidade."}, {"name": "Assessoria Administrativa", "desc": "Recursos administrativos, revisão de benefícios e acertos de CNIS."}]}, {"audience": "pf", "title": "Pacote Microempreendedor", "subtitle": "Serviços para MEI", "description": "Gestão completa para o microempreendedor manter a empresa regularizada, emitir documentos e resolver pendências.", "services": [{"name": "Gestão do MEI", "desc": "Abertura, formalização e baixa do registro MEI."}, {"name": "Notas Fiscais", "desc": "Emissão de notas fiscais de produtos e serviços."}, {"name": "Regularização", "desc": "Declarações anuais, parcelamento de DAS e emissão de guias."}]}, {"audience": "pf", "title": "Pacote Direção Livre", "subtitle": "Soluções veiculares e CNH", "description": "Regularização documental para condutores e veículos, incluindo licenciamento, transferência, renovação e defesa de infrações.", "services": [{"name": "Regularização de Veículos", "desc": "Licenciamento, transferência, emplacamento, gravame, CRV e procurações."}, {"name": "Habilitação CNH", "desc": "Renovação, EAR, PID, CNH definitiva e alteração de dados."}, {"name": "Defesa de Infrações", "desc": "Indicação de condutor, recursos e defesa de suspensão ou cassação."}]}, {"audience": "pf", "title": "Pacote Direitos PcD", "subtitle": "Assessoria administrativa e isenções", "description": "Suporte para isenções fiscais e direitos administrativos da pessoa com deficiência.", "services": [{"name": "Isenções na Compra de Veículos", "desc": "Processos administrativos de IPI e ICMS."}, {"name": "Isenção de IPVA", "desc": "Solicitação junto à Secretaria da Fazenda Estadual."}, {"name": "Cartão Defis", "desc": "Autorização para estacionamento em vagas especiais."}, {"name": "Rodízio Municipal", "desc": "Solicitação de isenção onde o benefício se aplica."}]}, {"audience": "pf", "title": "Pacote Vida em Dia", "subtitle": "Regularização civil, contratos e finanças", "description": "Organização financeira, contratos, imposto de renda, CPF, FGTS e cálculos administrativos.", "services": [{"name": "Imposto de Renda", "desc": "Declaração anual e regularização de malha fina."}, {"name": "Regularização de CPF", "desc": "Resolução de pendências cadastrais e restrições."}, {"name": "Consultoria Financeira", "desc": "Planejamento de dívidas e organização orçamentária."}, {"name": "Contratos e Cálculos", "desc": "Contratos de aluguel, compra e venda e cálculos trabalhistas."}, {"name": "Assistência FGTS", "desc": "Assessoria para saques e regularização cadastral."}]}, {"audience": "pj", "title": "Gestão Financeira Operacional", "subtitle": "BPO financeiro", "description": "Terceirização do financeiro com controle de contas a pagar, contas a receber e conciliação bancária.", "services": [{"name": "Contas a Pagar", "desc": "Gestão completa de contas e vencimentos."}, {"name": "Contas a Receber", "desc": "Acompanhamento de recebimentos e inadimplência."}, {"name": "Conciliação Bancária", "desc": "Conciliação diária ou semanal."}, {"name": "Agendamentos", "desc": "Pagamentos, folha e fornecedores no bankline."}]}, {"audience": "pj", "title": "Faturamento Inteligente", "subtitle": "Gestão fiscal e emissão", "description": "Agilidade na emissão de notas fiscais, boletos e envio automático de documentos aos clientes.", "services": [{"name": "Notas Fiscais", "desc": "Emissão de notas de produtos e serviços."}, {"name": "Boletos Bancários", "desc": "Geração e envio de cobranças."}, {"name": "Envio Automático", "desc": "Distribuição automática dos documentos fiscais."}]}, {"audience": "pj", "title": "Recuperação de Crédito e Cobrança", "subtitle": "Gestão de inadimplência", "description": "Cobrança preventiva, negociação amigável e acompanhamento de protestos.", "services": [{"name": "Cobrança Preventiva", "desc": "Lembretes antes do vencimento."}, {"name": "Cobrança Ativa", "desc": "Negociação de prazos e valores."}, {"name": "Gestão de Protesto", "desc": "Acompanhamento de títulos em cartório."}]}, {"audience": "pj", "title": "Gestão Administrativa e Compras", "subtitle": "Facilities e compras", "description": "Cotação de fornecedores, gestão de contratos e organização documental física e digital.", "services": [{"name": "Cotação de Fornecedores", "desc": "Mapas comparativos e negociação."}, {"name": "Gestão de Contratos", "desc": "Monitoramento de vigência e renovação."}, {"name": "Organização Documental", "desc": "Arquivo digital e físico estruturado."}]}, {"audience": "pj", "title": "Gestão de Comissões de Vendas", "subtitle": "Inteligência comercial", "description": "Apuração de vendas, cálculo de comissões, metas, bônus e relatórios.", "services": [{"name": "Apuração de Vendas", "desc": "Cruzamento de venda, faturamento e recebimento."}, {"name": "Comissionamento", "desc": "Aplicação de regras, bônus, metas e descontos."}, {"name": "Relatórios", "desc": "Extratos para diretoria e vendedores."}]}, {"audience": "pj", "title": "Gestão de Reembolsos e Despesas", "subtitle": "RDV e cartão corporativo", "description": "Controle de reembolsos, despesas externas, cartões e centros de custo.", "services": [{"name": "Conferência de RDV", "desc": "Validação de notas e políticas de reembolso."}, {"name": "Cartão Corporativo", "desc": "Monitoramento de extratos e despesas."}, {"name": "Centro de Custo", "desc": "Comparativos mensais e previsões."}]}, {"audience": "pj", "title": "Compliance e Regularidade Fiscal", "subtitle": "Compliance fiscal", "description": "Monitoramento de certidões, emissão e renovação de CNDs e cadastro em fornecedores.", "services": [{"name": "Monitoramento de CNDs", "desc": "Certidões federais, estaduais, municipais e trabalhistas."}, {"name": "Emissão e Renovação", "desc": "Ação preventiva para manter documentos válidos."}, {"name": "Cadastro em Fornecedores", "desc": "Fichas cadastrais e abertura de crédito."}]}]$catalog$::jsonb);

REVOKE ALL ON FUNCTION public.gsa_service_catalog_package_json(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gsa_seed_default_service_catalog(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gsa_public_service_catalog(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_service_catalog_snapshot(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_save_service_package(uuid,text,uuid,jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_delete_service_package(uuid,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.gsa_admin_import_service_catalog(uuid,text,jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
COMMIT;
