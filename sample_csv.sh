python3 -c "
import urllib.request, csv, io, json

url = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req, timeout=30)
text_stream = io.TextIOWrapper(resp, encoding='utf-8', errors='ignore')
reader = csv.DictReader(text_stream)

# Read just 1 row to get all column names
row = next(reader)
print('=== COLUNAS DO CSV ===')
for k in row.keys():
    print(f'  {k}: {repr(row[k][:120])}')
print(f'\n=== TOTAL DE COLUNAS: {len(row.keys())} ===')
"