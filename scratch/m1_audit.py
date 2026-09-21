# Milestone 1 Empirical Consistency Challenge Audit
import os
import sys
import re
import json

print('======================================================================')
print('EMPIRICAL CODEBASE CONSISTENCY CHALLENGER — MILESTONE 1 AUDIT')
print('======================================================================')

# 1. Index all src/ files
src_files = {}
all_src_paths = []
for root, dirs, files in os.walk('src'):
    for file in files:
        full_path = os.path.join(root, file).replace('\\', '/')
        all_src_paths.append(full_path)
        base = file.lower()
        no_ext = os.path.splitext(file)[0].lower()
        src_files.setdefault(base, []).append(full_path)
        src_files.setdefault(no_ext, []).append(full_path)

print(f'Indexed {len(all_src_paths)} total files in src/ ({len(src_files)} unique keys)')

# 2. Collect SQL schema files
sql_files = []
if os.path.exists('master_supabase_schema.sql'):
    sql_files.append('master_supabase_schema.sql')
for root, dirs, files in os.walk('supabase/migrations'):
    for file in files:
        if file.endswith('.sql'):
            sql_files.append(os.path.join(root, file).replace('\\', '/'))

for root, dirs, files in os.walk('.'):
    if any(x in root for x in ['node_modules', '.git', '.agents', 'dist', '.wrangler', 'backups', '.gemini']):
        continue
    for file in files:
        if file.endswith('.sql') and os.path.join(root, file).replace('\\', '/') not in sql_files:
            sql_files.append(os.path.join(root, file).replace('\\', '/'))

print(f'Found {len(sql_files)} SQL files across repository.')

combined_sql = ''
for sf in sql_files:
    try:
        with open(sf, 'r', encoding='utf-8', errors='ignore') as fp:
            combined_sql += '\n' + fp.read().lower()
    except Exception:
        pass
print(f'Aggregated SQL corpus: {len(combined_sql):,} characters.')

# 3. Read INVENTARIO_COMPLETO.md
with open('INVENTARIO_COMPLETO.md', 'r', encoding='utf-8') as fp:
    inv_text = fp.read()

lines = inv_text.split('\n')

def get_rows_between_headers(h_start_num, h_end_num=None):
    start_pat = rf'^## {h_start_num}\.'
    end_pat = rf'^## {h_end_num}\.' if h_end_num else None
    start_idx = -1
    for i, l in enumerate(lines):
        if re.match(start_pat, l.strip()):
            start_idx = i
            break
    if start_idx == -1:
        return []
    end_idx = len(lines)
    if end_pat:
        for i in range(start_idx + 1, len(lines)):
            if re.match(end_pat, lines[i].strip()):
                end_idx = i
                break
    sub = lines[start_idx:end_idx]
    rows = []
    for l in sub:
        l_str = l.strip()
        if l_str.startswith('| `') or l_str.startswith('|`'):
            parts = [p.strip().replace('`', '') for p in l_str.split('|')[1:-1]]
            rows.append(parts)
    return rows

inv_report = {}

# UI-MOD (Section 2 -> 3)
mod_rows = get_rows_between_headers(2, 3)
mod_v, mod_f = [], []
for r in mod_rows:
    mid, name, ref = r[0], r[1].replace('**', ''), r[3]
    first_path = ref.split(',')[0].strip()
    bn = os.path.basename(first_path).lower()
    if os.path.exists(first_path) or bn in src_files or os.path.splitext(bn)[0] in src_files:
        mod_v.append({'id': mid, 'name': name, 'path': first_path})
    else:
        mod_f.append({'id': mid, 'name': name, 'path': first_path})
inv_report['UI_MOD'] = {'total': len(mod_rows), 'passed': len(mod_v), 'failed': mod_f}

# UI-PAGE (Section 3 -> 4)
page_rows = get_rows_between_headers(3, 4)
page_v, page_f = [], []
for r in page_rows:
    pid, route, comp_raw = r[0], r[1], r[4]
    comp_clean = comp_raw.split('(')[0].split('/')[0].strip()
    k1, k2 = comp_clean.lower(), os.path.splitext(comp_clean)[0].lower()
    if k1 in src_files or k2 in src_files:
        matched = src_files.get(k1, src_files.get(k2))
        page_v.append({'id': pid, 'route': route, 'comp': comp_clean, 'matched': matched[0]})
    else:
        page_f.append({'id': pid, 'route': route, 'comp': comp_raw})
