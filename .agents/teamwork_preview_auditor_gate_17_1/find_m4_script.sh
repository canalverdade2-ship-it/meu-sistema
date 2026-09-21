find /home/opc/gsa-ai/ -name "*.py" -o -name "*.mjs" -o -name "*.sh" | xargs grep -l "masters-final" 2>/dev/null || true
