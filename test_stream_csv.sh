python3 -c "
import urllib.request, csv, io

url = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req)

text_stream = io.TextIOWrapper(resp, encoding='utf-8', errors='ignore')
reader = csv.DictReader(text_stream)

valid = 0
for row in reader:
    if row.get('title') and row.get('itemid'):
        valid += 1
        if valid <= 3:
            print('VALID ITEM:', row.get('itemid'), row.get('title')[:40], 'Preco:', row.get('sale_price'), 'Img:', row.get('image_link'))
    if valid >= 10:
        break
print('Total validados:', valid)
"