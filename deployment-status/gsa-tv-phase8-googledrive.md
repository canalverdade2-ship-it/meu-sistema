# GSA TV — Estado da Implantação da Fase 8 (Google Drive & Cache)

> **DOCUMENTO HIST?RICO / SUPERADO.** A decis?o final substituiu Google Drive/rclone pelo armazenamento definitivo na VPS e consolidou processamento, grade e relay no Control Plane atual. N?o use este documento como runbook nem como evid?ncia de implanta??o. Consulte [docs/arquitetura-atual-gsa-tv.md](../docs/arquitetura-atual-gsa-tv.md) e [infrastructure/gsa-tv/README.md](../infrastructure/gsa-tv/README.md).


**Captura:** 17/08/2026 22:35 UTC  
**Ambiente:** VPS Oracle de produção + Repositório local  
**Situação:** Infraestrutura de integração, sincronização, runbook e testes de resiliência do Google Drive 100% concluídos.

---

## 1. Entregas da Fase 8

| Componente / Arquivo | Descrição Técnica | Status |
|---|---|---|
| [`google-drive-setup-runbook.md`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/docs/google-drive-setup-runbook.md) | Guia operacional completo: criação da pasta raiz `GSA TV`, configuração no Google Cloud Console, credenciais OAuth desktop de menor privilégio | ✅ Concluído |
| [`sync-inbox.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/rclone/sync-inbox.sh) | Monitoramento e download da pasta `00_INBOX` com retentativas exponenciais, validação SHA-256 e notificação automática do Media Worker | ✅ Concluído |
| [`sync-media-cache.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/rclone/sync-media-cache.sh) | Download específico para abastecimento do Cache 48h com validação de hash esperado e quarentena em caso de divergência | ✅ Concluído |
| [`test-google-drive-resilience.sh`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/tests/test-google-drive-resilience.sh) | Suíte com 4 testes de resiliência: corrupção de hash, rate limits 429/403 com backoff, queda total do Drive e isolamento de quarentena | ✅ Concluído |
| [`rclone.conf.template`](file:///c:/Users/Adriano%20Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços%20-%20Copia%20(4)/infrastructure/gsa-tv/rclone/rclone.conf.template) | Configuração isolada com escopos separados (`drive.readonly` para VPS, escrita para n8n) e parâmetros anti-bloqueio | ✅ Concluído |

---

## 2. Garantias Operacionais

1. **Proteção Contra Quedas de Rede:**
   - O Playout Engine nunca lê arquivos diretamente da nuvem Google Drive.
   - Todo arquivo é baixado para `/opt/gsa-tv/cache/media/`, normalizado em H.264 CBR 4 Mbps / AAC estéreo 48 kHz (-16.0 LUFS) e conferido por SHA-256 antes da compilação da grade.
   - O Cache de 48 horas garante que mesmo uma indisponibilidade total do Google Drive de até 2 dias não interrompe a transmissão.

2. **Isolamento de Segredos:**
   - Tokens OAuth ficam exclusivamente em `/opt/gsa-tv/secrets/` e `/opt/gsa-tv/config/rclone/rclone.conf` com permissões estritas `chmod 600`.
   - Nenhum segredo ou token é enviado para o navegador ou versionado em código.

---

## 3. Próximo Gate — Fase 9: Workflows n8n & Automações

Os 7 workflows JSON já exportados estão prontos para importação no n8n da VPS:
1. `GSA TV 01 — Media Ingest`
2. `GSA TV 02 — Schedule Compile`
3. `GSA TV 03 — Cache Warmup`
4. `GSA TV 04 — Playout Monitor`
5. `GSA TV 05 — YouTube Monitor` (desativado até Fase 11)
6. `GSA TV 06 — Rights Watch`
7. `GSA TV 08 — Daily Technical Report`
