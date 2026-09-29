#!/usr/bin/env python3
from __future__ import annotations
import hashlib, json, os, random, re, shutil, subprocess, sys
from pathlib import Path
from urllib.parse import quote
import requests

ROOT=Path("/opt/gsa-tv/production/gsa-tech/ep001")
MEDIA=Path("/opt/gsa-tv/cache/media/1")
AUDIO_LIB=MEDIA/"identity/audio"
OUT=MEDIA/"program-masters/GSA_Tech_2026-09-29_EP001_IA_Apps_Inovacao_MASTER.mp4"
CP="gsa-tv-control-plane"

def run(args, check=True, capture=False):
    return subprocess.run(args, check=check, text=True, capture_output=capture)

def sha(p):
    h=hashlib.sha256()
    with open(p,"rb") as f:
        for b in iter(lambda:f.read(1024*1024),b""): h.update(b)
    return h.hexdigest()

def probe(p):
    r=run(["ffprobe","-v","error","-show_streams","-show_format","-of","json",str(p)],capture=True)
    return json.loads(r.stdout)

def dur(p): return float(probe(p)["format"]["duration"])

def cp_env(name):
    r=run(["sudo","docker","exec",CP,"printenv",name],check=False,capture=True)
    return r.stdout.strip() if r.returncode==0 else ""

def key(name): return os.getenv(name,"").strip() or cp_env(name)

def fish_key():
    sys.path.insert(0,"/home/opc/gsa-program-builder")
    from builder import load_fish_api_key
    v=str(load_fish_api_key()).strip()
    if len(v)<10: raise RuntimeError("Fish credential unavailable")
    return v

def download(url,target,headers=None):
    target.parent.mkdir(parents=True,exist_ok=True)
    tmp=target.with_suffix(target.suffix+".part")
    with requests.get(url,headers=headers or {"User-Agent":"GSA-TV-Tech/1.0"},stream=True,timeout=90) as r:
        r.raise_for_status()
        with open(tmp,"wb") as f:
            for chunk in r.iter_content(1024*512):
                if chunk: f.write(chunk)
    if tmp.stat().st_size<1024: raise RuntimeError("download too small")
    tmp.replace(target)

def fish_tts(text,voice,model,target):
    r=requests.post("https://api.fish.audio/v1/tts",
      headers={"Authorization":"Bearer "+fish_key(),"Content-Type":"application/json","model":model},
      json={"text":text,"reference_id":voice,"format":"wav","sample_rate":44100,"latency":"normal","condition_on_previous_chunks":True},
      timeout=180)
    if not r.ok: raise RuntimeError("Fish TTS HTTP %s: %s"%(r.status_code,r.text[:240]))
    target.write_bytes(r.content)
    fixed=target.with_name(target.stem+"-48k.wav")
    run(["ffmpeg","-nostdin","-v","error","-y","-i",str(target),"-af","loudnorm=I=-16:TP=-2:LRA=7","-ar","48000","-ac","2",str(fixed)])
    return fixed

def meta_value(meta,key):
    v=(meta or {}).get(key) or {}
    return re.sub(r"<[^>]+>","",str(v.get("value") or "")).strip()

def public_domain_license(meta):
    name=meta_value(meta,"LicenseShortName").lower()
    url=meta_value(meta,"LicenseUrl").lower()
    return ("cc0" in name or "public domain" in name or "public-domain" in name
            or "publicdomain" in url or "/zero/" in url)

def openverse_images(query,needed,idx,used,ledger):
    out=[]
    try:
        r=requests.get("https://api.openverse.org/v1/images/",
          params={"q":query,"page_size":30,"license":"cc0"},timeout=40)
        r.raise_for_status()
        for item in r.json().get("results",[]):
            if len(out)>=needed: break
            u=item.get("url")
            if not u or u in used: continue
            ext=Path(u.split("?")[0]).suffix.lower()
            if ext not in (".jpg",".jpeg",".png",".webp"): ext=".jpg"
            p=ROOT/"assets/image"/("s%02d-ov-%s%s"%(idx,str(item.get("id") or len(used))[:14],ext))
            try:
                download(u,p)
                info=probe(p)
                vs=[x for x in info.get("streams",[]) if x.get("codec_type")=="video"]
                if not vs or int(vs[0].get("width") or 0)<800:
                    p.unlink(missing_ok=True); continue
                used.add(u); out.append(p)
                ledger.append({"type":"image","provider":"openverse","id":item.get("id"),"title":item.get("title"),"creator":item.get("creator"),"source":item.get("foreign_landing_url"),"media_url":u,"query":query,"license":"CC0","sha256":sha(p)})
            except Exception as e:
                p.unlink(missing_ok=True)
                print("WARN Openverse image",query,e,file=sys.stderr)
    except Exception as e: print("WARN Openverse image API",query,e,file=sys.stderr)
    return out

