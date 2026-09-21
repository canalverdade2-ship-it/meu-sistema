import base64
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import time
from pathlib import Path

import requests
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

BASE = Path('/home/opc/gsa-program-builder')
JOBS = BASE / 'jobs'
CACHE = BASE / 'cache'
OUTPUT = BASE / 'output'
LOCK = BASE / 'builder.lock'
BUMPERS = Path('/opt/gsa-tv/cache/media/1/identity/program-bumpers-2026-09-05/mastered')
BUMPERS_CACHE = CACHE / 'bumpers'
MEDIA_ROOT = Path('/opt/gsa-tv/cache/media/1')
PUBLISH_DIR = MEDIA_ROOT / 'program-masters'
IMAGE = 'gsa-tv/control-plane:1.8.7'
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
PROFILES = {
    '720p': {'width': 1280, 'height': 720, 'fps': 30, 'audio_rate': 48000, 'audio_channels': 2},
    '1080p': {'width': 1920, 'height': 1080, 'fps': 30, 'audio_rate': 48000, 'audio_channels': 2},
}
DEFAULT_PROFILE = PROFILES['1080p']
PROFILE = DEFAULT_PROFILE


def resolve_profile(manifest):
    req = manifest.get('perfil') or manifest.get('profile')
    if isinstance(req, dict) and req.get('width') and req.get('height'):
        return {
            'width': int(req['width']),
            'height': int(req['height']),
            'fps': int(req.get('fps', 30)),
            'audio_rate': int(req.get('audio_rate', 48000)),
            'audio_channels': int(req.get('audio_channels', 2)),
        }
    if isinstance(req, str) and req.lower() in PROFILES:
        return dict(PROFILES[req.lower()])
    return dict(DEFAULT_PROFILE)
ALLOWED_EXTS = {'.mp4', '.mov', '.mkv', '.webm', '.mp3', '.wav', '.m4a', '.aac'}

FISH_API_URL = 'https://api.fish.audio/v1/tts'
FISH_MODEL = 's2.1-pro-free'
FISH_VOICE_CONTINUITY = '5c8a9b5d0b2549c7ada853529199ebe5'
FISH_VAULT_PATH = Path('/home/opc/gsa-ai/secrets/fish-production.enc.json')


