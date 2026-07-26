# Controle da Reformulação — Portal Empresarial GSA

## Frente de trabalho

- Branch exclusiva: `feature/portal-empresarial-pj`
- Backup do modelo anterior: `backup/area-pj-modelo-atual-2026-07-26`
- Data de início: 26/07/2026

## Objetivo

Transformar a área logada de clientes Pessoa Jurídica em um Portal Empresarial próprio, institucional, seguro e funcional, sem replicar a experiência destinada à Pessoa Física.

## Regra de segurança

Antes de qualquer alteração relevante, consultar a branch de backup. O desenvolvimento desta frente não deve modificar a branch de backup nem trabalhar diretamente na `main`.

## Escopo principal

- login empresarial exclusivo;
- seleção de empresa e unidade;
- Central da Empresa;
- obrigações e pendências;
- documentos empresariais;
- solicitações e protocolos;
- serviços contratados;
- financeiro empresarial;
- equipe, cargos e permissões;
- aprovações;
- notificações;
- histórico de atividades;
- configurações e segurança;
- experiência responsiva para desktop e celular.

## Requisitos obrigatórios

A implantação deve ser completa de ponta a ponta, incluindo:

- interface institucional e responsiva;
- autenticação e autorização reais;
- banco de dados e migrations;
- tabelas, relacionamentos, índices, funções e triggers necessários;
- RLS e isolamento entre empresas;
- controle por empresa, unidade, módulo e ação;
- integração real entre frontend, backend e banco;
- tratamento de erros, carregamentos, estados vazios e confirmações;
- trilha de auditoria;
- testes com diferentes perfis e permissões;
- estratégia de rollback para alterações estruturais;
- ausência total de aparência genérica, artificial ou de template automático.

## Alterações compartilhadas

Qualquer mudança em arquivos globais, autenticação comum, rotas, componentes compartilhados, banco, dependências ou configurações deve ser identificada antes da implementação e registrada nos commits.

## Condição de conclusão

Esta frente somente será considerada concluída depois que todos os fluxos estiverem funcionando em ambiente real ou equivalente, sem falhas de permissão, dados cruzados, rotas quebradas, tabelas ausentes, migrations incompletas ou ações sem backend.
