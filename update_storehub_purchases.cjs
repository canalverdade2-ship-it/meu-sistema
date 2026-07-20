const fs = require('fs');

const file = 'src/components/client/store/StoreHubPurchases.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove purchasesTab from interface
content = content.replace("  purchasesTab: string;\n  setPurchasesTab: (tab: any) => void;\n", "");
content = content.replace("  purchasesTab,\n  setPurchasesTab,\n", "");

// Add useState inside component
content = content.replace(
  "}: StoreHubPurchasesProps) {",
  "}: StoreHubPurchasesProps) {\n  const [purchasesTab, setPurchasesTab] = useState<'pendentes' | 'pagos' | 'cancelados'>('pendentes');\n"
);

fs.writeFileSync(file, content);
console.log('StoreHubPurchases.tsx updated with purchasesTab state.');
