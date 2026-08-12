-- Inspecionar tabelas, triggers e RPCs relacionadas a VIP
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND (table_name LIKE '%vip%' OR table_name LIKE '%level%' OR table_name = 'clientes')
ORDER BY table_name, ordinal_position;

SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND (routine_name LIKE '%vip%' OR routine_name LIKE '%level%');
