const fs = require('fs');

const files = [
  'src/components/client/ClientGSAStore.tsx',
  'src/components/client/StoreHub.tsx'
];

console.log("==========================================");
console.log("       GSA STORE - CODE METRICS");
console.log("==========================================\n");

files.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    
    console.log(`[FILE] ${file}`);
    console.log(`- Total Lines: ${lines.length}`);
    
    const useStates = (content.match(/useState\(/g) || []).length;
    const useEffects = (content.match(/useEffect\(/g) || []).length;
    const supabaseCalls = (content.match(/supabase\.from\(/g) || []).length;
    const rpcCalls = (content.match(/supabase\.rpc\(/g) || []).length;
    const inlineStyles = (content.match(/style={{/g) || []).length;
    const classNames = (content.match(/className="/g) || []).length;
    
    console.log(`- useState hooks: ${useStates}`);
    console.log(`- useEffect hooks: ${useEffects}`);
    console.log(`- Supabase Direct Queries (supabase.from): ${supabaseCalls}`);
    console.log(`- Supabase RPC Calls: ${rpcCalls}`);
    console.log(`- UI Complexity (classNames used): ${classNames}`);
    console.log(`- Inline Styles: ${inlineStyles}\n`);
    
    // Check for potential infinite loops in useEffects
    const useEffectMatches = content.match(/useEffect\([\s\S]*?\}, \[.*?\]\)/g) || [];
    let emptyDeps = 0;
    useEffectMatches.forEach(effect => {
      if (effect.includes('[]')) emptyDeps++;
    });
    console.log(`- useEffects with empty dependencies ([]): ${emptyDeps}`);
    console.log(`- useEffects with dependencies: ${useEffects - emptyDeps}\n`);
    
  } else {
    console.log(`[FILE] ${file} - NOT FOUND`);
  }
});
