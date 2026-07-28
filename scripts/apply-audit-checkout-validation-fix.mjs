import { readFileSync, writeFileSync } from 'node:fs';

const path = 'src/components/client/store/CheckoutModal.tsx';
const source = readFileSync(path, 'utf8');
const before = 'Não foi possível validar os produtos antes da compra: ${productValidationError.message}';
const after = 'Não foi possível validar preços e estoque antes da compra: ${productValidationError.message}';

if (source.includes(after)) {
  console.log('Correção do checkout já aplicada.');
  process.exit(0);
}

if (!source.includes(before)) {
  throw new Error('Mensagem de validação do checkout não encontrada.');
}

writeFileSync(path, source.replace(before, after), 'utf8');
console.log('Mensagem segura de validação de preços e estoque aplicada.');
