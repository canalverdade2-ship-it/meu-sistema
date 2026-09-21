## 2026-08-28T19:27:52Z
Goal: Concluir a implantação da feature "Entrar com recurso" (Appeal) para resgates de benefícios recusados, garantindo que caracteres especiais no WhatsApp (UTF-8) sejam corrigidos e preservando as restrições de infraestrutura do projeto.
Requested team: Use a large team of agents to finish frontend implementation and webhook integrations.

Continuar o trabalho da IA anterior para a feature de "Recurso" de resgate. As migrations no banco (`parceiros_resgates_recursos` e `parceiros_resgates_eventos`) já foram aplicadas. O fluxo do cliente via UI e as respostas do ADM via painel precisam ser finalizados, assim como os webhooks transacionais para o WhatsApp com total aderência ao encoding UTF-8.

CONSTRAINTS:
1. NÃO usar Git ou GitHub. Todo o trabalho é estritamente local ou direto no banco/VPS.
2. NÃO publicar no Cloudflare Pages.
3. UTF-8 ESTRITO: Todos os arquivos editados e webhooks n8n devem respeitar a codificação UTF-8 para evitar caracteres quebrados (ex: "NotificaÃ§Ã£o") nas mensagens do WhatsApp.

REQUIREMENTS:
- R1. Frontend do Cliente (Página de Consulta de Protocolo):
  Em `src/components/public/ProtocolConsultPage.tsx`:
  - Quando o status do resgate for "recusado", o cliente deve ter a opção de "Entrar com recurso" (apenas uma única vez).
  - O cliente deve poder enviar uma mensagem/justificativa e anexar até 3 fotos/documentos como evidência.
  - Ao salvar, os dados devem ser enviados para a tabela `parceiros_resgates_recursos` e o status do protocolo em `parceiros_resgates` pode passar para `em_recurso` (ou similar conforme arquitetura).

- R2. Frontend do Administrador (Gestão de Resgates):
  Em `src/components/admin/super-domains/pessoas/PartnerRedemptionDetailModal.tsx` e `FornecedoresSection.tsx`:
  - O ADM deve conseguir visualizar os detalhes do recurso, incluindo os textos e imagens enviados pelo cliente.
  - O ADM deve ter a opção de "Aceitar Recurso" ou "Negar Recurso".
  - Histórico de eventos deve ser exibido (utilizando `parceiros_resgates_eventos`).

- R3. Notificações WhatsApp (Correção UTF-8 e Integração):
  Em `src/utils/n8nWhatsApp.ts` e arquivos relacionados de disparo:
  - Corrigir urgentemente o encoding (UTF-8) para que as mensagens enviadas aos clientes (e automações) não cheguem com caracteres especiais quebrados.
  - Ao abrir um recurso, o cliente deve receber uma confirmação no WhatsApp.
  - Ao ter o recurso avaliado (aceito/negado), o cliente deve receber o veredito via WhatsApp, também formatado corretamente.

ACCEPTANCE CRITERIA:
- [ ] O cliente com benefício recusado visualiza o botão de recurso na página pública, submete a justificativa e as evidências com sucesso.
- [ ] O administrador enxerga o recurso aberto no painel de Fornecedores/Parceiros e consegue dar o veredito final.
- [ ] As mensagens de notificação chegam no WhatsApp do cliente formatadas corretamente, SEM nenhum caractere estranho como "Ã§" ou "Ã£o".
- [ ] Nenhuma alteração foi commitada no Git ou enviada para o Cloudflare Pages.
