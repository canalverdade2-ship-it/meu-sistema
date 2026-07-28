# Smoke Autenticado de Produção

## Finalidade

O workflow manual `Authenticated Production Smoke` valida a autenticação e a navegação interna de contas técnicas dos seguintes perfis:

- cliente pessoa física;
- gestão Master;
- prestador;
- fornecedor.

Ele não é executado automaticamente em pull requests porque depende de contas técnicas do ambiente real. O workflow não salva screenshots, vídeos ou traces.

## Secrets obrigatórios

Configure no repositório:

- `PLAYWRIGHT_BASE_URL`: URL HTTPS da produção;
- `PRODUCTION_CLIENT_CPF`;
- `PRODUCTION_CLIENT_PIN`;
- `PRODUCTION_ADMIN_CODE`;
- `PRODUCTION_PROVIDER_DOCUMENT`;
- `PRODUCTION_PROVIDER_PIN`;
- `PRODUCTION_SUPPLIER_DOCUMENT`;
- `PRODUCTION_SUPPLIER_PIN`.

Use contas dedicadas exclusivamente à validação, sem dados pessoais reais e com o menor privilégio necessário.

## Cobertura

### Cliente

- autenticação pela página pública;
- dashboard;
- perfil;
- serviços e assinaturas;
- financeiro;
- fidelidade;
- suporte;
- Marketplace.

### Gestão Master

- autenticação pela Área Restrita;
- dashboard administrativo;
- financeiro;
- relatórios.

### Prestador

- autenticação por documento e PIN;
- dashboard;
- demandas;
- financeiro.

### Fornecedor

- autenticação por documento e PIN;
- dashboard;
- produtos;
- pedidos.

## Execução pelo GitHub

1. Abra **Actions**.
2. Selecione **Authenticated Production Smoke**.
3. Use **Run workflow** na branch que será validada.
4. Confirme que os quatro passos autenticados foram aprovados.

## Execução local do cliente

```bash
PRODUCTION_SMOKE=true \
PLAYWRIGHT_BASE_URL=https://dominio.example \
PRODUCTION_CLIENT_CPF=00000000000 \
PRODUCTION_CLIENT_PIN=0000 \
npm run test:e2e:production-auth
```

## Execução local de gestão

```bash
PRODUCTION_SMOKE=true \
PLAYWRIGHT_BASE_URL=https://dominio.example \
PRODUCTION_ACTOR_TYPE=admin \
PRODUCTION_ADMIN_CODE=credencial-tecnica \
npm run test:e2e:production-roles
```

## Execução local de prestador

```bash
PRODUCTION_SMOKE=true \
PLAYWRIGHT_BASE_URL=https://dominio.example \
PRODUCTION_ACTOR_TYPE=provider \
PRODUCTION_ACTOR_DOCUMENT=00000000000 \
PRODUCTION_ACTOR_PIN=0000 \
npm run test:e2e:production-roles
```

## Execução local de fornecedor

```bash
PRODUCTION_SMOKE=true \
PLAYWRIGHT_BASE_URL=https://dominio.example \
PRODUCTION_ACTOR_TYPE=supplier \
PRODUCTION_ACTOR_DOCUMENT=00000000000000 \
PRODUCTION_ACTOR_PIN=0000 \
npm run test:e2e:production-roles
```

## Critérios de aprovação

Cada execução exige:

- URL HTTPS;
- credencial com formato válido;
- login concluído;
- permanência nas rotas autorizadas;
- conteúdo principal visível;
- ausência de tela fatal;
- ausência de exceção JavaScript não tratada.

## Cuidados

- nunca usar credencial pessoal de administrador;
- não usar conta de cliente comum;
- não publicar CPF, CNPJ, PIN ou código Master em issue, PR, log ou documento;
- revogar imediatamente qualquer secret exposto;
- revisar periodicamente o privilégio das contas técnicas;
- executar após mudanças de autenticação, autorização, rotas, sessão ou RLS;
- executar novamente antes da liberação em produção.
