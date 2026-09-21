perl -pi -e "s/WHERE \(categoria \\\!= 'emprestimo' OR categoria IS NULL\)/WHERE (categoria \\\!= 'emprestimo' OR categoria IS NULL) AND (origem_gsa_store IS NOT TRUE)/g" /tmp/full_func_def_clean.sql
