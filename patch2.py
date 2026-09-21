import sys
with open('/tmp/full_func_def_clean.sql', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('WHERE (categoria != \'emprestimo\' OR categoria IS NULL)', 'WHERE (categoria != \'emprestimo\' OR categoria IS NULL) AND (origem_gsa_store IS NOT TRUE)')
with open('/tmp/full_func_def_clean.sql', 'w', encoding='utf-8') as f:
    f.write(text)
