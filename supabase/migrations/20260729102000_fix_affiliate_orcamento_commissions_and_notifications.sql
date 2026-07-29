-- Migration: Fix affiliate store order commission triggers, gross points calculation, and non-zero commission rules

-- 1. Trigger em orcamentos
DROP TRIGGER IF EXISTS trg_affiliate_business_orcamentos ON public.orcamentos;
CREATE TRIGGER trg_affiliate_business_orcamentos
AFTER INSERT OR UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION gsa_affiliate_conversion_from_business_event();

-- 2. Atualizar gsa_guard_client_notification_insert para permitir notificações automatizadas
CREATE OR REPLACE FUNCTION public.gsa_guard_client_notification_insert()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_actor_type TEXT;
  v_actor_id UUID;
  v_recent_count INTEGER;
  v_allowed_admin_actions CONSTANT TEXT[] := ARRAY[
    'ticket_aberto_cliente', 'ticket_mensagem_cliente_adm', 'documento_enviado_cliente',
    'comprovante_enviado', 'premio_resgate_solicitado', 'voucher_resgate_solicitado',
    'assinatura_cancelamento_solicitado', 'orcamento_criado', 'orcamento_negociacao',
    'ticket_aberto', 'ticket_mensagem_cliente', 'saque_solicitado',
    'transferencia_solicitada', 'cadastro_novo_cliente', 'exclusao_solicitada',
    'os_documento_enviado', 'emprestimo_comentario', 'emprestimo_aceito',
    'emprestimo_assinado', 'quitacao', 'emprestimo_criado',
    'documento_cliente_enviado', 'sistema', 'checkout_loja', 'venda_afiliado'
  ];
BEGIN
  IF current_setting('gsa.system_override', true) = 'on' THEN
    RETURN NEW;
  END IF;

  v_actor_type := public.gsa_jwt_actor_type();
  v_actor_id := public.gsa_jwt_actor_id();
  IF v_actor_type <> 'cliente' THEN RETURN NEW; END IF;
  IF v_actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.titulo := left(trim(COALESCE(NEW.titulo, '')), 160);
  NEW.mensagem := left(trim(COALESCE(NEW.mensagem, '')), 2000);
  NEW.modulo := left(trim(COALESCE(NEW.modulo, 'sistema')), 80);
  NEW.contexto := COALESCE(NEW.contexto, '{}'::JSONB) || jsonb_build_object('actor_id', v_actor_id, 'actor_type', 'cliente');
  IF NEW.titulo = '' OR NEW.mensagem = '' THEN RAISE EXCEPTION 'Título e mensagem são obrigatórios.'; END IF;

  SELECT count(*) INTO v_recent_count
  FROM public.notificacoes n
  WHERE n.data_criacao >= NOW() - INTERVAL '1 minute'
    AND n.contexto ->> 'actor_id' = v_actor_id::TEXT;
  IF v_recent_count >= 20 THEN RAISE EXCEPTION 'Limite de notificações excedido. Aguarde antes de tentar novamente.'; END IF;

  IF NEW.destinatario_tipo IS NULL AND NEW.cliente_id = v_actor_id THEN NEW.destinatario_tipo := 'cliente'; END IF;
  IF NEW.destinatario_tipo = 'cliente' THEN
    IF NEW.cliente_id IS DISTINCT FROM v_actor_id OR NEW.prestador_id IS NOT NULL OR NEW.colaborador_id IS NOT NULL THEN
      IF COALESCE(NEW.acao_origem, '') = 'venda_afiliado' THEN
        RETURN NEW;
      END IF;
      RAISE EXCEPTION 'Cliente não pode criar notificação para outro usuário.';
    END IF;
  ELSIF NEW.destinatario_tipo = 'admin' THEN
    IF NEW.cliente_id IS NOT NULL OR NEW.prestador_id IS NOT NULL OR NEW.colaborador_id IS NOT NULL THEN
      RAISE EXCEPTION 'Notificação administrativa do cliente possui destinatário inválido.';
    END IF;
    IF COALESCE(NEW.acao_origem, 'sistema') <> ALL(v_allowed_admin_actions) THEN
      RAISE EXCEPTION 'Ação de notificação administrativa não permitida.';
    END IF;
    NEW.prioridade := CASE WHEN NEW.prioridade = 'alta' THEN 'alta' ELSE 'normal' END;
  ELSE
    RAISE EXCEPTION 'Tipo de destinatário não permitido para sessão de cliente.';
  END IF;
  NEW.tipo := COALESCE(NULLIF(NEW.tipo, ''), 'sistema');
  NEW.lida := false;
  NEW.data_criacao := COALESCE(NEW.data_criacao, NOW());
  RETURN NEW;
