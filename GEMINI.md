# Deploy de Edge Functions no VPS

Sempre que alterar o código de Edge Functions do Supabase localmente (ex: `supabase/functions/gsa-auth-session/index.ts` ou similares), lembre-se de que a aplicação principal (`localhost:3000`) se conecta ao Supabase hospedado no VPS (IP 147.15.43.141).

Para testar as alterações das funções, você deve **fazer o deploy imediatamente para o VPS**, pois o código local só entra em vigor lá.

## Passo a passo de deploy:
1. Copie o arquivo atualizado da função para o servidor remoto na mesma estrutura usando o comando `scp` e a chave SSH privada do projeto.
2. Execute o script de restart do Deno (`start-deno.sh`) no VPS via SSH.

**Exemplo de script para rodar no terminal e atualizar o ambiente na hora:**
```powershell
# 1. Enviar o novo arquivo temporariamente pro VPS
scp -o StrictHostKeyChecking=no -i "C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key" "supabase/functions/gsa-auth-session/index.ts" opc@147.15.43.141:/tmp/gsa-auth-session.ts

# 2. Substituir o arquivo no destino e reiniciar o container Deno
ssh -o StrictHostKeyChecking=no -i "C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key" opc@147.15.43.141 "sudo cp /tmp/gsa-auth-session.ts /home/opc/gsa-auth-session.ts && sudo bash /home/opc/start-deno.sh"
```
