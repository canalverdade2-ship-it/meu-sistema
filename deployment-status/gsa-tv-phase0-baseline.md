# GSA TV — Fase 0: linha de base e recuperação

**Captura:** 17/08/2026 19:47 UTC  
**Ambiente:** VPS Oracle de produção  
**Estado:** backup criado, restauração validada e gate de segurança identificado

## Linha de base

- Oracle Linux Server 9.8, kernel 6.12, arquitetura ARM64 (`aarch64`).
- 4 vCPUs Neoverse-N1.
- 22 GiB de RAM, aproximadamente 17 GiB disponíveis no momento da captura.
- Swap de 5 GiB sem uso.
- Disco raiz de 183 GiB, 157 GiB livres e 15% de utilização.
- Uptime de aproximadamente 11 dias.
- Amostra de CPU entre 98% e 100% ociosa, sem espera relevante de I/O.
- Interface principal sem erros ou pacotes descartados registrados.
- Docker 29.7.2 e Docker Compose 5.4.0.
- 11 containers ativos no momento da captura.
- n8n 2.33.5 e PostgreSQL 15.18.

## Serviços e persistência relevantes

- n8n em container com volume persistente `n8n_data`.
- PostgreSQL em container com volume persistente `evo_postgres_data`.
- Bancos lógicos separados `n8n` e `evolution`.
- Nginx no host como proxy.
- Cloudflare Tunnel, Supabase Auth/Realtime/Storage, Evolution API, Redis e serviço de autenticação ativos.
- Nenhum dos containers principais inventariados possuía healthcheck Docker configurado.

## Backup protegido

Diretório na VPS:

```text
/opt/gsa-tv-backups/phase0-20260817T195000Z
```

Proteções:

- proprietário `root:root`;
- diretórios com modo `700`;
- arquivos com modo `600`;
- manifesto SHA-256 para verificação de integridade;
- conteúdo sensível mantido somente na VPS.

Conteúdo:

- dump PostgreSQL em formato customizado do banco `n8n`;
- dump PostgreSQL em formato customizado do banco `evolution`;
- globals/roles PostgreSQL;
- três workflows exportados pelo n8n;
- volume persistente do n8n;
- Docker Compose atual;
- configurações de Nginx, firewalld e systemd;
- arquivo do serviço de autenticação;
- inventário de containers, imagens, volumes, redes e portas;
- linha de base de CPU, memória, disco e rede;
- auditoria de segurança do n8n para análise na Fase 1.

## Validações executadas

### PostgreSQL

- `pg_restore --list` validou os dois dumps.
- O dump do n8n foi restaurado em banco temporário isolado com 125 tabelas públicas.
- O dump do Evolution foi restaurado em banco temporário isolado com 37 tabelas públicas.
- Os dois bancos temporários de validação foram removidos após o teste.

### n8n

- Três workflows foram exportados.
- Os três arquivos passaram por validação JSON.
- O arquivo do volume persistente passou por leitura integral do `tar.gz`.

### Configuração

- Arquivos compactados de Nginx, firewalld e systemd passaram por leitura integral.
- Todos os itens do manifesto SHA-256 passaram pela verificação inicial.

## Pontos que bloqueiam a instalação antes da Fase 1

1. Há múltiplas portas de serviços internos permitidas publicamente no firewalld.
2. PostgreSQL, n8n e outras APIs estão vinculados a interfaces públicas.
3. Existem credenciais em arquivos locais de implantação e dumps; será necessária rotação controlada.
4. Os containers principais não possuem healthchecks.
5. Algumas imagens utilizam tags flutuantes e precisam ser fixadas por versão/digest.
6. O serviço Ksplice aparece como falho; não bloqueia o backup, mas deve ser diagnosticado separadamente.

## Gate da Fase 0

O gate de recuperação está **aprovado**: há backup protegido, checksums e restauração real dos dois bancos. A próxima etapa autorizada pelo plano é a Fase 1 — segurança e isolamento — iniciando por mapeamento de dependências antes de fechar qualquer porta ou rotacionar credenciais.
