# Relatório Técnico de Investigação: Notificações WhatsApp, Remediação UTF-8 e Fluxo de Recursos

**Autor:** survey_explorer_1 (teamwork_preview_explorer)  
**Data:** 2026-08-28  
**Escopo:** WhatsApp Notifications, Encoding UTF-8, Ciclo de Vida de Resgates e Recursos de Benefícios (`parceiros_resgates`, `parceiros_resgates_recursos`, `parceiros_resgates_eventos`, `n8nWhatsApp.ts`, `whatsappNotificationService.ts`, `vps-api`, `gsa-auth-session`).

---

## 1. Sumário Executivo & Diagnóstico Geral

A investigação do ecossistema de mensageria WhatsApp e processamento de resgates/recursos revelou uma arquitetura híbrida dividida em 3 camadas (Front-end Direct/Cascade, Edge Function Proxy e Database Outbox Worker), com grande robustez conceitual, porém com pontos críticos de atenção:

1. **Codificação UTF-8 & Mojibake:**
   - As mensagens enviadas via API (Evolution API e Webhooks n8n) trafegam via JSON sobre HTTP. A corrupção de caracteres especiais (ex: `NotificaÃ§Ã£o` em vez de `Notificação`) decorre historicamente da ausência de cabeçalho `charset=utf-8` explícito ou de dupla codificação (UTF-8 interpretado como ISO-8859-1/Latin1).
   - Foram identificados múltiplos arquivos TSX (`PartnerRedemptionDetailModal.tsx`, `FornecedoresSection.tsx`) onde caracteres acentuados em português foram corrompidos/truncados em edições passadas (ex: `ativao` por `ativação`, `notificao` por `notificação`, `No` por `Não`, `solicitao` por `solicitação`, `anlise` por `análise`).
2. **Bug Crítico na Edge Function `vps-api`:**
   - No arquivo `supabase/functions/vps-api/index.ts` (linha 314), o fallback para o webhook n8n utiliza a variável `phone: formattedPhone`, que **não foi declarada no escopo**, disparando um `ReferenceError` em tempo de execução quando a Evolution API falha e aciona o fallback n8n.
3. **Fluxo de Recurso ("Entrar com recurso" / Appeals):**
   - A base de dados (`supabase/migrations/20260828170000_partner_redemption_appeals.sql`) já possui toda a estrutura relacional e RPCs prontas (`parceiros_resgates_recursos`, `parceiros_resgates_eventos`, `parceiros_resgates_notificacoes`, `parceiros_resgates_public_status`, `parceiros_resgates_recurso_desafios`).
   - A Edge Function `gsa-auth-session` já implementa `request_partner_appeal`, `submit_partner_appeal` e `process_partner_appeal_outbox`.
   - **Lacuna no Frontend do Cliente (`ProtocolConsultPage.tsx`):** A página pública exibe apenas uma mensagem estática de recusa quando `status === 'recusado'`, sem o botão ou modal interativo para solicitar o código por WhatsApp e submeter a contestação/anexos.
   - **Admin Modal (`PartnerRedemptionDetailModal.tsx`):** Já possui os botões de decisão de recurso, mas possui strings com acentuação quebrada e necessita de visualização aprimorada de evidências/anexos e timeline de eventos.

---

## 2. Arquitetura de Notificações WhatsApp (3 Canais de Disparo)

O sistema possui três mecanismos complementares de envio:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       ARQUITETURA DE DISPARO WHATSAPP                       │
└─────────────────────────────────────────────────────────────────────────────┘

[ 1. CLIENT / ADMIN DIRECT (Cascade) ]
  src/lib/whatsappNotificationService.ts & src/utils/n8nWhatsApp.ts
       │
       ├── Tier 1 (Port 8080): Direct fetch to Evolution API (/message/sendText, /message/sendMedia)
       │                        Headers: { apikey, "Content-Type": "application/json" }
       │
       ├── Tier 2 (Edge Function): supabase.functions.invoke('vps-api', { action: 'send-whatsapp' })
       │                            Proxy seguro no Deno runtime
       │
       └── Tier 3 (Port 5678): Direct fetch to n8n webhook (/webhook/send-whatsapp)
                                Headers: { "Content-Type": "application/json" }