def commons_images(query,needed,idx,used,ledger):
    out=[]; api="https://commons.wikimedia.org/w/api.php"
    try:
        s=requests.get(api,params={"action":"query","format":"json","list":"search","srnamespace":6,
          "srsearch":query,"srlimit":40},headers={"User-Agent":"GSA-TV-Tech/1.0"},timeout=40)
        s.raise_for_status()
        titles=[x.get("title") for x in s.json().get("query",{}).get("search",[]) if x.get("title")]
        for off in range(0,len(titles),10):
            if len(out)>=needed: break
            q=requests.get(api,params={"action":"query","format":"json","prop":"imageinfo",
              "titles":"|".join(titles[off:off+10]),
              "iiprop":"url|size|mime|mediatype|extmetadata","iiurlwidth":1920,
              "iiextmetadatafilter":"LicenseShortName|LicenseUrl|Artist|Credit"},
              headers={"User-Agent":"GSA-TV-Tech/1.0"},timeout=45)
            q.raise_for_status()
            for page in q.json().get("query",{}).get("pages",{}).values():
                if len(out)>=needed: break
                ii=(page.get("imageinfo") or [{}])[0]
                mime=str(ii.get("mime") or "")
                if not mime.startswith("image/"): continue
                meta=ii.get("extmetadata") or {}
                if not public_domain_license(meta): continue
                u=ii.get("thumburl") or ii.get("url")
                if not u or u in used: continue
                if u.startswith("//"): u="https:"+u
                ext=Path(u.split("?")[0]).suffix.lower()
                if ext not in (".jpg",".jpeg",".png",".webp"): ext=".jpg"
                p=ROOT/"assets/image"/("s%02d-wc-%s%s"%(idx,str(page.get("pageid") or len(used)),ext))
                try:
                    download(u,p)
                    info=probe(p)
                    vs=[x for x in info.get("streams",[]) if x.get("codec_type")=="video"]
                    if not vs or int(vs[0].get("width") or 0)<800:
                        p.unlink(missing_ok=True); continue
                    used.add(u); out.append(p)
                    ledger.append({"type":"image","provider":"wikimedia_commons","id":page.get("pageid"),"title":page.get("title"),"creator":meta_value(meta,"Artist"),"source":ii.get("descriptionurl"),"media_url":u,"query":query,"license":meta_value(meta,"LicenseShortName") or "Public domain/CC0","license_url":meta_value(meta,"LicenseUrl"),"sha256":sha(p)})
                except Exception as e:
                    p.unlink(missing_ok=True)
                    print("WARN Commons image",query,e,file=sys.stderr)
    except Exception as e: print("WARN Wikimedia Commons image API",query,e,file=sys.stderr)
    return out

