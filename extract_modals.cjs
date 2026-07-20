const fs = require('fs');

const file = 'src/components/client/StoreHub.tsx';
const content = fs.readFileSync(file, 'utf8');

const modals = [
  { name: 'StoreHubCoupons', search: '<Modal isOpen={isCuponsModalOpen}' },
  { name: 'StoreHubPurchases', search: '<Modal isOpen={isPurchasesModalOpen}' },
  { name: 'StoreHubRefunds', search: '<Modal isOpen={isRefundsModalOpen}' },
  { name: 'StoreHubExchanges', search: '<Modal isOpen={isTrocaModalOpen}' },
  { name: 'StoreHubVipPromos', search: '<Modal isOpen={isVipPromosModalOpen}' },
  { name: 'StoreHubCancelOrder', search: '<Modal \n        isOpen={!!cancelRequestOrder}' }
];

modals.forEach(m => {
  const startIndex = content.indexOf(m.search);
  if (startIndex === -1) {
    console.log('Not found:', m.name);
    return;
  }
  
  let openTags = 0;
  let endIndex = -1;
  const substring = content.substring(startIndex);
  
  // Custom simple XML parser for the root <Modal>
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
    const modalContent = substring.substring(0, endIndex);
    fs.writeFileSync(`src/components/client/store/${m.name}.tsx`, 
`import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '../../ui/Modal';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';
// ADD ICONS AS NEEDED
import * as LucideIcons from 'lucide-react';

export default function ${m.name}(props: any) {
  const { ${Object.keys(m).join(', ')} } = props; // Adjust props as needed
  return (
    ${modalContent.replace(/\n/g, '\n    ')}
  );
}
`);
    console.log('Extracted:', m.name);
  }
});
