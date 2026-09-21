import fetch from 'node:fs';

async function testCommodities() {
  try {
    const res = await fetch('https://www.noticiasagricolas.com.br/cotacoes/soja');
    const html = await res.text();
    // Look for Paranaguá or CEPEA row
    const lines = html.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Paranaguá') || lines[i].includes('Cepea')) {
        console.log('Match line:', lines.slice(i, i + 15).join('\n'));
        break;
      }
    }
  } catch (e) {
    console.error(e);
  }
}
testCommodities();
