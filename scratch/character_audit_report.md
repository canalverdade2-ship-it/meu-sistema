# Character Encoding Audit

- Files scanned: 474
- Bytes scanned: 7118501
- Findings: 41
- Critical: 0
- High: 39
- Medium: 2

## Finding Types

- visible-mojibake-literal: 26 (Padroes visiveis comuns de texto quebrado.)
- utf8-mojibake-c3: 11 (Detects common UTF-8 double-decoding patterns in accented text.)
- zero-width-or-bom-inside-file: 2 (Caracter invisivel que pode afetar busca, comparacao ou layout.)
- utf8-mojibake-c2: 2 (Detects common UTF-8 double-decoding patterns in accented text.)

## Findings

- [high] utf8-mojibake-c3 src\components\admin\products\import\MediaImportSource.tsx:110:30 match="Ã©"
  `      // Fix mojibake (e.g. "Ã©" → "é") on the client side as a safety net`
- [high] visible-mojibake-literal src\components\admin\products\import\MediaImportSource.tsx:110:30 match="Ã©"
  `      // Fix mojibake (e.g. "Ã©" → "é") on the client side as a safety net`
- [medium] zero-width-or-bom-inside-file src\lib\productPricing.ts:1:1 match="﻿"
  `﻿import { Produto, PromotionQuantityInfo, ProductQuantityPriceBreakdown } from '../types';`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:81:6 match="Ã¡"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:81:17 match="Ã©"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:81:28 match="Ã­"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:81:39 match="Ã³"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:81:50 match="Ãº"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:82:6 match="Ã¢"
  `    "Ã¢": "â", "Ãª": "ê", "Ã´": "ô",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:82:17 match="Ãª"
  `    "Ã¢": "â", "Ãª": "ê", "Ã´": "ô",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:82:28 match="Ã´"
  `    "Ã¢": "â", "Ãª": "ê", "Ã´": "ô",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:83:6 match="Ã£"
  `    "Ã£": "ã", "Ãõ": "õ", "Ã§": "ç",`
- [high] utf8-mojibake-c3 supabase\functions\_shared\product_import_schema.ts:83:28 match="Ã§"
  `    "Ã£": "ã", "Ãõ": "õ", "Ã§": "ç",`
- [high] utf8-mojibake-c2 supabase\functions\_shared\product_import_schema.ts:88:6 match="Âº"
  `    "Âº": "º", "Âª": "ª"`
- [high] utf8-mojibake-c2 supabase\functions\_shared\product_import_schema.ts:88:17 match="Âª"
  `    "Âº": "º", "Âª": "ª"`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:81:6 match="Ã¡"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:81:17 match="Ã©"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:81:28 match="Ã­"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:81:39 match="Ã³"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:81:50 match="Ãº"
  `    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:82:6 match="Ã¢"
  `    "Ã¢": "â", "Ãª": "ê", "Ã´": "ô",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:82:17 match="Ãª"
  `    "Ã¢": "â", "Ãª": "ê", "Ã´": "ô",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:82:28 match="Ã´"
  `    "Ã¢": "â", "Ãª": "ê", "Ã´": "ô",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:83:6 match="Ã£"
  `    "Ã£": "ã", "Ãõ": "õ", "Ã§": "ç",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:83:17 match="Ãõ"
  `    "Ã£": "ã", "Ãõ": "õ", "Ã§": "ç",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:83:28 match="Ã§"
  `    "Ã£": "ã", "Ãõ": "õ", "Ã§": "ç",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:84:17 match="Ã€"
  `    "Ã ": "à", "Ã€": "À",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:85:17 match="Ã‰"
  `    "Ã ": "Á", "Ã‰": "É", "Ã ": "Í", "Ã“": "Ó", "Ãš": "Ú",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:85:39 match="Ã“"
  `    "Ã ": "Á", "Ã‰": "É", "Ã ": "Í", "Ã“": "Ó", "Ãš": "Ú",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:85:50 match="Ãš"
  `    "Ã ": "Á", "Ã‰": "É", "Ã ": "Í", "Ã“": "Ó", "Ãš": "Ú",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:86:6 match="Ã‚"
  `    "Ã‚": "Â", "ÃŠ": "Ê", "Ã”": "Ô",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:86:12 match="Â\""
  `    "Ã‚": "Â", "ÃŠ": "Ê", "Ã”": "Ô",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:86:17 match="ÃŠ"
  `    "Ã‚": "Â", "ÃŠ": "Ê", "Ã”": "Ô",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:86:28 match="Ã”"
  `    "Ã‚": "Â", "ÃŠ": "Ê", "Ã”": "Ô",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:87:6 match="Ãƒ"
  `    "Ãƒ": "Ã", "Ã•": "Õ", "Ã‡": "Ç",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:87:12 match="Ã\""
  `    "Ãƒ": "Ã", "Ã•": "Õ", "Ã‡": "Ç",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:87:17 match="Ã•"
  `    "Ãƒ": "Ã", "Ã•": "Õ", "Ã‡": "Ç",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:87:28 match="Ã‡"
  `    "Ãƒ": "Ã", "Ã•": "Õ", "Ã‡": "Ç",`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:88:6 match="Âº"
  `    "Âº": "º", "Âª": "ª"`
- [high] visible-mojibake-literal supabase\functions\_shared\product_import_schema.ts:88:17 match="Âª"
  `    "Âº": "º", "Âª": "ª"`
- [medium] zero-width-or-bom-inside-file supabase\migrations\20260716184000_product_discount_quantity_limit.sql:1:1 match="﻿"
  `﻿-- 20260716184000_product_discount_quantity_limit.sql`
