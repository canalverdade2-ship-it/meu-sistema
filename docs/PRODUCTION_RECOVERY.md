# Backup e recuperação de produção

## Princípios

- Credenciais nunca devem ser gravadas em arquivos versionados ou exibidas nos logs.
- Backups devem ser armazenados fora do repositório, com criptografia e controle de acesso.
- Um backup só é considerado válido depois de passar por teste de restauração.
- O teste de Storage deve ocorrer em um projeto Supabase diferente do ambiente de origem.

## Banco de dados

### Gerar backup

```bash
SUPABASE_DB_URL='postgresql://...' npm run backup:database -- /caminho/seguro
```

A rotina gera:

- `database.dump`: dump PostgreSQL em formato customizado;
- `schema.sql`: cópia legível da estrutura;
- `manifest.json`: data, tamanhos e checksums SHA-256.

### Testar restauração

Use um PostgreSQL local descartável com privilégios para criar e excluir bancos:

```bash
npm run restore:test-database -- /caminho/seguro/database.dump
```

O teste restaura por padrão os schemas `public` e `supabase_migrations`, valida tabelas públicas, funções e o histórico de migrations e exclui o banco temporário ao terminar. Para ampliar o escopo de forma consciente, configure `RESTORE_TEST_SCHEMAS` com uma lista separada por vírgulas.

## Supabase Storage

### Gerar backup

```bash
SUPABASE_URL='https://projeto.supabase.co' \
SUPABASE_SERVICE_ROLE_KEY='...' \
npm run backup:storage -- /caminho/seguro
```

A rotina lista todos os buckets, baixa os objetos e cria um manifesto contendo caminho, tamanho, tipo e checksum SHA-256.

### Verificar arquivos do backup

```bash
npm run backup:verify-storage -- /caminho/seguro/storage-.../manifest.json
```

### Testar restauração em projeto isolado

```bash
ALLOW_STORAGE_RESTORE=true \
TARGET_SUPABASE_URL='https://projeto-de-teste.supabase.co' \
TARGET_SUPABASE_SERVICE_ROLE_KEY='...' \
RESTORE_STORAGE_PREFIX='teste-restauracao-20260722' \
npm run restore:test-storage -- /caminho/seguro/storage-.../manifest.json
```

Proteções obrigatórias da rotina:

- recusa o mesmo projeto que originou o backup;
- restaura sob um prefixo isolado;
- baixa novamente cada arquivo e confere o checksum;
- remove os objetos restaurados ao final, salvo quando `CLEANUP_AFTER_RESTORE=false` for definido explicitamente.

## Workflow de validação do ambiente real

O workflow **Production Environment Validation** é iniciado manualmente em GitHub Actions. Ele não executa por `push` e exige a confirmação literal `VALIDAR_PRODUCAO`.

### Secrets obrigatórios no environment `production`

- `SUPABASE_DB_URL`;
- `SUPABASE_URL`;
- `SUPABASE_SERVICE_ROLE_KEY`;
- `SUPABASE_ACCESS_TOKEN`;
- `SUPABASE_DB_PASSWORD`;
- `SUPABASE_PROJECT_ID`.

Para o teste isolado de Storage:

- `TARGET_SUPABASE_URL`;
- `TARGET_SUPABASE_SERVICE_ROLE_KEY`.

Para o smoke autenticado somente leitura:

- `PRODUCTION_APP_URL`;
- `PRODUCTION_CLIENT_CPF`;
- `PRODUCTION_CLIENT_PIN`.

Use uma conta de cliente exclusiva para monitoramento, com o menor acesso necessário e sem informações pessoais reais além do identificador técnico exigido pelo fluxo.

### Etapas executadas

1. Confirmação do projeto Supabase esperado e presença dos secrets.
2. Verificação das migrations críticas e das Edge Functions de publicidade.
3. Aplicação opcional das migrations pendentes e redeploy das funções auditadas.
4. Inventário código versus banco de produção.
5. Backup efêmero do banco, validação dos checksums e restauração em PostgreSQL descartável.
6. Backup efêmero do Storage e verificação de todos os checksums.
7. Restauração opcional do Storage em projeto isolado, seguida de limpeza automática.
8. Login autenticado opcional no portal do cliente, sem criação ou alteração de registros.

### Proteção dos dados no CI

- dumps e objetos do Storage ficam apenas no diretório temporário do runner e não são enviados como artifacts;
- o artifact do Storage contém somente contagens, volume total e checksum agregado, sem nomes de buckets ou objetos;
- o smoke autenticado desabilita screenshots, vídeos e traces para não persistir conteúdo da sessão;
- os logs não imprimem CPF, PIN, URLs de conexão ou service role keys.

## Frequência mínima recomendada

- banco: diariamente e antes de migrations críticas;
- Storage: diariamente para buckets operacionais e antes de alterações de políticas;
- teste de restauração do banco: semanal;
- teste de restauração do Storage: mensal ou antes de mudanças relevantes;
- retenção: combinar cópias diárias, semanais e mensais de acordo com obrigações legais e capacidade contratada.

## Evidência

Cada execução deve guardar, fora do repositório:

- manifesto;
- checksums;
- logs sem credenciais;
- resultado do teste de restauração;
- responsável e data;
- ambiente de origem e ambiente de teste.
