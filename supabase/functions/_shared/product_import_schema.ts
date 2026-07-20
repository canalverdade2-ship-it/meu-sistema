export interface ExtractedProduct {
  name: string;
  description: string | null;
  cost: number | null;
  currency: string | null;
  supplier: string | null;
  product_url: string | null;
  sku: string | null;
  barcode: string | null;
  page: number | null;
  confidence: number;
  evidence: string | null;
}

export interface ExtractedPayload {
  products: ExtractedProduct[];
  warnings: string[];
}

export const PRODUCT_IMPORT_JSON_SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: ["string", "null"] },
          cost: { type: ["number", "null"], minimum: 0 },
          currency: { type: ["string", "null"] },
          supplier: { type: ["string", "null"] },
          product_url: { type: ["string", "null"] },
          sku: { type: ["string", "null"] },
          barcode: { type: ["string", "null"] },
          page: { type: ["integer", "null"], minimum: 1 },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          evidence: { type: ["string", "null"] }
        },
        required: ["name", "confidence"],
        additionalProperties: false
      }
    },
    warnings: {
      type: "array",
      items: { type: "string" }
    }
  },
  required: ["products"],
  additionalProperties: false
};

// Safe manual validator to avoid external dependencies in Deno Edge Functions
export function fixUtf8Encoding(str: string): string {
  try {
    const bytes = new Uint8Array(str.length);
    let isMisDecoded = false;
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code > 255) {
        return str; // contains actual unicode code points beyond ISO-8859-1
      }
      bytes[i] = code;
      if (code === 0xC3 || code === 0xC2) {
        isMisDecoded = true;
      }
    }
    if (isMisDecoded) {
      const decoded = new TextDecoder("utf-8").decode(bytes);
      if (!decoded.includes("\uFFFD")) {
        return decoded;
      }
    }
  } catch {
    // ignore
  }

  // Fallback replacements
  let clean = str;
  const replacements: Record<string, string> = {
    "Ã¡": "á", "Ã©": "é", "Ã­": "í", "Ã³": "ó", "Ãº": "ú",
    "Ã¢": "â", "Ãª": "ê", "Ã´": "ô",
    "Ã£": "ã", "Ãõ": "õ", "Ã§": "ç",
    "Ã ": "à", "Ã€": "À",
    "Ã ": "Á", "Ã‰": "É", "Ã ": "Í", "Ã“": "Ó", "Ãš": "Ú",
    "Ã‚": "Â", "ÃŠ": "Ê", "Ã”": "Ô",
    "Ãƒ": "Ã", "Ã•": "Õ", "Ã‡": "Ç",
    "Âº": "º", "Âª": "ª"
  };
  for (const [bad, good] of Object.entries(replacements)) {
    clean = clean.replaceAll(bad, good);
  }
  return clean;
}

export function validateAndNormalizeProducts(raw: any): ExtractedPayload {
  if (!raw || typeof raw !== 'object') {
    throw new Error("Payload retornado não é um objeto válido.");
  }

  const productsRaw = raw.products;
  if (!Array.isArray(productsRaw)) {
    throw new Error("A propriedade 'products' deve ser uma lista.");
  }

  const normalizedProducts: ExtractedProduct[] = [];
  const warnings: string[] = Array.isArray(raw.warnings) ? raw.warnings.map((w: any) => fixUtf8Encoding(String(w))) : [];

  for (let i = 0; i < productsRaw.length; i++) {
    const p = productsRaw[i];
    if (!p || typeof p !== 'object') continue;

    // Check required fields
    if (typeof p.name !== 'string' || !p.name.trim()) {
      continue; // Skip products without a valid name
    }

    let confidence = Number(p.confidence);
    if (isNaN(confidence) || confidence < 0 || confidence > 1) {
      confidence = 0.5; // fallback default
    }

    // Clean and validate cost
    let cost: number | null = null;
    if (p.cost !== undefined && p.cost !== null) {
      if (typeof p.cost === 'number') {
        if (p.cost >= 0) cost = p.cost;
      } else {
        let str = String(p.cost).trim();
        str = str.replace(/R\$\s?/gi, ''); // remove currency symbol
        // clean up thousands/decimals formatting
        if (str.includes(',') && !str.includes('.')) {
          str = str.replace(',', '.');
        } else if (str.includes(',') && str.includes('.')) {
          if (str.indexOf('.') < str.indexOf(',')) {
            str = str.replace(/\./g, '').replace(',', '.');
          } else {
            str = str.replace(/,/g, '');
          }
        }
        const val = parseFloat(str);
        if (!isNaN(val) && val >= 0) {
          cost = val;
        }
      }
    }

    // Clean page
    let page: number | null = null;
    if (p.page !== undefined && p.page !== null) {
      const val = parseInt(p.page, 10);
      if (!isNaN(val) && val >= 1) {
        page = val;
      }
    }

    // Clean string values, sanitize HTML/script tags if present
    const cleanString = (val: any): string | null => {
      if (val === undefined || val === null) return null;
      let str = String(val).trim();
      str = str.replace(/<[^>]*>/g, ''); // Simple script/HTML stripping
      return fixUtf8Encoding(str);
    };

    // Clean barcode
    let barcode = cleanString(p.barcode || p.ean);
    if (barcode) {
      // Basic EAN validation helper
      barcode = barcode.replace(/[^0-9]/g, '');
      if (barcode.length < 8 || barcode.length > 14) {
        barcode = null; // invalid barcode size
      }
    }

    normalizedProducts.push({
      name: p.name.trim().substring(0, 150),
      description: cleanString(p.description)?.substring(0, 500) || null,
      cost: cost,
      currency: cleanString(p.currency)?.substring(0, 3) || "BRL",
      supplier: cleanString(p.supplier)?.substring(0, 100) || null,
      product_url: cleanString(p.product_url)?.substring(0, 500) || null,
      sku: cleanString(p.sku)?.substring(0, 50) || null,
      barcode: barcode,
      page: page,
      confidence: confidence,
      evidence: cleanString(p.evidence)?.substring(0, 500) || null
    });
  }

  // Cap products at 500 to protect application performance
  const cappedProducts = normalizedProducts.slice(0, 500);

  return {
    products: cappedProducts,
    warnings
  };
}
