echo "=== SEARCHING FOR GBLUR ==="
grep -rn "gblur" /home/opc/gsa-ai/ /home/opc/gsa-program-builder/ 2>/dev/null || echo "ZERO gblur found in codebase."

echo "=== SEARCHING FOR SLOWDOWN (setpts) ==="
grep -rn "setpts" /home/opc/gsa-ai/ /home/opc/gsa-program-builder/ 2>/dev/null || echo "ZERO setpts found in codebase."

echo "=== SEARCHING FOR SECONDARY LOGO OVERLAYS IN BUILDERS ==="
grep -rn "overlay" /home/opc/gsa-program-builder/builder.py /home/opc/gsa-ai/work/identity-flow-20260907/ 2>/dev/null || echo "ZERO overlay found."