END;
$function$;

-- 3. Atualizar gsa_affiliate_award_points para creditar pontos baseados no VALOR BRUTO
CREATE OR REPLACE FUNCTION public.gsa_affiliate_award_points()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_client_id uuid;
  v_rate numeric;
  v_points numeric(14,2);
BEGIN
  IF NEW.status <> 'confirmada' THEN RETURN NEW; END IF;

  SELECT a.cliente_id, p.pontos_por_real
    INTO v_client_id, v_rate
  FROM public.gsa_afiliados a
  JOIN public.gsa_afiliado_programas p ON p.id = NEW.programa_id
  WHERE a.id = NEW.afiliado_id;

  v_points := round(greatest(NEW.valor_bruto, 0) * coalesce(v_rate, 1.0), 2);
  IF v_client_id IS NULL OR v_points <= 0 THEN RETURN NEW; END IF;

  INSERT INTO public.gsa_afiliado_pontos_eventos(cliente_id, afiliado_id, conversao_id, tipo, pontos_assinados, metadata)
  VALUES (v_client_id, NEW.afiliado_id, NEW.id, 'credito_conversao', v_points, jsonb_build_object('programa_id', NEW.programa_id, 'valor_bruto', NEW.valor_bruto))
  ON CONFLICT DO NOTHING;

  IF FOUND THEN 
    UPDATE public.clientes 
       SET pontos = coalesce(pontos, 0) + v_points,
           saldo_pontos = coalesce(saldo_pontos, 0) + floor(v_points)::integer,
           pontos_totais = coalesce(pontos_totais, 0) + floor(v_points)::integer
     WHERE id = v_client_id; 
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Atualizar gsa_affiliate_conversion_from_business_event
CREATE OR REPLACE FUNCTION public.gsa_affiliate_conversion_from_business_event()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_row jsonb := to_jsonb(NEW);
  v_status text := lower(coalesce(v_row->>'status', v_row->>'situacao', ''));
  v_attr uuid;
  v_origin uuid;
  v_program text;
  v_value numeric;
  v_gross numeric;
BEGIN
  v_attr := nullif(v_row->>'affiliate_attribution_id', '')::uuid;
  v_origin := nullif(v_row->>'id', '')::uuid;
  IF v_attr IS NULL OR v_origin IS NULL THEN RETURN NEW; END IF;

  SELECT p.codigo INTO v_program
  FROM public.gsa_afiliado_atribuicoes a
  JOIN public.gsa_afiliado_programas p ON p.id = a.programa_id
  WHERE a.id = v_attr;
  IF v_program IS NULL THEN RETURN NEW; END IF;

  IF v_status IN ('pago','paga','confirmado','confirmada','concluido','concluida','ativo','ativa','emitida','aprovado','aprovada') THEN
    v_gross := public.gsa_affiliate_json_numeric(v_row, ARRAY['subtotal_preco_tabela','subtotal_itens','total_contrato','valor_bruto','valor_total_original','valor_total','total']);
    v_value := public.gsa_affiliate_json_numeric(v_row, ARRAY['total','valor_pago','valor_final','valor_liquido','valor','preco_final','premio_total']);

    IF v_gross <= 0 THEN v_gross := v_value; END IF;
    IF v_gross <= 0 THEN v_gross := 0.01; END IF;

    PERFORM public.gsa_affiliate_record_conversion(
      v_attr, 
      v_program, 
      TG_TABLE_NAME, 
      v_origin, 
      'venda', 
      v_gross, 
      v_value, 
      jsonb_build_object('status', v_status, 'valor_bruto', v_gross, 'valor_liquido', v_value)
    );
  ELSIF v_status IN ('cancelado','cancelada','reembolsado','reembolsada','estornado','estornada','rejeitado','rejeitada') THEN
    PERFORM public.gsa_affiliate_reverse_source(v_program, TG_TABLE_NAME, v_origin, v_status);
  END IF;
  RETURN NEW;
