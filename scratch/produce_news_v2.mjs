import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
    set -e

    BASE_DIR="/opt/gsa-tv/cache/media/1/news/gsa-news-2026-09-02-v2"
    sudo mkdir -p "$BASE_DIR/assets/broll" "$BASE_DIR/assets/images" "$BASE_DIR/audio" "$BASE_DIR/graphics" "$BASE_DIR/credits" "$BASE_DIR/video/tmp" "$BASE_DIR/qc"
    sudo chown -R opc:opc "$BASE_DIR"
    sudo chmod -R 777 "$BASE_DIR"
    
    echo "Baixando vídeos B-roll..."
    
    # 1. Saneamento
    curl -L -o "$BASE_DIR/assets/broll/saneamento.mp4" "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
    # 2. STF
    curl -L -o "$BASE_DIR/assets/broll/stf.mp4" "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
    # 3. Amazonia
    curl -L -o "$BASE_DIR/assets/broll/amazonia.mp4" "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4"
    # 4. Nasa
    curl -L -o "$BASE_DIR/assets/broll/nasa.mp4" "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4"
    # 5. Copa do Brasil
    curl -L -o "$BASE_DIR/assets/broll/futebol_novo.mp4" "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4"
    # 6. Europa
    curl -L -o "$BASE_DIR/assets/broll/europa.mp4" "https://storage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4"
    # 7. IA
    curl -L -o "$BASE_DIR/assets/broll/ia.mp4" "https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4"
    # 8. Eleicoes
    curl -L -o "$BASE_DIR/assets/broll/eleicoes.mp4" "https://storage.googleapis.com/gtv-videos-bucket/sample/VolkswagenGTIReview.mp4"

    echo "Gerando áudios..."
    
    # Textos
    cat << 'EOF' > "$BASE_DIR/audio/text_00.txt"
Olá, muito boa noite. Eu sou Holt. O GSA News desta quarta-feira, 2 de setembro, está no ar com as principais notícias do dia.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_01.txt"
Boa noite. Eu sou Nyla. Hoje nós vamos falar sobre o novo relatório do IBGE sobre saneamento, a decisão do Supremo sobre terras indígenas, o avanço da Missão Artemis da NASA e a crise política na Europa. E ainda: os destaques das quartas de final da Copa do Brasil.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_02.txt"
Começamos com os dados preocupantes divulgados pelo IBGE nesta manhã. Mais de vinte e cinco milhões de brasileiros ainda não têm acesso à rede de esgoto e saneamento básico. O governo federal anunciou um pacote emergencial de obras de infraestrutura para os próximos quatro anos.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_03.txt"
Em Brasília, o Supremo Tribunal Federal retomou o julgamento decisivo sobre a demarcação de terras indígenas. A sessão foi marcada por protestos na Esplanada dos Ministérios, e a votação deve ser concluída apenas na semana que vem.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_04.txt"
Na área ambiental, um relatório da ONU apontou uma redução de quinze por cento no desmatamento da Amazônia em agosto, em comparação ao mesmo período do ano passado. Apesar da queda, especialistas alertam que a fiscalização precisa ser mantida de forma rigorosa.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_05.txt"
E no espaço, a NASA confirmou hoje que a Missão Artemis, que levará astronautas de volta à Lua, está com cronograma adiantado. Os novos testes com o foguete SLS e a cápsula Orion foram concluídos com sucesso no centro espacial Kennedy.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_06.txt"
Nos esportes, os jogos de ida das quartas de final da Copa do Brasil movimentaram a noite de ontem. Com estádios lotados, os times começaram a definir quem avança para a próxima fase. Os jogos de volta acontecem na semana que vem.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_07.txt"
No cenário internacional, uma nova crise política atinge a União Europeia. Líderes do bloco estão reunidos em Bruxelas para debater medidas contra a inflação e novas regras de imigração, após protestos em diversas capitais do continente.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_08.txt"
A inteligência artificial continua transformando o mercado de trabalho. Um novo estudo indica que empresas de tecnologia estão investindo bilhões em IA generativa, criando novas profissões, mas também gerando apreensão sobre o futuro do emprego tradicional.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_09.txt"
Aqui no Brasil, as eleições municipais entram na reta final. Em São Paulo, os candidatos participaram de um debate acalorado sobre transporte público e segurança, buscando conquistar os eleitores indecisos a poucas semanas do pleito.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_10.txt"
Esses foram os destaques do GSA News de hoje. Agradecemos a sua audiência nesta noite de quarta-feira.
EOF
    cat << 'EOF' > "$BASE_DIR/audio/text_11.txt"
