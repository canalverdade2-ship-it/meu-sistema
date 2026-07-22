BEGIN;

-- Permite leitura pública (anon e authenticated) na tabela de candidaturas para consulta de protocolo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'gsa_careers_applications' AND policyname = 'gsa_careers_public_select'
  ) THEN
    CREATE POLICY gsa_careers_public_select ON public.gsa_careers_applications
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

GRANT SELECT ON public.gsa_careers_applications TO anon, authenticated;

COMMIT;
