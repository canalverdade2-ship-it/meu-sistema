const fs = require('fs');
const path = require('path');

const DIR = 'c:\\Users\\Adriano Farias\\Downloads\\remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)\\src\\components\\client';

// We just do simple targeted replacements where we can.
async function fixAll() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.tsx'));
  
  for (const f of files) {
    let fp = path.join(DIR, f);
    let code = fs.readFileSync(fp, 'utf8');
    
    // Fix key={index} - basic naive fallback for components
    // If it's a map we can do key={... || index}
    code = code.replace(/key=\{index\}/g, "key={index}"); // wait, better not break it unless specific.
  }
}
