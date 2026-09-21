## 2026-08-28T19:28:23Z
Investigate the codebase regarding WhatsApp Notifications & UTF-8 Encoding Remediation.
- Specifically investigate `src/utils/n8nWhatsApp.ts` and all files sending WhatsApp messages / webhooks across the project.
- Search for any UTF-8 encoding/decoding corruption (e.g. latin1/utf8 misinterpretation, encodeURIComponent, unescape, string conversion issues leading to "Ã§", "Ã£o", broken accents).
- Find all notification triggers for redemptions (solicitado, aprovado, recusado) and identify what functions/events need to be implemented for appeal flow ("recurso_aberto" / "confirmacao_recurso", "recurso_aprovado" / "recurso_aceito", "recurso_negado").
- Check the payload structure expected by n8n webhooks, how phone numbers are formatted, template messages, and response handling.
- Check if there are Supabase Edge Functions or database webhooks or client-side fetch calls doing the dispatch.
- Output survey findings to survey_report.md and handoff.md.
