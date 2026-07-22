BEGIN;

-- Esta migration não recria o domínio. O SQL de origem foi preservado em
-- 20260722040000_affiliate_program.sql e é aplicado pelo workflow protegido de
-- reconciliação com fechamento transacional explícito. Este arquivo comprova
-- o estado final e fornece uma versão única para o histórico remoto.
DO $$
DECLARE
  v_table text;
  v_program_count integer;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'gsa_afiliado_programas',
    'gsa_afiliados',
    'gsa_afiliado_links',
    'gsa_afiliado_cliques',
    'gsa_afiliado_atribuicoes',
    'gsa_afiliado_conversoes',
    'gsa_afiliado_comissoes',
    'gsa_afiliado_saques',
    'gsa_afiliado_comissao_eventos'
  ] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Tabela obrigatória do programa de afiliados ausente: %', v_table;
    END IF;
  END LOOP;

  IF to_regprocedure('public.gsa_public_affiliate_programs()') IS NULL
     OR to_regprocedure('public.gsa_public_track_affiliate_click(text,text,text,text)') IS NULL
     OR to_regprocedure('public.gsa_client_bind_affiliate_click(uuid,text,text)') IS NULL
     OR to_regprocedure('public.gsa_affiliate_current_attribution(uuid,text)') IS NULL
     OR to_regprocedure('public.gsa_affiliate_record_conversion(uuid,text,text,uuid,text,numeric,numeric,jsonb)') IS NULL
     OR to_regprocedure('public.gsa_affiliate_reverse_source(text,text,uuid,text)') IS NULL THEN
    RAISE EXCEPTION 'Funções obrigatórias do programa de afiliados ausentes';
  END IF;

  SELECT count(DISTINCT codigo)
    INTO v_program_count
    FROM public.gsa_afiliado_programas
   WHERE codigo IN ('loja','viagens','classificados','servicos','saude','seguros');

  IF v_program_count <> 6 THEN
    RAISE EXCEPTION 'Catálogo inicial do programa de afiliados incompleto';
  END IF;
END $$;

COMMIT;
