import urllib.request, urllib.parse, json, os, traceback
from pathlib import Path

def fetch_media(query, work_dir, index):
    pexels_key = os.environ.get('PEXELS_API_KEY', 'vzRYUjFgGAouI5uYTbjlvonzRU2kiefK0P7JRPyf0Iq7CcDzU5gOZUbz')
    pixabay_key = os.environ.get('PIXABAY_API_KEY', '57596721-7e8e67b2aa9e242e8ade98871')
    used_urls = set()
    
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
            traceback.print_exc()
            
    return None

print(fetch_media('city', Path('/tmp'), 0))
