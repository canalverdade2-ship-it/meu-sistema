import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { OpenRouterClient } from "../_shared/openrouter_client.ts";
import { validateAndNormalizeProducts } from "../_shared/product_import_schema.ts";

const BUCKET_NAME = 'gsa-product-import-files';

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

serve(async (req) => {
  const origin = req.headers.get("origin");
  const headers = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  // Pre-declare vars to use in audit log & cleanup
  let atorId = "sistema";
  let actorInfo: any = null;
  let supabaseClient: any = null;
  let uploadedPath: string | null = null;
  let executionStart = Date.now();

  try {
    const { action, sessaoId, sessionToken, filename, path } = await req.json();

    if (!sessaoId || !sessionToken) {
      return new Response(JSON.stringify({ error: "Credenciais de sessão inválidas." }), { status: 401, headers });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    supabaseClient = createClient(supabaseUrl, supabaseKey);

    // Validate admin session
    const { data: actor, error: actorError } = await supabaseClient.rpc('gsa_admin_session_actor', {
      p_sessao_id: sessaoId,
      p_session_token: sessionToken
    });

    if (actorError || !actor || !actor.length || !actor[0].ator_id) {
      return new Response(JSON.stringify({ error: "Sessão expirada ou sem permissão." }), { status: 403, headers });
    }

    actorInfo = actor[0];
    atorId = actorInfo.ator_id;

    const logAudit = async (acao: string, detalhes: any) => {
      try {
        await supabaseClient.from("sistema_logs").insert({
          acao,
          detalhes: JSON.stringify(detalhes),
          ator_tipo: actorInfo?.ator_tipo || "sistema",
          ator_id: actorInfo?.ator_id || null,
          ator_nome: actorInfo?.ator_nome || "Sistema",
        });
      } catch (err) {
        console.error("Erro ao registrar auditoria:", err);
      }
    };

    if (action === 'create_upload') {
      if (!filename || !filename.match(/\.(pdf|jpg|jpeg|png|webp)$/i)) {
        return new Response(JSON.stringify({ error: "Extensão inválida para importação visual." }), { status: 400, headers });
      }

      const generatedImportId = crypto.randomUUID();
      const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
      const filePath = `${atorId}/${generatedImportId}/${safeFilename}`;

      const { data, error } = await supabaseClient.storage.from(BUCKET_NAME).createSignedUploadUrl(filePath);

      if (error) {
        throw error;
      }

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

      // Enforce isolation
      if (!path.startsWith(`${atorId}/`)) {
        return new Response(JSON.stringify({ error: "Caminho de arquivo inválido ou sem permissão." }), { status: 403, headers });
      }

      uploadedPath = path;

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

      const mimeType = fileData.type || 'application/octet-stream';
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      const base64Data = btoa(binary);

      const isPDF = mimeType === 'application/pdf' || path.toLowerCase().endsWith('.pdf');
      
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
        await supabaseClient.from("sistema_logs").insert({
          acao: "IA_IMPORTACAO_FALHOU",
          detalhes: JSON.stringify({ error: error.message, durationMs: duration }),
          ator_tipo: actorInfo?.ator_tipo || "sistema",
          ator_id: actorInfo?.ator_id || null,
          ator_nome: actorInfo?.ator_nome || "Sistema",
        });
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
        await supabaseClient.storage.from(BUCKET_NAME).remove([uploadedPath]);
        console.log(`[Storage Cleanup] Temp file removed: ${uploadedPath}`);
      } catch (cleanupErr) {
        console.error("[Storage Cleanup] Failed to delete temp file:", cleanupErr);
      }
    }
  }
});
