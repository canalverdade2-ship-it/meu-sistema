\pset pager off
SELECT pg_get_functiondef(p.oid) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE nspname='public' AND proname = 'gsa_client_convert_points';