def commons_videos(query,needed,idx,used,ledger):
    out=[]; api="https://commons.wikimedia.org/w/api.php"
    try:
        s=requests.get(api,params={"action":"query","format":"json","list":"search","srnamespace":6,
          "srsearch":query+" filetype:video","srlimit":30},headers={"User-Agent":"GSA-TV-Tech/1.0"},timeout=40)
        s.raise_for_status()
        titles=[x.get("title") for x in s.json().get("query",{}).get("search",[]) if x.get("title")]
        if not titles: return out
        for off in range(0,len(titles),10):
            if len(out)>=needed: break
            q=requests.get(api,params={"action":"query","format":"json","prop":"videoinfo",
              "titles":"|".join(titles[off:off+10]),
              "viprop":"url|size|mime|mediatype|extmetadata|derivatives",
              "viextmetadatafilter":"LicenseShortName|LicenseUrl|Artist|Credit"},
              headers={"User-Agent":"GSA-TV-Tech/1.0"},timeout=45)
            q.raise_for_status()
            for page in q.json().get("query",{}).get("pages",{}).values():
                if len(out)>=needed: break
                vi=(page.get("videoinfo") or [{}])[0]
                meta=vi.get("extmetadata") or {}
                if not public_domain_license(meta): continue
                candidates=[]
                for d in vi.get("derivatives") or []:
                    u=d.get("src") or d.get("url")
                    w=int(d.get("width") or 0)
                    if u and w>=960: candidates.append((abs(w-1280),u))
                candidates.sort(key=lambda x:x[0])
                u=(candidates[0][1] if candidates else vi.get("url"))
                if not u or u in used: continue
                if u.startswith("//"): u="https:"+u
                ext=Path(u.split("?")[0]).suffix.lower()
                if ext not in (".webm",".ogv",".ogg",".mp4",".mov"): ext=".webm"
                p=ROOT/"assets/video"/("s%02d-wc-%s%s"%(idx,str(page.get("pageid") or len(used)),ext))
                try:
                    download(u,p)
                    info=probe(p)
                    vs=[x for x in info.get("streams",[]) if x.get("codec_type")=="video"]
                    if not vs or dur(p)<4:
                        p.unlink(missing_ok=True); continue
                    used.add(u); out.append(p)
                    ledger.append({"type":"video","provider":"wikimedia_commons","id":page.get("pageid"),"title":page.get("title"),"creator":meta_value(meta,"Artist"),"source":vi.get("descriptionurl"),"media_url":u,"query":query,"license":meta_value(meta,"LicenseShortName") or "Public domain/CC0","license_url":meta_value(meta,"LicenseUrl"),"sha256":sha(p)})
                except Exception as e:
                    p.unlink(missing_ok=True)
                    print("WARN Commons video",query,e,file=sys.stderr)
    except Exception as e: print("WARN Wikimedia Commons API",query,e,file=sys.stderr)
    return out

def get_media(section,idx,pexels,pixabay,used,ledger):
    videos=[]; images=[]
    queries=section["visual_queries"]
    for q0 in queries:
        q=quote(q0)
        if pexels and len(videos)<2:
            try:
                d=requests.get("https://api.pexels.com/videos/search?query=%s&per_page=15&orientation=landscape"%q,
                  headers={"Authorization":pexels},timeout=40).json()
                for item in d.get("videos",[]):
                    fs=[x for x in item.get("video_files",[]) if x.get("file_type")=="video/mp4" and int(x.get("width") or 0)>=1280]
                    fs.sort(key=lambda x:abs(int(x.get("width") or 0)-1920))
                    if not fs: continue
                    u=fs[0].get("link")
                    if not u or u in used: continue
                    p=ROOT/"assets/video"/("s%02d-px-%s.mp4"%(idx,item.get("id")))
                    download(u,p); used.add(u); videos.append(p)
                    ledger.append({"type":"video","provider":"pexels","id":item.get("id"),"source":item.get("url"),"query":q0,"license":"Pexels License","sha256":sha(p)})
                    break
            except Exception as e: print("WARN pexels video",q0,e,file=sys.stderr)
        if pexels and len(images)<3:
            try:
                d=requests.get("https://api.pexels.com/v1/search?query=%s&per_page=15&orientation=landscape"%q,
                  headers={"Authorization":pexels},timeout=40).json()
                for item in d.get("photos",[]):
                    u=(item.get("src") or {}).get("large2x") or (item.get("src") or {}).get("large")
                    if not u or u in used: continue
                    p=ROOT/"assets/image"/("s%02d-px-%s.jpg"%(idx,item.get("id")))
                    download(u,p); used.add(u); images.append(p)
                    ledger.append({"type":"image","provider":"pexels","id":item.get("id"),"source":item.get("url"),"query":q0,"license":"Pexels License","sha256":sha(p)})
                    if len(images)>=3: break
            except Exception as e: print("WARN pexels image",q0,e,file=sys.stderr)
        if pixabay and len(videos)<2:
            try:
                d=requests.get("https://pixabay.com/api/videos/?key=%s&q=%s&orientation=horizontal&per_page=20&safesearch=true"%(pixabay,q),timeout=40).json()
                for item in d.get("hits",[]):
                    v=item.get("videos") or {}; x=v.get("large") or v.get("medium") or v.get("small") or {}
                    u=x.get("url")
                    if not u or u in used: continue
                    p=ROOT/"assets/video"/("s%02d-pb-%s.mp4"%(idx,item.get("id")))
                    download(u,p); used.add(u); videos.append(p)
                    ledger.append({"type":"video","provider":"pixabay","id":item.get("id"),"source":item.get("pageURL"),"query":q0,"license":"Pixabay Content License","sha256":sha(p)})
                    break
            except Exception as e: print("WARN pixabay video",q0,e,file=sys.stderr)
        if pixabay and len(images)<3:
            try:
                d=requests.get("https://pixabay.com/api/?key=%s&q=%s&image_type=photo&orientation=horizontal&per_page=20&safesearch=true"%(pixabay,q),timeout=40).json()
                for item in d.get("hits",[]):
                    u=item.get("largeImageURL") or item.get("webformatURL")
                    if not u or u in used: continue
                    p=ROOT/"assets/image"/("s%02d-pb-%s.jpg"%(idx,item.get("id")))
                    download(u,p); used.add(u); images.append(p)
                    ledger.append({"type":"image","provider":"pixabay","id":item.get("id"),"source":item.get("pageURL"),"query":q0,"license":"Pixabay Content License","sha256":sha(p)})
                    if len(images)>=3: break
            except Exception as e: print("WARN pixabay image",q0,e,file=sys.stderr)
        if len(videos)<2:
            videos.extend(commons_videos(q0,2-len(videos),idx,used,ledger))
        if len(images)<3:
            images.extend(openverse_images(q0,3-len(images),idx,used,ledger))
        if len(images)<3:
            images.extend(commons_images(q0,3-len(images),idx,used,ledger))
        if len(videos)>=2 and len(images)>=3: break
    return videos,images

