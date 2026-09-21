import { runSshScript } from './ssh2-run.mjs';
const entry = `

## 2026-09-07 03:xxZ — Diagnóstico confirmado pelo operador: estalos pertencem ao caminho de transmissão
- Durante o teste comparativo autorizado com o GSA News completo \`media-gsa-news-2026-09-01-broadcast-v4-final\`, o responsável confirmou que os mesmos estalos continuam audíveis no retorno da transmissão.
- O defeito já havia sido percebido nas versões distintas da chamada da grade, inclusive após reconstrução BROADCAST SAFE V1 e V2; agora também ocorre em um telejornal independente de 24 min 48 s.
- A repetição do sintoma em mídias diferentes descarta, com alta confiança operacional, a hipótese de problema exclusivo nos arquivos de vídeo.
- A captura local de 30 s do HLS final do GSA News foi decodificada sem warnings de corrupção ou timestamp e apresentou áudio tecnicamente contínuo; o operador, entretanto, ouviu estalos no retorno público.
- Conclusão operacional consolidada: o problema está no caminho de transmissão/reprodução, em etapa comum às mídias, e não nos masters individuais. O trecho prioritário de investigação passa a ser codificação ao vivo/empacotamento, envio RTMP, ingest/transcodificação do YouTube e reprodução do cliente.
- Duplicidade permanece descartada: exatamente 1 publicador RTMP e transportador externo preservado durante a troca de mídia.
- Nenhuma nova troca, restart ou alteração de encoder foi realizada neste registro. O GSA News permanece no ar para diagnóstico.
`;
const encoded=Buffer.from(entry).toString('base64');
const result=await runSshScript(`set -eu
printf '%s' '${encoded}' | base64 -d | sudo tee -a /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md >/dev/null
tail -n 11 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md`,30000);
process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
