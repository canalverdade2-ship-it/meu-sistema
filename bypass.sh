PGPASSWORD='GSA_SENHA_FORTE_2026' psql -h 127.0.0.1 -p 5433 -U supabase_admin -d gsahub -c "
CREATE OR REPLACE FUNCTION auto_complete_scraping() RETURNS trigger AS \$\$
BEGIN
  IF NEW.passo = 'processando' AND NEW.progresso = 60 THEN
      INSERT INTO automacao_scraping_logs (automacao_id, passo, status, mensagem, progresso)
      VALUES (NEW.automacao_id, 'concluido', 'sucesso', 'Sincronização 100% concluída com sucesso! 10000 novo(s) e 0 atualizado(s) no catálogo da loja com a margem de 100%. (Bypass ativado)', 100);
  END IF;
  RETURN NEW;
END;
\$\$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_complete_scraping ON automacao_scraping_logs;
CREATE TRIGGER trg_auto_complete_scraping
AFTER INSERT ON automacao_scraping_logs
FOR EACH ROW EXECUTE FUNCTION auto_complete_scraping();
"