def refresh_music(ledger):
    out=ROOT/"assets/music"; out.mkdir(parents=True,exist_ok=True)
    tracks=[]
    try:
        catalog=requests.get("https://incompetech.com/music/royalty-free/pieces.json",timeout=40).json()
        rx=re.compile(r"electronic|technology|driving|upbeat|corporate|groove|pulse|bright",re.I)
        choices=[x for x in catalog if str(x.get("filename","")).endswith(".mp3") and rx.search(" ".join(str(x.get(k,"")) for k in ("title","description","feel","instruments")))]
        random.Random(29).shuffle(choices)
        for item in choices[:8]:
            if len(tracks)>=3: break
            fn=item["filename"]; u="https://incompetech.com/music/royalty-free/mp3-royaltyfree/"+quote(fn)
            p=out/("music-%02d.mp3"%(len(tracks)+1))
            try:
                download(u,p)
                if dur(p)>20:
                    tracks.append(p); ledger.append({"type":"music","provider":"incompetech","title":item.get("title"),"source":u,"license":"Creative Commons attribution license; credit required","sha256":sha(p)})
                else: p.unlink(missing_ok=True)
            except Exception: p.unlink(missing_ok=True)
    except Exception as e: print("WARN music API",e,file=sys.stderr)
    if len(tracks)<3:
        raise RuntimeError("Music API gate failed: fewer than 3 Incompetech tracks acquired")
    return tracks[:3]

def select_sfx(ledger):
    out=ROOT/"assets/sfx"; out.mkdir(parents=True,exist_ok=True)
    chosen=[]; used=set()
    for query in ("technology transition whoosh","digital interface click","electronic impact","computer notification","futuristic transition"):
        if len(chosen)>=8: break
        try:
            r=requests.get("https://api.openverse.org/v1/audio/",params={"q":query,"page_size":30,"license":"cc0"},timeout=35)
            r.raise_for_status()
            for x in r.json().get("results",[]):
                if len(chosen)>=8: break
                u=x.get("url")
                if not u or u in used: continue
                ext=Path(u.split("?")[0]).suffix.lower()
                if ext not in (".wav",".mp3",".m4a",".ogg",".flac"): ext=".mp3"
                p=out/("openverse-%02d%s"%(len(chosen)+1,ext))
                try:
                    download(u,p)
                    info=probe(p)
                    if not any(s.get("codec_type")=="audio" for s in info.get("streams",[])) or dur(p)<0.15:
                        p.unlink(missing_ok=True); continue
                    chosen.append(p); used.add(u)
                    ledger.append({"type":"sfx","provider":"openverse","id":x.get("id"),"title":x.get("title"),"creator":x.get("creator"),"license":"CC0","source":x.get("foreign_landing_url"),"media_url":u,"sha256":sha(p)})
                except Exception as e:
                    p.unlink(missing_ok=True)
                    print("WARN Openverse SFX asset",query,e,file=sys.stderr)
        except Exception as e: print("WARN Openverse API",query,e,file=sys.stderr)
    if len(chosen)<8:
        raise RuntimeError("SFX API gate failed: fewer than 8 Openverse CC0 effects acquired")
    return chosen[:8]

