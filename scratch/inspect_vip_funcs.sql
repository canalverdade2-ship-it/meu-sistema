-- Imprimir a definicao de gsa_client_subscribe_vip e assinar_area_vip_cliente
SELECT routine_name, routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_name IN ('assinar_area_vip_cliente', 'gsa_client_subscribe_vip');

-- Listar triggers na tabela clientes e client_levels
SELECT tgname, relname, pg_get_triggerdef(pg_trigger.oid)
FROM pg_trigger
JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
WHERE relname IN ('clientes', 'client_levels', 'level_history');
