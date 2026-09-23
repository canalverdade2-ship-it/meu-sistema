#!/usr/bin/env python3
"""Render an original narrated reflection. Never substitutes for licensed films/news."""
import argparse
import hashlib
import json
import math
from pathlib import Path
import shutil
import subprocess


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
    if script.get('mode') != 'original_reflection':
        raise ValueError('Only original reflection is supported')
    if review.get('pass') is not True or review.get('violations') != []:
        raise ValueError('Editorial review is missing or rejected')
    if any(x != digest for x in [script.get('script_sha256'), review.get('script_sha256'), manifest.get('script_sha256')]):
        raise ValueError('Narration and reviewed script hashes differ')
    if script['date'] != manifest.get('broadcast_date') or script['program'] != manifest.get('program'):
        raise ValueError('Programme/date mismatch')
    if not math.isfinite(target) or not 60 <= target <= 7200:
        raise ValueError('Invalid slot duration')


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
    speed = duration / args.seconds
    if not math.isfinite(speed) or not 0.90 <= speed <= 1.10:
        raise ValueError(f'Narration needs editorial adjustment: {duration:.2f}s for {args.seconds:.2f}s; no excessive stretching allowed')
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
    title = work / 'program.txt'
    title.write_text(script['program'], encoding='utf-8')
    # Original typography/geometry; no third-party footage or burned-in station logo.
    filters = [
        "drawbox=x=120:y=145:w=6:h=780:color=0xC7AC69:t=fill",
        "drawbox=x=170:y=290:w=1550:h=2:color=0xC7AC69@0.45:t=fill",
        f"drawtext=fontfile={args.font}:textfile={title}:expansion=none:fontcolor=0xC7AC69:fontsize=42:x=180:y=200",
    ]
    sections = script['sections']
    total_words = sum(len(x['text'].split()) for x in sections)
    start = 0.0
    for index, section in enumerate(sections):
        end = start + args.seconds * len(section['text'].split()) / total_words
        text = work / f'chapter-{index:02}.txt'
        # Short titles stay comfortably within a full-HD frame.
        import textwrap
        text.write_text('\n'.join(textwrap.wrap(section['title'], width=34)), encoding='utf-8')
        filters.append(f"drawtext=fontfile={args.font}:textfile={text}:expansion=none:fontcolor=0xF4F0E7:fontsize=64:line_spacing=20:x=180:y=430:enable='gte(t,{start:.6f})*lt(t,{end:.6f})'")
        start = end
    filters.append("drawbox=x=180:y=850:w=1500:h=3:color=0xC7AC69@0.25:t=fill")
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'lavfi', '-i',
                    'color=c=0x0B1825:s=1920x1080:r=30', '-i', str(audio),
                    '-vf', ','.join(filters), '-af', f'atempo={speed:.9f},apad',
                    '-t', str(args.seconds), '-c:v', 'libx264', '-preset', 'veryfast',
                    '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                    '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(temp)], check=True)
    data = probe(temp)
    video = next(x for x in data['streams'] if x['codec_type'] == 'video')
    sound = next(x for x in data['streams'] if x['codec_type'] == 'audio')
    actual = float(data['format']['duration'])
    if abs(actual - args.seconds) > 0.15 or (video['width'], video['height'], video['codec_name']) != (1920, 1080, 'h264') or sound['codec_name'] != 'aac' or sound['sample_rate'] != '48000' or sound['channels'] != 2:
        raise ValueError('Master failed technical verification')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(temp), '-f', 'null', '-'], check=True)
    temp.rename(output)
    report = {'state': 'technical_validated', 'broadcast_date': script['date'], 'program': script['program'],
              'duration_s': actual, 'target_duration_s': args.seconds, 'audio_speed': speed,
              'script_sha256': script['script_sha256'], 'master_sha256': sha(output),
              'audio_sha256': sha(audio),
              'visual_provenance': [{
                  'provider': 'internal_generated',
                  'asset_id': None,
                  'source_page_url': None,
                  'contributor': 'GSA TV',
                  'license_basis': 'GSA internal original geometry and typography',
              }],
              'visual_review': {
                  'state': 'passed',
                  'pass': True,
                  'method': 'deterministic_internal_render',
                  'identifiable_people': False,
                  'visible_logos_or_brands': False,
                  'sensitive_or_misleading_context': False,
                  'copyrighted_artwork_or_screen': False,
                  'notes': [],
              },
              'published': False}
    output.with_suffix('.qc.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
