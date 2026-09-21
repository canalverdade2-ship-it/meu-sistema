# HANDOFF REPORT — API DYNAMIC TESTING EXPLORATION (MILESTONE 2)

**Subagente**: `teamwork_preview_explorer_m2_2`  
**Destinatário**: `parent` (`aee1e48f-27d4-4a89-8920-4c9e6d36d372`)  
**Data**: 2026-09-16  
**Tipo de Handoff**: **Hard Handoff** (Tarefa de Exploração Concluída com Sucesso)  
**Relatório Principal**: `.agents/teamwork_preview_explorer_m2_2/analysis.md`  

---

## 1. OBSERVATION (O que foi diretamente observado)

1. **Catálogo Completo de Endpoints**:
   - Foram auditadas as **17 Supabase Edge Functions** em `supabase/functions/` (`cloudflare-api`, `gsa-ads-admin`, `gsa-ads-public`, `gsa-auth-session`, `gsa-careers-notifications`, `gsa-classified-media`, `gsa-free-tools`, `gsa-partner-application`, `gsa-payments`, `gsa-product-import`, `gsa-public-budget`, `gsa-transactional-email`, `gsa-trigger-webhook`, `gsa-tv-proxy`, `gsa-whatsapp-inbound`, `ssh-proxy`, `vps-api`).
   - Foram auditadas as **15 rotas do servidor VPS** em `server_webhook.cjs` (linhas 9316 a 9450):
     - `GET /`, `GET /health`, `GET /ping` (linhas 9323-9331)
     - `GET /feeds/viagens`, `GET /feeds/viagens/nacionais`, `GET /feeds/viagens/internacionais`, `GET /feeds/viagens/promoc`, `GET /feeds/viagens/*.csv` (linhas 9334-9360)
     - `GET /api/dropship-search` (linhas 9363-9405)
     - `GET /webhook` (linhas 9408-9421)
     - `POST /webhook` (linhas 9424-9450)
     - `POST /webhook/supabase-update` (linha 9434 e linhas 9151-9313)
     - `POST /webhook/gsa-produtos-scraping` (linha 9438)
     - `POST /webhook/gsa-viagens-scraping` (linha 9438)
     - `POST /webhook/scraping` (linha 9438)
   - Foram auditadas as **10 integrações externas** listadas em `INVENTARIO_COMPLETO.md` (linhas 1486-1500): Evolution API text/media/state, n8n webhook fallback, InfinitePay checkout, Cloudflare R2 CDN, Cloudflare R2 Worker Auth, Google Gemini Flash NLU, ViaCEP e BrasilAPI.

2. **Verificação Empírica das Ferramentas Existentes**:
   - Comando executado: `npx tsx scripts/verify-integrations-webhooks.ts`
     - **Resultado Verbatim**:
       ```text
       ================================================================================
       🔌 GSA HUB — INTEGRATIONS & WEBHOOKS SANITY CHECK
       ================================================================================
       📊 Total checks: 10 | ✅ Passed: 10 | ❌ Failed: 0
       ✅ [WEBHOOK_SYNTAX] server_webhook.cjs: Sintaxe JavaScript V8 válida (node --check passou com sucesso).
       ✅ [CONCURRENCY_MUTEX] server_webhook.cjs: Proteção contra race condition de mensagens simultâneas detectada (Mutex/Queue).
       ✅ [AUTH_JWT_FALLBACK] server_webhook.cjs: Gerenciamento seguro de token de serviço (lê de variáveis de ambiente com fallback).
       ✅ [ATOMIC_OPERATIONS] server_webhook.cjs: Operações de pontos utilizam RPC/função atômica contra RMW (Read-Modify-Write).
       ✅ [WEBHOOK_SYNTAX] server_webhook_vps_live.cjs: Sintaxe JavaScript V8 válida (node --check passou com sucesso).
       ✅ [CONCURRENCY_MUTEX] server_webhook_vps_live.cjs: Proteção contra race condition de mensagens simultâneas detectada (Mutex/Queue).
       ✅ [AUTH_JWT_FALLBACK] server_webhook_vps_live.cjs: Gerenciamento seguro de token de serviço (lê de variáveis de ambiente com fallback).
       ✅ [ATOMIC_OPERATIONS] server_webhook_vps_live.cjs: Operações de pontos utilizam RPC/função atômica contra RMW (Read-Modify-Write).
       ✅ [INTEGRATION_CLIENT] src/utils/n8nWhatsApp.ts: Módulo de integração src/utils/n8nWhatsApp.ts possui tratamento de erro robusto (try/catch).
       ✅ [INTEGRATION_CLIENT] src/lib/whatsappVariationService.ts: Módulo de integração src/lib/whatsappVariationService.ts possui tratamento de erro robusto (try/catch).
       ```
   - Comando executado: `npx tsx scripts/verify-utf8-encoding.ts`
     - **Resultado Verbatim**:
       - 26 violações de encoding encontradas no total:
         - `src/components/admin/demandas/DemandasDashboard.tsx`: 6 ocorrências de `\uFFFD` (linhas 79, 97, 110, 112, 137).
         - `scripts/check-gsa-tv-contracts.ts`: 18 ocorrências de mojibake (ex: `mutaÃ§Ã£o`, `nÃ£o`).
         - `scripts/adversarial-frontend-stress-test.mjs` e `scripts/adversarial-targeted-check.mjs`: 1 regex de mojibake cada.

