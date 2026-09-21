grep -rn "masters-final" /home/opc/gsa-ai/ /home/opc/gsa-program-builder/ /scratch/ 2>/dev/null || true
tail -n 100 /home/opc/.bash_history | grep -E "masters|final|build" || true
