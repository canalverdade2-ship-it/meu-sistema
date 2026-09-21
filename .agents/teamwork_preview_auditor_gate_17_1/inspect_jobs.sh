ls -lat /home/opc/gsa-program-builder/jobs/ | head -n 15
for j in $(ls -td /home/opc/gsa-program-builder/jobs/* | head -n 5); do
  echo "=== JOB: $j ==="
  if [ -f "$j/result.json" ]; then
    cat "$j/result.json"
  fi
done
