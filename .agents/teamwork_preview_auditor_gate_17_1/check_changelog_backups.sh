ls -la /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md*
echo "=== DIFF STATS WITH LATEST BACKUP ==="
diff -u <(head -n 2500 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md.bak) <(head -n 2500 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md) | head -n 30 || true
echo "=== LINES ADDED IN RECENT ENTRIES ==="
tail -n 150 /home/opc/gsa-ai/GSA_TV_MEMORY_CHANGELOG.md | head -n 50
