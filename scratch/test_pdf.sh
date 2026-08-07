#!/bin/bash
curl -s -X POST http://127.0.0.1:8080/message/sendMedia/GSA_WhatsApp \
  -H "apikey: gsa_hub_evolution_token_2026" \
  -H "Content-Type: application/json" \
  -d '{
    "number": "5511971858372",
    "mediatype": "document",
    "mimetype": "application/pdf",
    "media": "data:application/pdf;base64,JVBERi0xLjQKJcOtw7zDtsOfCjEgMCBvYmoKPDwvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iaiA8PC9UeXBlIC9QYWdlcyAvQ291bnQgMSAvS2lkcyBbMyAwIFJdPj4KZW5kb2JqCjMgMCBvYmogPDwvVHlwZSAvUGFnZSAvUGFyZW50IDIgMCBSIC9NZWRpYUJveCBbMCAwIDYxMiA3OTJdIDvPgplbmRvYmoKOHRyYWlsZXIKPDwvU2l6ZSA0IC9Sb290IDEgMCBSPj4Kc3RhcnR4cmVmCjE1MAolJUVPRg==",
    "fileName": "teste_fatura.pdf",
    "caption": "Teste de envio de PDF instantaneo"
  }'
