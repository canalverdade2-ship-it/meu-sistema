from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "output" / "pdf" / "gsa-tv-documentacao-tecnica-atualizada-2026-09-04.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)

regular = Path(r"C:\Windows\Fonts\arial.ttf")
bold = Path(r"C:\Windows\Fonts\arialbd.ttf")
pdfmetrics.registerFont(TTFont("Arial", str(regular)))
pdfmetrics.registerFont(TTFont("Arial-Bold", str(bold)))

NAVY = colors.HexColor("#071A2F")
BLUE = colors.HexColor("#0D4F8B")
CYAN = colors.HexColor("#19A7CE")
GOLD = colors.HexColor("#D6AE52")
PALE = colors.HexColor("#EAF3F8")
LIGHT = colors.HexColor("#F5F7FA")
GREEN = colors.HexColor("#16835D")
AMBER = colors.HexColor("#B56A00")
RED = colors.HexColor("#B42318")
GRAY = colors.HexColor("#56616D")

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="TitleGSA", fontName="Arial-Bold", fontSize=25, leading=30, textColor=NAVY, spaceAfter=8))
styles.add(ParagraphStyle(name="SubtitleGSA", fontName="Arial", fontSize=11, leading=16, textColor=GRAY, spaceAfter=16))
styles.add(ParagraphStyle(name="H1GSA", fontName="Arial-Bold", fontSize=16, leading=20, textColor=NAVY, spaceBefore=8, spaceAfter=8))
styles.add(ParagraphStyle(name="H2GSA", fontName="Arial-Bold", fontSize=11.5, leading=15, textColor=BLUE, spaceBefore=7, spaceAfter=5))
styles.add(ParagraphStyle(name="BodyGSA", fontName="Arial", fontSize=9.2, leading=13.2, textColor=colors.HexColor("#1F2933"), spaceAfter=6))
styles.add(ParagraphStyle(name="SmallGSA", fontName="Arial", fontSize=7.8, leading=10.5, textColor=GRAY))
styles.add(ParagraphStyle(name="CalloutGSA", fontName="Arial-Bold", fontSize=10.2, leading=14, textColor=NAVY, leftIndent=8, rightIndent=8, spaceBefore=5, spaceAfter=5))
styles.add(ParagraphStyle(name="Cell", fontName="Arial", fontSize=7.8, leading=10, textColor=colors.HexColor("#24313D")))
styles.add(ParagraphStyle(name="CellBold", fontName="Arial-Bold", fontSize=7.8, leading=10, textColor=NAVY))
styles.add(ParagraphStyle(name="StatusOK", fontName="Arial-Bold", fontSize=8, textColor=GREEN))
styles.add(ParagraphStyle(name="StatusPending", fontName="Arial-Bold", fontSize=8, textColor=AMBER))
styles.add(ParagraphStyle(name="StatusRisk", fontName="Arial-Bold", fontSize=8, textColor=RED))

def P(text, style="BodyGSA"):
    return Paragraph(text, styles[style])

def bullet(text):
    return Paragraph("&#8226; " + text, ParagraphStyle(name="bulletx"+str(abs(hash(text))), parent=styles["BodyGSA"], leftIndent=12, firstLineIndent=-7, spaceAfter=3))

def status(text, kind="ok"):
    return P(text, {"ok":"StatusOK", "pending":"StatusPending", "risk":"StatusRisk"}[kind])

def table(rows, widths, header=True):
    t = Table(rows, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    commands = [
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6), ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("GRID", (0,0), (-1,-1), 0.35, colors.HexColor("#C8D3DD")),
    ]
    if header:
        commands += [("BACKGROUND", (0,0), (-1,0), NAVY), ("TEXTCOLOR", (0,0), (-1,0), colors.white)]
    for r in range(1 if header else 0, len(rows)):
        if r % 2 == 0: commands.append(("BACKGROUND", (0,r), (-1,r), LIGHT))
    t.setStyle(TableStyle(commands))
    return t

