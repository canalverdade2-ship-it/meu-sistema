const fs = require('fs');

const file = 'src/components/client/store/StoreHubPurchases.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace imports
content = content.replace(
  "import * as LucideIcons from 'lucide-react';",
  "import { Package, History, Clock, Trash2, DollarSign, CreditCard, RefreshCcw, ShoppingBag } from 'lucide-react';"
);

const propsInterface = `
export interface StoreHubPurchasesProps {
  isPurchasesModalOpen: boolean;
  setIsPurchasesModalOpen: (open: boolean) => void;
  setSelectedOrderId: (id: string | null) => void;
  loading: boolean;
  allPurchases: any[];
  groupedPurchases: (purchases: any[]) => any[];
  purchasesTab: string;
  setPurchasesTab: (tab: any) => void;
  handleCancelOrder: (order: any) => void;
  isProcessingPayment: boolean;
  handlePayOrder: (order: any) => void;
  setSelectedOrderDetail: (order: any) => void;
  setCancelRequestOrder: (order: any) => void;
  setSelectedOrderTimeline: (order: any) => void;
  onNavigate?: (path: string) => void;
}

export default function StoreHubPurchases({
  isPurchasesModalOpen,
  setIsPurchasesModalOpen,
  setSelectedOrderId,
  loading,
  allPurchases,
  groupedPurchases,
  purchasesTab,
  setPurchasesTab,
  handleCancelOrder,
  isProcessingPayment,
  handlePayOrder,
  setSelectedOrderDetail,
  setCancelRequestOrder,
  setSelectedOrderTimeline,
  onNavigate
}: StoreHubPurchasesProps) {
`;

content = content.replace(
  /export default function StoreHubPurchases\(props: any\) \{[\s\S]*?return \(/,
  propsInterface + '  return ('
);

fs.writeFileSync(file, content);
console.log('StoreHubPurchases.tsx fixed!');