inv_report['UI_PAGE'] = {'total': len(page_rows), 'passed': len(page_v), 'failed': page_f}

# UI-FORM (Section 4 -> 5)
form_rows = get_rows_between_headers(4, 5)
form_v, form_f = [], []
for r in form_rows:
    fid, screen = r[0], r[1]
    comp_name = screen.split('/')[1].strip() if '/' in screen else screen
    c1 = comp_name.split('(')[0].strip().lower()
    c2 = os.path.splitext(c1)[0].lower()
    if c1 in src_files or c2 in src_files:
        form_v.append({'id': fid, 'screen': screen, 'comp': c1})
    else:
        form_f.append({'id': fid, 'screen': screen, 'comp': c1})
inv_report['UI_FORM'] = {'total': len(form_rows), 'passed': len(form_v), 'failed': form_f}

# UI-BTN (Section 5 -> 6)
btn_rows = get_rows_between_headers(5, 6)
btn_v, btn_f = [], []
for r in btn_rows:
    bid, loc = r[0], r[1]
    c1 = loc.split('(')[0].strip().lower()
    c2 = os.path.splitext(c1)[0].lower()
    if c1 in src_files or c2 in src_files:
        btn_v.append({'id': bid, 'loc': loc, 'comp': c1})
    else:
        btn_f.append({'id': bid, 'loc': loc, 'comp': c1})
inv_report['UI_BTN'] = {'total': len(btn_rows), 'passed': len(btn_v), 'failed': btn_f}

# UI-TBL (Section 6 -> 7)
tbl_rows = get_rows_between_headers(6, 7)
tbl_v, tbl_f = [], []
for r in tbl_rows:
    tid, loc = r[0], r[1]
    c_part = loc.split('/')[1] if '/' in loc else loc
    c1 = c_part.split('(')[0].strip().lower()
    c2 = os.path.splitext(c1)[0].lower()
    if c1 in src_files or c2 in src_files:
        tbl_v.append({'id': tid, 'loc': loc, 'comp': c1})
    else:
        tbl_f.append({'id': tid, 'loc': loc, 'comp': c1})
inv_report['UI_TBL'] = {'total': len(tbl_rows), 'passed': len(tbl_v), 'failed': tbl_f}

# UI-MDL (Section 7 -> 8)
mdl_rows = get_rows_between_headers(7, 8)
mdl_v, mdl_f = [], []
for r in mdl_rows:
    mid, loc = r[0], r[1]
    c1 = loc.split('(')[0].strip().lower()
    c2 = os.path.splitext(c1)[0].lower()
    if c1 in src_files or c2 in src_files:
        mdl_v.append({'id': mid, 'loc': loc, 'comp': c1})
    else:
        mdl_f.append({'id': mid, 'loc': loc, 'comp': c1})
inv_report['UI_MDL'] = {'total': len(mdl_rows), 'passed': len(mdl_v), 'failed': mdl_f}

# DB-TBL (Section 9 -> 10)
dbtbl_rows = get_rows_between_headers(9, 10)
dbtbl_v, dbtbl_f = [], []
for r in dbtbl_rows:
    tid, tname = r[0], r[1].lower().strip()
    patterns = [
        rf'create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?{re.escape(tname)}[\s\(]',
        rf'table\s+(?:public\.)?{re.escape(tname)}[\s\(]',
        rf'from\s+(?:public\.)?{re.escape(tname)}[\s\;,\)]',
        rf'into\s+(?:public\.)?{re.escape(tname)}[\s\(]',
        rf'update\s+(?:public\.)?{re.escape(tname)}[\s]'
    ]
    found = any(re.search(p, combined_sql) for p in patterns)
    if found:
        dbtbl_v.append({'id': tid, 'table': tname})
    else:
        dbtbl_f.append({'id': tid, 'table': tname})
inv_report['DB_TBL'] = {'total': len(dbtbl_rows), 'passed': len(dbtbl_v), 'failed': dbtbl_f}

# DB-RPC (Section 10 -> 11)
dbrpc_rows = get_rows_between_headers(10, 11)
dbrpc_v, dbrpc_f = [], []
for r in dbrpc_rows:
    rid, fname = r[0], r[1].lower().strip()
    pattern = rf'(?:function|procedure)\s+(?:public\.)?{re.escape(fname)}[\s\(]'
    found = bool(re.search(pattern, combined_sql))
    if found:
        dbrpc_v.append({'id': rid, 'rpc': fname})
    else:
        dbrpc_f.append({'id': rid, 'rpc': fname})
