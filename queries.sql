\x on

SELECT proname, pg_get_functiondef(pg_proc.oid) 
FROM pg_proc JOIN pg_namespace n ON n.oid=pronamespace 
WHERE nspname='public' AND proname IN ('gsa_client_request_withdrawal', 'gsa_client_cancel_withdrawal');

SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name IN ('saques', 'carteira_lancamentos') AND table_schema='public'
ORDER BY table_name, ordinal_position;

SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname='public' AND tablename IN ('saques','carteira_lancamentos','extrato_financeiro');

SELECT tablename, policyname, roles, cmd, qual, with_check 
FROM pg_policies 
WHERE tablename IN ('saques','carteira_lancamentos','extrato_financeiro');

SELECT key, value 
FROM system_settings 
WHERE key = 'valor_minimo_saque';
