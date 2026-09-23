# n8n da GSA TV

Runtime atual: n8n 2.33.5 atrás do Nginx em `https://n8n.147-15-43-141.nip.io`.
A porta 5678 do container deve permanecer vinculada somente a `127.0.0.1`.

## Segredos

O arquivo real de ambiente fica em `/etc/gsa/n8n.env`, propriedade `root:root`, modo `0600`.
Nunca versionar senha de banco, API key ou chave de criptografia no compose ou nos workflows.
O volume externo `n8n_data` preserva a configuração criptográfica do n8n.

## Redes

`gsa-network` conecta o n8n ao PostgreSQL existente.
`gsa-tv-automation-net` é a rede privada da automação da TV.
O n8n usa `172.30.250.2`; a ponte GSA TV atende em `172.30.250.1:19202`.

## Workflows

Os nove workflows JSON atuais são versionados com IDs estáveis.
`import-workflows.sh` atualiza o mesmo ID, publica a nova versão e não cria cópias.
Cada workflow tem Schedule Trigger e Execute Workflow Trigger para homologação controlada.

## TLS

O certificado é emitido pelo `acme.sh`/Let's Encrypt e instalado em `/etc/nginx/ssl/n8n.{cer,key}`.
A renovação registra `systemctl reload nginx` como hook.
O desafio HTTP-01 é servido por `/usr/share/nginx/html/.well-known/acme-challenge/`.


## Autopilot V2

O workflow **GSA TV 08 - Daily Operational Report** inclui o resumo retornado por `/automation/snapshot`:

- saúde geral do Autopilot;
- freshness do Readiness Horizon;
- prontidão D+1;
- estado da Continuous Content Factory;
- estado do Duration Engine.

O workflow **GSA TV 04 - Playout Monitor** continua avaliando somente a saúde do sinal corrente. Pendências de conteúdo futuro são tratadas pelos incidentes idempotentes do Control Plane e não devem marcar falsamente o playout atual como offline.

O workflow **GSA TV 09 - Fixed Grid Horizon** mantém a materialização do horizonte de grade; o Autopilot complementa essa camada com produção, duração e readiness.