def header_footer(canvas, doc):
    canvas.saveState()
    w, h = A4
    canvas.setFillColor(NAVY)
    canvas.rect(0, h-12*mm, w, 12*mm, fill=1, stroke=0)
    canvas.setFont("Arial-Bold", 8)
    canvas.setFillColor(colors.white)
    canvas.drawString(18*mm, h-7.6*mm, "GSA TV | DOCUMENTACAO TECNICA")
    canvas.setFillColor(GOLD)
    canvas.rect(0, h-12.7*mm, w, 0.7*mm, fill=1, stroke=0)
    canvas.setFont("Arial", 7.5)
    canvas.setFillColor(GRAY)
    canvas.drawString(18*mm, 10*mm, "Estado consolidado em 04/09/2026 - America/Sao_Paulo")
    canvas.drawRightString(w-18*mm, 10*mm, f"Pagina {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=22*mm, bottomMargin=18*mm, title="GSA TV - Documentacao tecnica atualizada", author="Grupo GSA")
story = []

story += [Spacer(1, 8*mm), P("GSA TV", "TitleGSA"), P("Documentacao tecnica atualizada da transmissao, Control Plane e encoder", "SubtitleGSA")]
cover = Table([
    [P("DATA DE CORTE", "CellBold"), P("04/09/2026", "Cell")],
    [P("AMBIENTE", "CellBold"), P("VPS de producao - canal principal ch-main", "Cell")],
    [P("ESCOPO", "CellBold"), P("Arquitetura de playout, composicao grafica, encoder RTMP, YouTube, continuidade e operacao 24x7", "Cell")],
    [P("CLASSIFICACAO", "CellBold"), P("Relatorio tecnico de estado - inclui itens concluidos e pendencias abertas", "Cell")],
], colWidths=[42*mm, 120*mm])
cover.setStyle(TableStyle([("BACKGROUND",(0,0),(0,-1),PALE),("GRID",(0,0),(-1,-1),0.5,colors.HexColor("#B8C7D3")),("VALIGN",(0,0),(-1,-1),"TOP"),("PADDING",(0,0),(-1,-1),8)]))
story += [cover, Spacer(1, 10*mm)]
callout = Table([[P("Conclusao executiva", "CellBold")],[P("A separacao entre Control Plane e encoder foi implantada e comprovou que o painel pode reiniciar sem trocar o PID do transporte. A atualizacao grafica por ZMQ tambem manteve os PIDs. Entretanto, a garantia operacional 24x7 ainda nao deve ser declarada concluida: persistencia apos reinicio e fallback automatico estavam em endurecimento, e o teste de falha forcada do produtor ainda nao havia sido aprovado no momento deste documento.", "CalloutGSA")]], colWidths=[162*mm])
callout.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),GOLD),("BACKGROUND",(0,1),(-1,1),PALE),("BOX",(0,0),(-1,-1),0.8,GOLD),("PADDING",(0,0),(-1,-1),8)]))
story += [callout, Spacer(1, 8*mm), P("Status geral", "H1GSA")]
story.append(table([
    [P("Area","CellBold"),P("Estado","CellBold"),P("Observacao","CellBold")],
    [P("Control Plane 1.7.0","Cell"),status("IMPLANTADO"),P("Saudavel no ultimo diagnostico; atua como cliente do engine.","Cell")],
    [P("Encoder Engine 1.0.0","Cell"),status("IMPLANTADO"),P("Transporte e produtor separados em processos independentes.","Cell")],
    [P("Atualizacao grafica sem RTMP restart","Cell"),status("COMPROVADO"),P("52 comandos ZMQ; transporte e produtor mantidos.","Cell")],
    [P("Troca isolada de fontes","Cell"),status("COMPROVADO"),P("Produtor mudou; transporte RTMP manteve o mesmo PID.","Cell")],
    [P("Fallback automatico em falha forcada","Cell"),status("PENDENTE","pending"),P("Candidato construido, mas o ultimo teste forcado nao iniciou o fallback no prazo observado.","Cell")],
    [P("Live publica no YouTube","Cell"),status("NAO CONFIRMADA","risk"),P("A VPS reportava envio; o evento publico nao estava online/confirmado.","Cell")],
], [48*mm,31*mm,83*mm]))

story += [PageBreak(), P("1. Objetivo e criterios de aceite", "H1GSA")]
story += [P("O objetivo solicitado e manter a GSA TV continuamente no ar e permitir alteracoes rotineiras sem recriar a conexao RTMP com o YouTube. A arquitetura anterior nao atendia esse objetivo porque o FFmpeg era processo filho do container do Control Plane."), P("Criterios tecnicos adotados", "H2GSA")]
for x in [
    "Reiniciar ou atualizar o Control Plane sem encerrar o transporte RTMP.",
    "Atualizar feeds e propriedades graficas sem reiniciar o encoder.",
    "Trocar a fonte de programacao alterando somente o produtor interno.",
    "Impedir dois transportes concorrentes na mesma chave por trava exclusiva no PostgreSQL.",
    "Restaurar automaticamente o ultimo estado apos falha de processo ou reboot.",
    "Exibir fallback continuo quando a fonte principal falhar.",
    "Separar estado interno de envio do estado publico real do evento no YouTube.",
]: story.append(bullet(x))

