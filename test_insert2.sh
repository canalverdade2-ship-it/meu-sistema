cat << 'EOF' > /tmp/test_insert.json
[{
  "codigo_produto": "SHOPEE_TEST123",
  "nome": "Produto Teste",
  "valor_custo": 10.0,
  "valor": 20.0,
  "porcentagem_lucro": 100,
  "identificador_preferencial": "interno",
  "tipo_cliente": "pf"
}]
EOF
SUPABASE_URL='https://api.147-15-43-141.nip.io'
SERVICE_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3ODk0OTQ0NDcsImV4cCI6MjEwNDg1NDQ0N30.qELUpqY0u5ZZDEjzY1CJ8_2q3QQmdiVT4C17HsOrr_E'
curl -v -X POST $SUPABASE_URL/rest/v1/produtos \
  -H "Content-Type: application/json" \
  -H "apikey: $SERVICE_KEY" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Prefer: return=minimal" \
  -d @/tmp/test_insert.json