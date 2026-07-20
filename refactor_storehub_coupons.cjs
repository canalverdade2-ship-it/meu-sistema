const fs = require('fs');

const file = 'src/components/client/StoreHub.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('StoreHubCoupons')) {
  content = content.replace(
    "import { ClientGSAStore } from './ClientGSAStore';",
    "import { ClientGSAStore } from './ClientGSAStore';\nimport StoreHubCoupons from './store/StoreHubCoupons';"
  );
}

// 2. Remove states
const statesToRemove = [
  "const [cuponsTab, setCuponsTab] = useState<'ativos' | 'usados'>('ativos');",
  "const [cupons, setCupons] = useState<any[]>([]);",
  "const [cuponsAtivados, setCuponsAtivados] = useState<Set<string>>(new Set());",
  "const [cuponsUsados, setCuponsUsados] = useState<Set<string>>(new Set());",
  "const [ativandoCupom, setAtivandoCupom] = useState<string | null>(null);",
  "const [copiedCupomId, setCopiedCupomId] = useState<string | null>(null);",
  "const [selectedUsedCupomId, setSelectedUsedCupomId] = useState<string | null>(null);"
];

statesToRemove.forEach(state => {
  content = content.replace(new RegExp(state.replace(/[.*+?^$\/{}()|[\\]\\\\]/g, '\\\\$&') + '\\r?\\n?', 'g'), '');
});

// 3. Remove fetchCupons call in useEffect
content = content.replace(/if\s*\(isCuponsModalOpen\)\s*fetchCupons\(\);\r?\n?/g, '');

// 4. Remove fetchCupons function
const fetchCuponsMatch = content.match(/const fetchCupons = async \(\) => \{[\s\S]*?\n  \};\n/);
if (fetchCuponsMatch) {
  content = content.replace(fetchCuponsMatch[0], '');
}

// 5. Remove ativarCupom function
const ativarCupomMatch = content.match(/const ativarCupom = async \(cupomId: string\) => \{[\s\S]*?\n  \};\n/);
if (ativarCupomMatch) {
  content = content.replace(ativarCupomMatch[0], '');
}

// 6. Replace JSX
const jsxStart = '<Modal isOpen={isCuponsModalOpen}';
const startIndex = content.indexOf(jsxStart);
if (startIndex !== -1) {
  let openTags = 0;
  let endIndex = -1;
  const substring = content.substring(startIndex);
  let idx = 0;
  while(idx < substring.length) {
    if (substring.substring(idx, idx + 6) === '<Modal') {
      openTags++;
      idx += 6;
    } else if (substring.substring(idx, idx + 8) === '</Modal>') {
      openTags--;
      if (openTags === 0) {
        endIndex = idx + 8;
        break;
      }
      idx += 8;
    } else {
      idx++;
    }
  }
  
  if (endIndex !== -1) {
    const toReplace = substring.substring(0, endIndex);
    content = content.replace(toReplace, `<StoreHubCoupons isOpen={isCuponsModalOpen} onClose={() => setIsCuponsModalOpen(false)} clientId={clientId!} />`);
  }
}

fs.writeFileSync(file, content);
console.log('StoreHub.tsx successfully refactored for StoreHubCoupons.');