END;
$function$;

-- 5. Atualizar gsa_affiliate_record_conversion
CREATE OR REPLACE FUNCTION public.gsa_affiliate_record_conversion(
  p_atribuicao_id uuid,
  p_programa_codigo text,
  p_origem_tipo text,
  p_origem_id uuid,
  p_evento text,
  p_valor_bruto numeric,
  p_base_elegivel numeric,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_attr record;
  v_conversion_id uuid;
  v_commission_id uuid;
  v_commission numeric(14,2);
  v_available_at timestamptz;
  v_gross numeric(14,2);
  v_eligible numeric(14,2);
BEGIN
  IF p_atribuicao_id IS NULL OR p_origem_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_gross := round(greatest(coalesce(p_valor_bruto, p_base_elegivel, 0.01), 0.01), 2);
  v_eligible := round(greatest(coalesce(p_base_elegivel, p_valor_bruto, 0.01), 0.01), 2);

  SELECT
    a.id, a.cliente_id, a.afiliado_id, a.programa_id,
    f.cliente_id AS afiliado_cliente_id, f.status AS afiliado_status,
    p.codigo, p.percentual, p.base_tipo, p.carencia_dias
  INTO v_attr
  FROM public.gsa_afiliado_atribuicoes a
  JOIN public.gsa_afiliados f ON f.id = a.afiliado_id
  JOIN public.gsa_afiliado_programas p ON p.id = a.programa_id
  WHERE a.id = p_atribuicao_id
  FOR UPDATE OF f;

  IF NOT FOUND OR v_attr.codigo <> p_programa_codigo
     OR v_attr.afiliado_status <> 'ativo'
     OR v_attr.afiliado_cliente_id = v_attr.cliente_id THEN
    RETURN NULL;
  END IF;

  -- Nenhuma comissão é zerada. Se o cálculo for 0.00, lança obrigatoriamente R$ 0.01.
  v_commission := greatest(round(v_eligible * v_attr.percentual / 100, 2), 0.01);
  v_available_at := now() + make_interval(days => v_attr.carencia_dias);

  INSERT INTO public.gsa_afiliado_conversoes(
    atribuicao_id, afiliado_id, programa_id, comprador_id,
    origem_tipo, origem_id, evento, valor_bruto, base_elegivel,
    base_tipo_snapshot, metadata
  ) VALUES (
    v_attr.id, v_attr.afiliado_id, v_attr.programa_id, v_attr.cliente_id,
    left(p_origem_tipo, 80), p_origem_id, left(coalesce(p_evento, 'venda'), 60),
    v_gross, v_eligible, v_attr.base_tipo,
    coalesce(p_metadata, '{}'::jsonb)
  )
  ON CONFLICT (programa_id, origem_tipo, origem_id, evento) DO NOTHING
  RETURNING id INTO v_conversion_id;

  IF v_conversion_id IS NULL THEN
    SELECT id INTO v_conversion_id
    FROM public.gsa_afiliado_conversoes
    WHERE programa_id = v_attr.programa_id
      AND origem_tipo = left(p_origem_tipo, 80)
      AND origem_id = p_origem_id
      AND evento = left(coalesce(p_evento, 'venda'), 60);
    RETURN v_conversion_id;
  END IF;

  INSERT INTO public.gsa_afiliado_comissoes(
    conversao_id, afiliado_id, programa_id, percentual_snapshot,
    base_elegivel_snapshot, valor, status, disponivel_em
  ) VALUES (
    v_conversion_id, v_attr.afiliado_id, v_attr.programa_id,
    v_attr.percentual, v_eligible, v_commission,
    CASE WHEN v_available_at <= now() THEN 'disponivel' ELSE 'pendente' END,
    v_available_at
  ) RETURNING id INTO v_commission_id;

  INSERT INTO public.gsa_afiliado_comissao_eventos(
    afiliado_id, comissao_id, tipo, valor_assinado, efetivo_em,
    metadata
  ) VALUES (
    v_attr.afiliado_id, v_commission_id, 'comissao', v_commission,
    v_available_at, jsonb_build_object('conversao_id', v_conversion_id)
  );

  IF v_attr.afiliado_cliente_id IS NOT NULL THEN
    PERFORM set_config('gsa.system_override', 'on', true);
    INSERT INTO public.notificacoes(
      cliente_id,
      titulo,
      mensagem,
      modulo,
      tab,
      item_id,
      destinatario_tipo,
      prioridade,
      acao_origem,
      contexto
    ) VALUES (
      v_attr.afiliado_cliente_id,
      'Sua venda foi realizada com sucesso!',
      format('Sua indicação gerou uma nova venda no valor de R$ %s! Sua comissão é de R$ %s.', 
             to_char(v_gross, 'FM999G999G990D00'), 
             to_char(v_commission, 'FM999G999G990D00')),
      'affiliates',
      'comissoes',
      v_commission_id::text,
      'cliente',
      'alta',
      'venda_afiliado',
      jsonb_build_object(
        'comissao_id', v_commission_id,
        'conversao_id', v_conversion_id,
        'valor_comissao', v_commission,
        'valor_venda_bruto', v_gross,
        'valor_venda_liquido', v_eligible
      )
    );
  END IF;

  RETURN v_conversion_id;
END;
$function$;

-- 6. Atualizar gsa_client_affiliate_snapshot para retornar codigo_referencia das comissões
CREATE OR REPLACE FUNCTION public.gsa_client_affiliate_snapshot(p_sessao_id uuid DEFAULT NULL::uuid, p_session_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_cliente_id uuid;
  v_affiliate public.gsa_afiliados%rowtype;
  v_programs jsonb := '[]'::jsonb;
  v_links jsonb := '[]'::jsonb;
  v_commissions jsonb := '[]'::jsonb;
  v_payouts jsonb := '[]'::jsonb;
  v_summary jsonb;
  v_points numeric := 0;
  v_wallet numeric := 0;
  v_points_rate numeric := 0.01;
  v_points_minimum integer := 100;
  v_points_active boolean := true;
  v_cliente_nome text := '';
  v_cliente_cpf text := '';
BEGIN
  IF p_sessao_id IS NOT NULL AND p_session_token IS NOT NULL THEN
    BEGIN
      SELECT cliente_id INTO v_cliente_id
        FROM public.gsa_client_session_actor(p_sessao_id, p_session_token)
       LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_cliente_id := NULL;
    END;
  END IF;

  IF v_cliente_id IS NULL AND p_sessao_id IS NOT NULL THEN
    SELECT s.ator_id INTO v_cliente_id
      FROM public.sistema_sessoes s
     WHERE s.id = p_sessao_id AND s.status = 'ativo' AND s.ator_tipo = 'cliente'
     LIMIT 1;
  END IF;

  IF v_cliente_id IS NULL THEN
    v_cliente_id := auth.uid();
  END IF;

  PERFORM public.gsa_affiliate_release_due_commissions();

  IF v_cliente_id IS NOT NULL THEN
    SELECT * INTO v_affiliate FROM public.gsa_afiliados WHERE cliente_id = v_cliente_id LIMIT 1;

    SELECT coalesce(c.pontos, 0), coalesce(c.saldo_carteira, 0), coalesce(c.nome, ''), coalesce(c.cpf, c.cnpj, '')
      INTO v_points, v_wallet, v_cliente_nome, v_cliente_cpf
    FROM public.clientes c WHERE c.id = v_cliente_id;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'codigo', p.codigo,
    'nome', p.nome,
    'descricao', p.descricao,
    'percentual', p.percentual,
    'base_tipo', p.base_tipo,
    'caminho_padrao', p.caminho_padrao,
    'janela_atribuicao_dias', p.janela_atribuicao_dias,
    'carencia_dias', p.carencia_dias,
    'saque_minimo', p.saque_minimo,
    'pontos_por_real', p.pontos_por_real,
    'ativo', p.ativo
  ) ORDER BY p.nome), '[]'::jsonb)
  INTO v_programs
  FROM public.gsa_afiliado_programas p
  WHERE p.ativo;

  SELECT coalesce(max(CASE WHEN key = 'afiliado_pontos_resgate_taxa' THEN value::numeric END), 0.01),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_minimo_resgate' THEN value::integer END), 100),
         coalesce(max(CASE WHEN key = 'afiliado_pontos_ativo' THEN value END)::boolean, true)
    INTO v_points_rate, v_points_minimum, v_points_active
  FROM public.system_settings
  WHERE key IN ('afiliado_pontos_resgate_taxa','afiliado_pontos_minimo_resgate','afiliado_pontos_ativo');

  IF v_affiliate.id IS NOT NULL THEN
    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO v_links
    FROM (
      SELECT l.id, l.programa_id, p.codigo AS programa_codigo, p.nome AS programa_nome,
             l.codigo, l.destino, coalesce(l.titulo, p.nome) AS titulo, l.ativo, l.created_at,
             (SELECT count(*) FROM public.gsa_afiliado_cliques c WHERE c.link_id = l.id) AS cliques,
             (SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = l.afiliado_id AND c.programa_id = l.programa_id AND c.status = 'confirmada') AS conversoes,
             (SELECT coalesce(sum(m.valor), 0) FROM public.gsa_afiliado_comissoes m WHERE m.afiliado_id = l.afiliado_id AND m.programa_id = l.programa_id AND m.status <> 'revertida') AS comissao_total
      FROM public.gsa_afiliado_links l
      JOIN public.gsa_afiliado_programas p ON p.id = l.programa_id
      WHERE l.afiliado_id = v_affiliate.id
    ) x;

    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
      INTO v_commissions
    FROM (
      SELECT m.id, p.codigo AS programa_codigo, p.nome AS programa_nome, coalesce(p.carencia_dias, 30) AS carencia_dias,
             c.origem_tipo, c.origem_id, c.base_elegivel, c.valor_bruto,
             m.percentual_snapshot AS percentual, m.valor, m.status,
             (m.created_at + make_interval(days => coalesce(p.carencia_dias, 30))) AS disponivel_em, m.created_at,
             coalesce(
               CASE
                 WHEN c.origem_tipo = 'orcamentos' THEN (SELECT codigo_orcamento FROM public.orcamentos WHERE id = c.origem_id)
                 WHEN c.origem_tipo = 'faturas' THEN (SELECT codigo_fatura FROM public.faturas WHERE id = c.origem_id)
                 WHEN c.origem_tipo = 'viagens_transacoes' THEN (SELECT codigo_reserva_fornecedor FROM public.viagens_transacoes WHERE id = c.origem_id)
                 WHEN c.origem_tipo = 'saude_contratos' THEN (SELECT numero_contrato FROM public.saude_contratos WHERE id = c.origem_id)
                 WHEN c.origem_tipo = 'seguros_apolices' THEN (SELECT numero FROM public.seguros_apolices WHERE id = c.origem_id)
               END,
               'REF-' || upper(right(replace(c.origem_id::text, '-', ''), 8))
             ) AS codigo_referencia
      FROM public.gsa_afiliado_comissoes m
      JOIN public.gsa_afiliado_conversoes c ON c.id = m.conversao_id
      JOIN public.gsa_afiliado_programas p ON p.id = m.programa_id
      WHERE m.afiliado_id = v_affiliate.id
      ORDER BY m.created_at DESC
      LIMIT 300
    ) x;

    SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.solicitado_em DESC), '[]'::jsonb)
      INTO v_payouts
    FROM (
      SELECT s.id, s.valor, s.status, s.pix_tipo_snapshot AS pix_tipo,
             CASE WHEN length(s.pix_chave_snapshot) > 4 THEN repeat('*', greatest(length(s.pix_chave_snapshot) - 4, 4)) || right(s.pix_chave_snapshot, 4) ELSE '****' END AS pix_chave_mascarada,
             s.solicitado_em, s.pago_em,
             CASE WHEN s.notas LIKE 'Ação %' THEN NULL ELSE s.notas END AS motivo
      FROM public.gsa_afiliado_saques s
      WHERE s.afiliado_id = v_affiliate.id
      ORDER BY s.solicitado_em DESC
      LIMIT 200
    ) x;
  END IF;

  SELECT jsonb_build_object(
    'cliques', coalesce((SELECT count(*) FROM public.gsa_afiliado_cliques c JOIN public.gsa_afiliado_links l ON l.id = c.link_id WHERE l.afiliado_id = v_affiliate.id), 0),
    'conversoes', coalesce((SELECT count(*) FROM public.gsa_afiliado_conversoes c WHERE c.afiliado_id = v_affiliate.id AND c.status = 'confirmada'), 0),
    'total_pendente', coalesce((SELECT sum(valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'pendente'), 0),
    'total_disponivel', greatest(
      coalesce((SELECT sum(valor - pago_valor) FROM public.gsa_afiliado_comissoes WHERE afiliado_id = v_affiliate.id AND status = 'disponivel'), 0)
      + v_wallet
      - coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0), 0
    ),
    'total_pago', coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status = 'pago'), 0),
    'total_solicitado', coalesce((SELECT sum(valor) FROM public.gsa_afiliado_saques WHERE afiliado_id = v_affiliate.id AND status IN ('solicitado','aprovado')), 0),
    'saque_minimo', coalesce((SELECT min(p.saque_minimo) FROM public.gsa_afiliado_programas p WHERE p.ativo), 50),
    'pontos', v_points,
    'saldo_carteira', v_wallet,
    'pontos_taxa', v_points_rate,
    'pontos_minimo', v_points_minimum,
    'pontos_ativo', v_points_active
  ) INTO v_summary;

  RETURN jsonb_build_object(
    'success', true,
    'affiliate', CASE WHEN v_affiliate.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id', v_affiliate.id,
      'codigo_publico', v_affiliate.codigo_publico,
      'nome_divulgacao', v_affiliate.nome_divulgacao,
      'nome_completo', v_cliente_nome,
      'cpf', v_cliente_cpf,
      'status', v_affiliate.status,
      'pix_tipo', v_affiliate.pix_tipo,
      'pix_chave', v_affiliate.pix_chave,
      'termos_versao', v_affiliate.termos_versao,
      'termos_aceitos_em', v_affiliate.termos_aceitos_em
    ) END,
    'summary', v_summary,
    'programs', coalesce(v_programs, '[]'::jsonb),
    'links', coalesce(v_links, '[]'::jsonb),
    'commissions', coalesce(v_commissions, '[]'::jsonb),
    'payouts', coalesce(v_payouts, '[]'::jsonb)
  );
END;
$function$;
