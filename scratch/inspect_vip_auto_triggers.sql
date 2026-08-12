-- Verificar se existe trigger ou função que atualiza nivel_id quando pontos_totais muda
SELECT tgname, relname, pg_get_triggerdef(pg_trigger.oid)
FROM pg_trigger
JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
WHERE relname = 'clientes'
  AND (pg_get_triggerdef(pg_trigger.oid) LIKE '%pontos%' OR pg_get_triggerdef(pg_trigger.oid) LIKE '%nivel%');

-- Verificar definição de funções de pontos
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname LIKE '%nivel%' OR proname LIKE '%pontos%' OR proname LIKE '%vip%';
