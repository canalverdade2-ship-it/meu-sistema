const fs = require('fs');

const file = 'src/components/client/StoreHub.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Add import
if (!content.includes('StoreHubPurchases')) {
  content = content.replace(
    "import StoreHubCoupons from './store/StoreHubCoupons';",
    "import StoreHubCoupons from './store/StoreHubCoupons';\nimport StoreHubPurchases from './store/StoreHubPurchases';"
  );
}

// 2. Remove states
const statesToRemove = [
  "const [purchasesTab, setPurchasesTab] = useState<'pendentes' | 'pagos' | 'cancelados'>('pendentes');"
];

statesToRemove.forEach(state => {
  content = content.replace(new RegExp(state.replace(/[.*+?^$\/{}()|[\\]\\\\]/g, '\\\\$&') + '\\r?\\n?', 'g'), '');
});

// 3. Replace JSX
const jsxStart = '<Modal isOpen={isPurchasesModalOpen} onClose={() => { setIsPurchasesModalOpen(false); setSelectedOrderId(null); }} title="Minhas Compras" size="wide">';
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
    const replacement = `<StoreHubPurchases
        isPurchasesModalOpen={isPurchasesModalOpen}
        setIsPurchasesModalOpen={setIsPurchasesModalOpen}
        setSelectedOrderId={setSelectedOrderId}
        loading={loading}
        allPurchases={allPurchases}
        groupedPurchases={groupedPurchases}
        handleCancelOrder={handleCancelOrder}
        isProcessingPayment={isProcessingPayment}
        handlePayOrder={handlePayOrder}
        setSelectedOrderDetail={setSelectedOrderDetail}
        setCancelRequestOrder={setCancelRequestOrder}
        setSelectedOrderTimeline={setSelectedOrderTimeline}
        onNavigate={onNavigate}
      />`;
    content = content.replace(toReplace, replacement);
  }
}

fs.writeFileSync(file, content);
console.log('StoreHub.tsx successfully refactored for StoreHubPurchases.');
