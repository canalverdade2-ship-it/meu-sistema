python3 -c "
import urllib.request, csv, io, json

url = 'https://affiliate.shopee.com.br/api/v1/datafeed/download?id=YWJjZGVmZ2hpamtsbW5vcPNcbnfdFhhQkoz1FtnUm6DtED25ejObtofpYLqHBC0h'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
resp = urllib.request.urlopen(req, timeout=30)
text_stream = io.TextIOWrapper(resp, encoding='utf-8', errors='ignore')
reader = csv.DictReader(text_stream)

# Find first row with model_names containing '|' (actual variations)
count = 0
for row in reader:
    names = row.get('model_names', '')
    if '|' in names or ',' in names:
        print('=== PRODUTO COM VARIAÇÕES ===')
        print(f'  title: {row[\"title\"][:100]}')
        print(f'  model_names: {names[:200]}')
        print(f'  model_ids: {row.get(\"model_ids\", \"\")[:200]}')
        print(f'  sale_price: {row.get(\"sale_price\", \"\")}')
        print(f'  price: {row.get(\"price\", \"\")}')
        print(f'  image_link: {row.get(\"image_link\", \"\")[:100]}')
        print(f'  image_link_3: {row.get(\"image_link_3\", \"\")[:100]}')
        print(f'  item_rating: {row.get(\"item_rating\", \"\")}')
        print(f'  discount_percentage: {row.get(\"discount_percentage\", \"\")}')
        print(f'  like: {row.get(\"like\", \"\")}')
        print(f'  shop_name: {row.get(\"shop_name\", \"\")}')
        print(f'  product_link: {row.get(\"product_link\", \"\")[:150]}')
        break
    count += 1
    if count > 500:
        print('No product with variations found in first 500 rows')
        break
print(f'  (found after scanning {count} rows)')
"