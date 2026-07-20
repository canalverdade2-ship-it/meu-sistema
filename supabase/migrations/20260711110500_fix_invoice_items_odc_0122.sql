UPDATE public.faturas
SET itens_faturados = jsonb_build_array(
  jsonb_build_object(
    'tipo', 'produto',
    'codigo', '#ODC-0122',
    'descricao', 'Pedido GSA Store #ODC-0122',
    'quantidade', 5,
    'valor_unitario', 195,
    'subtotal', 975
  )
)
WHERE id = 'a7ac1e1c-7f01-43b1-9219-9cfc7cba0c42'
  AND (
    itens_faturados IS NULL
    OR itens_faturados::text ILIKE '%Pedido GSA Store via RPC Seguro%'
    OR itens_faturados::text ILIKE '%\"subtotal\": 0%'
  );