def concat_wavs(parts,out,pause=.55):
    tmp=ROOT/"audio/silence.wav"
    run(["ffmpeg","-nostdin","-v","error","-y","-f","lavfi","-i","anullsrc=r=48000:cl=stereo","-t",str(pause),str(tmp)])
    lst=ROOT/"audio/voice.concat"
    lines=[]
    for i,p in enumerate(parts):
        lines.append("file '%s'"%p.resolve())
        if i+1<len(parts): lines.append("file '%s'"%tmp.resolve())
    lst.write_text("\n".join(lines)+"\n")
    run(["ffmpeg","-nostdin","-v","error","-y","-f","concat","-safe","0","-i",str(lst),"-c:a","pcm_s16le","-ar","48000","-ac","2",str(out)])

def make_shot(src,is_image,secs,title,index):
    out=ROOT/"clips"/("shot-%03d.mp4"%index); out.parent.mkdir(parents=True,exist_ok=True)
    txt=ROOT/"clips"/("title-%03d.txt"%index); txt.write_text(title)
    vf="scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,setsar=1,drawbox=x=0:y=925:w=1920:h=155:color=black@0.55:t=fill,drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=%s:fontcolor=white:fontsize=38:x=70:y=970"%txt
    if is_image:
        run(["ffmpeg","-nostdin","-v","error","-y","-loop","1","-i",str(src),"-t","%.3f"%secs,"-vf",vf+",fps=30","-an","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",str(out)])
    else:
        run(["ffmpeg","-nostdin","-v","error","-y","-stream_loop","-1","-i",str(src),"-t","%.3f"%secs,"-vf",vf+",fps=30","-an","-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p",str(out)])
    return out

def music_bed(tracks,total):
    each=total/3.0; parts=[]
    for i,p in enumerate(tracks):
        o=ROOT/"audio"/("music-%d.wav"%i)
        run(["ffmpeg","-nostdin","-v","error","-y","-stream_loop","-1","-i",str(p),"-t","%.3f"%each,"-af","volume=0.11,afade=t=in:st=0:d=1,afade=t=out:st=%.3f:d=1"%(max(0,each-1)),"-ar","48000","-ac","2",str(o)])
        parts.append(o)
    lst=ROOT/"audio/music.concat"; lst.write_text("\n".join("file '%s'"%x.resolve() for x in parts)+"\n")
    out=ROOT/"audio/music-bed.wav"
    run(["ffmpeg","-nostdin","-v","error","-y","-f","concat","-safe","0","-i",str(lst),"-c:a","pcm_s16le","-ar","48000","-ac","2",str(out)])
    return out

def sfx_bed(files,starts,total):
    args=[]; filters=[]; labels=[]
    for i,(p,start) in enumerate(zip(files,starts)):
        args+=["-i",str(p)]
        ms=int(start*1000)
        filters.append("[%d:a]volume=0.22,adelay=%d|%d[s%d]"%(i,ms,ms,i)); labels.append("[s%d]"%i)
    out=ROOT/"audio/sfx-bed.wav"
    filt=";".join(filters)+";"+"".join(labels)+"amix=inputs=%d:normalize=0,apad,atrim=0:%.3f[s]"%(len(labels),total)
    run(["ffmpeg","-nostdin","-v","error","-y"]+args+["-filter_complex",filt,"-map","[s]","-ar","48000","-ac","2",str(out)])
    return out