def load_fish_api_key() -> str:
    if not FISH_VAULT_PATH.is_file():
        raise FileNotFoundError(f'Cofre de credenciais Fish Audio ausente: {FISH_VAULT_PATH}')
    hex_key = os.environ.get('GSA_TV_SECRET_KEY')
    if not hex_key:
        try:
            proc = subprocess.run(
                ['docker', 'exec', 'gsa-tv-control-plane', 'printenv', 'GSA_TV_SECRET_KEY'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True
            )
            hex_key = proc.stdout.strip()
        except Exception:
            proc = subprocess.run(
                ['sudo', 'docker', 'exec', 'gsa-tv-control-plane', 'printenv', 'GSA_TV_SECRET_KEY'],
                stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True
            )
            hex_key = proc.stdout.strip()
    key_bytes = bytes.fromhex(hex_key)
    vault_data = json.loads(FISH_VAULT_PATH.read_text(encoding='utf-8'))

    def b64url_decode(s: str) -> bytes:
        return base64.urlsafe_b64decode(s + '=' * (-len(s) % 4))

    nonce = b64url_decode(vault_data['nonce'])
    ciphertext = b64url_decode(vault_data['ciphertext'])
    aad = vault_data['aad'].encode('utf-8')
    aesgcm = AESGCM(key_bytes)
    decrypted_bytes = aesgcm.decrypt(nonce, ciphertext, aad)
    decrypted_json = json.loads(decrypted_bytes.decode('utf-8'))
    return decrypted_json['api_key']


def synthesize_continuity_bumper(program_name: str, slug: str, kind: str, job_dir: Path = None) -> Path:
    is_presenting = (kind == 'presenting')
    suffix = 'apresentando' if is_presenting else 'de-volta'
    spoken_text = f"Estamos apresentando {program_name}." if is_presenting else f"Estamos de volta {program_name}."

    BUMPERS_CACHE.mkdir(parents=True, exist_ok=True)
    token_data = f"{slug}|{kind}|{spoken_text}|{FISH_VOICE_CONTINUITY}|{FISH_MODEL}|48k-5s-v1"
    cache_token = hashlib.sha256(token_data.encode('utf-8')).hexdigest()[:12]
    conformed_wav = BUMPERS_CACHE / f"{slug}--{suffix}--{cache_token}.wav"

    if conformed_wav.exists() and conformed_wav.stat().st_size > 1024:
        return conformed_wav

    api_key = load_fish_api_key()
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'model': FISH_MODEL
    }
    payload = {
        'text': spoken_text,
        'reference_id': FISH_VOICE_CONTINUITY,
        'format': 'mp3',
        'normalize': True,
        'latency': 'normal',
        'prosody': {'speed': 1.0, 'volume': 0, 'normalize_loudness': True}
    }
    resp = requests.post(FISH_API_URL, headers=headers, json=payload, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"Fish Audio TTS falhou ({resp.status_code}): {resp.text[:300]}")

    raw_mp3 = (job_dir or CACHE) / f"raw_tts_{slug}_{kind}_{cache_token}.mp3"
    raw_mp3.write_bytes(resp.content)

    filter_graph = (
        "[0:a]adelay=250|250,afade=t=in:st=0:d=0.25,apad=whole_dur=5.0,atrim=0:5.0,"
        "afade=t=out:st=4.5:d=0.5,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000[a]"
    )
    temp_wav = conformed_wav.with_suffix(f'.{os.getpid()}.tmp.wav')
    args = [
        '-y', '-i', str(raw_mp3),
        '-filter_complex', filter_graph,
        '-map', '[a]',
        '-ac', '2',
        '-ar', '48000',
        '-c:a', 'pcm_s16le',
        str(temp_wav)
    ]
    p = run_tool('ffmpeg', args)
    raw_mp3.unlink(missing_ok=True)
    if p.returncode != 0:
        temp_wav.unlink(missing_ok=True)
        raise RuntimeError(f"Falha ao conformar áudio de continuidade com FFmpeg: {p.stderr[-1500:]}")
    os.replace(temp_wav, conformed_wav)

    canonical_alias = BUMPERS_CACHE / f"{slug}--{suffix}.wav"
    try:
        shutil.copyfile(conformed_wav, canonical_alias)
    except Exception:
        pass

    return conformed_wav


def bumper_path(slug, kind, program=None, job_dir=None):
    suffix = 'apresentando' if kind == 'presenting' else 'de-volta'
    program_name = program or slug.replace('-', ' ').title()
    try:
        return synthesize_continuity_bumper(program_name, slug, kind, job_dir)
    except Exception as exc:
        p = BUMPERS / f'{slug}--{suffix}.mp3'
        if p.is_file():
            return p
        raise RuntimeError(f'Falha ao gerar bumper Fish Audio para {slug} ({kind}): {exc}') from exc


def safe_slug(value):
    value = str(value or '').strip().lower()
    if not re.fullmatch(r'[a-z0-9-]{2,80}', value):
        raise ValueError('slug invalido')
    return value


def safe_media_path(value):
    p = Path(str(value)).expanduser().resolve()
    if p.suffix.lower() not in ALLOWED_EXTS or not p.is_file():
        raise ValueError(f'arquivo invalido: {p}')
    roots = [MEDIA_ROOT.resolve(), BASE.resolve(), Path('/home/opc/gsa-ai').resolve()]
    if not any(p == r or str(p).startswith(str(r) + os.sep) for r in roots):
        raise ValueError(f'arquivo fora das raizes permitidas: {p}')
    return p


def docker_prefix(cpus='1.0'):
    return ['nice', '-n', '15', 'ionice', '-c', '3', 'docker', 'run', '--rm', '-i',
            '--cpus', str(cpus), '--cpu-shares', '128', '--user', '1000:1000', '-v', '/opt:/opt', '-v', '/home:/home',
            '-v', '/tmp:/tmp', '-w', str(BASE), IMAGE]