story += [P("Limite de garantia", "H2GSA"), P("Uma unica VPS nao oferece garantia absoluta contra falha total do host, indisponibilidade do provedor, ruptura de rota de internet ou indisponibilidade do YouTube. Alta disponibilidade real contra perda integral da VPS requer uma segunda instancia em outro dominio de falha, com estrategia de ingestao de backup.")]

story += [P("2. Arquitetura atual", "H1GSA")]
arch = table([
    [P("Camada","CellBold"),P("Responsabilidade","CellBold"),P("Tecnologia","CellBold")],
    [P("Fontes e grade","Cell"),P("Midias, playlist, HLS e programacao automatizada.","Cell"),P("ffplayout + arquivos locais","Cell")],
    [P("Control Plane","Cell"),P("API, jobs, banco, comandos operacionais e configuracao.","Cell"),P("Node.js 20 / PostgreSQL","Cell")],
    [P("Produtor interno","Cell"),P("Decodifica a fonte, compoe cards/logo e entrega MPEG-TS local.","Cell"),P("FFmpeg + ZMQ + UDP local","Cell")],
    [P("Transporte externo","Cell"),P("Mantem a sessao RTMP e envia ao YouTube; nao muda nas trocas comuns.","Cell"),P("FFmpeg persistente","Cell")],
    [P("Automacao","Cell"),P("Feeds, preparacao editorial e agenda.","Cell"),P("n8n + APIs oficiais","Cell")],
    [P("Supervisao","Cell"),P("Saude do canal e recuperacao.","Cell"),P("Docker health, watchdog; guardiao 24x7 pendente","Cell")],
], [34*mm,83*mm,45*mm])
story += [arch, Spacer(1,6*mm), P("Fluxo de sinal", "H2GSA")]
flow = Table([[P("ffplayout / midia / fonte ao vivo", "CellBold"), P("->", "CellBold"), P("produtor interno", "CellBold"), P("->", "CellBold"), P("transporte RTMP", "CellBold"), P("->", "CellBold"), P("YouTube", "CellBold")]], colWidths=[39*mm,8*mm,31*mm,8*mm,34*mm,8*mm,30*mm])
flow.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,-1),PALE),("BOX",(0,0),(-1,-1),0.7,CYAN),("ALIGN",(0,0),(-1,-1),"CENTER"),("VALIGN",(0,0),(-1,-1),"MIDDLE"),("PADDING",(0,0),(-1,-1),7)]))
story += [flow]

story += [PageBreak(), P("3. Evolucao tecnica realizada", "H1GSA")]
timeline = [
    ("1.6.37", "Estado seguro anterior", "Um FFmpeg dentro do Control Plane; mudancas de container derrubavam a sessao."),
    ("1.6.38", "Candidata dinamica", "ZMQ e trava de encoder; houve regressao de escopo e falha de restauracao."),
    ("1.6.39", "Correcao intermediaria", "Restauracao de media, ZMQ e diagnostico de drawtext; feeds melhoraram, mas o encoder continuava acoplado."),
    ("1.7.0", "Separacao implantada", "Control Plane passou a anexar-se ao engine externo; reinicio do painel nao encerra o transporte."),
    ("Engine 1.0.0", "Dois estagios", "Produtor entrega MPEG-TS local e transporte persistente envia RTMP."),
]
story.append(table([[P("Versao","CellBold"),P("Marco","CellBold"),P("Resultado","CellBold")]] + [[P(a,"CellBold"),P(b,"Cell"),P(c,"Cell")] for a,b,c in timeline], [27*mm,42*mm,93*mm]))
story += [P("Falhas relevantes encontradas e tratadas", "H2GSA")]
for x in [
    "Arquivos antigos identificados incorretamente como Holt continham Nyla; o primeiro render foi rejeitado.",
    "O primeiro deploy dinamico teve regressao 'next is not defined' e foi revertido.",
    "O relogio drawtext exigiu escape adicional no filtro com ZMQ.",
    "O comando drawtext reinit sobre textfile era invalido ('Both text and text file provided'); o corpo passou a usar reload=1.",
    "O Control Plane 1.6.37 restaurava program em vez de preservar media:<id>; corrigido na 1.6.39.",
    "Recriacao do container do painel encerrava o FFmpeg e podia fazer o YouTube finalizar a live; corrigido arquiteturalmente na 1.7.0.",
]: story.append(bullet(x))