inv_report['DB_RPC'] = {'total': len(dbrpc_rows), 'passed': len(dbrpc_v), 'failed': dbrpc_f}

# API-EDGE (Section 11 -> 12)
edge_rows = get_rows_between_headers(11, 12)
edge_v, edge_f = [], []
for r in edge_rows:
    eid, fname, entrypoint = r[0], r[1].strip(), r[2].strip()
    found = os.path.exists(entrypoint) or os.path.exists(os.path.join('supabase', 'functions', fname))
    if found:
        edge_v.append({'id': eid, 'name': fname, 'entrypoint': entrypoint})
    else:
        edge_f.append({'id': eid, 'name': fname, 'entrypoint': entrypoint})
inv_report['API_EDGE'] = {'total': len(edge_rows), 'passed': len(edge_v), 'failed': edge_f}

# API-WH (Section 12 -> 13)
wh_rows = get_rows_between_headers(12, 13)
vps_code = ''
if os.path.exists('server_webhook.cjs'):
    with open('server_webhook.cjs', 'r', encoding='utf-8', errors='ignore') as fp:
        vps_code += fp.read()
if os.path.exists('server_webhook_vps_live.cjs'):
    with open('server_webhook_vps_live.cjs', 'r', encoding='utf-8', errors='ignore') as fp:
        vps_code += fp.read()
wh_v, wh_f = [], []
for r in wh_rows:
    wid, route = r[0], r[1].strip()
    clean_route = route.split('*')[0].rstrip('/')
    found = (route == '/') or (clean_route in vps_code) or (route in vps_code)
    if found:
        wh_v.append({'id': wid, 'route': route})
    else:
        wh_f.append({'id': wid, 'route': route})
inv_report['API_WH'] = {'total': len(wh_rows), 'passed': len(wh_v), 'failed': wh_f}

# API-END (Section 13 -> end)
end_rows = get_rows_between_headers(13, None)
end_v, end_f = [], []
for r in end_rows:
    nid, service = r[0], r[1].strip()
    src_file = r[5].strip() if len(r) > 5 else ''
    found = os.path.exists(src_file)
    if found:
        end_v.append({'id': nid, 'service': service, 'file': src_file})
    else:
        end_f.append({'id': nid, 'service': service, 'file': src_file})
inv_report['API_END'] = {'total': len(end_rows), 'passed': len(end_v), 'failed': end_f}

print('\n-------------------------------------------------------------')
print('INVENTORY NODE VERIFICATION RESULTS:')
print('-------------------------------------------------------------')
global_total = 0
global_passed = 0
for cat, data in inv_report.items():
    global_total += data['total']
    global_passed += data['passed']
    pct = (data['passed'] / data['total'] * 100) if data['total'] > 0 else 100
    print(f'{cat:10}: {data["passed"]}/{data["total"]} ({pct:.1f}%) | Failures: {len(data["failed"])}')
    if len(data['failed']) > 0:
        for f_item in data['failed'][:3]:
            print(f'   -> FAIL: {f_item}')

print('-------------------------------------------------------------')
print(f'GLOBAL CATALOG SUM: {global_passed}/{global_total} ({(global_passed/global_total*100):.2f}%) verified against actual code.')
print('=============================================================')

# 4. Cross-Reference GRAFO_CONEXOES, MATRIZ_RASTREABILIDADE, MATRIZ_TESTES_CONEXOES
print('\n--- Auditing Connection Graph & Traceability Cross-Referencing ---')

with open('GRAFO_CONEXOES.md', 'r', encoding='utf-8') as fp:
    grafo_text = fp.read()

with open('MATRIZ_RASTREABILIDADE.md', 'r', encoding='utf-8') as fp:
    rastreab_text = fp.read()

with open('MATRIZ_TESTES_CONEXOES.md', 'r', encoding='utf-8') as fp:
    testes_text = fp.read()

# Parse edges in GRAFO_CONEXOES (EDGE-001 to EDGE-080)
grafo_edges = {}
for line in grafo_text.split('\n'):
    line_s = line.strip()
    if line_s.startswith('| `EDGE-') or line_s.startswith('|`EDGE-'):
        parts = [p.strip().replace('`', '') for p in line_s.split('|')[1:-1]]
        edge_id = parts[0]
        if len(parts) >= 7:
            grafo_edges[edge_id] = {
                'id': edge_id,
                'origem': parts[1],
                'handler': parts[2],
                'servico': parts[3],
                'endpoint': parts[4],
                'tabelas': parts[5],
                'propagacao': parts[6],
                'status': parts[7] if len(parts) > 7 else 'ANALISADO ESTATICAMENTE'
            }

