const fs = require('fs');
const path = require('path');

const file = 'src/components/client/ClientGSAStore.tsx';
const content = fs.readFileSync(file, 'utf8');
const lines = content.split('\n');

const componentsToExtract = [
  'QuantityModal',
  'StoreItemCard',
  'CartDrawer',
  'CheckoutModal',
  'ProductDetailsModal',
  'FilterModal',
  'AvailableCouponsModal',
  'SubscriptionDurationModal'
];

// Comum imports para todos
const commonImports = `import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Search, Package, Scissors, Calendar, Trash2, X, Plus, Minus, Tag, Check, AlertCircle, Loader2, ChevronLeft, ChevronRight, Filter, SlidersHorizontal, Briefcase, ArrowRight, Ticket, Coins, Sparkles, CreditCard, CheckCircle, Clock, CheckCircle2, Wallet, Gift } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatCurrency, generateCode, formatDate } from '../../../lib/utils';
import { toast } from 'react-hot-toast';
import { Modal } from '../../ui/Modal';
`;

let newGSAStore = [];
let i = 0;
while (i < lines.length) {
  let matched = false;
  for (const comp of componentsToExtract) {
    if (lines[i].startsWith(`function ${comp}(`)) {
      matched = true;
      let compLines = [];
      let openBrackets = 0;
      let started = false;
      
      while (i < lines.length) {
        const line = lines[i];
        compLines.push(line);
        
        openBrackets += (line.match(/\{/g) || []).length;
        openBrackets -= (line.match(/\}/g) || []).length;
        
        if (line.includes('{')) started = true;
        
        i++;
        if (started && openBrackets === 0) {
          break;
        }
      }
      
      const compContent = commonImports + '\nexport default ' + compLines.join('\n').replace(`function ${comp}`, `function ${comp}`);
      fs.writeFileSync(`src/components/client/store/${comp}.tsx`, compContent);
      console.log(`Extracted ${comp}.tsx`);
      i--; // adjust loop
      break;
    }
  }
  
  if (!matched) {
    newGSAStore.push(lines[i]);
  }
  i++;
}

// Inserir os lazy loads logo abaixo dos imports
const lazyLoads = componentsToExtract.map(comp => `const ${comp} = React.lazy(() => import('./store/${comp}'));`).join('\n');

const finalLines = newGSAStore.join('\n');
const importInsertIndex = finalLines.lastIndexOf('import ');
const beforeImports = finalLines.substring(0, importInsertIndex);
const afterImportsIndex = finalLines.indexOf('\n', importInsertIndex);
const finalCode = finalLines.substring(0, afterImportsIndex + 1) + '\n' + lazyLoads + '\n' + finalLines.substring(afterImportsIndex + 1);

fs.writeFileSync(file, finalCode);
console.log('ClientGSAStore.tsx updated with lazy loads.');
