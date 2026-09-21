
BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT ON public.gsa_calculator_pro_products TO anon, authenticated, service_role;
GRANT SELECT ON public.gsa_calculator_pro_runtime_config TO anon, authenticated, service_role;

DROP POLICY IF EXISTS "Public select on gsa_calculator_pro_products" ON public.gsa_calculator_pro_products;
CREATE POLICY "Public select on gsa_calculator_pro_products"
  ON public.gsa_calculator_pro_products
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

DROP POLICY IF EXISTS "Public select on gsa_calculator_pro_runtime_config" ON public.gsa_calculator_pro_runtime_config;
CREATE POLICY "Public select on gsa_calculator_pro_runtime_config"
  ON public.gsa_calculator_pro_runtime_config
  FOR SELECT
  TO anon, authenticated, service_role
  USING (true);

COMMIT;
