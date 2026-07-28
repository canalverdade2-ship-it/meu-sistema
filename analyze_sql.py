import os
import re
import glob

# Obter as 20 migrations mais recentes
directory = r'c:\Users\Adriano Farias\Downloads\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\supabase\migrations'
files = glob.glob(os.path.join(directory, '*.sql'))
files.sort(reverse=True)
recent_files = files[:20]

print(f'Analisando {len(recent_files)} arquivos...')
report = []

for filepath in recent_files:
    filename = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')
        
    # 1. EXCEPTION WHEN OTHERS
    for i, line in enumerate(lines):
        if re.search(r'(?i)EXCEPTION\s+WHEN\s+OTHERS', line):
            report.append(f'- **{filename}:{i+1}** - BAIXO/MEDIO - Uso de EXCEPTION WHEN OTHERS genérico que pode silenciar erros críticos sem o devido repasse (re-raise).')

    # 2. SELECT *
    for i, line in enumerate(lines):
        if re.search(r'(?i)SELECT\s+\*\s+FROM', line) and 'jsonb_array_elements' not in line:
            report.append(f'- **{filename}:{i+1}** - BAIXO - Uso de SELECT * ao invés de listar as colunas explicitamente (Anti-padrão de performance/estabilidade).')

    # 3. Funções longas (+200 linhas)
    # Busca por CREATE OR REPLACE FUNCTION ... e conta ate END; 
    in_func = False
    func_name = ''
    func_start = 0
    for i, line in enumerate(lines):
        match = re.search(r'(?i)CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\s+([a-zA-Z0-9_\.]+)', line)
        if match:
            in_func = True
            func_name = match.group(2)
            func_start = i
        elif in_func and re.search(r'(?i)^END;\s*\$\', line.strip()):
            in_func = False
            func_len = i - func_start
            if func_len > 100: # 100 para pegar mais
                report.append(f'- **{filename}:{func_start+1}** - ALTO - Função {func_name} é muito longa ({func_len} linhas). Deve ser refatorada em funções menores.')

    # 4. Falta de índices (Foreign keys) e Defaults
    # Analisa CREATE TABLE
    for i, line in enumerate(lines):
        if re.search(r'(?i)\b[a-zA-Z0-9_]+_id\b\s+UUID', line) and 'REFERENCES' in line and not 'DEFAULT' in line:
            pass # just a heuristc
        
        if re.search(r'(?i)(created_at|updated_at|status)\s+[a-zA-Z]+(\(.*?\))?', line) and 'DEFAULT' not in line.upper() and 'CREATE TABLE' in content:
            # check if it lacks default
            report.append(f'- **{filename}:{i+1}** - MEDIO - Coluna comum de metadados sem DEFAULT explícito.')
            
for r in report:
    print(r)
