# Política de migrations do banco

## Regra principal

Uma migration que já chegou a `main` ou foi registrada em qualquer ambiente não pode ser editada, renomeada ou reutilizada.

Toda correção deve ser feita por uma nova migration com versão de 14 dígitos e nome descritivo:

```text
YYYYMMDDHHMMSS_descricao_da_alteracao.sql
```

## Requisitos obrigatórios

1. A versão deve ser única no diretório `supabase/migrations`.
2. A migration deve falhar imediatamente diante de estado incompatível.
3. Alterações de função devem restabelecer explicitamente `SECURITY DEFINER`, `search_path`, `REVOKE` e `GRANT` quando aplicável.
4. Tabelas expostas pela API devem definir RLS e políticas no mesmo conjunto de mudanças.
5. Mudanças em Storage devem validar bucket, privacidade, limite de tamanho, MIME types e políticas.
6. Jobs e triggers devem possuir verificação posterior de existência e estado habilitado.
7. Operações destrutivas exigem backup e plano de reversão testado.
8. `migration repair` não substitui a execução do SQL e só pode reconciliar histórico depois que o estado real do banco foi comprovado.

## Proibições

- editar migration aplicada;
- marcar migration como aplicada sem executar ou verificar seus efeitos;
- incluir senha ou URL de conexão no SQL;
- conceder `EXECUTE` ou acesso de tabela a `PUBLIC` por conveniência;
- usar `SECURITY DEFINER` sem `SET search_path` controlado;
- excluir tabela, coluna ou objeto de Storage sem etapa de compatibilidade e retenção.

## Validação antes do merge

- TypeScript e contratos;
- migrations de domínio em PostgreSQL limpo quando houver baseline disponível;
- inspeção de funções, grants, RLS, policies, triggers e buckets;
- build de produção;
- E2E seguro;
- inventário código ↔ banco;
- evidência do backup quando a mudança for destrutiva.

## Produção

A implantação deve usar uma versão fixa da Supabase CLI. Depois da aplicação, o pipeline deve consultar o banco e comprovar os objetos esperados, em vez de confiar apenas no código de saída do comando de deploy.
