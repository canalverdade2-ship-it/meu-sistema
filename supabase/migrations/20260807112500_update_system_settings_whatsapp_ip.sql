-- Atualiza configuracao de webhook do WhatsApp na tabela system_settings para a nova VPS (147.15.43.141)
UPDATE public.system_settings
SET value = REPLACE(value, '163.176.97.152', '147.15.43.141')
WHERE key = 'whatsapp_n8n_webhook_url' OR value LIKE '%163.176.97.152%';
