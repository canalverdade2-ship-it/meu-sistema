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

O teste cria um banco temporário, restaura o dump, valida tabelas públicas, funções e o histórico de migrations e exclui o banco ao terminar.

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