print(f'Parsed {len(grafo_edges)} edges from GRAFO_CONEXOES.md')

# Parse MATRIZ_RASTREABILIDADE (TRC-001 to TRC-080)
rastreab_flows = {}
for line in rastreab_text.split('\n'):
    line_s = line.strip()
    if line_s.startswith('| `TRC-') or line_s.startswith('|`TRC-'):
        parts = [p.strip().replace('`', '') for p in line_s.split('|')[1:-1]]
        trc_id = parts[0]
        edge_ref = parts[1]
        rastreab_flows[edge_ref] = {
            'trc_id': trc_id,
            'edge_ref': edge_ref,
            'dominio': parts[2],
            'rota': parts[3],
            'componente': parts[4],
            'gatilho': parts[5],
            'handler': parts[6],
            'servico': parts[7],
            'endpoint': parts[8],
            'tabelas': parts[9],
            'status': parts[11] if len(parts) > 11 else 'ANALISADO ESTATICAMENTE'
        }

print(f'Parsed {len(rastreab_flows)} traceability flows from MATRIZ_RASTREABILIDADE.md')

# Parse MATRIZ_TESTES_CONEXOES (EDGE-001 to EDGE-080)
testes_edges = {}
for line in testes_text.split('\n'):
    line_s = line.strip()
    if line_s.startswith('| `EDGE-') or line_s.startswith('|`EDGE-'):
        parts = [p.strip().replace('`', '') for p in line_s.split('|')[1:-1]]
        edge_id = parts[0]
        if len(parts) >= 7:
            testes_edges[edge_id] = {
                'id': edge_id,
                'dominio': parts[1],
                'origem': parts[2],
                'happy_path': parts[3],
                'negative_path': parts[4],
                'db_verification': parts[5],
                'reactivity_validation': parts[6],
                'status': parts[7] if len(parts) > 7 else 'ANALISADO ESTATICAMENTE'
            }

print(f'Parsed {len(testes_edges)} test specifications from MATRIZ_TESTES_CONEXOES.md')

cross_reconciliation = {
    'total_canonical_edges': 80,
    'grafo_count': len(grafo_edges),
    'rastreabilidade_count': len(rastreab_flows),
    'testes_count': len(testes_edges),
    'missing_in_rastreab': [f'EDGE-{i:03d}' for i in range(1, 81) if f'EDGE-{i:03d}' not in rastreab_flows],
    'missing_in_testes': [f'EDGE-{i:03d}' for i in range(1, 81) if f'EDGE-{i:03d}' not in testes_edges],
    'missing_in_grafo': [f'EDGE-{i:03d}' for i in range(1, 81) if f'EDGE-{i:03d}' not in grafo_edges]
}
print('Cross-reconciliation status:', cross_reconciliation)

# 5. Deep Probing of Sample of >= 20 Connection Edges
print('\n--- Deep Empirical Factual Wiring Probe (Sample of 25 Edges) ---')
sample_ids = [f'EDGE-{i:03d}' for i in range(1, 26)] # 25 edges sample

