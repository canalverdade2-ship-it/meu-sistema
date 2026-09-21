python3 -c "
import urllib.request, csv, io

url = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)

# Lê primeiras linhas
lines = []
for _ in range(50):
    line = resp.readline()
    if not line: break
    lines.append(line.decode('utf-8', errors='ignore'))

content = ''.join(lines)
reader = csv.DictReader(io.StringIO(content))
print('Colunas encontradas:', reader.fieldnames)
for i, row in enumerate(reader):
    if i < 3:
        print(f'--- ITEM {i+1} ---')
        print('itemid:', row.get('itemid'))
        print('title:', row.get('title'))
        print('sale_price:', row.get('sale_price'))
        print('price:', row.get('price'))
        print('image_link:', row.get('image_link'))
        print('category:', row.get('global_category1'))
"