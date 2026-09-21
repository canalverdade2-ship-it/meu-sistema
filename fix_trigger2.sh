PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -t -c "
CREATE OR REPLACE FUNCTION public.gsa_admin_trigger_scraping_now_internal(p_sessao_id text, p_session_token text, p_automacao_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS \$\$
  DECLARE
      v_config record;
      v_result jsonb;
  BEGIN
      SELECT * INTO v_config
      FROM public.automacao_scraping_configs
      WHERE id = p_automacao_id;

      IF NOT FOUND THEN
          RAISE EXCEPTION 'Automação não encontrada';
      END IF;

      DELETE FROM public.automacao_scraping_logs WHERE automacao_id = p_automacao_id;

      INSERT INTO public.automacao_scraping_logs (automacao_id, passo, status, mensagem, progresso)
      VALUES (p_automacao_id, 'iniciando', 'em_andamento', 'Iniciando importador de produtos...', 10);

      UPDATE public.automacao_scraping_configs
      SET ultima_execucao = NOW()
      WHERE id = p_automacao_id;

      SELECT to_jsonb(t) INTO v_result FROM public.automacao_scraping_configs t WHERE t.id = p_automacao_id;
      RETURN v_result;
  END;
\$\$;
"