[ 2. TRANSACTIONAL DB OUTBOX ]
  Database RPCs (gsa_complete_partner_appeal, gsa_admin_decide_partner_appeal, etc.)
       │
       ▼
  Tabela public.parceiros_resgates_notificacoes (status: 'pendente')
       │
       ▼
  Edge Function gsa-auth-session (action: 'process_partner_appeal_outbox')
       │ (Acionado por Cron / n8n Schedule Trigger a cada minuto)
       ▼
  Evolution API (/message/sendText) -> WhatsApp do Cliente/Admin
```

### 2.1 Detalhamento dos Arquivos de Mensageria

| Arquivo | Papel / Responsabilidade | Payload / Método | Observações |
|---|---|---|---|
| `src/utils/n8nWhatsApp.ts` | Notificações administrativas (Master Admin) | Invoca Edge Function `vps-api` (`action: 'send-whatsapp'`) | Formata cabeçalho `[CATEGORIA]`, data PT-BR e envia para `whatsapp_admin_notificacoes`. |
| `src/lib/whatsappNotificationService.ts` | Motor de notificações de clientes e vouchers | Cascata 3-Tier (Evo direct -> `vps-api` -> n8n) | Suporta variações de saudação, randomizador de URLs, injeção de zero-width entropy, envio de mídia (banner/logo) e envio direto de texto. |
| `supabase/functions/vps-api/index.ts` | Edge Function de proxy para a VPS Oracle | POST `action: 'send-whatsapp'` | Envia para Evolution API (147.15.43.141:8080) e n8n (147.15.43.141:5678). **Contém bug na linha 314 (`formattedPhone`).** |
| `supabase/functions/gsa-auth-session/index.ts` | Edge Function para auth e fluxo de recursos | Ações: `request_partner_appeal`, `submit_partner_appeal`, `process_partner_appeal_outbox` | Dispara código de verificação de 6 dígitos via WhatsApp e processa fila de saída (`parceiros_resgates_notificacoes`). |
| `src/features/partners/service.ts` | Camada de serviço de parceiros e resgates | Métodos de integração com RPCs e WhatsApp | Orquestra `redeemPartnerBenefit`, `completePartnerRedemption`, `approveRedemption`, `rejectRedemption`, `submitPartnerAppeal`, `decidePartnerAppeal`. |

---

## 3. Investigação de Codificação UTF-8 & Remediação de Mojibake

### 3.1 Causa Raiz do Mojibake ("NotificaÃ§Ã£o")
O padrão `Ã§` ocorre quando o byte sequence de `ç` em UTF-8 (`0xC3 0xA7`) é interpretado como dois caracteres individuais da tabela ISO-8859-1/Latin-1:
- `0xC3` = `Ã`
- `0xA7` = `§`

Da mesma forma:
- `ã` (`0xC3 0xA3`) -> `Ã£`
- `á` (`0xC3 0xA1`) -> `Ã¡`
- `é` (`0xC3 0xA9`) -> `Ã©`
- `í` (`0xC3 0xAD`) -> `Ã­`
- `ó` (`0xC3 0xB3`) -> `Ã³`
- `ú` (`0xC3 0xBA`) -> `Ãº`
- `õ` (`0xC3 0xB5`) -> `Ãµ`
- `º` (`0xC2 0xBA`) -> `Âº`
- `ª` (`0xC2 0xAA`) -> `Âª`

### 3.2 Varredura de Arquivos com Problemas de Encoding
Na varredura da base, os arquivos de código-fonte contêm os seguintes problemas:

1. **`src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx`**:
   - Linha 187: `'Recurso aprovado. A solicitao voltou ao fluxo de andamento.'` -> `"solicitação"`
   - Linha 192: `'No foi possível registrar a decisão do recurso.'` -> `"Não"`
   - Linha 202: `'Informe o link de ativao gerado...'` -> `"ativação"`
   - Linha 225: `'✅ Link de ativao salvo e enviado...'` -> `"ativação"`
   - Linha 229: `'Link de ativao salvo no cadastro!'` -> `"ativação"`
   - Linha 236: `'Erro ao salvar link de ativao.'` -> `"ativação"`
   - Linha 267: `'✅ Notificao oficial de WhatsApp reenviada...'` -> `"Notificação"`
   - Linha 271: `'No foi possível reenviar...'` -> `"Não"`
   - Linha 470: `'0h (Solicitao)'` -> `"Solicitação"`
   - Linha 547: `'No informado'` -> `"Não informado"`
   - Linha 621: `'Solicitao Recusada'` -> `"Solicitação Recusada"`
   - Linha 663: `'Prazo de anlise'` -> `"Prazo de análise"`
   - Linha 671: `'Contestao apresentada'` -> `"Contestação apresentada"`
   - Linha 685: `'Fundamentao da decisão'` -> `"Fundamentação da decisão"`
   - Linha 790/794/796: `'Link de Ativao'`, `'notificao'` -> `"Ativação"`, `"notificação"`

2. **`src/components/admin/super-domains/pessoas/FornecedoresSection.tsx`**:
   - Múltiplas ocorrências de `liberao` (`liberação`), `ativao` (`ativação`), `notificao` (`notificação`), `No` (`Não`), `benefcio` (`benefício`), `informaes` (`informações`), `anlise` (`análise`).

3. **`supabase/functions/vps-api/index.ts`**:
   - `json()` helper define corretamente `'content-type': 'application/json; charset=utf-8'`.
   - Porém, a linha 314 referencia a variável inexistente `formattedPhone`. Deve ser corrigida para `targetDestination` ou `phone`.

4. **Diretriz Estrita para Mensagens WhatsApp**:
   - Todas as strings em templates de mensagem devem ser literais UTF-8 diretos em TypeScript (`"Olá"`, `"Notificação"`, `"Benefício"`).
   - Ao trafegar via `fetch` HTTP POST JSON, o cabeçalho `'Content-Type': 'application/json; charset=utf-8'` garante que o body não seja re-encodado como ASCII/Latin1.
   - NUNCA aplicar `unescape(encodeURIComponent(...))` ou conversões via Buffer binário em strings de texto simples.

---

## 4. Mapeamento de Eventos e Triggers (Ciclo de Vida de Resgates & Recursos)

### 4.1 Ciclo de Vida do Resgate (`parceiros_resgates`)

| Evento / Status | Ação / Origem | Destinatário WhatsApp | Mensagem / Conteúdo | Canal de Disparo |
|---|---|---|---|---|
| **Resgate Solicitado (Modo 24h)** | Cliente submete form no site público | 1. Cliente<br>2. Master Admin | 1. Boas-vindas, protocolo, aviso de ativação em até 24h.<br>2. Alerta de novo resgate pendente com protocolo. | 1. `whatsappNotificationService.enviarWhatsAppDireto`<br>2. `sendAdminWhatsAppNotification` |
| **Resgate Solicitado (Imediato)** | Cliente submete form no site público | Cliente | Confirmação imediata com Cupom/Link/Instruções. | `whatsappNotificationService.enviarWhatsAppDireto` |
| **Resgate Concluído / Aprovado** | Admin insere Link de Ativação no Painel | Cliente | Notificação oficial rica com link oficial, cupom/voucher e banner do parceiro. | `whatsappNotificationService.enviarWhatsAppDireto` |
| **Resgate Recusado** | Admin clica "Recusar" e informa motivo | Cliente | Informa recusa, motivo e instrui sobre a possibilidade de apresentar 1 recurso com protocolo. | Inserido em `parceiros_resgates_notificacoes` via `gsa_admin_set_partner_redemption_status` |

### 4.2 Ciclo de Vida do Recurso (`parceiros_resgates_recursos`)

| Evento / Status | Ação / Origem | Destinatário WhatsApp | Mensagem / Conteúdo | Canal de Disparo |
|---|---|---|---|---|
| **Desafio de Código de Recurso** | Cliente clica "Entrar com recurso" na página pública | Cliente | Código numérico de 6 dígitos (expira em 10 min) para validação de titularidade do telefone. | Edge Function `gsa-auth-session` -> Evolution API |
| **Recurso Submetido (`recurso_interposto`)** | Cliente valida PIN e envia contestação | 1. Cliente<br>2. Master Admin | 1. Confirmação de recebimento do recurso com prazo de análise de 5 dias e número do recurso (`REC-2026-XXXX`).<br>2. Alerta ao Admin sobre novo recurso interposto. | DB Outbox `parceiros_resgates_notificacoes` via `gsa_complete_partner_appeal` |
| **Recurso Deferido / Aprovado (`recurso_deferido`)** | Admin clica "Aprovar Recurso" no painel | Cliente | Notificação informando que o recurso foi aprovado e a solicitação voltou ao fluxo de andamento (status `pendente`). | DB Outbox `parceiros_resgates_notificacoes` via `gsa_admin_decide_partner_appeal` |
| **Recurso Indeferido / Negado (`recurso_indeferido`)** | Admin clica "Recusar Recurso" com fundamentação | Cliente | Notificação informando o veredito final com o motivo fundamentado pelo Administrador. | DB Outbox `parceiros_resgates_notificacoes` via `gsa_admin_decide_partner_appeal` |
| **Alerta de SLA 24h / Vencido** | Job periódico avalia prazos | Master Admin | Lembrete de prazo (<24h) ou alerta de SLA expirado para recursos pendentes. | DB Outbox via `gsa_schedule_partner_appeal_sla_notifications` |

---

## 5. Estrutura de Payloads, Telefones e Templates

### 5.1 Especificação de Payload para Webhooks n8n (Porta 5678)

```json
{
  "phone": "5511971858372",
  "message": "🚨 *GSA HUB - Notificação Administrativa*\n\n[FORNECEDORES] *Novo Resgate: Pet Shop Exemplo*\n\nO cliente *Adriano Farias* solicitou o benefício...\n\n📅 28/08/2026 16:30:00\n\n_Mensagem enviada via GSA HUB._",
  "title": "Novo Resgate: Pet Shop Exemplo",
  "category": "FORNECEDORES",
  "timestamp": "2026-08-28T19:30:00.000Z"
}
```

### 5.2 Especificação de Payload para Evolution API (Porta 8080)

**Envio de Texto Simples (`/message/sendText/GSA_WhatsApp`):**
```json
{
  "number": "5511971858372",
  "text": "🎉 *SEU BENEFÍCIO JÁ ESTÁ DISPONÍVEL!* 🐾\n\nOlá, *Adriano*! 🌟\n...",
  "delay": 500,
  "linkPreview": true
}
```

**Envio de Mídia / Imagem (`/message/sendMedia/GSA_WhatsApp`):**
```json
{
  "number": "5511971858372",
  "mediatype": "image",
  "mimetype": "image/png",
  "caption": "🎉 *SEU BENEFÍCIO JÁ ESTÁ DISPONÍVEL!* 🐾\n...",
  "media": "https://.../capa.png",
  "fileName": "banner-beneficio.png",
  "delay": 500
}
```

### 5.3 Regras de Normalização de Telefone
- O número é sanitizado removendo qualquer caractere não numérico: `raw.replace(/\D/g, '')`.
- Se o número tiver 10 ou 11 dígitos e não iniciar com `55`, adiciona-se o DDI brasileiro: `55${clean}`.
- Tratamento especial para números com `@lid` (Evolution API Baileys LID para garantir entrega): `38830967099420@lid`.

---

## 6. Lacunas Identificadas & Recomendações para Implementação

| Área | Arquivo / Componente | Lacuna Observada | Ação Recomendada |
|---|---|---|---|
| **R1. Frontend do Cliente** | `src/components/public/ProtocolConsultPage.tsx` | Falta o botão "Entrar com recurso" quando o status é `recusado`, o modal de desafio por WhatsApp (PIN de 6 dígitos) e o formulário de contestação com upload de até 3 evidências. | Implementar o fluxo de recurso completo em `ProtocolConsultPage.tsx` integrando com `requestPartnerAppealVerification` e `submitPartnerAppeal`. Atualizar subscrição Realtime para `parceiros_resgates_public_status`. |
| **R2. Frontend do Administrador** | `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` & `FornecedoresSection.tsx` | Caracteres acentuados corrompidos em português; necessidade de exibir histórico de eventos (`parceiros_resgates_eventos`) e dados detalhados do recurso. | Corrigir todas as strings para UTF-8 válido com acentuação estrita e integrar histórico público da timeline de eventos. |
| **R3. Notificações WhatsApp** | `supabase/functions/vps-api/index.ts` | Variável `formattedPhone` inexistente causa `ReferenceError` no fallback n8n. | Corrigir linha 314 para `phone: targetDestination` ou `phone`. |
| **R3. UTF-8 WhatsApp** | `src/utils/n8nWhatsApp.ts` & `src/lib/whatsappNotificationService.ts` | Assegurar que nenhuma rotina altere ou converta strings de forma destrutiva para evitar mojibake em caracteres especiais. | Manter headers com `charset=utf-8` e templates literais UTF-8. |

---

## 7. Conclusão da Investigação

A infraestrutura de banco de dados e backend já está bem modelada e pronta para suportar o fluxo completo de recursos e disparos transacionais. Os ajustes prioritários concentram-se na interface do usuário (R1 no cliente público e R2 no modal do ADM), na correção cirúrgica do bug na Edge Function `vps-api` (R3) e na restauração da integridade dos textos em português UTF-8 nos arquivos TSX.
