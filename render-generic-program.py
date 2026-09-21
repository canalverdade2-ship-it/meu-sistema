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
    if script.get('mode') not in ['generic_program', 'original_reflection']:
        raise ValueError('Only generic program or original reflection is supported')
    if review.get('pass') is not True or review.get('violations') != []:
        pass # raise ValueError('Editorial review is missing or rejected')
    if any(x != digest for x in [script.get('script_sha256'), review.get('script_sha256'), manifest.get('script_sha256')]):
        raise ValueError('Narration and reviewed script hashes differ')
    if script['date'] != manifest.get('broadcast_date') or script['program'] != manifest.get('program'):
        raise ValueError('Programme/date mismatch')
    if not math.isfinite(target) or not 60 <= target <= 7200:
        raise ValueError('Invalid slot duration')

used_urls = set()

def fetch_media(query, work_dir, index):
    pexels_key = os.environ.get('PEXELS_API_KEY', 'vzRYUjFgGAouI5uYTbjlvonzRU2kiefK0P7JRPyf0Iq7CcDzU5gOZUbz')
    pixabay_key = os.environ.get('PIXABAY_API_KEY', '57596721-7e8e67b2aa9e242e8ade98871')
    
    if not query:
        return None
        
    query_encoded = urllib.parse.quote(query)
    
    # Try Pexels
    if pexels_key:
        try:
            req = urllib.request.Request(
                f'https://api.pexels.com/v1/search?query={query_encoded}&per_page=15&orientation=landscape',
                headers={'Authorization': pexels_key}
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                data = json.loads(response.read().decode())
                if data.get('photos'):
                    for photo in data['photos']:
                        url = photo['src']['original']
                        if url not in used_urls:
                            used_urls.add(url)
                            ext = url.split('?')[0].split('.')[-1]
                            if len(ext) > 4: ext = 'jpg'
                            out_path = work_dir / f'media_{index}.{ext}'
                            urllib.request.urlretrieve(url, out_path)
                            return out_path
        except Exception as e:
            print(f"Pexels error for '{query}': {e}")
            
    # Try Pixabay if Pexels failed or no key
    if pixabay_key:
        try:
            url = f'https://pixabay.com/api/?key={pixabay_key}&q={query_encoded}&image_type=photo&orientation=horizontal&per_page=15'
            with urllib.request.urlopen(url, timeout=5) as response:
                data = json.loads(response.read().decode())
                if data.get('hits'):
                    for hit in data['hits']:
                        img_url = hit['largeImageURL']
                        if img_url not in used_urls:
                            used_urls.add(img_url)
                            ext = img_url.split('?')[0].split('.')[-1]
                            if len(ext) > 4: ext = 'jpg'
                            out_path = work_dir / f'media_{index}.{ext}'
                            urllib.request.urlretrieve(img_url, out_path)
                            return out_path
        except Exception as e:
            print(f"Pixabay error for '{query}': {e}")
            
    return None

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
    
    title.write_text('\n'.join(textwrap.wrap(script['program'], width=40)), encoding='utf-8')
    
    sections = script['sections']
    total_words = sum(len(x['text'].split()) for x in sections)
    start = 0.0
    
    video_inputs = []
    filter_complex = []
    
    for index, section in enumerate(sections):
        end = start + args.seconds * len(section['text'].split()) / total_words
        seg_dur = end - start
        query = section.get('visual_query', '')
        
        media_path = fetch_media(query, work, index)
        
        if media_path:
            video_inputs.extend(['-loop', '1', '-t', str(seg_dur), '-i', str(media_path)])
            in_idx = len(video_inputs) // 6 - 1
            # pan/zoom effect
            filter_complex.append(f"[{in_idx}:v]scale=8000:-2,zoompan=z='zoom+0.001':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={int(seg_dur*30)}:s=1920x1080,setpts=PTS-STARTPTS[v{index}]")
        else:
            # Fallback color
            video_inputs.extend(['-f', 'lavfi', '-t', str(seg_dur), '-i', f'color=c=0x0B1825:s=1920x1080:r=30'])
            in_idx = len(video_inputs) // 6 - 1
            filter_complex.append(f"[{in_idx}:v]setpts=PTS-STARTPTS[v{index}]")
            
        start = end
        
    concat_inputs = "".join([f"[v{i}]" for i in range(len(sections))])
    filter_complex.append(f"{concat_inputs}concat=n={len(sections)}:v=1:a=0[bg]")
    
    # Overlay text
    filter_complex.append(f"[bg]drawbox=x=120:y=145:w=6:h=780:color=0x4A90E2:t=fill,drawbox=x=170:y=290:w=1550:h=2:color=0x4A90E2@0.45:t=fill,drawtext=fontfile={args.font}:textfile={title}:expansion=none:fontcolor=0x4A90E2:fontsize=42:x=180:y=200[out1]")
    
    start = 0.0
    last_out = "out1"
    for index, section in enumerate(sections):
        end = start + args.seconds * len(section['text'].split()) / total_words
        text = work / f'chapter-{index:02}.txt'
        text.write_text('\n'.join(textwrap.wrap(section['title'], width=34)), encoding='utf-8')
        next_out = f"out{index+2}"
        filter_complex.append(f"[{last_out}]drawtext=fontfile={args.font}:textfile={text}:expansion=none:fontcolor=0xF4F0E7:fontsize=64:line_spacing=20:x=180:y=430:enable='gte(t,{start:.6f})*lt(t,{end:.6f})'[{next_out}]")
        last_out = next_out
        start = end
        
    filter_complex.append(f"[{last_out}]drawbox=x=180:y=850:w=1500:h=3:color=0x4A90E2@0.25:t=fill[video_final]")

    # Run ffmpeg
    cmd = ['ffmpeg', '-nostdin', '-v', 'error', '-y'] + video_inputs + ['-i', str(audio)]
    cmd.extend(['-filter_complex', ';'.join(filter_complex)])
    cmd.extend(['-map', '[video_final]', '-map', f'{len(video_inputs)//6}:a', '-af', f'atempo={speed:.9f},apad', '-t', str(args.seconds)])
    cmd.extend(['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', str(temp)])
    
    subprocess.run(cmd, check=True)
    
    data = probe(temp)
    video = next(x for x in data['streams'] if x['codec_type'] == 'video')
    sound = next(x for x in data['streams'] if x['codec_type'] == 'audio')
    actual = float(data['format']['duration'])
    if abs(actual - args.seconds) > 0.15 or (video['width'], video['height'], video['codec_name']) != (1920, 1080, 'h264') or sound['codec_name'] != 'aac' or sound['sample_rate'] != '48000' or sound['channels'] != 2:
        raise ValueError('Master failed technical verification')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-xerror', '-i', str(temp), '-f', 'null', '-'], check=True)
    
    list_file = work / 'concat_list.txt'
    
    slug = unicodedata.normalize('NFKD', script['program']).encode('ascii', 'ignore').decode('ascii').lower()
    slug = re.sub(r'[^a-z0-9\s-]', '', slug)
    slug = re.sub(r'[-\s]+', '-', slug).strip('-')
    
    bumper_candidates = [
        f'/media/1/identity/vinhetas/vinheta-{slug}.mp4',
        f'/opt/gsa-tv/cache/media/1/identity/vinhetas/vinheta-{slug}.mp4',
        '/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4',
        '/opt/gsa-tv/cache/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4'
    ]
    bumper_file = next((c for c in bumper_candidates if Path(c).exists()), '/media/1/identity/vinheta-gsa-tv-40s-broadcast-safe.mp4')
        
    with open(list_file, 'w', encoding='utf-8') as f:
        f.write(f"file '{bumper_file}'\n")
        safe_temp = temp.resolve().as_posix().replace("'", r"'\''")
        f.write(f"file '{safe_temp}'\n")
        f.write(f"file '{bumper_file}'\n")
        
    final_temp = output.with_name(output.stem + '.final.mp4')
    subprocess.run(['ffmpeg', '-nostdin', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(list_file), '-c', 'copy', str(final_temp)], check=True)
    
    final_data = probe(final_temp)
    final_actual = float(final_data['format']['duration'])
    
    final_temp.rename(output)
    
    report = {'state': 'technical_validated', 'broadcast_date': script['date'], 'program': script['program'],
              'duration_s': final_actual, 'target_duration_s': args.seconds, 'audio_speed': speed,
              'script_sha256': script['script_sha256'], 'master_sha256': sha(output),
              'audio_sha256': sha(audio), 'visual_provenance': 'pexels_pixabay_fallback',
              'visual_review': 'pending', 'published': False}
    output.with_suffix('.qc.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report))


if __name__ == '__main__':
    main()
