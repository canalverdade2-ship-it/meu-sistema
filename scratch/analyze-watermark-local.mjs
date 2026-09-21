import fs from 'fs';
import { PNG } from 'pngjs';

// Analyze the screenshot locally to find the watermark bounding box
const imgPath = 'C:/Users/Adriano Farias/.gemini/antigravity/brain/c6c9049f-c55a-4d14-9335-f1cc78667b6d/.user_uploaded/media_1788455881493.png';

fs.createReadStream(imgPath)
  .pipe(new PNG())
  .on('parsed', function() {
    console.log(`Imagem: ${this.width}x${this.height}`);
    
    // Watermark is near bottom right
    // Search in region x: [width * 0.8 to width * 0.98], y: [height * 0.7 to height * 0.95]
    let minX = this.width, maxX = 0, minY = this.height, maxY = 0;
    let count = 0;
    
    const startX = Math.round(this.width * 0.85);
    const startY = Math.round(this.height * 0.70);
    const endY = Math.round(this.height * 0.95);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < this.width - 20; x++) {
        const idx = (this.width * y + x) << 2;
        const r = this.data[idx];
        const g = this.data[idx + 1];
        const b = this.data[idx + 2];
        
        // Star is grayish/white on dark background
        if (r > 70 && g > 70 && b > 70 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
          count++;
        }
      }
    }
    
    console.log(`Bounding Box detectado: x=${minX}, y=${minY}, w=${maxX - minX}, h=${maxY - minY} (pixels: ${count})`);
    
    // Relative to width & height:
    console.log(`Posição percentual:`);
    console.log(`X%: ${(minX / this.width * 100).toFixed(2)}% | Y%: ${(minY / this.height * 100).toFixed(2)}%`);
    console.log(`W%: ${((maxX - minX) / this.width * 100).toFixed(2)}% | H%: ${((maxY - minY) / this.height * 100).toFixed(2)}%`);
  })
  .on('error', (err) => console.error(err));