def run_tool(tool, args, cpus='1.0'):
    cmd = docker_prefix(cpus) + [tool] + list(args)
    return subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)


def probe(path):
    p = run_tool('ffprobe', ['-v', 'error', '-show_entries',
                             'format=duration:stream=codec_name,codec_type,width,height,r_frame_rate,sample_rate,channels',
                             '-of', 'json', str(path)], cpus='0.25')
    if p.returncode != 0:
        raise RuntimeError(p.stderr[-1200:])
    return json.loads(p.stdout)


def duration(path):
    data = probe(path)
    return float(data.get('format', {}).get('duration') or 0)


def load_guard(max_factor=0.80):
    cores = os.cpu_count() or 1
    load1 = os.getloadavg()[0]
    limit = cores * max_factor
    return {'ok': load1 <= limit, 'load1': round(load1, 2), 'cores': cores, 'limit': round(limit, 2)}


def cache_key(path, kind, title='', profile_tag='1080p30-v1'):
    st = path.stat()
    raw = f'{path}|{st.st_mtime_ns}|{st.st_size}|{kind}|{title}|{profile_tag}'.encode()
    return hashlib.sha256(raw).hexdigest()[:20]


def encode_args():
    return ['-c:v', 'libx264', '-preset', 'superfast', '-crf', '23', '-g', '60',
            '-keyint_min', '60', '-sc_threshold', '0', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart']


def normalize_video(src, profile, trim=None):
    w = profile['width']
    h = profile['height']
    fps = profile['fps']
    ptag = f'{w}x{h}@{fps}'
    key = cache_key(src, 'video', f'{trim or ""}|{ptag}', profile_tag=ptag)
    out = CACHE / f'{key}.mp4'
    if out.exists() and out.stat().st_size > 1024:
        return out
    info = probe(src)
    has_audio = any(s.get('codec_type') == 'audio' for s in info.get('streams', []))
    vf = f'scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},fps={fps},format=yuv420p'
    args = ['-y', '-i', str(src)]
    if trim:
        args += ['-t', str(float(trim))]
    if has_audio:
        args += ['-vf', vf, '-af', 'aresample=48000', '-map', '0:v:0', '-map', '0:a:0']
    else:
        args += ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
                 '-vf', vf, '-map', '0:v:0', '-map', '1:a:0', '-shortest']
    args += encode_args() + [str(out)]
    p = run_tool('ffmpeg', args)
    if p.returncode != 0:
        out.unlink(missing_ok=True)
        raise RuntimeError(p.stderr[-2200:])
    return out


def write_text(job_dir, name, text):
    p = job_dir / name
    p.write_text(str(text), encoding='utf-8')
    return p


