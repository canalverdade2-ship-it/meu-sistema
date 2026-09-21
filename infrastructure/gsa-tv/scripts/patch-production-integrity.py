"""One-time installer for the existing VPS builder, with backups taken separately."""
from pathlib import Path
import subprocess

p = Path('/home/opc/gsa-program-builder/video_assembler.py')
s = p.read_text()
s = s.replace('import argparse', 'import argparse\nimport re\nimport math')
s = s.replace("'channels': int(a_stream.get('channels', 0))", "'channels': int(a_stream.get('channels', 0)),\n        'fps': v_stream.get('r_frame_rate', '0/1')")
s = s.replace('def assemble_program(manifest_path, output_mp4=None):', 'def assemble_program(manifest_path, output_mp4=None, no_register=False, budget_seconds=None, broadcast_date=None):')
s = s.replace("    narration_dur = audio_info['duration']", "    narration_dur = audio_info['duration']\n    if not math.isfinite(narration_dur) or narration_dur <= 0:\n        raise ValueError('Locução inválida')\n    opening = find_opening_vinheta(slug)\n    opening_duration = probe_media(opening)['duration'] if opening else 0\n    if budget_seconds and narration_dur + opening_duration > budget_seconds:\n        raise ValueError(f'Programa excede bloco: {narration_dur + opening_duration:.1f}s > {budget_seconds}s')\n    if broadcast_date and not re.fullmatch(r'\\d{4}-\\d{2}-\\d{2}', broadcast_date):\n        raise ValueError('Data inválida')")
s = s.replace('vf_chain = ",".join(vf_filters)', 'vf_chain = "scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,fps=30,format=yuv420p," + ",".join(vf_filters)')
s = s.replace('f"{slug}-master-1080p.mp4"', 'f"{slug}-{broadcast_date or time.strftime(\'%Y-%m-%d\')}-master-1080p.mp4"')
s = s.replace('        os.replace(tmp_final, output_mp4)\n        \n        final_probe = probe_media(output_mp4)', '''        final_probe = probe_media(tmp_final)
        if (final_probe['width'], final_probe['height'], final_probe['vcodec'], final_probe['acodec'], final_probe['arate'], final_probe['channels']) != (1920, 1080, 'h264', 'aac', 48000, 2):
            raise ValueError('Master fora do perfil broadcast')
        if final_probe['fps'] not in ('30/1', '60/2'):
            raise ValueError('Master fora de 30fps')
        if final_probe['duration'] <= 0 or (budget_seconds and final_probe['duration'] > budget_seconds + 0.1):
            raise ValueError('Duração final inválida')
        if abs(final_probe['duration'] - narration_dur - opening_duration) > 2:
            raise ValueError('Master incompleto ou duração divergente')
        subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-i', str(tmp_final), '-f', 'null', '-'], check=True)
        os.replace(tmp_final, output_mp4)''')
s = s.replace('        register_in_database(slug, program_name, output_mp4, final_probe)', '''        qc = {'state': 'validated', 'broadcast_date': broadcast_date, 'program_slug': slug, 'path': str(output_mp4), 'probe': final_probe}
        output_mp4.with_suffix('.qc.json').write_text(json.dumps(qc))
        if not no_register:
            register_in_database(slug, program_name, output_mp4, final_probe)''')
s = s.replace('    args = parser.parse_args()', "    parser.add_argument('--no-register', action='store_true')\n    parser.add_argument('--budget-seconds', type=float)\n    parser.add_argument('--broadcast-date')\n    args = parser.parse_args()")
s = s.replace('    assemble_program(args.manifest, args.output)', '    assemble_program(args.manifest, args.output, args.no_register, args.budget_seconds, args.broadcast_date)')
assert 'Master fora do perfil' in s and 'qc.json' in s
compile(s, str(p), 'exec')
p.write_text(s)

# Guard TTS generation by an editorial word budget BEFORE spending synthesis calls.
p = Path('/home/opc/gsa-ai/bin/gsa-tts-engine.mjs')
s = p.read_text()
s = s.replace("    all: false,", "    all: false,\n    budgetSeconds: null,")
s = s.replace("    else if (args[i] === '--all')", "    else if (args[i] === '--budget-seconds') options.budgetSeconds = Number(args[++i]);\n    else if (args[i] === '--all')")
s = s.replace("  const chunkFiles = [];", "  if (options.budgetSeconds && paragraphs.join(' ').split(/\\s+/).length > Math.floor(Math.max(0, options.budgetSeconds - 60) * 1.5)) throw new Error('Roteiro excede orçamento de palavras do bloco; revisão necessária');\n  const chunkFiles = [];")
s = s.replace("    program: prog.programName,", "    broadcast_date: options.date,\n    script_sha256: crypto.createHash('sha256').update(prog.locucaoText).digest('hex'),\n    program: prog.programName,")
staged = p.with_suffix('.staged.mjs')
staged.write_text(s)
subprocess.run(['node', '--check', str(staged)], check=True)
staged.replace(p)
print('PRODUCTION_INTEGRITY_PATCHED')
