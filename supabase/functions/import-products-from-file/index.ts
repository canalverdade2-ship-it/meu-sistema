import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { OpenRouterClient } from "../_shared/openrouter_client.ts";
import { validateAndNormalizeProducts } from "../_shared/product_import_schema.ts";

const BUCKET_NAME = 'gsa-product-import-files';
const MAX_BODY_BYTES = 16 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function allowedOrigin(origin: string | null) {
  if (!origin) return true;
  const configured = (Deno.env.get('PRODUCT_IMPORT_ALLOWED_ORIGINS') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  return configured.includes(origin)
    || ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin);
}

async function readJsonWithinLimit(request: Request) {
  if (!request.body) throw new SyntaxError('invalid_json');
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new RangeError('payload_too_large');
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new SyntaxError('invalid_json');
    return parsed as Record<string, unknown>;
  } finally {
    reader.releaseLock();
  }
}

function clientIp(request: Request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

async function digest(value: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function consumeRateLimit(client: any, bucketKey: string, limit: number) {
  const { data, error } = await client.rpc('gsa_auth_rate_limit_check', {
    p_bucket_key: bucketKey,
    p_limit: limit,
    p_window_seconds: 3600,
    p_block_seconds: 3600,
  });
  if (error || typeof data?.allowed !== 'boolean') throw new Error('rate_limit_unavailable');
  return data as { allowed: boolean; retry_after?: number };
}

function bytesToBase64(bytes: Uint8Array) {
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function storedFileMetadata(client: any, path: string) {
  const lastSlash = path.lastIndexOf('/');
  const directory = path.slice(0, lastSlash);
  const filename = path.slice(lastSlash + 1);
  const { data, error } = await client.storage.from(BUCKET_NAME).list(directory, {
    limit: 10,
    search: filename,
  });
  if (error) throw error;
  const file = data?.find((entry: any) => entry.name === filename);
  if (!file) throw new Error('Arquivo não encontrado.');
  const size = Number(file.metadata?.size || 0);
  const mimeType = String(file.metadata?.mimetype || file.metadata?.contentType || '').toLowerCase();
  return { size, mimeType };
}

const PRODUCT_JSON_SCHEMA_DEFINITION = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: ["string", "null"] },
          cost: { type: ["number", "null"] },
          currency: { type: ["string", "null"] },
          supplier: { type: ["string", "null"] },
          product_url: { type: ["string", "null"] },
          sku: { type: ["string", "null"] },
          barcode: { type: ["string", "null"] },
          page: { type: ["integer", "null"] },
          confidence: { type: "number" },
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

export async function handleRequest(req: Request) {
  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin);

  if (origin && !allowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: 'origin_not_allowed' }), { status: 403, headers });
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  }
  if (!(req.headers.get('content-type') || '').toLowerCase().includes('application/json')) {
    return new Response(JSON.stringify({ error: 'unsupported_media_type' }), { status: 415, headers });
  }
  const declaredLength = Number(req.headers.get('content-length') || 0);
  if (declaredLength > MAX_BODY_BYTES) {
    return new Response(JSON.stringify({ error: 'payload_too_large' }), { status: 413, headers });
  }

  // Pre-declare vars to use in audit log & cleanup
  let atorId = "sistema";
  let actorInfo: any = null;
  let supabaseClient: any = null;
  let uploadedPath: string | null = null;
  const executionStart = Date.now();

  try {
    let requestBody: Record<string, unknown>;
    try {
      requestBody = await readJsonWithinLimit(req);
    } catch (error) {
      return new Response(JSON.stringify({
        error: error instanceof RangeError ? 'payload_too_large' : 'invalid_json',
      }), {
        status: error instanceof RangeError ? 413 : 400,
        headers,
      });
    }
    const action = String(requestBody.action || '');
    const sessaoId = String(requestBody.sessaoId || '');
    const sessionToken = String(requestBody.sessionToken || '');
    const filename = typeof requestBody.filename === 'string' ? requestBody.filename : '';
    const path = typeof requestBody.path === 'string' ? requestBody.path : '';

    if (!sessaoId || !sessionToken) {
      return new Response(JSON.stringify({ error: "Credenciais de sessão inválidas." }), { status: 401, headers });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ error: 'Servidor não configurado.' }), { status: 503, headers });
    }
    supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Valida a sessão e o módulo de produtos antes de criar URL, baixar ou
    // codificar qualquer arquivo.
    const { data: actor, error: actorError } = await supabaseClient.rpc('gsa_admin_authorize_product_url_import', {
      p_sessao_id: sessaoId,
      p_session_token: sessionToken
    });

    if (actorError || !actor?.ator_id) {
      return new Response(JSON.stringify({ error: "Sessão expirada ou sem permissão." }), { status: 403, headers });
    }

    actorInfo = actor;
    atorId = actorInfo.ator_id;

    const actorHash = await digest(`${supabaseKey}:actor:${actorInfo.ator_tipo}:${atorId}`);
    const ipHash = await digest(`${supabaseKey}:ip:${clientIp(req)}`);
    let actorLimit;
    let ipLimit;
    try {
      [actorLimit, ipLimit] = await Promise.all([
        consumeRateLimit(supabaseClient, `product-file-import:${action}:actor:${actorHash}`, action === 'analyze_media' ? 12 : 40),
        consumeRateLimit(supabaseClient, `product-file-import:${action}:ip:${ipHash}`, action === 'analyze_media' ? 20 : 80),
      ]);
    } catch (error) {
      console.error('Limitador da importação de arquivo indisponível:', error);
      return new Response(JSON.stringify({ error: 'rate_limit_unavailable' }), { status: 503, headers });
    }
    if (!actorLimit.allowed || !ipLimit.allowed) {
      const retryAfter = Math.max(
        1,
        Number(actorLimit.retry_after || 0),
        Number(ipLimit.retry_after || 0),
      );
      return new Response(JSON.stringify({ error: 'too_many_attempts', retry_after: retryAfter }), {
        status: 429,
        headers: { ...headers, 'retry-after': String(retryAfter) },
      });
    }

    const logAudit = async (acao: string, detalhes: any) => {
      const { error } = await supabaseClient.from("sistema_logs").insert({
        acao,
        detalhes: JSON.stringify(detalhes),
        ator_tipo: actorInfo?.ator_tipo || "sistema",
        ator_id: actorInfo?.ator_id || null,
        ator_nome: actorInfo?.ator_nome || "Sistema",
      });
      if (error) console.error(`Erro ao registrar auditoria ${acao}:`, error);
    };

    if (action === 'create_upload') {
      const extension = filename.split('.').pop()?.toLowerCase() || '';
      if (
        !filename
        || filename.length > 160
        || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)
        || !ALLOWED_EXTENSIONS.has(extension)
      ) {
        return new Response(JSON.stringify({ error: "Extensão inválida para importação visual." }), { status: 400, headers });
      }

      const generatedImportId = crypto.randomUUID();
      const filePath = `${atorId}/${generatedImportId}/${filename}`;

      const { data, error } = await supabaseClient.storage.from(BUCKET_NAME).createSignedUploadUrl(filePath);

      if (error) {
        throw error;
      }
      await logAudit('IA_IMPORTACAO_UPLOAD_CRIADO', {
        import_id: generatedImportId,
        filename,
      });

      return new Response(JSON.stringify({ 
        import_id: generatedImportId, 
        path: filePath,
        signed_url: data.signedUrl,
        token: data.token
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'analyze_media') {
      if (!path) {
        return new Response(JSON.stringify({ error: "Caminho do arquivo não fornecido." }), { status: 400, headers });
      }

      const escapedActorId = String(atorId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pathPattern = new RegExp(
        `^${escapedActorId}/[0-9a-f]{8}-[0-9a-f-]{27}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,159}$`,
        'i',
      );
      if (!pathPattern.test(path) || path.includes('..') || path.includes('//')) {
        return new Response(JSON.stringify({ error: "Caminho de arquivo inválido ou sem permissão." }), { status: 403, headers });
      }

      uploadedPath = path;
      const extension = path.split('.').pop()?.toLowerCase() || '';
      if (!ALLOWED_EXTENSIONS.has(extension)) {
        return new Response(JSON.stringify({ error: "Extensão inválida para importação visual." }), { status: 415, headers });
      }

      let metadata;
      try {
        metadata = await storedFileMetadata(supabaseClient, path);
      } catch (error) {
        console.error('Falha ao consultar metadados do arquivo:', error);
        return new Response(JSON.stringify({ error: "Arquivo não encontrado para análise." }), { status: 400, headers });
      }
      const expectedPdf = extension === 'pdf';
      const maximumBytes = expectedPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
      if (!Number.isFinite(metadata.size) || metadata.size <= 0 || metadata.size > maximumBytes) {
        return new Response(JSON.stringify({ error: `Arquivo excede o tamanho máximo de ${expectedPdf ? 10 : 5} MB.` }), { status: 413, headers });
      }
      if (
        metadata.mimeType
        && (!ALLOWED_MIME_TYPES.has(metadata.mimeType)
          || (expectedPdf && metadata.mimeType !== 'application/pdf')
          || (!expectedPdf && !metadata.mimeType.startsWith('image/')))
      ) {
        return new Response(JSON.stringify({ error: "MIME do arquivo não permitido." }), { status: 415, headers });
      }

      let client: OpenRouterClient;
      try {
        client = new OpenRouterClient();
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 503, headers });
      }

      const modelVision = Deno.env.get('PRODUCT_IMPORT_VISION_MODEL') || 'google/gemma-4-26b-a4b-it:free';
      const modelVisionFallback = Deno.env.get('PRODUCT_IMPORT_VISION_FALLBACK_MODEL') || 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free';
      const modelText = Deno.env.get('PRODUCT_IMPORT_TEXT_MODEL') || 'qwen/qwen3-next-80b-a3b-instruct:free';

      // Download file to buffer
      const { data: fileData, error: downloadError } = await supabaseClient.storage.from(BUCKET_NAME).download(path);
      
      if (downloadError || !fileData) {
        return new Response(JSON.stringify({ error: "Erro ao ler o arquivo para análise." }), { status: 400, headers });
      }

      const mimeType = (fileData.type || metadata.mimeType || 'application/octet-stream').toLowerCase();
      if (
        !ALLOWED_MIME_TYPES.has(mimeType)
        || fileData.size <= 0
        || fileData.size > maximumBytes
        || (expectedPdf && mimeType !== 'application/pdf')
        || (!expectedPdf && !mimeType.startsWith('image/'))
      ) {
        return new Response(JSON.stringify({ error: "Tipo ou tamanho real do arquivo não permitido." }), { status: 415, headers });
      }
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      const base64Data = bytesToBase64(bytes);

      const isPDF = expectedPdf;
      
      let primaryModel = isPDF ? modelText : modelVision;
      let usedModel = primaryModel;
      let fallbackUsed = false;
      let normalizerUsed = false;
      let parsedPayload: any = null;
      let rawTextResult = "";

      await logAudit("IA_IMPORTACAO_INICIADA", { filename, path, type: isPDF ? "pdf" : "image", primaryModel });

      const promptText = "Analise este arquivo e extraia todos os produtos identificados. Retorne estritamente um JSON no seguinte formato: { \"products\": [ { \"name\": \"...\", \"description\": \"...\", \"cost\": 0, \"currency\": \"BRL\", \"supplier\": \"...\", \"product_url\": \"...\", \"sku\": \"...\", \"barcode\": \"...\", \"page\": 1, \"confidence\": 0.9, \"evidence\": \"...\" } ], \"warnings\": [\"...\"] }.";

      const extractJson = (text: string): any => {
        const cleanJson = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(cleanJson);
      };

      const normalizeWithQwen = async (rawTextToNormalize: string): Promise<any> => {
        normalizerUsed = true;
        const qwenPayload = {
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Você é um normalizador de dados de produtos. Corrija a estrutura de saída do modelo e transforme o seguinte texto no formato JSON rigoroso esperado de importação.
JSON Schema: ${JSON.stringify(PRODUCT_JSON_SCHEMA_DEFINITION)}

Texto bruto para estruturar:
${rawTextToNormalize}`
                }
              ]
            }
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "products_normalize",
              strict: true,
              schema: PRODUCT_JSON_SCHEMA_DEFINITION
            }
          },
          provider: {
            require_parameters: true
          }
        };

        const qwenRes = await client.request({
          model: modelText,
          payload: qwenPayload,
          timeoutMs: 45000
        });

        return extractJson(qwenRes.content);
      };

      const shouldUseVisionFallback = (err: any, productsCount = 0): boolean => {
        if (!err) {
          // If successful but zero products found, we fall back to try to extract visually
          return productsCount === 0;
        }
        const msg = String(err.message || "");
        // Catch network timeouts, provider errors (5xx/429/408), JSON parse issues
        return (
          msg.includes("408") ||
          msg.includes("429") ||
          msg.includes("500") ||
          msg.includes("502") ||
          msg.includes("503") ||
          msg.includes("504") ||
          msg.includes("Timeout") ||
          msg.includes("JSON") ||
          msg.includes("vazia")
        );
      };

      if (isPDF) {
        // PDF flow: First use Qwen with cloudflare-ai file-parser
        try {
          const pdfPayload = {
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  {
                    type: "file",
                    file: {
                      filename: filename || "catalogo.pdf",
                      file_data: `data:${mimeType};base64,${base64Data}`
                    }
                  }
                ]
              }
            ],
            plugins: [
              {
                id: "file-parser",
                pdf: {
                  engine: "cloudflare-ai"
                }
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "pdf_import",
                strict: true,
                schema: PRODUCT_JSON_SCHEMA_DEFINITION
              }
            },
            provider: {
              require_parameters: true
            }
          };

          const res = await client.request({
            model: modelText,
            payload: pdfPayload,
            timeoutMs: 90000
          });

          rawTextResult = res.content;
          const rawParsed = extractJson(res.content);
          parsedPayload = validateAndNormalizeProducts(rawParsed);

        } catch (e: any) {
          console.warn("[PDF Flow] Primary Qwen text parser failed/empty. Falling back to Gemma visual route.", e);
        }

        // Fallback to visual route if Qwen returned nothing or failed
        if (!parsedPayload || parsedPayload.products.length === 0) {
          fallbackUsed = true;
          usedModel = modelVision;
          await logAudit("IA_IMPORTACAO_FALLBACK", { path, reason: "Text extraction returned 0 products or failed. Attempting vision model." });

          try {
            const visualPdfPayload = {
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: promptText },
                    {
                      type: "file",
                      file: {
                        filename: filename || "catalogo.pdf",
                        file_data: `data:${mimeType};base64,${base64Data}`
                      }
                    }
                  ]
                }
              ],
              response_format: {
                type: "json_schema",
                json_schema: {
                  name: "pdf_visual_import",
                  strict: true,
                  schema: PRODUCT_JSON_SCHEMA_DEFINITION
                }
              },
              provider: {
                require_parameters: true
              }
            };

            const res = await client.request({
              model: modelVision,
              payload: visualPdfPayload,
              timeoutMs: 90000
            });

            rawTextResult = res.content;
            const rawParsed = extractJson(res.content);
            parsedPayload = validateAndNormalizeProducts(rawParsed);

          } catch (e: any) {
            // Visual PDF fallback failed, try Nemotron fallback
            if (shouldUseVisionFallback(e)) {
              usedModel = modelVisionFallback;
              const nemotronPayload = {
                messages: [
                  {
                    role: "user",
                    content: [
                      { type: "text", text: promptText + " Responda estritamente em formato JSON válido." },
                      {
                        type: "file",
                        file: {
                          filename: filename || "catalogo.pdf",
                          file_data: `data:${mimeType};base64,${base64Data}`
                        }
                      }
                    ]
                  }
                ]
              };

              const res = await client.request({
                model: modelVisionFallback,
                payload: nemotronPayload,
                timeoutMs: 90000
              });

              rawTextResult = res.content;
              try {
                const rawParsed = extractJson(res.content);
                parsedPayload = validateAndNormalizeProducts(rawParsed);
              } catch {
                // If Nemotron JSON malformed, normalize with Qwen
                const normalized = await normalizeWithQwen(res.content);
                parsedPayload = validateAndNormalizeProducts(normalized);
              }
            } else {
              throw e;
            }
          }
        }

      } else {
        // Image flow: Primary is Gemma
        try {
          const imagePayload = {
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: promptText },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${mimeType};base64,${base64Data}`
                    }
                  }
                ]
              }
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "image_import",
                strict: true,
                schema: PRODUCT_JSON_SCHEMA_DEFINITION
              }
            },
            provider: {
              require_parameters: true
            }
          };

          const res = await client.request({
            model: modelVision,
            payload: imagePayload,
            timeoutMs: 45000
          });

          rawTextResult = res.content;
          const rawParsed = extractJson(res.content);
          parsedPayload = validateAndNormalizeProducts(rawParsed);

        } catch (e: any) {
          if (shouldUseVisionFallback(e)) {
            fallbackUsed = true;
            usedModel = modelVisionFallback;
            await logAudit("IA_IMPORTACAO_FALLBACK", { path, reason: `Primary vision model error: ${e.message}. Attempting Nemotron Omni.` });

            const nemotronPayload = {
              messages: [
                {
                  role: "user",
                  content: [
                    { type: "text", text: promptText + " Responda estritamente em formato JSON válido." },
                    {
                      type: "image_url",
                      image_url: {
                        url: `data:${mimeType};base64,${base64Data}`
                      }
                    }
                  ]
                }
              ]
            };

            const res = await client.request({
              model: modelVisionFallback,
              payload: nemotronPayload,
              timeoutMs: 45000
            });

            rawTextResult = res.content;
            try {
              const rawParsed = extractJson(res.content);
              parsedPayload = validateAndNormalizeProducts(rawParsed);
            } catch {
              const normalized = await normalizeWithQwen(res.content);
              parsedPayload = validateAndNormalizeProducts(normalized);
            }
          } else {
            throw e;
          }
        }
      }

      if (!parsedPayload || !parsedPayload.products || parsedPayload.products.length === 0) {
        throw new Error("Nenhum produto pôde ser estruturado a partir deste arquivo.");
      }

      const duration = Date.now() - executionStart;
      await logAudit("IA_IMPORTACAO_CONCLUIDA", {
        filename,
        primaryModel,
        usedModel,
        fallbackUsed,
        normalizerUsed,
        productsCount: parsedPayload.products.length,
        durationMs: duration
      });

      return new Response(JSON.stringify({
        products: parsedPayload.products,
        warnings: parsedPayload.warnings,
        processing: {
          primary_model: primaryModel,
          used_model: usedModel,
          fallback_used: fallbackUsed,
          normalizer_used: normalizerUsed,
          duration_ms: duration
        }
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida." }), { status: 400, headers });

  } catch (error: any) {
    const duration = Date.now() - executionStart;
    console.error("Edge function error:", error);

    try {
      if (supabaseClient) {
        const { error: logError } = await supabaseClient.from("sistema_logs").insert({
          acao: "IA_IMPORTACAO_FALHOU",
          detalhes: JSON.stringify({ error: error.message, durationMs: duration }),
          ator_tipo: actorInfo?.ator_tipo || "sistema",
          ator_id: actorInfo?.ator_id || null,
          ator_nome: actorInfo?.ator_nome || "Sistema",
        });
        if (logError) console.error("Erro ao registrar auditoria de falha:", logError);
      }
    } catch (logErr) {
      console.error("Erro ao registrar auditoria de falha:", logErr);
    }

    // Determine standard HTTP status codes
    let status = 500;
    const msg = error.message || "";
    if (msg.includes("Sessão") || msg.includes("Credenciais")) {
      status = 403;
    } else if (msg.includes("configurado") || msg.includes("ausente")) {
      status = 503;
    } else if (msg.includes("Timeout")) {
      status = 408;
    } else if (msg.includes("429") || msg.includes("Limite")) {
      status = 429;
    } else if (msg.includes("MIME") || msg.includes("Extensão")) {
      status = 415;
    } else if (msg.includes("tamanho") || msg.includes("max")) {
      status = 413;
    } else if (msg.includes("não pôde ser interpretado") || msg.includes("Nenhum produto")) {
      status = 502; // Bad Gateway from provider/inference output failure
    }

    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
      status
    });

  } finally {
    // Delete temp file from storage
    if (uploadedPath && supabaseClient) {
      try {
        const { error: cleanupError } = await supabaseClient.storage.from(BUCKET_NAME).remove([uploadedPath]);
        if (cleanupError) console.error("[Storage Cleanup] Failed to delete temp file:", cleanupError);
      } catch (cleanupErr) {
        console.error("[Storage Cleanup] Failed to delete temp file:", cleanupErr);
      }
    }
  }
}

if (import.meta.main) serve(handleRequest);
