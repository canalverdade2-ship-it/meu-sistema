// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import { isUrlSafe } from "../_shared/ssrf_validator.ts";
import { parseProductHtml, parseProductsHtml } from "../_shared/html_parser.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function safeFetch(url: string, timeoutMs = 10000): Promise<Response> {
  if (!url || !isUrlSafe(url)) {
    throw new Error("URL inválida ou não permitida");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "Accept": "text/html,application/xhtml+xml,image/*",
        "User-Agent": "Mozilla/5.0 (compatible; GSA-Store-Bot/1.0)",
      },
    });
  } catch (e: any) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') {
      throw new Error("Tempo limite excedido ao consultar URL");
    }
    throw new Error("Falha ao consultar a URL");
  }
  clearTimeout(timeoutId);

  // Validate redirect destination
  if (response.url && !isUrlSafe(response.url)) {
    throw new Error("URL de redirecionamento inválida ou não permitida");
  }

  return response;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { sessaoId, sessionToken, url, action, images, products, batchId } = body;

    if (!sessaoId || !sessionToken) {
      return new Response(JSON.stringify({ error: "Sessão não informada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Authenticate
    const { data: actorData, error: authError } = await supabase.rpc(
      "gsa_admin_authorize_product_url_import",
      { p_sessao_id: sessaoId, p_session_token: sessionToken }
    );

    if (authError || !actorData) {
      return new Response(JSON.stringify({ error: authError?.message || "Sessão inválida ou sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ACTION: analyze
    if (action === "analyze") {
      let response: Response;
      try {
        response = await safeFetch(url);
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return new Response(JSON.stringify({ error: "A URL não retornou conteúdo HTML válido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      const text = await response.text();
      if (text.length > 2000000) {
        return new Response(JSON.stringify({ error: "Conteúdo da página muito grande (>2MB)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      const parsed = parseProductHtml(text, response.url || url);

      await supabase.from("sistema_logs").insert({
        acao: "IMPORTAR_DADOS_PRODUTO_URL",
        detalhes: JSON.stringify({ url_consultada: new URL(url).hostname, campos_encontrados: Object.keys(parsed.origem_campos), status: "sucesso" }),
        ator_tipo: actorData.ator_tipo, ator_id: actorData.ator_id, ator_nome: actorData.ator_nome,
      });

      return new Response(JSON.stringify({ success: true, data: { ...parsed, url_original: url, url_final: response.url || url, avisos: [] } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ACTION: discover_products
    } else if (action === "discover_products") {
      let response: Response;
      try {
        response = await safeFetch(url);
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html")) {
        return new Response(JSON.stringify({ error: "A URL não retornou conteúdo HTML válido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      const text = await response.text();
      if (text.length > 2000000) {
        return new Response(JSON.stringify({ error: "Conteúdo da página muito grande (>2MB)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      const candidates = parseProductsHtml(text, response.url || url);

      await supabase.from("sistema_logs").insert({
        acao: "DESCOBRIR_PRODUTOS_PAGINA",
        detalhes: JSON.stringify({ url_consultada: new URL(url).hostname, encontrados: candidates.length, status: "sucesso" }),
        ator_tipo: actorData.ator_tipo, ator_id: actorData.ator_id, ator_nome: actorData.ator_nome,
      });

      return new Response(JSON.stringify({ success: true, data: { candidates, total: candidates.length } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    // ACTION: analyze_products (batch of single URLs)
    } else if (action === "analyze_products") {
       // Frontend should send individual URLs to analyze, but we can reuse 'analyze' from frontend directly.
       // For this requirement, it's safer to have the frontend loop `analyze` or we can map them here.
       // The prompt says "Processar as URLs em pequenos lotes... No máximo 10 URLs por chamada".
       const urls = body.urls || [];
       if (!Array.isArray(urls) || urls.length === 0 || urls.length > 10) {
         return new Response(JSON.stringify({ error: "Array de URLs inválido (máx 10)" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
       }

       const results = await Promise.all(urls.map(async (u) => {
          try {
            const res = await safeFetch(u);
            const text = await res.text();
            if (text.length > 2000000) return { url: u, error: "Página muito grande" };
            const parsed = parseProductHtml(text, res.url || u);
            return { url: u, success: true, data: { ...parsed, url_final: res.url || u } };
          } catch (err: any) {
            return { url: u, error: err.message };
          }
       }));

       await supabase.from("sistema_logs").insert({
        acao: "ANALISAR_PRODUTOS_EM_LOTE",
        detalhes: JSON.stringify({ quantidade: urls.length, status: "sucesso" }),
        ator_tipo: actorData.ator_tipo, ator_id: actorData.ator_id, ator_nome: actorData.ator_nome,
      });

       return new Response(JSON.stringify({ success: true, data: results }), { headers: { ...corsHeaders, "Content-Type": "application/json" }});

    // ACTION: copy_images
    } else if (action === "copy_images") {
      if (!Array.isArray(images) || images.length === 0) {
         return new Response(JSON.stringify({ error: "Nenhuma imagem informada" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const uploadedUrls: string[] = [];
      const failedUrls: string[] = [];

      for (const imgUrl of images) {
        try {
          const imgRes = await safeFetch(imgUrl);
          if (!imgRes.ok) throw new Error("Status " + imgRes.status);
          
          const blob = await imgRes.blob();
          if (blob.size > 5000000) throw new Error("Muito grande"); // 5MB
          
          const cType = blob.type;
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(cType)) throw new Error("Tipo inválido");

          const ext = cType.split('/')[1];
          const fileName = `imports/produtos/${crypto.randomUUID()}.${ext}`;

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('gsa-store-images').upload(fileName, blob, { contentType: cType, upsert: true });

          if (uploadError || !uploadData) throw uploadError;
          const { data: publicData } = supabase.storage.from('gsa-store-images').getPublicUrl(fileName);
          uploadedUrls.push(publicData.publicUrl);
        } catch (e) {
          failedUrls.push(imgUrl);
        }
      }

      await supabase.from("sistema_logs").insert({
        acao: "IMPORTAR_DADOS_PRODUTO_URL",
        detalhes: JSON.stringify({ imagens_copiadas: uploadedUrls.length, imagens_falhas: failedUrls.length, status: "copia_imagens" }),
        ator_tipo: actorData.ator_tipo, ator_id: actorData.ator_id, ator_nome: actorData.ator_nome,
      });

      return new Response(JSON.stringify({ success: true, data: { uploaded: uploadedUrls, failed: failedUrls } }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // ACTION: copy_product_images (batch)
    } else if (action === "copy_product_images") {
      if (!batchId || !Array.isArray(products) || products.length === 0) {
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }});
      }

      const results = [];

      for (const prod of products) {
        const clientId = prod.client_id;
        const imgs = prod.images || [];
        const uploadedUrls: string[] = [];
        const failedUrls: string[] = [];

        // max 5
        const toProcess = imgs.slice(0, 5);
        for (const imgUrl of toProcess) {
          try {
            const imgRes = await safeFetch(imgUrl);
            if (!imgRes.ok) throw new Error("Status " + imgRes.status);
            
            const blob = await imgRes.blob();
            if (blob.size > 5000000) throw new Error("Muito grande"); // 5MB
            
            const cType = blob.type;
            if (!['image/jpeg', 'image/png', 'image/webp'].includes(cType)) throw new Error("Tipo inválido");

            const ext = cType.split('/')[1];
            // imports/produtos/{batch_id}/{client_id}/{uuid}.{ext}
            const fileName = `imports/produtos/${batchId}/${clientId}/${crypto.randomUUID()}.${ext}`;

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('gsa-store-images').upload(fileName, blob, { contentType: cType, upsert: true });

            if (uploadError || !uploadData) throw uploadError;
            const { data: publicData } = supabase.storage.from('gsa-store-images').getPublicUrl(fileName);
            uploadedUrls.push(publicData.publicUrl);
          } catch (e) {
            failedUrls.push(imgUrl);
          }
        }
        results.push({ client_id: clientId, uploaded: uploadedUrls, failed: failedUrls });
      }

      await supabase.from("sistema_logs").insert({
        acao: "COPIAR_IMAGENS_LOTE",
        detalhes: JSON.stringify({ batch_id: batchId, produtos_processados: products.length }),
        ator_tipo: actorData.ator_tipo, ator_id: actorData.ator_id, ator_nome: actorData.ator_nome,
      });

      return new Response(JSON.stringify({ success: true, data: results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } else {
      return new Response(JSON.stringify({ error: "Ação inválida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
