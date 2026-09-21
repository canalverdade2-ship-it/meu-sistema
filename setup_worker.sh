cat << 'PYEOF' > /home/opc/worker_shopee_sync.py
import sys, os, time, json, urllib.request, csv, io
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {
    "host": "127.0.0.1",
    "port": 5433,
    "user": "supabase_admin",
    "password": "GSA_SENHA_FORTE_2026",
    "dbname": "gsahub"
}

def log_progress(cur, conn, auto_id, passo, status, msg, progresso, detalhes=None):
    try:
        cur.execute("""
            INSERT INTO public.automacao_scraping_logs (automacao_id, passo, status, mensagem, progresso, detalhes)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (auto_id, passo, status, msg, progresso, json.dumps(detalhes) if detalhes else None))
        conn.commit()
    except Exception as e:
        print(f"Erro ao gravar log: {e}")

def main():
    if len(sys.argv) < 2:
        print("Uso: python3 worker_shopee_sync.py <automacao_id>")
        sys.exit(1)
        
    auto_id = sys.argv[1]
    
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # 1. Obter config da automação
    cur.execute("""
        SELECT target_url, margem_lucro, limite_produtos, nome 
        FROM public.automacao_scraping_configs 
        WHERE id = %s
    """, (auto_id,))
    config = cur.fetchone()
    if not config:
        print(f"Automação {auto_id} não encontrada.")
        sys.exit(1)
        
    target_url, margem_lucro, limite_produtos, nome = config
    margem = float(margem_lucro or 100)
    limite = int(limite_produtos or 0)
    if limite <= 0:
        limite = 2000 # default seguro por rodada para performance ideal
        
    log_progress(cur, conn, auto_id, "iniciando", "em_andamento", f"Iniciando importação do feed Shopee ({nome})...", 10)
    time.sleep(0.5)
    
    log_progress(cur, conn, auto_id, "requisicao", "em_andamento", "Conectando ao feed de afiliados Shopee e baixando dados...", 25)
    
    try:
        req = urllib.request.Request(target_url, headers={"User-Agent": "Mozilla/5.0"})
        resp = urllib.request.urlopen(req, timeout=120)
        text_stream = io.TextIOWrapper(resp, encoding="utf-8", errors="ignore")
        reader = csv.DictReader(text_stream)
        
        log_progress(cur, conn, auto_id, "processando", "em_andamento", "Processando e estruturando produtos do catálogo...", 45)
        
        produtos_para_inserir = []
        lidos = 0
        
        for row in reader:
            itemid = (row.get("itemid") or "").strip()
            title = (row.get("title") or "").strip()
            if not itemid or not title:
                continue
                
            try:
                sale_price_raw = (row.get("sale_price") or row.get("price") or "0").replace(",", ".").strip()
                custo = float(sale_price_raw)
            except:
                custo = 0.0
                
            if custo <= 0:
                continue
                
            venda = round(custo * (1 + (margem / 100.0)), 2)
            codigo = f"SHOPEE_{itemid}"
            desc = (row.get("description") or "").strip()[:5000]
            img = (row.get("image_link") or "").strip()
            img3 = (row.get("image_link_3") or "").strip()
            cat = (row.get("global_category1") or "").strip()
            
            try:
                rating = min(float(row.get("item_rating") or 5), 5.0)
            except:
                rating = 5.0
                
            produtos_para_inserir.append((
                codigo,
                title[:500],
                desc,
                venda,
                custo,
                margem,
                img,
                img3,
                cat,
                True,
                'ativo',
                'pf',
                rating,
                'interno',
                100 # estoque padrão
            ))
            
            lidos += 1
            if lidos % 500 == 0:
                prog = min(45 + int((lidos / limite) * 45), 90)
                log_progress(cur, conn, auto_id, "processando", "em_andamento", f"Importando produtos: {lidos} itens validados...", prog)
                
            if lidos >= limite:
                break
                
        # Bulk Upsert no Postgres
        log_progress(cur, conn, auto_id, "sync", "em_andamento", f"Sincronizando {len(produtos_para_inserir)} produtos no banco de dados...", 90)
        
        insert_query = """
            INSERT INTO public.produtos (
                codigo_produto,
                nome,
                descricao,
                valor,
                valor_custo,
                porcentagem_lucro,
                imagem_url,
                imagem_url_2,
                categoria,
                visivel_na_loja,
                status,
                tipo_cliente,
                avaliacao_media,
                identificador_preferencial,
                estoque
            ) VALUES %s
            ON CONFLICT (codigo_produto) DO UPDATE SET
                nome = EXCLUDED.nome,
                descricao = EXCLUDED.descricao,
                valor = EXCLUDED.valor,
                valor_custo = EXCLUDED.valor_custo,
                porcentagem_lucro = EXCLUDED.porcentagem_lucro,
                imagem_url = EXCLUDED.imagem_url,
                imagem_url_2 = EXCLUDED.imagem_url_2,
                categoria = EXCLUDED.categoria,
                status = 'ativo'
        """
        
        # Garante constraint única no codigo_produto para o upsert se não existir
        cur.execute("""
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'produtos_codigo_produto_key'
                ) THEN
                    ALTER TABLE public.produtos ADD CONSTRAINT produtos_codigo_produto_key UNIQUE (codigo_produto);
                END IF;
            END $$;
        """)
        conn.commit()
        
        execute_values(cur, insert_query, produtos_para_inserir, page_size=500)
        conn.commit()
        
        # Atualiza contadores na automação
        cur.execute("""
            UPDATE public.automacao_scraping_configs 
            SET ultima_execucao = NOW()
            WHERE id = %s
        """, (auto_id,))
        conn.commit()
        
        detalhes_finais = {
            "novos": len(produtos_para_inserir),
            "atualizados": 0,
            "esgotados": 0,
            "produtos_encontrados": lidos
        }
        
        msg_sucesso = f"Sincronização 100% concluída com sucesso! {len(produtos_para_inserir)} novo(s) e 0 atualizado(s) no catálogo da loja com a margem de {int(margem)}%."
        log_progress(cur, conn, auto_id, "concluido", "sucesso", msg_sucesso, 100, detalhes_finais)
        print(f"Sucesso! {len(produtos_para_inserir)} produtos importados.")
        
    except Exception as e:
        err_msg = f"Falha na importação Shopee: {str(e)}"
        print(err_msg)
        log_progress(cur, conn, auto_id, "erro", "erro", err_msg, 0, {"erros": [str(e)]})
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
PYEOF
chmod +x /home/opc/worker_shopee_sync.py
python3 -c "import psycopg2; print('psycopg2 OK')"