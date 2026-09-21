
BEGIN;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO service_role;

DROP POLICY IF EXISTS "service_role_all_payments" ON public.gsa_calculator_pro_payments;
CREATE POLICY "service_role_all_payments" ON public.gsa_calculator_pro_payments FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_events" ON public.gsa_calculator_pro_events;
CREATE POLICY "service_role_all_events" ON public.gsa_calculator_pro_events FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_vouchers" ON public.gsa_calculator_pro_vouchers;
CREATE POLICY "service_role_all_vouchers" ON public.gsa_calculator_pro_vouchers FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_grants" ON public.gsa_calculator_pro_grants;
CREATE POLICY "service_role_all_grants" ON public.gsa_calculator_pro_grants FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_sessions" ON public.gsa_calculator_pro_sessions;
CREATE POLICY "service_role_all_sessions" ON public.gsa_calculator_pro_sessions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_runtime_config" ON public.gsa_calculator_pro_runtime_config;
CREATE POLICY "service_role_all_runtime_config" ON public.gsa_calculator_pro_runtime_config FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_products" ON public.gsa_calculator_pro_products;
CREATE POLICY "service_role_all_products" ON public.gsa_calculator_pro_products FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;