def render_audio_bumper(audio, program_name, label, job_dir, profile):
    w = profile['width']
    h = profile['height']
    fps = profile['fps']
    ptag = f'{w}x{h}@{fps}'
    key = cache_key(audio, 'bumper', f'{program_name}|{label}|{ptag}', profile_tag=ptag)
    out = CACHE / f'{key}.mp4'
    if out.exists() and out.stat().st_size > 1024:
        return out
    dur = max(1.0, duration(audio))
    fade_start = max(0.0, dur - 0.35)
    program_file = write_text(job_dir, f'{key}_program.txt', program_name)
    label_file = write_text(job_dir, f'{key}_label.txt', label)
    header_h = int(round(110 * h / 720))
    logo_fs = int(round(38 * h / 720))
    logo_x = int(round(48 * w / 1280))
    logo_y = int(round(34 * h / 720))
    prog_fs = int(round(64 * h / 720))
    prog_y = int(round(255 * h / 720))
    label_fs = int(round(34 * h / 720))
    label_y = int(round(350 * h / 720))
    vf = (
        "drawbox=x=0:y=0:w=iw:h=ih:color=0x101826:t=fill,"
        f"drawbox=x=0:y=0:w=iw:h={header_h}:color=0x1D2A44:t=fill,"
        f"drawtext=fontfile={FONT_BOLD}:text='GSA TV':fontcolor=white:fontsize={logo_fs}:x={logo_x}:y={logo_y},"
        f"drawtext=fontfile={FONT_BOLD}:textfile={program_file}:fontcolor=white:fontsize={prog_fs}:x=(w-text_w)/2:y={prog_y},"
        f"drawtext=fontfile={FONT_REG}:textfile={label_file}:fontcolor=white@0.90:fontsize={label_fs}:x=(w-text_w)/2:y={label_y},"
        f"fade=t=in:st=0:d=0.25,fade=t=out:st={fade_start:.3f}:d=0.35"
    )
    args = ['-y', '-f', 'lavfi', '-i', f'color=c=0x101826:s={w}x{h}:r={fps}:d={dur:.3f}',
            '-i', str(audio), '-vf', vf, '-map', '0:v:0', '-map', '1:a:0', '-t', f'{dur:.3f}']
    args += encode_args() + [str(out)]
    p = run_tool('ffmpeg', args)
    if p.returncode != 0:
        out.unlink(missing_ok=True)
        raise RuntimeError(p.stderr[-2200:])
    return out


def expand_manifest(manifest):
    program = str(manifest.get('programa') or '').strip() or 'GSA TV'
    slug = safe_slug(manifest.get('slug'))
    if isinstance(manifest.get('timeline'), list):
        return program, slug, manifest['timeline']
    blocks = manifest.get('blocos') or []
    if not isinstance(blocks, list) or not blocks:
        raise ValueError('informe timeline ou blocos')
    timeline = []
    if manifest.get('abertura'):
        timeline.append({'tipo': 'video', 'papel': 'abertura', 'arquivo': manifest['abertura']})
    if manifest.get('usar_bumpers', True):
        timeline.append({'tipo': 'presenting'})
    intervals = manifest.get('intervalos') or []
    for i, block in enumerate(blocks):
        timeline.append({'tipo': 'video', 'papel': f'bloco-{i+1}', 'arquivo': block})
        if i < len(blocks) - 1 and i < len(intervals) and intervals[i]:
            ads = intervals[i] if isinstance(intervals[i], list) else [intervals[i]]
            for ad in ads:
                timeline.append({'tipo': 'video', 'papel': 'intervalo', 'arquivo': ad})
            if manifest.get('usar_bumpers', True):
                timeline.append({'tipo': 'return'})
    if manifest.get('encerramento'):
        timeline.append({'tipo': 'video', 'papel': 'encerramento', 'arquivo': manifest['encerramento']})
    return program, slug, timeline


def resolve_item(item, program, slug, job_dir=None):
    if not isinstance(item, dict):
        raise ValueError('item de timeline invalido')
    kind = str(item.get('tipo') or 'video').strip().lower()
    if kind in {'video', 'abertura', 'encerramento', 'intervalo', 'bloco'}:
        src = safe_media_path(item.get('arquivo'))
        return {'tipo': 'video', 'papel': item.get('papel') or kind, 'arquivo': str(src),
                'trim': item.get('duracao_max')}
    if kind == 'presenting':
        return {'tipo': 'bumper', 'papel': 'apresentando',
                'arquivo': str(bumper_path(slug, 'presenting', program=program, job_dir=job_dir)),
                'label': 'ESTAMOS APRESENTANDO'}
    if kind in {'return', 'de-volta', 'voltamos'}:
        return {'tipo': 'bumper', 'papel': 'de-volta',
                'arquivo': str(bumper_path(slug, 'return', program=program, job_dir=job_dir)),
                'label': 'DE VOLTA À PROGRAMAÇÃO'}
    if kind == 'audio_bumper':
        src = safe_media_path(item.get('arquivo'))
        return {'tipo': 'bumper', 'papel': item.get('papel') or 'bumper', 'arquivo': str(src),
                'label': str(item.get('label') or program)[:100]}
    raise ValueError(f'tipo nao suportado: {kind}')


