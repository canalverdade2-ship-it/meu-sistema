const fs = require('fs');

function analyzeFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  
  console.log(`\n======================================================`);
  console.log(` ANALYZING: ${filePath}`);
  console.log(`======================================================\n`);

  // 1. Estados (useState)
  console.log(`--- STATES (useState) ---`);
  lines.forEach((l, i) => {
    if (l.includes('useState')) {
      console.log(`[L${i+1}] ${l.trim()}`);
    }
  });

  // 2. Efeitos (useEffect)
  console.log(`\n--- EFFECTS (useEffect) ---`);
  let inEffect = false;
  let effectStr = '';
  lines.forEach((l, i) => {
    if (l.includes('useEffect(')) {
      console.log(`[L${i+1}] useEffect found:`);
    }
    const depMatch = l.match(/\}, \[(.*?)\]\)/);
    if (depMatch) {
      console.log(`    -> Dependencies: [${depMatch[1]}] (L${i+1})`);
    }
  });

  // 3. Consultas Diretas ao Banco (supabase.from)
  console.log(`\n--- DATABASE QUERIES (supabase.from) ---`);
  lines.forEach((l, i) => {
    if (l.includes('supabase.from')) {
      console.log(`[L${i+1}] ${l.trim()}`);
    }
  });
  
  // 4. Componentes e Funções principais
  console.log(`\n--- FUNCTIONS & COMPONENTS ---`);
  lines.forEach((l, i) => {
    if ((l.startsWith('const ') || l.startsWith('function ')) && (l.includes('=>') || l.includes('function'))) {
      if (!l.includes('useState') && !l.includes('useRef') && !l.includes('useMemo')) {
         // Limit length to avoid too much noise
         if (l.length < 150) {
            console.log(`[L${i+1}] ${l.trim()}`);
         }
      }
    }
  });
}

analyzeFile('src/components/client/ClientGSAStore.tsx');
analyzeFile('src/components/client/StoreHub.tsx');
