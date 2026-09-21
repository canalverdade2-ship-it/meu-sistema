from pathlib import Path
import subprocess

base = Path('/opt/gsa-tv/backups/automation-repair-20260914-0455')
p = Path('/home/opc/gsa-ai/bin/gsa-tts-engine.mjs')
s = p.read_text()
s = s.replace('    if (fs.existsSync(dated)) return dated;', "    if (fs.existsSync(dated)) return dated;\n    throw new Error('Roteiro ausente para a data solicitada: ' + targetDate);")
s = s.replace("    method: 'POST',", "    method: 'POST',\n    signal: AbortSignal.timeout(90000),", 1)
s = s.replace('  const totalDuration = getAudioDuration(masterWav);', "  const totalDuration = getAudioDuration(masterWav);\n  if (!Number.isFinite(totalDuration) || totalDuration <= 0 || getAudioDuration(masterMp3) <= 0) throw new Error('Master rejeitado: áudio ausente, inválido ou com duração zero');")
s = s.replace('  for (const t of targets) {', '  let failures = 0;\n  for (const t of targets) {')
s = s.replace("      console.error('[TTS Engine Error]", "      failures++;\n      console.error('[TTS Engine Error]")
old = '  console.log(`\\n[TTS Engine] Processamento concluído com sucesso para ${targets.length} programa(s)!`);'
assert old in s
s = s.replace(old, "  if (failures) throw new Error(failures + ' de ' + targets.length + ' programas falharam; lote incompleto');\n  console.log('[TTS Engine] Lote validado: ' + targets.length + ' programas.');")
staged = base / 'gsa-tts-engine.new.mjs'
staged.write_text(s)
subprocess.run(['node', '--check', str(staged)], check=True)

p2 = Path('/opt/gsa-tv/bin/gsa-tv-night-controller.sh')
c = p2.read_text()
a = c.index('    # 4. Disparar Night Factory')
b = c.index('    ;;', a)
c = c[:a] + '    systemctl start --no-block gsa-tv-night-factory.service\n    log "Produção solicitada ao serviço único; conferir resultado do lote."\n' + c[b:]
c = c.replace('00:59 BRT', '00:00 BRT')
c = c.replace('    log "Operação morning-start finalizada com sucesso."', '    if [ "$PROG_OK" != true ]; then exit 1; fi\n    log "Operação morning-start confirmada pelo encoder."')
controller = base / 'night-controller.new.sh'
controller.write_text(c)
subprocess.run(['bash', '-n', str(controller)], check=True)

for name in ['gsa-tv-night-factory', 'gsa-tv-night-stop']:
    d = Path('/etc/systemd/system') / (name + '.timer.d')
    d.mkdir(exist_ok=True)
    dest = d / '95-programming-window.conf'
    assert not dest.exists(), str(dest)
    dest.write_text('[Timer]\nOnCalendar=\nOnCalendar=*-*-* 00:00:00 America/Sao_Paulo\nPersistent=false\nAccuracySec=1s\nRandomizedDelaySec=0\n')
for name in ['gsa-tv-night-factory', 'gsa-tv-night-stop', 'gsa-tv-morning-start']:
    d = Path('/etc/systemd/system') / (name + '.service.d')
    d.mkdir(exist_ok=True)
    dest = d / '95-programming-timezone.conf'
    assert not dest.exists()
    dest.write_text('[Service]\nEnvironment=TZ=America/Sao_Paulo\n')
subprocess.run(['install', '-m', '755', str(staged), str(p)], check=True)
subprocess.run(['install', '-m', '755', str(controller), str(p2)], check=True)
print('PHASE1_PATCHES_INSTALLED')