def validate_manifest(manifest):
    program, slug, timeline = expand_manifest(manifest)
    profile = resolve_profile(manifest)
    resolved = [resolve_item(item, program, slug) for item in timeline]
    if not resolved:
        raise ValueError('timeline vazia')
    return {'ok': True, 'programa': program, 'slug': slug, 'profile': profile,
            'timeline': resolved, 'load': load_guard()}


def safe_output_name(value, slug):
    name = os.path.basename(str(value or '').strip())
    if not name:
        name = f'{slug}-master-{time.strftime("%Y%m%d-%H%M%S")}.mp4'
    if not re.fullmatch(r'[A-Za-z0-9._-]{3,120}.mp4', name):
        raise ValueError('nome de saida invalido')
    return name


def prepare_segments(resolved, program, job_dir, profile):
    result = []
    for index, item in enumerate(resolved, start=1):
        src = Path(item['arquivo'])
        if item['tipo'] == 'video':
            out = normalize_video(src, profile, item.get('trim'))
        else:
            out = render_audio_bumper(src, program, item.get('label') or program, job_dir, profile)
        result.append({'ordem': index, 'papel': item['papel'], 'origem': str(src), 'normalizado': str(out)})
    return result


def concat_segments(segments, out_file, job_dir):
    concat_file = job_dir / 'concat.txt'
    lines = [f"file '{s['normalizado']}'" for s in segments]
    concat_file.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    temp = out_file.with_suffix('.tmp.mp4')
    args = ['-y', '-f', 'concat', '-safe', '0', '-i', str(concat_file), '-c', 'copy',
            '-movflags', '+faststart', str(temp)]
    p = run_tool('ffmpeg', args, cpus='0.5')
    if p.returncode != 0:
        temp.unlink(missing_ok=True)
        raise RuntimeError(p.stderr[-2200:])
    os.replace(temp, out_file)
    return concat_file


def control_plane_post(endpoint, payload):
    data = base64.b64encode(json.dumps(payload, ensure_ascii=False).encode('utf-8')).decode('ascii')
    script = r"""(async()=>{const p=JSON.parse(Buffer.from(process.env.GSA_BUILDER_PAYLOAD,'base64').toString('utf8'));const r=await fetch('http://127.0.0.1:9202'+process.env.GSA_BUILDER_ENDPOINT,{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+process.env.INTERNAL_API_TOKEN},body:JSON.stringify(p)});const t=await r.text();if(!r.ok){console.error(t);process.exit(2)};process.stdout.write(t)})().catch(e=>{console.error(e);process.exit(3)})"""
    cmd = ['docker', 'exec', '-e', f'GSA_BUILDER_PAYLOAD={data}', '-e', f'GSA_BUILDER_ENDPOINT={endpoint}',
           'gsa-tv-control-plane', 'node', '-e', script]
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=45)
    if proc.returncode != 0:
        raise RuntimeError(f'Control Plane {endpoint}: {(proc.stderr or proc.stdout)[-1800:]}')
    try:
        return json.loads(proc.stdout)
    except Exception as exc:
        raise RuntimeError(f'Resposta inválida do Control Plane: {proc.stdout[-800:]}') from exc


def publish_master(out_file, slug, manifest):
    PUBLISH_DIR.mkdir(parents=True, exist_ok=True)
    published_name = safe_output_name(manifest.get('nome_publicado') or out_file.name, slug)
    target = PUBLISH_DIR / published_name
    temp = PUBLISH_DIR / f'.{published_name}.{os.getpid()}.tmp'
    shutil.copy2(out_file, temp)
    os.chmod(temp, 0o664)
    os.replace(temp, target)
    return target


