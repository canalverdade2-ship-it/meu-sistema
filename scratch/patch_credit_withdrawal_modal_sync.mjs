import fs from 'node:fs';
const p = 'C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)/src/components/client/CreditWithdrawalModal.tsx';
const original = fs.readFileSync(p, 'utf8');
const crlf = original.includes('\r\n');
let s = original.replace(/\r\n/g, '\n');
function once(a,b,label){const c=s.split(a).length-1;if(c!==1)throw new Error(`${label}: ${c}`);s=s.replace(a,b);}
once(
  "  createCreditWithdrawal,\n  quoteCreditWithdrawal,",
  "  createCreditWithdrawal,\n  listClientCreditWithdrawals,\n  quoteCreditWithdrawal,",
  'import list',
);
once(
  "  useEffect(() => {\n    if (!isOpen) return;\n    setCurrent(withdrawal || null);\n    setValue('');\n    setPixType('cpf');\n    setPixKey('');\n    setPhotoFile(null);\n    setAddressFile(null);\n  }, [isOpen, withdrawal?.id]);",
  "  useEffect(() => {\n    if (!isOpen) {\n      setCurrent(null);\n      return;\n    }\n    if (withdrawal) {\n      setCurrent(withdrawal);\n    } else if (current?.id) {\n      void listClientCreditWithdrawals()\n        .then((items) => { const latest = items.find((item) => item.id === current.id); if (latest) setCurrent(latest); })\n        .catch(() => undefined);\n    } else {\n      setValue('');\n      setPixType('cpf');\n      setPixKey('');\n      setPhotoFile(null);\n      setAddressFile(null);\n    }\n  }, [isOpen, withdrawal?.id, withdrawal?.status]);",
  'sync effect',
);
fs.writeFileSync(p, crlf ? s.replace(/\n/g, '\r\n') : s, 'utf8');
console.log('MODAL_SYNC_OK');
