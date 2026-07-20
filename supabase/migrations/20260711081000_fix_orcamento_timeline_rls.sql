DROP POLICY IF EXISTS "orcamento_timeline_select_public" ON public.orcamento_timeline;
CREATE POLICY "orcamento_timeline_select_public"
  ON public.orcamento_timeline
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "orcamento_timeline_insert_public" ON public.orcamento_timeline;
CREATE POLICY "orcamento_timeline_insert_public"
  ON public.orcamento_timeline
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "orcamento_timeline_update_public" ON public.orcamento_timeline;
CREATE POLICY "orcamento_timeline_update_public"
  ON public.orcamento_timeline
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_timeline TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_timeline TO authenticated;
GRANT ALL ON public.orcamento_timeline TO service_role;
