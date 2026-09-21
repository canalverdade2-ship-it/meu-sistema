import { runSshScript } from './ssh2-run.mjs';

async function main() {
  const script = `
python3 -c "
from PIL import Image
import numpy as np

img = Image.open('/opt/gsa-tv/cache/media/1/identity/vinhetas/frame9_raw.png')
w, h = img.size
print(f'Tamanho da imagem: {w}x{h}')

# O logo fica no canto inferior direito
# Vamos recortar os ultimos 250x250 pixels
crop = img.crop((w - 250, h - 250, w, h))
crop.save('/opt/gsa-tv/cache/media/1/identity/vinhetas/watermark_zone.png')

# Encontrar pixels com brilho mais alto que a media da regiao
arr = np.array(crop.convert('L'))
threshold = arr > 60
coords = np.argwhere(threshold)
if len(coords):
    y_min, x_min = coords.min(axis=0)
    y_max, x_max = coords.max(axis=0)
    abs_x = w - 250 + x_min
    abs_y = h - 250 + y_min
    box_w = x_max - x_min
    box_h = y_max - y_min
    print(f'Watermark detectada em: x={abs_x}, y={abs_y}, w={box_w}, h={box_h}')
"
`;
  const res = await runSshScript(script);
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
}

main().catch(console.error);
