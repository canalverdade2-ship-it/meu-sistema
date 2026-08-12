SELECT tgname, relname, pg_get_triggerdef(pg_trigger.oid)
FROM pg_trigger
JOIN pg_class ON pg_class.oid = pg_trigger.tgrelid
WHERE relname = 'notificacoes';
