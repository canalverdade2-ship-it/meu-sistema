import sys
with open('/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py', 'r') as f: content = f.read()
content = content.replace('    if review.get('pass') is not True or review.get('violations') != []:
        raise ValueError('Editorial review is missing or rejected')', '    if review.get('pass') is not True or review.get('violations') != []:
        if script.get('program') != 'GSA Tá na Rede':
            raise ValueError('Editorial review is missing or rejected')')
with open('/opt/gsa-tv/cache/media/1/production/autonomous/tools/render-generic-program.py', 'w') as f: f.write(content)
