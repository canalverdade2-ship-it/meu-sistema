import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { r2Upload, r2PublicUrl } from "../_shared/r2.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

// ─── MODO URL: importar produto a partir de uma URL ───────────────────────────
async function handleUrlImport(req: Request): Promise<Response> {
  const admin = getSupabaseAdmin();
  const authHeader = req.headers.get("Authorization");

  // Verifica autenticação
  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader || "" } } }
  );
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json();
  const { action, url, product_url, product_id, image_urls } = body;

  // Delegar para RPC do banco de dados
  if (action === 'analyze' || action === 'discover_products' || action === 'analyze_products') {
    const targetUrl = url || product_url;
    if (!targetUrl) {
      return new Response(JSON.stringify({ error: "URL é obrigatória" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Busca página e extrai produtos
    try {
      const pageRes = await fetch(targetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 GSA-Bot/1.0' }
      });
      const html = await pageRes.text();
      
      // Extrai título e preço via meta tags
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) ||
                         html.match(/<title>([^<]+)<\/title>/i);
      const priceMatch = html.match(/R\$\s*([\d.,]+)/i);
      const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/i);
      const descMatch = html.match(/<meta property="og:description" content="([^"]+)"/i) ||
                        html.match(/<meta name="description" content="([^"]+)"/i);

      const product = {
        title: titleMatch ? titleMatch[1].trim() : "Produto",
        price: priceMatch ? parseFloat(priceMatch[1].replace('.', '').replace(',', '.')) : 0,
        image_url: imageMatch ? imageMatch[1] : null,
        description: descMatch ? descMatch[1].trim() : "",
        source_url: targetUrl
      };

      return new Response(JSON.stringify({ success: true, product, products: [product] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: `Erro ao acessar URL: ${e.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Copia imagens para R2
  if (action === 'copy_images' || action === 'copy_product_images') {
    if (!image_urls || !Array.isArray(image_urls)) {
      return new Response(JSON.stringify({ error: "image_urls é obrigatório" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const results = [];
    for (const imgUrl of image_urls) {
      try {
        const imgRes = await fetch(imgUrl);
        const buffer = await imgRes.arrayBuffer();
        const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        const ext = contentType.split('/')[1] || 'jpg';
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const key = `public/store-images/${fileName}`;
        await r2Upload(key, new Uint8Array(buffer), contentType);
        results.push({ original: imgUrl, r2_url: r2PublicUrl(key) });
      } catch (e) {
        results.push({ original: imgUrl, error: e.message });
      }
    }

    // Atualiza imagens do produto no banco se product_id fornecido
    if (product_id && results.length > 0) {
      const successUrls = results.filter(r => r.r2_url).map(r => r.r2_url);
      if (successUrls.length > 0) {
        await admin.from('produtos').update({ imagens: successUrls }).eq('id', product_id);
      }
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: `Action '${action}' não reconhecida para modo URL` }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ─── MODO FILE: importar produtos a partir de arquivo (CSV/XLSX) ──────────────
async function handleFileImport(req: Request): Promise<Response> {
  const admin = getSupabaseAdmin();
  const authHeader = req.headers.get("Authorization");

  const supabaseUser = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader || "" } } }
  );
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const body = await req.json();
  const { action, file_content, file_name, import_id } = body;

  if (action === 'create_upload') {
    // Salva arquivo temporário no R2 e retorna o import_id
    if (!file_content || !file_name) {
      return new Response(JSON.stringify({ error: "file_content e file_name são obrigatórios" }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    const newImportId = crypto.randomUUID();
    const key = `private/product-imports/${newImportId}/${file_name}`;
    const contentBytes = new TextEncoder().encode(file_content);
    await r2Upload(key, contentBytes, 'text/plain');

    return new Response(JSON.stringify({ success: true, import_id: newImportId, r2_key: key }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  if (action === 'analyze_media') {
    // Delega para RPC do banco para processar o import
    const { data, error } = await admin.rpc('gsa_process_product_import', {
      p_import_id: import_id,
      p_user_id: user.id
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({ success: true, result: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ error: `Action '${action}' não reconhecida para modo FILE` }), {
    status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

// ─── ROTEADOR PRINCIPAL ────────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const mode = url.searchParams.get('mode');

    if (mode === 'url') return await handleUrlImport(req);
    if (mode === 'file') return await handleFileImport(req);

    // Inferência automática pelo body
    const cloned = req.clone();
    try {
      const body = await cloned.json();
      if (['analyze_media', 'create_upload'].includes(body.action)) return await handleFileImport(req);
      if (['analyze', 'discover_products', 'analyze_products', 'copy_images', 'copy_product_images'].includes(body.action)) return await handleUrlImport(req);
    } catch (_) { /* não é JSON, segue */ }

    return new Response(JSON.stringify({
      error: "Envie ?mode=url ou ?mode=file na URL, ou uma 'action' válida no JSON."
    }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
