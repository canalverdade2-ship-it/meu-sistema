# Empirical Challenger M1 Comprehensive Verification
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
    except Exception as e:
        pass
print(f'Aggregated SQL corpus: {len(combined_sql):,} characters.')

# 3. Parse INVENTARIO_COMPLETO.md
with open('INVENTARIO_COMPLETO.md', 'r', encoding='utf-8') as fp:
    inv_text = fp.read()

lines = inv_text.split('\n')

def get_table_rows(start_hdr, end_hdr=None):
    start_idx = -1
    for i, line in enumerate(lines):
        if start_hdr in line:
            start_idx = i
            break
    if start_idx == -1:
        return []
    end_idx = len(lines)
    if end_hdr:
        for i in range(start_idx + 1, len(lines)):
            if end_hdr in lines[i]:
                end_idx = i
                break
    sub = lines[start_idx:end_idx]
    rows = []
    for l in sub:
        l_str = l.strip()
        if l_str.startswith('| ') or l_str.startswith('|'):
            parts = [p.strip().replace('', '') for p in l_str.split('|')[1:-1]]
            rows.append(parts)
    return rows

inv_report = {}

# Check UI-MOD
mod_rows = get_table_rows('## 2. INVENTÁRIO DE MÓDULOS', '## 3. CATÁLOGO EXAUSTIVO DE ROTAS')
mod_v, mod_f = [], []
for r in mod_rows:
    mid, name, ref = r[0], r[1].replace('**', ''), r[3]
    first_path = ref.split(',')[0].strip()
    if os.path.exists(first_path):
        mod_v.append({'id': mid, 'name': name, 'path': first_path})
    else:
        # check if it exists in src_files
        bn = os.path.basename(first_path).lower()
        if bn in src_files or os.path.splitext(bn)[0] in src_files:
            mod_v.append({'id': mid, 'name': name, 'path': first_path})
        else:
            mod_f.append({'id': mid, 'name': name, 'path': first_path})
inv_report['UI_MOD'] = {'total': len(mod_rows), 'passed': len(mod_v), 'failed': mod_f}

# Check UI-PAGE
page_rows = get_table_rows('## 3. CATÁLOGO EXAUSTIVO DE ROTAS', '## 4. CATÁLOGO DE FORMULÁRIOS')
page_v, page_f = [], []
for r in page_rows:
    pid, route, comp_raw = r[0], r[1], r[4]
    comp_clean = comp_raw.split('(')[0].split('/')[0].strip()
    k1, k2 = comp_clean.lower(), os.path.splitext(comp_clean)[0].lower()
    if k1 in src_files or k2 in src_files:
        page_v.append({'id': pid, 'route': route, 'comp': comp_clean, 'file': src_files.get(k1, src_files.get(k2))[0]})
    else:
        page_f.append({'id': pid, 'route': route, 'comp': comp_raw})
inv_report['UI_PAGE'] = {'total': len(page_rows), 'passed': len(page_v), 'failed': page_f}

# Check UI-FORM
form_rows = get_table_rows('## 4. CATÁLOGO DE FORMULÁRIOS', '## 5. CATÁLOGO DE BOTÕES')
form_v, form_f = [], []
for r in form_rows:
    fid, screen = r[0], r[1]
    comp_name = screen.split('/')[1].strip() if '/' in screen else screen
    c1, c2 = comp_name.split('(')[0].strip().lower(), os.path.splitext(comp_name.split('(')[0].strip())[0].lower()
    if c1 in src_files or c2 in src_files:
        form_v.append({'id': fid, 'screen': screen, 'comp': c1})
    else:
        form_f.append({'id': fid, 'screen': screen, 'comp': c1})
inv_report['UI_FORM'] = {'total': len(form_rows), 'passed': len(form_v), 'failed': form_f}

# Check UI-BTN
btn_rows = get_table_rows('## 5. CATÁLOGO DE BOTÕES', '## 6. CATÁLOGO DE TABELAS DE DADOS')
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

# Check UI-TBL
tbl_rows = get_table_rows('## 6. CATÁLOGO DE TABELAS DE DADOS', '## 7. CATÁLOGO DE MODAIS')
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

# Check UI-MDL
mdl_rows = get_table_rows('## 7. CATÁLOGO DE MODAIS', '## 8. DISTRIBUIÇÃO DAS 294 TABELAS')
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

# Check DB-TBL
dbtbl_rows = get_table_rows('## 9. CATÁLOGO COMPLETO DE TABELAS', '## 10. CATÁLOGO COMPLETO DE STORED PROCEDURES')
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

# Check DB-RPC
dbrpc_rows = get_table_rows('## 10. CATÁLOGO COMPLETO DE STORED PROCEDURES', '## 11. INVENTÁRIO DE SUPABASE EDGE FUNCTIONS')
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

# Check API-EDGE
edge_rows = get_table_rows('## 11. INVENTÁRIO DE SUPABASE EDGE FUNCTIONS', '## 12. INVENTÁRIO DE WEBHOOKS')
edge_v, edge_f = [], []
for r in edge_rows:
    eid, fname, entrypoint = r[0], r[1].strip(), r[2].strip()
    found = os.path.exists(entrypoint) or os.path.exists(os.path.join('supabase', 'functions', fname))
    if found:
        edge_v.append({'id': eid, 'name': fname, 'entrypoint': entrypoint})
    else:
        edge_f.append({'id': eid, 'name': fname, 'entrypoint': entrypoint})
inv_report['API_EDGE'] = {'total': len(edge_rows), 'passed': len(edge_v), 'failed': edge_f}

# Check API-WH
wh_rows = get_table_rows('## 12. INVENTÁRIO DE WEBHOOKS', '## 13. INTEGRAÇÕES EXTERNAS')
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

# Check API-END
end_rows = get_table_rows('## 13. INTEGRAÇÕES EXTERNAS')
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