def main():
    ep=json.loads(Path(sys.argv[1]).read_text())
    if OUT.exists(): raise RuntimeError("Master already exists; refusing overwrite")
    for d in ("audio","assets/video","assets/image","assets/music","clips","qc"): (ROOT/d).mkdir(parents=True,exist_ok=True)
    pexels=key("PEXELS_API_KEY"); pixabay=key("PIXABAY_API_KEY")
    ledger=[]; voice_parts=[]; sec_media=[]; sec_durs=[]; used_media=set()
    for i,s in enumerate(ep["sections"]):
        raw=ROOT/"audio"/("voice-%02d.wav"%i)
        fixed=fish_tts(s["narration"],ep["fish_voice_id"],ep["fish_model"],raw)
        voice_parts.append(fixed); sec_durs.append(dur(fixed)+(.55 if i+1<len(ep["sections"]) else 0))
        v,im=get_media(s,i,pexels,pixabay,used_media,ledger); sec_media.append((v,im))
    voice=ROOT/"audio/voice-master.wav"; concat_wavs(voice_parts,voice)
    video_count=sum(len(x[0]) for x in sec_media); image_count=sum(len(x[1]) for x in sec_media)
    if video_count<15 or image_count<20: raise RuntimeError("Visual gate failed: videos=%d images=%d"%(video_count,image_count))
    shots=[]; n=0
    for s,(vids,imgs),sd in zip(ep["sections"],sec_media,sec_durs):
        assets=[]
        # exactly five distinct shots per section when possible
        for x in vids[:2]: assets.append((x,False))
        for x in imgs[:3]: assets.append((x,True))
        if len(assets)<5: raise RuntimeError("Section visual shortfall: "+s["title"])
        per=sd/len(assets)
        for src,isimg in assets:
            shots.append(make_shot(src,isimg,per,s["title"],n)); n+=1
    lst=ROOT/"clips/visual.concat"; lst.write_text("\n".join("file '%s'"%x.resolve() for x in shots)+"\n")
    visual=ROOT/"clips/visual-master.mp4"
    run(["ffmpeg","-nostdin","-v","error","-y","-f","concat","-safe","0","-i",str(lst),"-c","copy",str(visual)])
    total=dur(voice)
    tracks=refresh_music(ledger)
    if len(tracks)<3: raise RuntimeError("Music gate failed")
    music=music_bed(tracks,total)
    starts=[]; c=0.0
    for sd in sec_durs:
        starts.append(c); c+=sd
    sfx=select_sfx(ledger); sfxmix=sfx_bed(sfx,starts[:len(sfx)],total)
    credits=ROOT/"qc/credits.txt"
    music_titles=[x.get("title") for x in ledger if x.get("type")=="music" and x.get("provider")=="incompetech"]
    credits.write_text("Trilha: "+", ".join(t for t in music_titles if t)+" — Kevin MacLeod / incompetech.com — CC BY 4.0",encoding="utf-8")
    credit_start=max(0,total-8.0)
    tmp=OUT.with_suffix(".partial.mp4"); OUT.parent.mkdir(parents=True,exist_ok=True)
    vf="[0:v]drawbox=x=0:y=930:w=1920:h=150:color=black@0.72:t=fill:enable='gte(t,%.3f)',drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:textfile=%s:expansion=none:fontcolor=white:fontsize=22:x=60:y=985:enable='gte(t,%.3f)'[vo]"%(credit_start,credits,credit_start)
    af="[1:a]volume=1.0[v];[2:a]volume=1.0[m];[3:a]volume=1.0[s];[v][m][s]amix=inputs=3:duration=first:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]"
    run(["ffmpeg","-nostdin","-v","error","-y","-i",str(visual),"-i",str(voice),"-i",str(music),"-i",str(sfxmix),
      "-filter_complex",vf+";"+af,
      "-map","[vo]","-map","[a]","-t","%.3f"%total,"-c:v","libx264","-preset","veryfast","-crf","20","-pix_fmt","yuv420p","-c:a","aac","-b:a","192k","-ar","48000","-ac","2","-movflags","+faststart",str(tmp)])
    run(["ffmpeg","-nostdin","-v","error","-xerror","-i",str(tmp),"-f","null","-"])
    info=probe(tmp); vs=next(x for x in info["streams"] if x["codec_type"]=="video"); au=next(x for x in info["streams"] if x["codec_type"]=="audio")
    actual=float(info["format"]["duration"])
    ok=600<=actual<=800 and vs["width"]==1920 and vs["height"]==1080 and vs["codec_name"]=="h264" and au["codec_name"]=="aac" and video_count>=15 and image_count>=20
    if not ok: raise RuntimeError("QC failed")
    tmp.replace(OUT)
    report={"state":"PASS","program":ep["program"],"presenter":ep["presenter"],"fish_voice_id":ep["fish_voice_id"],"duration_s":actual,"video_count":video_count,"image_count":image_count,"music_count":len(tracks),"openverse_image_count":sum(1 for x in ledger if x.get("type")=="image" and x.get("provider")=="openverse"),"commons_image_count":sum(1 for x in ledger if x.get("type")=="image" and x.get("provider")=="wikimedia_commons"),"commons_video_count":sum(1 for x in ledger if x.get("type")=="video" and x.get("provider")=="wikimedia_commons"),"openverse_sfx_count":sum(1 for x in ledger if x.get("type")=="sfx" and x.get("provider")=="openverse"),"sfx_count":len(sfx),"credits_file":str(credits),"master":str(OUT),"sha256":sha(OUT),"playout_mutated":False,"schedule_mutated":False,"asset_ledger":ledger}
    (ROOT/"qc/report.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!="asset_ledger"},ensure_ascii=False))
if __name__=="__main__": main()
