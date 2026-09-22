#!/usr/bin/env python3
"""Render a generic program with B-roll fallback engine."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess
import os
import urllib.request
import urllib.parse
import ipaddress
import socket
import textwrap
import unicodedata
import re

def sha(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def probe(path):
    return json.loads(subprocess.check_output([
        'ffprobe', '-v', 'error', '-show_format', '-show_streams', '-of', 'json', str(path)
    ], text=True))


def validate_inputs(script, manifest, target):
    digest = hashlib.sha256(script['narration'].encode()).hexdigest()
    review = script.get('review', {})
    if script.get('mode') not in ['generic_program', 'source_bound_program']:
        raise ValueError('Only generic or source-bound programs are supported')
    if review.get('pass') is not True or review.get('violations') != []:
        raise ValueError('Editorial review is missing or rejected')
    if any(x != digest for x in [script.get('script_sha256'), review.get('script_sha256'), manifest.get('script_sha256')]):
        raise ValueError('Narration and reviewed script hashes differ')
    if script['date'] != manifest.get('broadcast_date') or script['program'] != manifest.get('program'):
        raise ValueError('Programme/date mismatch')
    if not math.isfinite(target) or not 60 <= target <= 7200:
        raise ValueError('Invalid slot duration')

def compute_timing(audio_duration, slot_seconds, bumper_duration):
    values = (audio_duration, slot_seconds, bumper_duration)
    if not all(math.isfinite(float(x)) for x in values):
        raise ValueError('Non-finite duration')
    body_seconds = float(slot_seconds) - (2 * float(bumper_duration))
    if body_seconds < 60:
        raise ValueError(
            f'Slot too short for opening/closing bumpers: slot={slot_seconds:.2f}s '
            f'bumpers={2 * float(bumper_duration):.2f}s'
        )
    speed = float(audio_duration) / body_seconds
    if not 0.90 <= speed <= 1.10:
        raise ValueError(
            f'Narration needs editorial adjustment: {float(audio_duration):.2f}s for '
            f'{body_seconds:.2f}s body inside {float(slot_seconds):.2f}s slot; '
            'no excessive stretching allowed'
        )
    return body_seconds, speed

used_urls = set()

MEDIA_HOST_SUFFIXES = {
    'pexels': ('pexels.com',),
    'pixabay': ('pixabay.com',),
}

def validate_media_url(url, provider):
    parsed = urllib.parse.urlparse(str(url))
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Unsafe media URL')
    host = parsed.hostname.lower().rstrip('.')
    suffixes = MEDIA_HOST_SUFFIXES.get(provider, ())
    if not suffixes or not any(host == suffix or host.endswith('.' + suffix) for suffix in suffixes):
        raise ValueError(f'Unexpected media host for {provider}: {host}')
    try:
        infos = socket.getaddrinfo(host, 443, type=socket.SOCK_STREAM)
    except socket.gaierror as exc:
        raise ValueError(f'Media host resolution failed: {host}') from exc
    addresses = {info[4][0] for info in infos}
    if not addresses:
        raise ValueError('Media host resolved without addresses')
    for raw in addresses:
        ip = ipaddress.ip_address(raw)
        if not ip.is_global:
            raise ValueError(f'Non-public media address blocked: {ip}')
    return str(url)

class SafeMediaRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, provider):
        super().__init__()
        self.provider = provider

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_media_url(newurl, self.provider)
        return super().redirect_request(req, fp, code, msg, headers, newurl)

def download_media(url, out_path, provider, timeout=30):
    validate_media_url(url, provider)
    max_bytes = int(os.environ.get('GSA_TV_BROLL_MAX_BYTES', str(512 * 1024 * 1024)))
    if max_bytes < 1024 * 1024 or max_bytes > 2 * 1024 * 1024 * 1024:
        raise ValueError('GSA_TV_BROLL_MAX_BYTES outside safe bounds')
    opener = urllib.request.build_opener(SafeMediaRedirectHandler(provider))
    request = urllib.request.Request(url, headers={'User-Agent': 'GSA-TV-Autopilot/2'})
    total = 0
    try:
        with opener.open(request, timeout=timeout) as response, open(out_path, 'wb') as target:
            validate_media_url(response.geturl(), provider)
            content_length = response.headers.get('Content-Length')
            if content_length and int(content_length) > max_bytes:
                raise ValueError('B-roll exceeds configured size limit')
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                total += len(chunk)
                if total > max_bytes:
                    raise ValueError('B-roll exceeded configured size limit while downloading')
                target.write(chunk)
    except Exception:
        try:
            Path(out_path).unlink(missing_ok=True)
        except Exception:
            pass
        raise
    if total < 1024:
        Path(out_path).unlink(missing_ok=True)
        raise ValueError('B-roll download is unexpectedly small')
    return out_path

def fetch_video(query, work_dir, index, timeout=30):
    """Busca vídeo B-roll FHD 1080p no Pexels Videos e depois Pixabay Videos.
    Retorna o caminho do arquivo .mp4 baixado, ou None se não encontrar."""
    pexels_key = os.environ.get('PEXELS_API_KEY', '').strip()
    pixabay_key = os.environ.get('PIXABAY_API_KEY', '').strip()

    if not query:
        return None, {
            'provider': 'internal_generated',
            'asset_id': None,
            'source_page_url': None,
            'contributor': None,
            'license_basis': 'GSA internal generated background',
            'query': query,
        }

    query_encoded = urllib.parse.quote(query)
    out_path = work_dir / f'video_{index}.mp4'

    # --- Pexels Videos API ---
    if pexels_key:
        try:
            req = urllib.request.Request(
                f'https://api.pexels.com/videos/search?query={query_encoded}&per_page=15&orientation=landscape',
                headers={'Authorization': pexels_key}
            )
            with urllib.request.urlopen(req, timeout=timeout) as response:
                data = json.loads(response.read().decode())
            for video in data.get('videos', []):
                # Filtra apenas MP4 e ordena do mais próximo de 1920px ao mais distante
                files = [f for f in video.get('video_files', []) if f.get('file_type') == 'video/mp4']
                files.sort(key=lambda f: abs(f.get('width', 0) - 1920))
                for vf in files:
                    url = vf.get('link', '')
                    if url and url not in used_urls:
                        used_urls.add(url)
                        download_media(url, out_path, 'pexels', timeout=timeout)
                        print(f"Pexels video: '{query}' → {vf.get('width')}x{vf.get('height')}")
                        return out_path, {
                            'provider': 'pexels',
                            'asset_id': video.get('id'),
                            'source_page_url': video.get('url'),
                            'contributor': (video.get('user') or {}).get('name'),
                            'license_basis': 'Pexels License',
                            'query': query,
                        }
        except Exception as e:
            print(f"Pexels video error for '{query}': {e}")

    # --- Pixabay Videos API ---
    if pixabay_key:
        try:
            url = (f'https://pixabay.com/api/videos/?key={pixabay_key}'
                   f'&q={query_encoded}&video_type=all&orientation=horizontal&per_page=15')
            with urllib.request.urlopen(url, timeout=timeout) as response:
                data = json.loads(response.read().decode())
            for hit in data.get('hits', []):
                videos = hit.get('videos', {})
                # Prefere 'large' (1920p), fallback 'medium' (1280p)
                for quality in ('large', 'medium'):
                    vdata = videos.get(quality, {})
                    vid_url = vdata.get('url', '')
                    if vid_url and vid_url not in used_urls:
                        used_urls.add(vid_url)
                        download_media(vid_url, out_path, 'pixabay', timeout=timeout)
                        print(f"Pixabay video ({quality}): '{query}' → {vdata.get('width')}x{vdata.get('height')}")
                        return out_path, {
                            'provider': 'pixabay',
                            'asset_id': hit.get('id'),
                            'source_page_url': hit.get('pageURL'),
                            'contributor': hit.get('user'),
                            'license_basis': 'Pixabay Content License',
                            'query': query,
                        }
        except Exception as e:
            print(f"Pixabay video error for '{query}': {e}")

    return None, {
        'provider': 'internal_generated',
        'asset_id': None,
        'source_page_url': None,
        'contributor': None,
        'license_basis': 'GSA internal generated background',
        'query': query,
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--script', type=Path, required=True)
    parser.add_argument('--manifest', type=Path, required=True)
    parser.add_argument('--seconds', type=float, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--font', default='/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
    args = parser.parse_args()
    script = json.loads(args.script.read_text())
    manifest = json.loads(args.manifest.read_text())
    validate_inputs(script, manifest, args.seconds)
    audio = Path(manifest['audio_wav'])
    duration = float(probe(audio)['format']['duration'])
    output = args.output.resolve()
    work = output.parent / (output.stem + '-graphics')
    temp = output.with_name(output.stem + '.partial.mp4')
    if output.exists():
        raise FileExistsError('Output edition already exists; use a new edition')
    if work.exists():
        shutil.rmtree(work)
    if temp.exists():
        temp.unlink()
    work.mkdir(parents=True)

    slug = unicodedata.normalize('NFKD', script['program']).encode('ascii', 'ignore').decode('ascii').lower()
    slug = re.sub(r'[^a-z0-9\\s-]', '', slug)
    slug = re.sub(r'[-\\s]+', '-', slug).strip('-')

    bumper_path = Path(f'/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-{slug}.mp4')
    fallback_bumper = Path('/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-gsa-tv-40s-broadcast-safe.mp4')
    bumper_file = bumper_path if bumper_path.exists() else fallback_bumper
    if not bumper_file.exists():
        raise FileNotFoundError(f'Broadcast bumper not found: {bumper_file}')

    bumper_duration = float(probe(bumper_file)['format']['duration'])
    body_seconds, speed = compute_timing(duration, args.seconds, bumper_duration)

    title = work / 'program.txt'
    
    title.write_text('\n'.join(textwrap.wrap(script['program'], width=40)), encoding='utf-8')
    
    sections = script['sections']
    visual_provenance = []
    total_words = sum(len(x['text'].split()) for x in sections)
    start = 0.0
    
    media_args = []    # argumentos -i para inputs de vídeo/lavfi
    filter_complex = []
    input_count = 0    # índice do próximo input a ser adicionado

    for index, section in enumerate(sections):
        end = start + body_seconds * len(section['text'].split()) / total_words
        seg_dur = end - start
        query = section.get('visual_query', '')

        clip, provenance = fetch_video(query, work, index)
        provenance['section_index'] = index
        provenance['section_title'] = section.get('title')
        visual_provenance.append(provenance)

        if clip:
            # Vídeo B-roll: loop se necessário, escala para 1920×1080, reset de timestamps
            media_args.extend(['-stream_loop', '-1', '-t', str(seg_dur), '-i', str(clip)])
            filter_complex.append(
                f"[{input_count}:v]"
                f"scale=1920:1080:force_original_aspect_ratio=decrease,"
                f"pad=1920:1080:(ow-iw)/2:(oh-ih)/2,fps=30,setpts=PTS-STARTPTS[v{index}]"
            )
        else:
            # Fallback: fundo sólido (azul escuro institucional)
            media_args.extend(['-f', 'lavfi', '-t', str(seg_dur), '-i', f'color=c=0x0B1825:s=1920x1080:r=30'])
            filter_complex.append(f"[{input_count}:v]setpts=PTS-STARTPTS[v{index}]")

        input_count += 1
        start = end

    concat_inputs = "".join([f"[v{i}]" for i in range(len(sections))])
    filter_complex.append(f"{concat_inputs}concat=n={len(sections)}:v=1:a=0[bg]")
    
    # Overlay text
    filter_complex.append(f"[bg]drawbox=x=120:y=145:w=6:h=780:color=0x4A90E2:t=fill,drawbox=x=170:y=290:w=1550:h=2:color=0x4A90E2@0.45:t=fill,drawtext=fontfile={args.font}:textfile={title}:expansion=none:fontcolor=0x4A90E2:fontsize=42:x=180:y=200[out1]")
    
    start = 0.0
    last_out = "out1"
    for index, section in enumerate(sections):
        end = start + body_seconds * len(section['text'].split()) / total_words
        text = work / f'chapter-{index:02}.txt'
        text.write_text('\n'.join(textwrap.wrap(section['title'], width=34)), encoding='utf-8')
        next_out = f"out{index+2}"
        filter_complex.append(f"[{last_out}]drawtext=fontfile={args.font}:textfile={text}:expansion=none:fontcolor=0xF4F0E7:fontsize=64:line_spacing=20:x=180:y=430:enable='gte(t,{start:.6f})*lt(t,{end:.6f})'[{next_out}]")
        last_out = next_out
        start = end
        
    filter_complex.append(f"[{last_out}]drawbox=x=180:y=850:w=1500:h=3:color=0x4A90E2@0.25:t=fill[video_final]")

    # Run ffmpeg
    cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-y'] + media_args + ['-i', str(audio)]
    cmd.extend(['-filter_complex', ';'.join(filter_complex)])
    cmd.extend(['-map', '[video_final]', '-map', f'{input_count}:a', '-af', f'atempo={speed:.9f},apad', '-t', str(body_seconds)])
    cmd.extend(['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(temp)])

    
    subprocess.run(cmd, check=True)
    
    data = probe(temp)
    video = next(x for x in data['streams'] if x['codec_type'] == 'video')
    sound = next(x for x in data['streams'] if x['codec_type'] == 'audio')
    actual = float(data['format']['duration'])
    if abs(actual - body_seconds) > 0.15 or (video['width'], video['height'], video['codec_name']) != (1920, 1080, 'h264') or sound['codec_name'] != 'aac' or sound['sample_rate'] != '48000' or sound['channels'] != 2:
        raise ValueError('Program body failed technical verification')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(temp), '-f', 'null', '-'], check=True)
    
    list_file = work / 'concat_list.txt'
    
    # Reuse the exact bumper Path already selected and probed above.
    safe_bumper = bumper_file.resolve().as_posix().replace("'", r"'\''")
    with open(list_file, 'w', encoding='utf-8') as f:
        f.write(f"file '{safe_bumper}'\n")
        safe_temp = temp.resolve().as_posix().replace("'", r"'\''")
        f.write(f"file '{safe_temp}'\n")
        f.write(f"file '{safe_bumper}'\n")
        
    final_temp = output.with_name(output.stem + '.final.mp4')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(list_file), '-c', 'copy', str(final_temp)], check=True)
    
    final_data = probe(final_temp)
    final_actual = float(final_data['format']['duration'])
    if abs(final_actual - args.seconds) > 0.75:
        raise ValueError(
            f'Final master duration mismatch: {final_actual:.3f}s for {args.seconds:.3f}s slot'
        )

    final_temp.rename(output)
    
    report = {'state': 'technical_validated', 'broadcast_date': script['date'], 'program': script['program'],
              'duration_s': final_actual, 'target_duration_s': args.seconds, 'body_target_duration_s': body_seconds,
              'bumper_duration_s': bumper_duration, 'audio_speed': speed,
              'script_sha256': script['script_sha256'], 'master_sha256': sha(output),
              'audio_sha256': sha(audio), 'visual_provenance': visual_provenance,
              'visual_review': {'state': 'pending', 'pass': False}, 'published': False}
    output.with_suffix('.qc.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
