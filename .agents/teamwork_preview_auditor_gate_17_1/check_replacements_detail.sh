ls -la /home/opc/gsa-ai/work/identity-flow-20260907/replacements/
echo "=== SHA256 OF REPLACEMENTS ==="
sha256sum /home/opc/gsa-ai/work/identity-flow-20260907/replacements/*.mp4
echo "=== SHA256 OF THE 9 REGENERATED IN MASTERS-FINAL ==="
for f in gsa-agro-opening.mp4 gsa-bem-viver-closing.mp4 gsa-business-opening.mp4 gsa-em-fe-closing.mp4 gsa-esportes-closing.mp4 gsa-hora-da-palavra-opening.mp4 gsa-motor-opening.mp4 gsa-news-noite-opening.mp4 gsa-sabor-opening.mp4; do
  sha256sum "/home/opc/gsa-ai/work/identity-flow-20260907/masters-final/$f"
done
