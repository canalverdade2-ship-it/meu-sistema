# GSA TV — implantação da automação, etapa 1

> Registro histórico. Situação atual e etapas seguintes: [relatório atualizado](gsa-tv-automacao-status-2026-09-14.md).

Data: 14/09/2026, madrugada de Brasília.

## Implantado na VPS
- Backup protegido: /opt/gsa-tv/backups/automation-repair-20260914-0455, com SHA256SUMS e RESTORE.txt.
- ffprobe: removida montagem inválida da raiz e entrada interativa desnecessária. Arquivo real retornou 3444.375521 segundos; arquivo inexistente foi rejeitado.
- TTS: duração inválida rejeitada; lote com falhas retorna erro; timeout de API de 90 segundos; data solicitada não usa silenciosamente roteiro de outra data.
- Timers de produção e continuidade: 00:00 America/Sao_Paulo. Próxima execução: 15/09/2026 00:00 BRT. Morning start mantido às 06:00 BRT.
- Fuso explícito nos três serviços. Controlador solicita o mesmo serviço systemd, sem iniciar fábrica paralela em background.
- Morning start retorna falha se não confirmar modo program.

## Validação e limites
- Sintaxe Node e Bash aprovada.
- Processo noturno atual preservado (PID 2898043). Código Node já carregado não recebe as alterações deste lote; ffprobe corrigido fica disponível às chamadas seguintes.
- Control Plane e ffplayout continuaram healthy; nenhum comando de reinício de transmissão executado.
- NÃO homologado ciclo completo, produção, imagem pública ou grade diurna.
- Fábrica ainda contém continuação após falhas e vínculo amplo de mídia por nome. Não foi reescrita enquanto executava.
- Arquivo de GSA Em Fé medido tem cerca de 57m24s para bloco 06h00–06h30; compatibilidade editorial e de duração permanece pendente.
- Manifestos antigos com duração zero não foram reclassificados automaticamente.

## Próximas etapas obrigatórias
1. Corrigir dependências e estados da fábrica, validação de masters e vínculo exato por programa/data.
2. Definir limite de produção às 05h59 e conferências 05h00/05h30/05h50, sem promover conteúdo inválido.
3. Validar programa piloto completo e programação diária em ambiente isolado.
4. Implantar acompanhamento no painel e concluir testes de ciclos reais.
