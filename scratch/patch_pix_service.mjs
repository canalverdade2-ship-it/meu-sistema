import fs from 'node:fs';
const p = 'src/lib/pixService.ts';
let s = fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
function once(a, b, label) {
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${label}: ${n}`);
  s = s.replace(a, b);
}
once('  orderNsu?: string;\n  pixCode?: string;', '  orderNsu?: string;\n  total?: number;\n  pixCode?: string;', 'result total');
once('  clienteId,\n  valorLiquido,\n  clienteNome,', '  clienteId,\n  clienteNome,', 'destructure amount');
once('  clienteId: string;\n  valorLiquido: number;\n  clienteNome?: string;', '  clienteId: string;\n  clienteNome?: string;', 'type amount');
once("    const valorFinal = typeof valorLiquido === 'number' && valorLiquido > 0 ? valorLiquido : 0;", `    const quote = await callClientRpc<any>('gsa_client_store_payment_quote', {\n      p_orcamento_id: orcamentoId,\n    });\n    const valorFinal = Number(quote?.total ?? 0);\n    if (!Number.isFinite(valorFinal) || valorFinal < 0) {\n      throw new Error('O servidor retornou um total inválido para o pedido.');\n    }`, 'server quote');
once('      return { success: true };', '      return { success: true, total: valorFinal };', 'zero charge return');
once("    // 3. Atualizar ou criar fatura se aplicável enriquecendo com os itens do orçamento", `    if (!checkoutLink) {\n      return { success: false, total: valorFinal, error: 'A InfinitePay não retornou um link de pagamento válido.' };\n    }\n\n    // 3. Atualizar ou criar fatura se aplicável enriquecendo com os itens do orçamento`, 'require link');
once('      orderNsu: orderNsu,\n    };', '      orderNsu: orderNsu,\n      total: valorFinal,\n    };', 'return total');
fs.writeFileSync(p, s, 'utf8');
console.log('PIX_SERVICE_PATCHED');