def build(manifest, force=False):
    validation = validate_manifest(manifest)
    guard = validation['load']
    if not force and not guard['ok']:
        raise RuntimeError(f"VPS ocupada: load1={guard['load1']} limite={guard['limit']}")
    OUTPUT.mkdir(parents=True, exist_ok=True)
    JOBS.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    with open(LOCK, 'w') as lockf:
        try:
            fcntl.flock(lockf, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('ja existe um render em andamento')
        stamp = time.strftime('%Y%m%d-%H%M%S')
        job_id = f"{validation['slug']}-{stamp}-{os.getpid()}"
        job_dir = JOBS / job_id
        job_dir.mkdir(parents=True, exist_ok=False)
        name = safe_output_name(manifest.get('saida'), validation['slug'])
        out_file = OUTPUT / name
        status_file = job_dir / 'result.json'
        profile = validation['profile']
        try:
            segments = prepare_segments(validation['timeline'], validation['programa'], job_dir, profile)
            concat_file = concat_segments(segments, out_file, job_dir)
            info = probe(out_file)
            actual_duration = float(info.get('format', {}).get('duration') or 0)
            published = None
            library = None
            scheduling = None
            want_library = manifest.get('registrar_biblioteca') is True or isinstance(manifest.get('agendar'), dict)
            want_publish = manifest.get('publicar') is True or want_library
            if want_publish:
                published = publish_master(out_file, validation['slug'], manifest)
            if want_library:
                library = control_plane_post('/program-builder/register', {
                    'filename': published.name,
                    'title': str(manifest.get('titulo_biblioteca') or f"{validation['programa']} - Master")[:180],
                    'rights_ok': manifest.get('direitos_confirmados') is True,
                    'approved': manifest.get('aprovar_biblioteca') is True,
                    'slug': validation['slug'],
                    'builder_job_id': job_id,
                })
            schedule_cfg = manifest.get('agendar')
            if isinstance(schedule_cfg, dict):
                start = schedule_cfg.get('inicio') or schedule_cfg.get('scheduled_start')
                if not start:
                    raise ValueError('agendar.inicio obrigatorio')
                scheduling = control_plane_post('/program-builder/schedule', {
                    'media_item_id': library.get('media_id'),
                    'scheduled_start': start,
                    'title': str(schedule_cfg.get('titulo') or validation['programa'])[:180],
                    'dry_run': schedule_cfg.get('dry_run') is True,
                    'compile_playlist': schedule_cfg.get('compilar_grade', True) is not False,
                })
            result = {'ok': True, 'job_id': job_id, 'programa': validation['programa'],
                      'slug': validation['slug'], 'arquivo': str(out_file), 'profile': profile,
                      'duracao': actual_duration,
                      'bytes': out_file.stat().st_size, 'segmentos': segments,
                      'concat': str(concat_file), 'publicado': str(published) if published else None,
                      'biblioteca': library, 'agendamento': scheduling,
                      'load_inicio': guard}
            status_file.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
            return result
        except Exception as exc:
            status_file.write_text(json.dumps({'ok': False, 'erro': str(exc)}, ensure_ascii=False, indent=2), encoding='utf-8')
            raise


def load_manifest(path):
    p = Path(path).expanduser().resolve()
    return json.loads(p.read_text(encoding='utf-8'))


def main():
    import argparse
    parser = argparse.ArgumentParser(description='GSA Program Builder v1')
    parser.add_argument('action', choices=['validate', 'build', 'programs'])
    parser.add_argument('manifest', nargs='?')
    parser.add_argument('--force', action='store_true', help='ignora apenas o load guard; mantem lock e limite de CPU')
    args = parser.parse_args()
    if args.action == 'programs':
        all_slugs = {p.name.split('--', 1)[0] for p in BUMPERS.glob('*--apresentando.mp3')}
        if BUMPERS_CACHE.is_dir():
            all_slugs |= {p.name.split('--', 1)[0] for p in BUMPERS_CACHE.glob('*--apresentando*.wav')}
        names = sorted(all_slugs)
        print(json.dumps({'programas': names}, ensure_ascii=False, indent=2))
        return
    if not args.manifest:
        parser.error('manifest obrigatorio')
    manifest = load_manifest(args.manifest)
    result = validate_manifest(manifest) if args.action == 'validate' else build(manifest, force=args.force)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