story += [P("4. Evidencias de validacao", "H1GSA")]
story.append(table([
    [P("Teste","CellBold"),P("Evidencia","CellBold"),P("Resultado","CellBold")],
    [P("Reinicio do Control Plane","Cell"),P("Outer PID 18 e producer PID 20 permaneceram iguais apos recriacao do painel.","Cell"),status("PASS")],
    [P("Graphics reload","Cell"),P("4 cards e 52 comandos; transport_restarted=false; PIDs inalterados.","Cell"),status("PASS")],
    [P("Troca isolada vermelho -> azul","Cell"),P("Outer permaneceu; produtor mudou; receptor RTMP continuou running.","Cell"),status("PASS")],
    [P("Estado de producao","Cell"),P("Control Plane 1.7.0 e Encoder Engine 1.0.0 reportados running/healthy.","Cell"),status("PASS")],
    [P("Canal interno","Cell"),P("online | running | media:media-gsa-agora-nature-narrated-v1 | sending.","Cell"),status("PASS")],
    [P("Falha forcada do produtor","Cell"),P("SIGKILL aplicado; fallback nao ficou running no prazo de 4 segundos.","Cell"),status("NAO APROVADO","risk")],
    [P("YouTube publico","Cell"),P("Consulta automatica permaneceu unconfirmed; usuario informou que nao estava online.","Cell"),status("NAO APROVADO","risk")],
], [42*mm,86*mm,34*mm]))

story += [PageBreak(), P("5. Estado operacional no corte", "H1GSA")]
story.append(table([
    [P("Item","CellBold"),P("Valor conhecido","CellBold")],
    [P("Canal","Cell"),P("ch-main","Cell")],
    [P("Control Plane","Cell"),P("gsa-tv/control-plane:1.7.0 - running/healthy no ultimo diagnostico","Cell")],
    [P("Encoder Engine","Cell"),P("gsa-tv/encoder-engine:1.0.0 - running/healthy no ultimo diagnostico","Cell")],
    [P("Modo interno","Cell"),P("media:media-gsa-agora-nature-narrated-v1","Cell")],
    [P("Sinal interno","Cell"),P("sending, sem last_error no ultimo diagnostico","Cell")],
    [P("Perfil","Cell"),P("1920x1080, 30 fps, H.264, AAC 48 kHz, perfil observado de 6 Mbps","Cell")],
    [P("Evento monitorado","Cell"),P("g-Kbyx_zG-Y","Cell")],
    [P("Live publica","Cell"),P("Nao confirmada e informada como offline pelo usuario","Cell")],
], [48*mm,114*mm]))
story += [P("Importante", "H2GSA"), P("O estado sending no banco significa que o sistema local considera o envio ativo. Ele nao prova que o evento esta publico. O YouTube pode receber ingestao e ainda manter PUBLIC_LIVE=false, exigir acao 'Transmitir ao vivo' ou ter encerrado o evento apos uma queda.")]

story += [P("6. Projeto 24x7 - requisitos e pendencias", "H1GSA")]
story.append(table([
    [P("Controle","CellBold"),P("Situacao","CellBold"),P("Acao necessaria","CellBold")],
    [P("Docker restart unless-stopped","Cell"),status("ATIVO"),P("Manter e validar apos reboot controlado.","Cell")],
    [P("Trava exclusiva PostgreSQL","Cell"),status("ATIVA"),P("Confirmar propriedade pelo engine em todos os caminhos.","Cell")],
    [P("Reinicio automatico do produtor","Cell"),status("IMPLEMENTADO"),P("Repetir teste de morte forcada e medir tempo de recuperacao.","Cell")],
    [P("Reinicio automatico do transporte","Cell"),status("CANDIDATO","pending"),P("Promover e testar sem a chave publica.","Cell")],
    [P("Persistencia do ultimo estado","Cell"),status("CANDIDATO","pending"),P("Validar container restart e reboot completo.","Cell")],
    [P("Fallback continuo","Cell"),status("FALHOU NO ULTIMO TESTE","risk"),P("Corrigir causa, validar audio/video e manter outer PID.","Cell")],
    [P("Guardiao externo","Cell"),status("PENDENTE","pending"),P("Instalar timer/systemd com limiar, logs e anti-loop.","Cell")],
    [P("Segunda VPS","Cell"),status("NAO EXISTE","pending"),P("Necessaria para alta disponibilidade contra perda total do host.","Cell")],
], [45*mm,40*mm,77*mm]))

