# GSA TV — estado da implantação da plataforma

**Captura:** 17/08/2026 20:15 UTC  
**Ambiente:** VPS Oracle de produção  
**Situação:** plataforma desconectada instalada; conexões externas ainda não ativadas

## Concluído

- usuário Linux de serviço `gsa-tv` criado sem shell interativo;
- árvore persistente criada sob `/opt/gsa-tv` com permissões restritas;
- rede Docker exclusiva `gsa-tv-net` criada;
- pacote oficial ARM64 do ffplayout 2.1.0 validado por SHA-256;
- imagem Debian Trixie ARM64 construída com ffplayout 2.1.0, FFmpeg/ffprobe 7.1.5 e SQLite;
- contêiner executado sem capacidades Linux, com filesystem somente leitura, limite de 3 CPUs e 6 GiB de RAM;
- painel do ffplayout acessível somente em `127.0.0.1:8787` na VPS;
- healthcheck HTTP aprovado e política de reinício configurada;
- banco inicial criado com senha administrativa aleatória fora da imagem e modo `600` no host;
- benchmark H.264/AAC 1280×720, 30 fps e 4,5 Mb/s aprovado em 4,92× o tempo real;
- fallback técnico de 30 segundos validado com H.264 720p30 e AAC estéreo 48 kHz;
- backup online do SQLite criado, checksum gerado e `PRAGMA integrity_check` aprovado;
- timer diário de backup habilitado para 03:20 no fuso de São Paulo;
- rclone 1.74.4 ARM64 instalado a partir do RPM oficial com checksum validado.

## Mantido desconectado de propósito

- nenhuma chave RTMPS do YouTube foi cadastrada;
- nenhuma conta ou token do Google Drive foi cadastrado;
- o painel do ffplayout não foi publicado no Nginx/Cloudflare;
- nenhuma transmissão externa foi iniciada;
- a grade existente é apenas técnica e o canal padrão ainda se chama `Channel 1`.

## Pendências de segurança do ambiente preexistente

As portas diretas de n8n, PostgreSQL e Evolution API ainda não foram fechadas. O código atual contém consumidores que usam endpoints por IP, portanto o fechamento será feito somente depois da migração desses consumidores para HTTPS/rede Docker, para não interromper o GSA Hub.

## Próximo gate

1. criar a configuração protegida do rclone;
2. autorizar a conta Google Drive e restringir o acesso à pasta raiz da GSA TV;
3. implantar o cache manager e a validação de mídia;
4. configurar o canal técnico, playlist provisória e preview HLS interno;
5. integrar os primeiros workflows do n8n;
6. somente depois cadastrar uma chave de teste não listada do YouTube.

