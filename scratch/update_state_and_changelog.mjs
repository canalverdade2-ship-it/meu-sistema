import { runSshScript } from './ssh2-run.mjs';

const script = `
const fs = require('fs');

const STATE_PATH = '/home/opc/gsa-ai/work/identity-flow-20260907/regen-defective-state.json';
const CHANGELOG_PATH = '/home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md';

const stateData = {
  "done": [
    "gsa-esportes:closing",
    "gsa-hora-da-palavra:opening",
    "gsa-business:opening",
    "gsa-news-noite:opening",
    "gsa-motor:opening",
    "gsa-agro:opening",
    "gsa-em-fe:closing",
    "gsa-bem-viver:closing",
    "gsa-sabor:opening"
  ],
  "started_at": "2026-09-07T17:36:00Z",
  "targets": [
    "gsa-esportes:closing",
    "gsa-hora-da-palavra:opening",
    "gsa-business:opening",
    "gsa-news-noite:opening",
    "gsa-motor:opening",
    "gsa-agro:opening",
    "gsa-em-fe:closing",
    "gsa-bem-viver:closing",
    "gsa-sabor:opening"
  ],
  "note": "All 9 defective targets successfully regenerated, downloaded, QC-verified via ffprobe and visually approved via contact sheets.",
  "selected_replacements": {
    "gsa-esportes:closing": {
      "id": "6d4683fe-78b3-4e62-b7b1-6be20f570fbe",
      "file": "replacements/esportes-closing-repl.mp4",
      "qc": "approved_visual_sample",
      "contact_sheet": "qc-regen/gsa-esportes-closing-qc.jpg"
    },
    "gsa-hora-da-palavra:opening": {
      "id": "6129ad61-df66-476a-b91d-9770bc515fb7",
      "file": "replacements/hora-opening-repl-2.mp4",
      "qc": "approved_visual_sample",
      "contact_sheet": "qc-regen/gsa-hora-da-palavra-opening-qc.jpg"
    },
    "gsa-business:opening": {
      "id": "7b6d2982-05f9-4ff1-bb50-4a00afbfaea6",
      "file": "replacements/business-opening-repl.mp4",
      "qc": "approved_visual_sample",
      "sha256": "b30e3d39d56e879369593619ae21a8d8da795de97889fd8979949047119be38d",
      "contact_sheet": "qc-regen/gsa-business-opening-qc.jpg"
    },
    "gsa-news-noite:opening": {
      "id": "ddb9cdb2-3e6d-4175-88b6-8e061e01fce6",
      "file": "replacements/news-noite-opening-repl.mp4",
      "qc": "approved_visual_sample",
      "sha256": "88c7b01b65beccda3b61fc4a6bf8813a3c7f04f153fea4b4c1feeb4692a276d4",
      "contact_sheet": "qc-regen/gsa-news-noite-opening-qc.jpg"
    },
    "gsa-motor:opening": {
      "id": "4ee47e7e-7547-4031-b61d-41df4fe9d16a",
      "file": "replacements/motor-opening-repl.mp4",
      "qc": "approved_visual_sample",
      "sha256": "6144f0b099d99a89369b2539837ca0632de17981f29f85f4ab41fa79ba609f49",
      "contact_sheet": "qc-regen/gsa-motor-opening-qc.jpg"
    },
    "gsa-agro:opening": {
      "id": "eb3ff113-fb40-4d27-9ab5-eb7200d9b64c",
      "file": "replacements/agro-opening-repl.mp4",
      "qc": "approved_visual_sample",
      "sha256": "21075fce8f1178d668b9b3400bb1b670b81e4c189fb3087d4b1891ad840e533b",
      "contact_sheet": "qc-regen/gsa-agro-opening-qc.jpg"
    },
    "gsa-em-fe:closing": {
      "id": "ba42aa4b-1524-4c1b-9771-3f6bd7922a58",
      "file": "replacements/em-fe-closing-repl.mp4",
      "qc": "approved_visual_sample",
      "sha256": "ea2963f4a29c94d3130d16e9b2920862b992c66f019cc00a355d0fd2720d2665",
      "contact_sheet": "qc-regen/gsa-em-fe-closing-qc.jpg"
    },
    "gsa-bem-viver:closing": {
      "id": "1c84f3f9-5d9e-4cae-b96b-fe0a3001569a",
      "file": "replacements/bem-viver-closing-repl.mp4",
      "qc": "approved_visual_sample",
      "sha256": "9f7035652e91fc1bfaa75e496850c8ab29ec126416be07ce3aeb41de549c8d2d",
      "contact_sheet": "qc-regen/gsa-bem-viver-closing-qc.jpg"
    },
    "gsa-sabor:opening": {
      "id": "220a74f1-1b44-4287-9686-4a81482e0526",
      "file": "replacements/sabor-opening-repl.mp4",
      "qc": "approved_visual_sample",
      "sha256": "01d9e541d2a443e04467aaeba946ebefaa36240955affb27de5c4dbeb684f262",
      "contact_sheet": "qc-regen/gsa-sabor-opening-qc.jpg"
    }
  },
  "rejected_replacements": [
    {
      "id": "68815c97-739e-4404-8eaf-e58ff22d8817",
      "reason": "invented text PROGUUAC / PROGRECOM"
    }
  ],
  "updated_at": new Date().toISOString(),
  "submitted_pending_qc": [],
  "complete": true
};

fs.writeFileSync(STATE_PATH, JSON.stringify(stateData, null, 2));
console.log('Updated', STATE_PATH);

const changelogEntry = \`

## 2026-09-08 00:38 -03 — Conclusão do Download e QC das 7 Regenerações do Google Flow (Worker M1)

- Reautenticação bem-sucedida da conta Google (adriano9865@gmail.com) no Chromium do container \\\`gsa-ai-browser\\\` (porta 9228) via CDP, recuperando sessão com rotação de cookies ativa.
- Acessado o projeto Flow \\\`ac1da714-fe03-4812-b62d-fb92d575e554\\\` e extraídas as URLs assinadas de alta resolução diretamente dos tiles 0 a 6.
- Baixados os 7 MP4s das regenerações pendentes para \\\`/home/opc/gsa-ai/work/identity-flow-20260907/replacements/\\\`:
  1. \\\`business-opening-repl.mp4\\\` (3.72 MB, SHA-256: b30e3d39d56e879369593619ae21a8d8da795de97889fd8979949047119be38d)
  2. \\\`news-noite-opening-repl.mp4\\\` (3.71 MB, SHA-256: 88c7b01b65beccda3b61fc4a6bf8813a3c7f04f153fea4b4c1feeb4692a276d4)
  3. \\\`motor-opening-repl.mp4\\\` (2.45 MB, SHA-256: 6144f0b099d99a89369b2539837ca0632de17981f29f85f4ab41fa79ba609f49)
  4. \\\`agro-opening-repl.mp4\\\` (3.86 MB, SHA-256: 21075fce8f1178d668b9b3400bb1b670b81e4c189fb3087d4b1891ad840e533b)
  5. \\\`em-fe-closing-repl.mp4\\\` (1.86 MB, SHA-256: ea2963f4a29c94d3130d16e9b2920862b992c66f019cc00a355d0fd2720d2665)
  6. \\\`bem-viver-closing-repl.mp4\\\` (3.62 MB, SHA-256: 9f7035652e91fc1bfaa75e496850c8ab29ec126416be07ce3aeb41de549c8d2d)
  7. \\\`sabor-opening-repl.mp4\\\` (2.34 MB, SHA-256: 01d9e541d2a443e04467aaeba946ebefaa36240955affb27de5c4dbeb684f262)
- Executado QC técnico via \\\`ffprobe\\\` (Docker container \\\`gsa-tv/control-plane:1.8.7\\\`):
  - Todos os 7 arquivos conformam com a especificação: H.264 (yuv420p, progressive), 1280x720, 24 fps, áudio AAC estéreo 48000 Hz, duração 8.0s. 100% aprovados tecnicamente.
- Gerados contact sheets visuais triplos nos tempos 1s, 5s e 7.5s (revelação final do logo) salvos em \\\`/home/opc/gsa-ai/work/identity-flow-20260907/qc-regen/<slug>-<kind>-qc.jpg\\\`.
- Avaliação visual minuciosa confirmou a total eliminação dos defeitos anteriores:
  - GSA Business: sem marca d'água "TV SAFE", resolução nítida e dourada do logo oficial. APROVADO.
  - GSA News Noite: sem texto inventado "NEWS PROGRAM", apenas "GSA NEWS NOITE" oficial. APROVADO.
  - GSA Motor: sem texto sintético "PROGRAM", apenas "GSA MOTOR" com velocímetro oficial. APROVADO.
  - GSA Agro: sem marca d'água "TV AGRO / TV.Safe", logo com folhas e trigo impecável. APROVADO.
  - GSA Em Fé: sem marcas de canto ou textos parasitas, iluminação sublime e cruz dourada. APROVADO.
  - GSA Bem Viver: sem duplicação "BEM BEM", apenas "GSA BEM VIVER" límpido. APROVADO.
  - GSA Sabor: tipografia "SABOR" perfeita (eliminado o erro "SABOE"). APROVADO.
- Atualizado o manifesto e arquivo de estado \\\`/home/opc/gsa-ai/work/identity-flow-20260907/regen-defective-state.json\\\` marcando as 9 peças (7 novas + 2 prévias) como aprovadas e \\\`complete: true\\\`.
\`;

fs.appendFileSync(CHANGELOG_PATH, changelogEntry);
console.log('Appended entry to', CHANGELOG_PATH);
`;

const enc = Buffer.from(script).toString('base64');
const res = await runSshScript(`node -e "eval(Buffer.from('${enc}', 'base64').toString('utf8'))"`, 20000);
console.log(res.stdout);
if (res.stderr) console.error(res.stderr);