edge_probes = []
for eid in sample_ids:
    g_info = grafo_edges.get(eid, {})
    r_info = rastreab_flows.get(eid, {})
    
    origem_text = g_info.get('origem', r_info.get('componente', ''))
    handler_text = g_info.get('handler', r_info.get('handler', ''))
    servico_text = g_info.get('servico', r_info.get('servico', ''))
    endpoint_text = g_info.get('endpoint', r_info.get('endpoint', ''))
    tabelas_text = g_info.get('tabelas', r_info.get('tabelas', ''))
    
    # Check component existence
    comp_file_name = origem_text.split('<br>')[0].split('(')[0].strip()
    if not comp_file_name:
        comp_file_name = r_info.get('componente', '')
    
    c_key = comp_file_name.lower()
    c_key_no_ext = os.path.splitext(c_key)[0]
    matched_files = src_files.get(c_key, src_files.get(c_key_no_ext, []))
    
    comp_found = len(matched_files) > 0
    matched_file_path = matched_files[0] if comp_found else None
    
    # Read component file content to search for handler or service call
    comp_content = ''
    handler_found = False
    service_call_found = False
    h_name = handler_text.split('(')[0].strip()
    s_name = servico_text.split('(')[0].replace('callAdminRpc', '').replace('callClientRpc', '').replace("'", "").replace('"', '').strip()
    
    if comp_found and os.path.exists(matched_file_path):
        try:
            with open(matched_file_path, 'r', encoding='utf-8', errors='ignore') as fp:
                comp_content = fp.read()
        except:
            pass
        
        if h_name and (h_name in comp_content or re.search(rf'\b{re.escape(h_name)}\b', comp_content)):
            handler_found = True
        
        if s_name and (s_name in comp_content):
            service_call_found = True
    
    if not handler_found and h_name:
        for p in all_src_paths:
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    if h_name in fp.read():
                        handler_found = True
                        break
            except:
                pass
                
    if not service_call_found and s_name:
        for p in all_src_paths:
            try:
                with open(p, 'r', encoding='utf-8', errors='ignore') as fp:
                    if s_name in fp.read():
                        service_call_found = True
                        break
            except:
                pass

    # Check backend endpoint / RPC / table in combined SQL
    rpc_matches = re.findall(r'(?:RPC|gsa_\w+|[a-z_]+)', endpoint_text)
    backend_found = False
    for token in rpc_matches:
        if token.startswith('gsa_') or token.startswith('rpc'):
            clean_token = token.replace('RPC', '').strip().lower()
            if clean_token and clean_token in combined_sql:
                backend_found = True
                break
    if not backend_found:
        first_table = tabelas_text.split(',')[0].strip().split()[0].lower()
        if first_table in combined_sql:
            backend_found = True

    status_str = 'CONFIRMED' if (comp_found and (handler_found or service_call_found) and backend_found) else 'PARTIAL'
    edge_probes.append({
        'edge_id': eid,
        'component': comp_file_name,
        'component_found': comp_found,
        'component_path': matched_file_path,
        'handler': h_name,
        'handler_found': handler_found,
        'service': s_name,
        'service_found': service_call_found,
        'endpoint_or_table': endpoint_text,
        'backend_found': backend_found,
        'wiring_status': status_str
    })
    print(f'[{eid}] {comp_file_name:30} -> {h_name:25} -> {s_name:25} : {status_str}')

print(f'Probed {len(edge_probes)} connection edges.')
confirmed_edges = [ep for ep in edge_probes if ep['wiring_status'] == 'CONFIRMED']
print(f'Confirmed Factual Wiring: {len(confirmed_edges)}/{len(edge_probes)} ({len(confirmed_edges)/len(edge_probes)*100:.1f}%)')

# 6. Status Integrity & Hallucination Audit
print('\n--- Status Integrity & Premature Coverage Audit ---')

all_docs = {
    'INVENTARIO_COMPLETO.md': inv_text,
    'MATRIZ_RASTREABILIDADE.md': rastreab_text,
    'GRAFO_CONEXOES.md': grafo_text,
    'MATRIZ_TESTES_CONEXOES.md': testes_text
}

status_audit = {}
for doc_name, text in all_docs.items():
    validado_count = len(re.findall(r'\bVALIDADO\b', text))
    validado_lines = [l.strip() for l in text.split('\n') if 'VALIDADO' in l]
    claims_of_validado = [l for l in validado_lines if not any(x in l.lower() for x in ['zero', 'sem falsas', 'proibido', 'prematuras', 'só é aceito', 'não fabricar', 'antes dos testes'])]
    analisado_count = len(re.findall(r'ANALISADO ESTATICAMENTE', text))
    status_audit[doc_name] = {
        'total_VALIDADO_mentions': validado_count,
        'actual_claims_of_VALIDADO': len(claims_of_validado),
        'claims_sample': claims_of_validado[:3],
        'total_ANALISADO_ESTATICAMENTE': analisado_count
    }
    print(f'{doc_name:25}: Premature VALIDADO claims: {len(claims_of_validado)} | ANALISADO ESTATICAMENTE: {analisado_count}')

final_summary = {
    'inventory_node_verification': inv_report,
    'cross_reconciliation': cross_reconciliation,
    'edge_wiring_probes': edge_probes,
    'status_integrity_audit': status_audit
}

with open('scratch/challenger_m1_full_audit_results.json', 'w', encoding='utf-8') as fp:
    json.dump(final_summary, fp, indent=2)

print('\nAudit results saved to scratch/challenger_m1_full_audit_results.json')
print('======================================================================')

