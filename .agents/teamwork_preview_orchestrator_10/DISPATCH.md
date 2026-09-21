# Dispatch Instructions

## 2026-08-27T18:31:28Z
You are the Project Orchestrator for this task.

Working Directory: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\teamwork_preview_orchestrator_10
User Request File: c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md (see the latest entry at timestamp 2026-08-27T18:30:11Z)

Task Summary:
Implement stability and humanization improvements for WhatsApp notifications via Evolution API in GSA HUB:
- R1: Humanização da Experiência (Presence Choreography in `src/lib/whatsappNotificationService.ts`: initial random delay 4-12s, mark as read receipt if replying, available presence, composing 4s -> paused 2s -> composing 3s, send message, unavailable presence).
- R2: Geração Dinâmica de Conteúdo (dynamic greetings/footers with invisible zero-width spaces \u200B for string uniqueness, query params ?t=[ts]&ref=[rand] on links, safe random byte appended to generated/prepared PDFs to make hash unique without corrupting).
- R3: Controle de Concorrência e Agrupamento (micro-jitter delays between concurrent requests to different numbers; message batching/grouping with line breaks when multiple messages target the same number simultaneously).
- R4: Rotina de Manutenção de Conexão (Keep-Alive periodic check of Evolution API connection state to keep WebSocket alive and monitor health).
- R5: Painel de Monitoramento (GSA OS) - Component `WhatsAppHealthMonitor.tsx` in admin panel displaying connection status and a "Pause Dispatch" toggle to hold messages in local queue without discarding.

Acceptance Criteria:
- npm run typecheck:strict passes with exit code 0.
- Fallback architecture (Evolution API -> Edge Function VPS -> n8n) is preserved.
- Delays are non-blocking / asynchronous.
- Message strings & PDF buffer hashes are unique.
- WhatsAppHealthMonitor renders correctly and pause button pauses queue dispatch.
- Write and run unit/integration tests to validate all requirements.