3. **Conectividade e Provas de Rede Vivas**:
   - `curl.exe -s --connect-timeout 5 http://147.15.43.141:8080/instance/connectionState/GSA_WhatsApp`:
     - Retornou: `{"status":401,"error":"Unauthorized","response":{"message":"Unauthorized"}}`
     - Comprovou que a VPS está ativa e a Evolution API rejeita conexões anônimas com HTTP 401.
   - `curl.exe -s --connect-timeout 5 https://viacep.com.br/ws/01001000/json/`:
     - Retornou: `{"cep": "01001-000", "logradouro": "Praça da Sé", "localidade": "São Paulo", ...}`
   - `curl.exe -s --connect-timeout 5 https://brasilapi.com.br/api/cnpj/v1/00000000000191`:
     - Retornou dados corporativos completos do Banco do Brasil com status 200.

4. **Proteções de Concorrência e Segurança Inspecionadas no Código**:
   - `SessionMutex`: `server_webhook.cjs`, linhas 45-84. Fila FIFO sequencial por telefone.
   - Fallback de Service Role: `server_webhook.cjs`, linha 15.
   - Atomicidade de Pontos: `server_webhook.cjs`, linha 5117 chamando `gsa_converter_pontos_carteira`.
   - Proteção SSRF: `supabase/functions/gsa-product-import/index.ts` e `_shared/ssrf_validator.ts`.
   - Limites de Tamanho de Payload: `gsa-auth-session` (8 KB), `gsa-ads-public` (32 KB), `gsa-ads-admin` (128 KB).
   - Rate Limiting de Balde Duplo: `gsa-auth-session`, linhas 41-94.

---

## 2. LOGIC CHAIN (Raciocínio Lógico Passo a Passo)

1. **Premissa 1 (Completude de Escopo)**: O relatório `RELATORIO_TESTES_API.md` deve cobrir 100% dos 42 endpoints (17 Edge Functions, 15 rotas de webhook VPS, 10 integrações externas) para cumprir as Regras de Ouro 3, 4 e 13 e o Requisito R4 do ORIGINAL_REQUEST.md.
2. **Premissa 2 (Metodologia de Teste Dinâmico Genuíno)**: Conforme a Regra de Ouro 4 e a Proibição de Mascaramento de Falhas (R2), os testes não podem usar mocks passantes estáticos para fingir sucesso. Para cada endpoint, devem ser avaliados o cenário positivo (happy path), o cenário negativo (autenticação, permissão, corpo malformado, rate limit) e a integridade UTF-8.
3. **Premissa 3 (Diferenciação de Ambientes de Execução)**: As Edge Functions rodam em Deno na VPS remota (`147.15.43.141`), enquanto o `server_webhook.cjs` roda no Node.js da VPS ou pode ser instanciado em porta de teste isolada localmente (ex: porta 5689) pelo Worker para testes de integração imediatos. As integrações públicas (ViaCEP, BrasilAPI) são testáveis ao vivo via HTTP.
4. **Premissa 4 (Rastreamento de Falhas Reais)**: O baseline detectou que `DemandasDashboard.tsx` possui 6 caracteres corrompidos `\uFFFD`. O plano de testes de API inclui asserções obrigatórias de integridade UTF-8 em todos os despachos para garantir que mensagens e webhooks não introduzam ou propaguem mojibake.
5. **Conclusão Lógica**: O plano de testes estruturado em `analysis.md` detalha exatamente as rotas, métodos, cabeçalhos, payloads, asserções de erro e comandos que o Worker precisa executar para validar dinamicamente os 42 endpoints e gerar o documento `RELATORIO_TESTES_API.md`.

