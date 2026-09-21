# DISPATCH - Explorer Survey Public & WhatsApp

Objective: Investigate and audit the public partner redemption flow and WhatsApp notifications.

Scope:
- Public partners page & redemption modal: `src/components/public/PartnersPage.tsx`, `src/components/public/PartnerRedemptionModal.tsx` (or related components).
- Mandatory data collection: Full Name (`nome_completo`), Email (`email`), WhatsApp with DDD (`telefone`).
- Protocol generator: verify official format `PROT-RES-YYYY-XXXXXX`.
- Pop-up confirmation behavior: Mode 24 Hours (with 24h deadline, orientations, SLA) vs Immediate Mode (coupon code, direct link, auto redirect).
- WhatsApp notification triggers: verify client notification payload/message format and admin alert format with all details and protocol.
- Identify edge cases, missing validations, or integration gaps.

Input Files:
- c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md
- `src/components/public/`
- `src/services/` or `src/utils/` related to WhatsApp and redemption

Output:
- Write comprehensive report to `.agents/teamwork_preview_explorer_survey_public/handoff.md`.
