# GSA TV — Rotação de segredos e baseline do Autopilot V2

## Estado

Este documento acompanha a branch `feat/gsa-tv-autopilot-v2`.

Segredos anteriormente versionados devem ser considerados comprometidos por terem aparecido em histórico Git. Remover o valor do arquivo atual não revoga cópias históricas.

## Segredos que exigem rotação

- credencial PostgreSQL utilizada por automações da GSA TV;
- token interno do Control Plane;
- token do Encoder Engine, quando ainda ativo no ambiente;
- qualquer chave privada ou token presente no arquivo removido `CREDENCIAIS_SISTEMA_GSA.md`.

Não registrar valores novos neste documento.

## Destino correto

Os valores de runtime devem existir somente no servidor/secret store, por exemplo:

- `/opt/gsa-tv/control-plane/.env` com permissão restrita;
- arquivo de EnvironmentFile protegido para unidades systemd que realmente precisarem;
- secret store/Vault quando o serviço já tiver integração disponível.

Permissões recomendadas para arquivos locais de segredo:

```bash
sudo chown root:root /caminho/do/arquivo
sudo chmod 600 /caminho/do/arquivo
```

## Variáveis usadas pelo controlador legado sanitizado

```text
GSA_TV_DATABASE_URL
GSA_TV_CONTROL_TOKEN
GSA_TV_ENCODER_TOKEN
GSA_TV_CONTROL_URL
GSA_TV_ENCODER_URL
```

O controlador ativo descrito na arquitetura atual é o Python em
`infrastructure/gsa-tv/scripts/night-controller.py`. O shell da raiz permanece somente por compatibilidade histórica e não deve voltar a ser fonte de segredos.

## Validação antes de produção

1. Rotacionar cada segredo no sistema de origem.
2. Atualizar somente os secret stores da VPS.
3. Confirmar que Control Plane, Watchdog e jobs de produção inicializam.
4. Confirmar que nenhum segredo aparece em logs.
5. Executar busca no checkout atual do repositório por padrões de credenciais.
6. Revogar os valores antigos.
7. Não reintroduzir `CREDENCIAIS_SISTEMA_GSA.md`.

## Histórico Git

Como o repositório é público, a rotação é obrigatória mesmo após a remoção dos arquivos atuais. Reescrita de histórico é uma operação separada e de maior impacto; não deve ser executada sem plano de coordenação, porque altera SHAs e clones existentes.


## Rotação do ENCODER_ENGINE_TOKEN

O Encoder Engine V2 deriva do `ENCODER_ENGINE_TOKEN` a chave AES-256-GCM usada para proteger o arquivo local de recuperação:

`/opt/gsa-tv/runtime/encoder-state.json`

Por isso, a troca desse token deve ser tratada como uma operação coordenada de runtime.

Procedimento recomendado:

1. executar em janela off-air;
2. confirmar que o canal está `stopped` e que o Encoder Engine não possui transporte/produtor ativo;
3. remover o estado persistido antigo somente depois de confirmar que não há transmissão a restaurar;
4. gerar/configurar o novo token no secret store/`.env` protegido;
5. recriar Encoder Engine e Control Plane com o mesmo novo token;
6. verificar `/health` e `/v1/status`;
7. iniciar novamente pelo fluxo operacional normal.

Não rotacionar o token durante uma transmissão pública. Um token novo não consegue descriptografar um estado persistido com a chave anterior.

O valor do token nunca deve aparecer em logs, relatórios, commits ou comandos copiados para documentação.
