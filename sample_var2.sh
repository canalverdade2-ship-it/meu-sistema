python3 -c "
import urllib.request, csv, io

url = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req, timeout=60)
text_stream = io.TextIOWrapper(resp, encoding='utf-8', errors='ignore')
reader = csv.DictReader(text_stream)

# Find a product where model_names has multiple entries with commas
count = 0
found = 0
for row in reader:
    names = row.get('model_names', '')
    ids = row.get('model_ids', '')
    # Multiple model IDs = true variations
    if '|' in ids:
        print(f'=== PRODUTO #{found+1} COM VARIAÇÕES REAIS ===')
        print(f'  title: {row[\"title\"][:100]}')
        print(f'  model_names: {names[:300]}')
        print(f'  model_ids: {ids[:300]}')
        print(f'  sale_price: {row.get(\"sale_price\", \"\")}')
        print(f'  price: {row.get(\"price\", \"\")}')
        print()
        found += 1
        if found >= 3:
            break
    count += 1
    if count > 2000:
        break
print(f'Scanned {count} rows, found {found} products with true variations')
"