---

## 3. CAVEATS (Ressalvas e Limitações)

1. **Porta 5680 da VPS não exposta diretamente para a internet**: A porta 5680 da VPS (`server_webhook.cjs`) não é acessível externamente a partir da máquina local via IP público (bloqueada por Security List do Oracle Cloud), operando internamente atrás de reverse proxy ou na rede privada. Portanto, para o teste dinâmico do `server_webhook.cjs`, o Worker deve executá-lo em processo filho Node.js local ou testar via SSH na VPS.
2. **Deno não instalado no PATH do Windows**: O comando `deno --version` falhou localmente. Os testes das Edge Functions devem ser realizados via chamadas HTTP reais (`fetch` / curl) ou via SDK Supabase (`@supabase/supabase-js` `functions.invoke`), que é a forma canônica utilizada pelo frontend em produção.
3. **Credenciais de Produção**: Algumas credenciais externas (como API Key privada da InfinitePay de produção ou API Key privada do Resend) não devem ser expostas em logs de teste para conformidade com segurança. Os testes de webhook da InfinitePay devem usar os endpoints de teste ou a validação de assinatura/NSU já construída.

---

## 4. CONCLUSION (Conclusão e Recomendações Acionáveis)

1. O mapeamento completo das 42 interfaces de API e integração está finalizado e documentado em profundidade no arquivo `.agents/teamwork_preview_explorer_m2_2/analysis.md`.
2. A suíte de scripts de verificação de integrações (`scripts/verify-integrations-webhooks.ts`) está 100% verde (10/10 verificações aprovadas), atestando a presença do `SessionMutex`, do fallback seguro do `SERVICE_ROLE_JWT` e da chamada atômica na conversão de pontos.
3. As violações de codificação UTF-8 (`\uFFFD` em `DemandasDashboard.tsx` e mojibake em `check-gsa-tv-contracts.ts`) estão catalogadas com números de linha precisos para correção pelo Worker de remediação no Milestone 3.
4. O Worker pode iniciar imediatamente a redação e execução dos testes dinâmicos para elaboração do `RELATORIO_TESTES_API.md` seguindo a matriz exata da Seção 7 do relatório `analysis.md`.

---

## 5. VERIFICATION METHOD (Método de Verificação Independente)

Para reproduzir e verificar independentemente todas as constatações deste relatório:

1. **Verificar sanidade e sintaxe dos webhooks da VPS e SessionMutex**:
   ```powershell
   npx tsx scripts/verify-integrations-webhooks.ts
   ```
   *Condição de aprovação*: Exit code 0, 10 verificações passadas.

2. **Verificar baseline de codificação UTF-8 e detectar as 26 violações**:
   ```powershell
   npx tsx scripts/verify-utf8-encoding.ts
   ```
   *Condição de aprovação*: Exit code 1, identifica exatamente 6 problemas em `DemandasDashboard.tsx` e 18 em `check-gsa-tv-contracts.ts`.

3. **Verificar conectividade e rejeição não autorizada da VPS Evolution API**:
   ```powershell
   curl.exe -s --connect-timeout 5 http://147.15.43.141:8080/instance/connectionState/GSA_WhatsApp
   ```
   *Condição de aprovação*: Retorna HTTP 401 `{"status":401,"error":"Unauthorized"}`.

4. **Verificar APIs públicas externas (ViaCEP e BrasilAPI)**:
   ```powershell
   curl.exe -s https://viacep.com.br/ws/01001000/json/
   curl.exe -s https://brasilapi.com.br/api/cnpj/v1/00000000000191
   ```
   *Condição de aprovação*: Retorna JSON 200 válido com dados cadastrais íntegros.

5. **Verificar a integridade do relatório analítico completo**:
   - Inspecionar o arquivo `.agents/teamwork_preview_explorer_m2_2/analysis.md`.
