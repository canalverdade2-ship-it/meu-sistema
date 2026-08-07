-- Restaura configuracao de webhook do WhatsApp na tabela system_settings para a VPS com a Evolution API ativa (163.176.97.152)
UPDATE public.system_settings
SET value = REPLACE(value, '147.15.43.141', '163.176.97.152')
WHERE key = 'whatsapp_n8n_webhook_url' OR value LIKE '%147.15.43.141%';