story += [PageBreak(), P("7. Escolha das tecnologias", "H1GSA")]
story += [P("Recomendacao: manter FFmpeg como motor de codificacao e transporte, ffplayout como playout de grade e o novo engine como proprietario persistente da sessao. A falha anterior era de acoplamento, nao uma limitacao fundamental do FFmpeg.")]
story.append(table([
    [P("Opcao","CellBold"),P("Adequacao","CellBold"),P("Decisao","CellBold")],
    [P("FFmpeg + engine proprio","Cell"),P("Leve, automatizavel, excelente em servidor headless e compativel com a infraestrutura atual.","Cell"),status("RECOMENDADO")],
    [P("ffplayout","Cell"),P("Adequado para grade, HLS e continuidade; nao deve ser o unico proprietario do RTMP externo.","Cell"),status("MANTER")],
    [P("OBS Studio","Cell"),P("Bom para operacao humana com interface, mas inadequado como nucleo de VPS headless 24x7.","Cell"),status("NAO RECOMENDADO","pending")],
    [P("CasparCG","Cell"),P("Playout profissional, porem mais pesado e complexo; nao resolve sozinho HA de VPS ou evento YouTube.","Cell"),status("SEM GANHO AGORA","pending")],
    [P("GStreamer","Cell"),P("Excelente para pipelines dinamicos, mas aumentaria complexidade operacional e de suporte neste momento.","Cell"),status("ALTERNATIVA FUTURA","pending")],
], [37*mm,88*mm,37*mm]))

story += [P("8. Procedimentos operacionais", "H1GSA")]
story += [P("Mudancas sem interrupcao esperada", "H2GSA")]
for x in ["Atualizacao dos textos dos feeds por arquivos com reload=1.", "Alteracao de cards, titulos, cores e dimensoes suportadas por ZMQ.", "Reinicio ou deploy apenas do Control Plane 1.7.0.", "Troca de fonte pelo produtor interno, desde que o transporte permaneça saudavel."]: story.append(bullet(x))
story += [P("Mudancas que ainda exigem janela", "H2GSA")]
for x in ["Resolucao, FPS, codec, bitrate ou chave RTMP.", "Atualizacao do proprio Encoder Engine.", "Reboot da VPS ate a restauracao automatica ser aprovada.", "Qualquer intervencao quando o fallback e o guardiao ainda nao estiverem validados."]: story.append(bullet(x))
story += [P("Regra de liberacao", "H2GSA"), P("Nao declarar operacao 24x7 concluida nem recolocar a live publica como definitiva antes de: aprovar fallback forcado; provar restauracao apos restart do engine; provar reboot da VPS; validar audio, video e RTMP; confirmar PUBLIC_LIVE=true no evento correto do YouTube.")]

story += [PageBreak(), P("9. Plano de fechamento recomendado", "H1GSA")]
steps = [
    ("1", "Corrigir fallback", "Capturar o erro exato, iniciar fallback em ate poucos segundos e manter o PID do transporte."),
    ("2", "Persistir estado", "Restaurar automaticamente modo, argumentos e destino apos restart do engine."),
    ("3", "Instalar guardiao", "Supervisionar engine e Control Plane fora dos containers, com anti-loop e logs."),
    ("4", "Teste de caos", "Matar produtor, reiniciar painel, reiniciar engine e simular fonte ausente."),
    ("5", "Teste de reboot", "Reiniciar VPS em janela controlada e medir retorno integral."),
    ("6", "Validar YouTube", "Confirmar ingestao, saude, resolucao 1080p e PUBLIC_LIVE=true."),
    ("7", "Alta disponibilidade", "Planejar segunda VPS/regiao e ingestao de backup para falha total do host."),
]
story.append(table([[P("Etapa","CellBold"),P("Entrega","CellBold"),P("Aceite","CellBold")]] + [[P(a,"CellBold"),P(b,"CellBold"),P(c,"Cell")] for a,b,c in steps], [15*mm,45*mm,102*mm]))

story += [Spacer(1,7*mm), P("10. Registro de integridade deste documento", "H1GSA"), P("Este PDF registra o estado observado e os testes executados ate a interrupcao solicitada para documentacao. Ele diferencia explicitamente implementacao, validacao aprovada e trabalho ainda pendente. PIDs sao evidencias temporais e mudam legitimamente apos reinicio do servico correspondente.")]
story += [P("Artefatos tecnicos relacionados", "H2GSA")]
for x in [
    "infrastructure/gsa-tv/services/encoder-engine/ - codigo e compose do novo engine.",
    "infrastructure/gsa-tv/services/playout-api/compose.production.yml - referencia do Control Plane 1.7.0.",
    "infrastructure/gsa-tv/docs/runbook-operacional-gsa-tv.md - runbook operacional existente, ainda sujeito a consolidacao apos os testes 24x7.",
    "scratch/ - scripts de auditoria, build, promocao e testes usados na implantacao.",
]: story.append(bullet(x))

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUT)