O GSA News fica por aqui. Uma excelente noite para você e até amanhã, com mais informações.
EOF

    # TTS Voices
    VOICE_HOLT="pt-BR-AntonioNeural"
    VOICE_NYLA="pt-BR-FranciscaNeural"

    # Generate edge-tts
    edge-tts --voice $VOICE_HOLT --file "$BASE_DIR/audio/text_00.txt" --write-media "$BASE_DIR/audio/raw_00.mp3"
    edge-tts --voice $VOICE_NYLA --file "$BASE_DIR/audio/text_01.txt" --write-media "$BASE_DIR/audio/raw_01.mp3"
    edge-tts --voice $VOICE_HOLT --file "$BASE_DIR/audio/text_02.txt" --write-media "$BASE_DIR/audio/raw_02.mp3"
    edge-tts --voice $VOICE_NYLA --file "$BASE_DIR/audio/text_03.txt" --write-media "$BASE_DIR/audio/raw_03.mp3"
    edge-tts --voice $VOICE_HOLT --file "$BASE_DIR/audio/text_04.txt" --write-media "$BASE_DIR/audio/raw_04.mp3"
    edge-tts --voice $VOICE_NYLA --file "$BASE_DIR/audio/text_05.txt" --write-media "$BASE_DIR/audio/raw_05.mp3"
    edge-tts --voice $VOICE_HOLT --file "$BASE_DIR/audio/text_06.txt" --write-media "$BASE_DIR/audio/raw_06.mp3"
    edge-tts --voice $VOICE_NYLA --file "$BASE_DIR/audio/text_07.txt" --write-media "$BASE_DIR/audio/raw_07.mp3"
    edge-tts --voice $VOICE_HOLT --file "$BASE_DIR/audio/text_08.txt" --write-media "$BASE_DIR/audio/raw_08.mp3"
    edge-tts --voice $VOICE_NYLA --file "$BASE_DIR/audio/text_09.txt" --write-media "$BASE_DIR/audio/raw_09.mp3"
    edge-tts --voice $VOICE_HOLT --file "$BASE_DIR/audio/text_10.txt" --write-media "$BASE_DIR/audio/raw_10.mp3"
    edge-tts --voice $VOICE_NYLA --file "$BASE_DIR/audio/text_11.txt" --write-media "$BASE_DIR/audio/raw_11.mp3"

    # Convert to wav 48kHz
    for i in {00..11}; do
        ffmpeg -y -i "$BASE_DIR/audio/raw_$i.mp3" -ar 48000 -ac 2 "$BASE_DIR/audio/cena_$i.wav"
    done

    echo "Criando arquivos gráficos..."

    echo "ABERTURA" > "$BASE_DIR/graphics/00_section.txt"
    echo "GSA NEWS - 02 DE SETEMBRO" > "$BASE_DIR/graphics/00_title.txt"
    echo "Boa noite. O telejornal de hoje está no ar." > "$BASE_DIR/graphics/00_ticker.txt"

    echo "ESCALADA" > "$BASE_DIR/graphics/01_section.txt"
    echo "DESTAQUES DE HOJE" > "$BASE_DIR/graphics/01_title.txt"
    echo "Saneamento, STF, NASA e Copa do Brasil são os destaques de hoje." > "$BASE_DIR/graphics/01_ticker.txt"

    echo "INFRAESTRUTURA" > "$BASE_DIR/graphics/02_section.txt"
    echo "IBGE: DEFICIT DE SANEAMENTO BÁSICO" > "$BASE_DIR/graphics/02_title.txt"
    echo "Mais de 25 milhões de brasileiros não têm acesso à rede de esgoto." > "$BASE_DIR/graphics/02_ticker.txt"

    echo "POLÍTICA" > "$BASE_DIR/graphics/03_section.txt"
    echo "STF: JULGAMENTO DE TERRAS INDÍGENAS" > "$BASE_DIR/graphics/03_title.txt"
    echo "Sessão é marcada por protestos em Brasília." > "$BASE_DIR/graphics/03_ticker.txt"

    echo "MEIO AMBIENTE" > "$BASE_DIR/graphics/04_section.txt"
    echo "ONU: DESMATAMENTO NA AMAZÔNIA" > "$BASE_DIR/graphics/04_title.txt"
    echo "Relatório aponta redução de 15% em agosto." > "$BASE_DIR/graphics/04_ticker.txt"

    echo "CIÊNCIA" > "$BASE_DIR/graphics/05_section.txt"
    echo "NASA: MISSÃO ARTEMIS AVANÇA" > "$BASE_DIR/graphics/05_title.txt"
    echo "Testes com foguete SLS são concluídos com sucesso." > "$BASE_DIR/graphics/05_ticker.txt"

    echo "ESPORTES" > "$BASE_DIR/graphics/06_section.txt"
    echo "COPA DO BRASIL: QUARTAS DE FINAL" > "$BASE_DIR/graphics/06_title.txt"
    echo "Jogos de ida movimentam os estádios." > "$BASE_DIR/graphics/06_ticker.txt"

    echo "INTERNACIONAL" > "$BASE_DIR/graphics/07_section.txt"
    echo "CRISE POLÍTICA NA EUROPA" > "$BASE_DIR/graphics/07_title.txt"
    echo "Líderes discutem inflação e imigração em Bruxelas." > "$BASE_DIR/graphics/07_ticker.txt"

    echo "TECNOLOGIA" > "$BASE_DIR/graphics/08_section.txt"
    echo "O IMPACTO DA IA NO MERCADO" > "$BASE_DIR/graphics/08_title.txt"
    echo "Empresas investem bilhões em inteligência artificial." > "$BASE_DIR/graphics/08_ticker.txt"

    echo "ELEIÇÕES 2026" > "$BASE_DIR/graphics/09_section.txt"
    echo "RETA FINAL EM SÃO PAULO" > "$BASE_DIR/graphics/09_title.txt"
    echo "Candidatos participam de debate na capital paulista." > "$BASE_DIR/graphics/09_ticker.txt"

    echo "ENCERRAMENTO" > "$BASE_DIR/graphics/10_section.txt"
    echo "GSA NEWS" > "$BASE_DIR/graphics/10_title.txt"
    echo "Obrigado pela sua audiência." > "$BASE_DIR/graphics/10_ticker.txt"

    echo "ENCERRAMENTO" > "$BASE_DIR/graphics/11_section.txt"
    echo "GSA NEWS" > "$BASE_DIR/graphics/11_title.txt"
    echo "Boa noite e até amanhã." > "$BASE_DIR/graphics/11_ticker.txt"

    # Mapeamento de cenas -> B-roll
    # 00, 01 - stf
    # 02 - saneamento
    # 03 - stf
    # 04 - amazonia
    # 05 - nasa
    # 06 - futebol_novo
    # 07 - europa
    # 08 - ia
    # 09 - eleicoes
    # 10, 11 - stf (placeholder)
    
    BROLLS=("stf.mp4" "stf.mp4" "saneamento.mp4" "stf.mp4" "amazonia.mp4" "nasa.mp4" "futebol_novo.mp4" "europa.mp4" "ia.mp4" "eleicoes.mp4" "stf.mp4" "stf.mp4")

    echo "Renderizando cenas no Docker..."
    for i in {00..11}; do
        idx=$(echo $i | sed 's/^0*//')
        if [ -z "$idx" ]; then idx=0; fi
        
        BROLL=\${BROLLS[$idx]}
        DURATION=\$(ffprobe -i "$BASE_DIR/audio/cena_$i.wav" -show_entries format=duration -v quiet -of csv="p=0")
        
        sudo docker exec gsa-tv-ffplayout ffmpeg -nostdin -hide_banner -loglevel error -y \
            -stream_loop -1 -ss 0 -i /media/1/news/gsa-news-2026-09-02-v2/assets/broll/$BROLL \
            -t $DURATION -i /media/1/news/gsa-news-2026-09-02-v2/audio/cena_$i.wav \
            -vf "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,drawbox=x=0:y=770:w=1920:h=230:color=0x06162a@0.90:t=fill,drawbox=x=0:y=770:w=1920:h=5:color=0xc99a3b@1:t=fill,drawbox=x=1510:y=45:w=350:h=76:color=0x06162a@0.90:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:text='GSA NEWS':fontcolor=white:fontsize=34:x=1570:y=63,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=/media/1/news/gsa-news-2026-09-02-v2/graphics/\${i}_section.txt:expansion=none:fontcolor=0xe2b354:fontsize=27:x=70:y=792,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=/media/1/news/gsa-news-2026-09-02-v2/graphics/\${i}_title.txt:expansion=none:fontcolor=white:fontsize=34:x=70:y=835,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=/media/1/news/gsa-news-2026-09-02-v2/graphics/\${i}_ticker.txt:expansion=none:fontcolor=white:fontsize=21:x=70:y=1025,format=yuv420p" \
            -c:v libx264 -preset ultrafast -crf 22 -profile:v high -level 4.1 -r 30 -g 60 -pix_fmt yuv420p \
            /media/1/news/gsa-news-2026-09-02-v2/video/tmp/scene_$i.mp4
    done

    echo "Concatenando cenas..."
    ls $BASE_DIR/video/tmp/scene_*.mp4 | sort | awk '{print "file '\''" $0 "'\''"}' > /tmp/concat_02_09_v2.txt
    
    # We need the path inside docker for concat
    ls $BASE_DIR/video/tmp/scene_*.mp4 | sort | awk '{gsub("/opt/gsa-tv/cache", ""); print "file '\''" $0 "'\''"}' > $BASE_DIR/video/tmp/concat_docker.txt

    sudo docker exec gsa-tv-ffplayout ffmpeg -y -f concat -safe 0 \
        -i /media/1/news/gsa-news-2026-09-02-v2/video/tmp/concat_docker.txt \
        -c:v libx264 -preset medium -crf 20 -c:a aac -ar 48000 -ac 2 \
        /media/1/news/gsa-news-2026-09-02-v2/video/gsa-news-2026-09-02-v2-final.mp4

    echo "Realizando QC e inserindo no banco de dados..."
    FINAL_PATH="$BASE_DIR/video/gsa-news-2026-09-02-v2-final.mp4"
    ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "$FINAL_PATH" > "$BASE_DIR/qc/duration.txt"
    DURATION_S=\$(cat "$BASE_DIR/qc/duration.txt" | awk '{print int(\$1 + 0.5)}')

    sudo -u postgres psql -d gsatv -c "
        INSERT INTO public.gsa_tv_media_items 
        (id, channel_id, title, original_filename, duration_s, state, rights_ok, drive_path, media_kind, source_type)
        VALUES (
            'media-gsa-news-2026-09-02-v2-final', 
            'ch-main', 
            'GSA News - 02/09/2026 (V2)', 
            'gsa-news-2026-09-02-v2-final.mp4', 
            \$DURATION_S, 
            'ready', 
            true, 
            '/media/1/news/gsa-news-2026-09-02-v2/video/gsa-news-2026-09-02-v2-final.mp4',
            'video',
            'generated'
        ) ON CONFLICT (id) DO UPDATE SET duration_s = EXCLUDED.duration_s;
    "

    sudo -u postgres psql -d gsatv -c "
        INSERT INTO public.gsa_tv_jobs(channel_id, job_type, status, progress, payload)
        VALUES('ch-main', 'media_take', 'pending', 0,
        jsonb_build_object('media_item_id', 'media-gsa-news-2026-09-02-v2-final'));
    "

    echo "Tudo concluído com sucesso."
  `;

  try {
    const res = await runSshScript(script, 600000);
    console.log(res.stdout);
  } catch (err) {
    console.error(err);
  }
}

main();
