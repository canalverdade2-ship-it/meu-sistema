# Notificações administrativas — 21/09/2026

Aplicado no banco da VPS: compatibilidade com p_tipo enviado por clientes publicados; evento de compra da loja; evento de fatura quitada (inserção já paga ou transição para pago), sem duplicação do mesmo evento. Não há reconstrução de alertas históricos.

Validação SQL transacional com rollback: compra, exclusão de orçamento fora da loja, quitação, inserção já paga e repetição. Dois testes do contrato RPC aprovados. Nenhuma compra ou pagamento real foi criado pelo teste.

Frontend local: removido parâmetro incompatível, primeiro aviso após lista vazia gera alerta, consulta periódica alerta e retorno à aba atualiza. Publicação do frontend ainda não realizada nesta etapa.

Backup local: backups/notifications-20260921-171453. Backup do esquema na VPS: /home/opc/backups/notifications-20260921. Reversão dos objetos novos: rollback-database.sql no backup local. Notificações já geradas são preservadas pela reversão.
