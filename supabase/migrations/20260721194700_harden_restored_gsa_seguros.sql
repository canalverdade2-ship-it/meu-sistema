BEGIN;

-- A migration de fronteiras administrativas 20260721000500 foi executada
-- antes das tabelas-base de Seguros existirem em produção e, corretamente,
-- ignorou essas relações. Após a restauração, recriamos as políticas
-- restritivas para que colaboradores só acessem o módulo autorizado.

DO $policies$
DECLARE
  v_table text;
  v_policy_name text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'seguros_configuracoes',
    'seguros_parceiros',
    'seguros_produtos',
    'seguros_ofertas',
    'seguros_cotacoes',
    'seguros_cotacao_dados',
    'seguros_propostas',
    'seguros_aceites',
    'seguros_apolices',
    'seguros_documentos',
    'seguros_assessorias',
    'seguros_comissoes',
    'seguros_assistencias',
    'seguros_sinistros',
    'seguros_sinistro_mensagens',
    'seguros_atendimentos',
    'seguros_atendimento_mensagens',
    'seguros_auditoria'
  ]
  LOOP
    IF to_regclass(format('public.%I', v_table)) IS NULL THEN
      RAISE EXCEPTION 'Tabela obrigatória do GSA Seguros ausente: %', v_table;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table);
    v_policy_name := left('gsa_collaborator_module_' || v_table, 63);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_policy_name, v_table);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.gsa_admin_restrict_collaborator_to_module(%L)) WITH CHECK (public.gsa_admin_restrict_collaborator_to_module(%L))',
      v_policy_name,
      v_table,
      'seguros',
      'seguros'
    );
  END LOOP;
END;
$policies$;

CREATE OR REPLACE VIEW public.seguros_ofertas_publicas
WITH (security_barrier = true) AS
SELECT
  p.id,
  p.slug,
  p.nome,
  p.categoria,
  p.resumo,
  p.imagem_url,
  p.preco_referencia,
  p.detalhes,
  p.coberturas,
  p.destaque,
  pa.nome AS parceiro_nome
FROM public.seguros_produtos p
JOIN public.seguros_parceiros pa ON pa.id = p.parceiro_id
WHERE p.status = 'publicado'
  AND pa.status = 'ativo';

REVOKE ALL ON public.seguros_ofertas_publicas FROM PUBLIC;
GRANT SELECT ON public.seguros_ofertas_publicas TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
