# Context Briefing for teamwork_preview_orchestrator_17

## Original User Request
Refer to c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\.agents\ORIGINAL_REQUEST.md under header ## 2026-09-08T02:46:22Z.

## Task Summary
Finalizar o pacote de identidade visual (vinhetas de abertura/encerramento) da GSA TV completando 4 ações obrigatórias pendentes:
1. Baixar e auditar as 7 regenerações pendentes do Google Flow via container gsa-ai-browser (CDP 127.0.0.1:9228) com QC técnico (fprobe) e QC visual (contact sheets nos tempos 1s, 5s, 9s em /home/opc/gsa-ai/work/identity-flow-20260907/qc-regen/).
2. Integrar o Program Builder Python em /home/opc/gsa-ai/ à API Fish Audio (https://api.fish.audio/v1/tts, modelo s2.1-pro-free, voz institucional 5c8a9b5d0b2549c7ada853529199ebe5) usando a chave segura em /opt/gsa-tv/ai-worker/ai_worker.mjs para locuções de continuidade (Estamos apresentando [Nome do Programa] / Estamos de volta [Nome do Programa]), gerando áudio 48kHz estéreo ~5s com fade in/out.
3. Refazer o QC e master completo do GSA Agro (abertura do Flow aprovada + locução Fish de continuidade + encerramento do Flow) com fprobe e contact sheets visuais, descartando os testes anteriores com MP3 antigo.
4. Montar o pacote final aprovado em /home/opc/gsa-ai/work/identity-flow-20260907/masters-final/ (mínimo 40 MP4s) com manifest.json (campos program, piece_type, source, sha256, pproved_at) e registrar a conclusão no changelog obrigatório /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md.

## VPS Details
- Host: Oracle Cloud Linux, 147.15.43.141:22, usuário opc, chave SSH em C:/Users/Adriano Farias/Downloads/CLOUD/ssh-key-2026-07-30.key
- SSH Helper (Node.js): c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\scratch\ssh2-run.mjs
- Working directory on VPS: /home/opc/gsa-ai

## Working Directory
.agents/teamwork_preview_orchestrator_17
