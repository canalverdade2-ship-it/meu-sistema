# Central de Avisos e Campanhas

## Escopo

Módulo administrativo e camada pública para criação, publicação, segmentação e acompanhamento de comunicados, promoções, alertas, manutenções, eventos e campanhas institucionais no GSA HUB.

## Formatos entregues

- janela pop-up;
- faixa superior;
- banner integrado à página;
- card flutuante;
- tela inteira.

## Fluxo administrativo

1. Criar um rascunho.
2. Definir conteúdo, categoria, formato e modelo visual.
3. Cadastrar imagens responsivas para computador e celular.
4. Configurar botões e destinos validados.
5. Segmentar páginas, público e dispositivos.
6. Definir período, prioridade, frequência e fechamento.
7. Revisar a pré-visualização.
8. Publicar imediatamente ou agendar.
9. Pausar, retomar, encerrar, arquivar, duplicar ou excluir conforme permissão.
10. Consultar métricas e histórico de auditoria.

## Segurança

- tabelas administrativas protegidas por RLS e sem leitura direta pública;
- entrega pública exclusivamente por RPC com campos controlados;
- público autenticado derivado do JWT, sem confiança no valor enviado pelo frontend;
- identificadores de visitante e sessão armazenados no banco apenas como SHA-256;
- frequência e impressão processadas com lock transacional;
- clique e fechamento aceitos somente depois de uma impressão válida da mesma sessão;
- links restritos a rotas internas ou HTTP/HTTPS;
- upload restrito a JPG, PNG e WebP, com limite de 5 MB;
- permissões granulares por ação para colaboradores;
- histórico de criação, alteração, publicação, pausa, retomada, encerramento, arquivamento, exclusão e mudanças de permissão;
- falhas da camada pública são não bloqueantes e não impedem o carregamento do site.

## Estrutura de banco

- `gsa_site_campaigns`: configuração e ciclo de vida;
- `gsa_site_campaign_events`: impressões, cliques e fechamentos pseudonimizados;
- `gsa_site_campaign_history`: auditoria administrativa e automática;
- `gsa_site_campaign_permissions`: permissões granulares dos colaboradores;
- bucket `gsa-site-campaigns`: imagens públicas controladas por políticas de storage.

## RPCs públicas

- `gsa_public_site_campaigns`;
- `gsa_public_site_campaign_event`.

## RPCs administrativas

- `gsa_admin_site_campaigns_overview`;
- `gsa_admin_upsert_site_campaign`;
- `gsa_admin_set_site_campaign_status`;
- `gsa_admin_duplicate_site_campaign`;
- `gsa_admin_delete_site_campaign`;
- `gsa_admin_site_campaign_my_permissions`;
- `gsa_admin_site_campaign_permission_overview`;
- `gsa_admin_set_site_campaign_permissions`.

## Validação local e CI

```bash
npm ci
npm run test:site-campaigns
npx tsc --noEmit
npm run build
```

O contrato também integra `test:integrity:contracts` para impedir regressões estruturais.

## Implantação

As migrations devem ser aplicadas na ordem numérica. Após a aplicação, validar com contas de administrador e colaborador, visitante anônimo e cliente autenticado, cobrindo computador, tablet e celular. A branch não deve ser mesclada nem promovida para produção enquanto os checks oficiais e a validação no ambiente conectado não estiverem concluídos.
