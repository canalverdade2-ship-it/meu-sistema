import fs from 'node:fs';
const root='C:/Users/Adriano Farias/Downloads/remix-9.10_-grupo-gsa---gestão-de-serviços - Copia (4)';
const checkout=`${root}/src/components/client/store/CheckoutPage.tsx`;
const pix=`${root}/src/lib/pixService.ts`;
let c=fs.readFileSync(checkout,'utf8');
let p=fs.readFileSync(pix,'utf8');
function one(src,a,b,label){const n=src.split(a).length-1;if(n!==1)throw new Error(`${label}: ${n}`);return src.replace(a,b);}

c=one(c,"  prazo_meses?: number;\n  isBrinde?: boolean;","  prazo_meses?: number;\n  produto_variante_id?: string | null;\n  isBrinde?: boolean;",'cart type');
c=one(c,"            prazo_meses: item.prazo_meses,\n            item_detalhes: detalhes","            prazo_meses: item.prazo_meses,\n            produto_variante_id: item.produto_variante_id || item.variante_id || null,\n            item_detalhes: detalhes",'guest variant');
c=one(c,"          prazo_meses: item.prazo_meses,\n          item_detalhes: detalhes","          prazo_meses: item.prazo_meses,\n          produto_variante_id: item.produto_variante_id || null,\n          item_detalhes: detalhes",'auth variant');c=one(c,"            quantidade: item.quantidade,\n            ...(item.tipo === 'assinatura' ? { prazo_meses: item.prazo_meses || 1 } : {}),","            quantidade: item.quantidade,\n            ...(item.tipo === 'produto' ? { variante_id: item.produto_variante_id || null } : {}),\n            ...(item.tipo === 'assinatura' ? { prazo_meses: item.prazo_meses || 1 } : {}),",'checkout payload variant');

p=one(p,"  qrCodeUrl?: string;\n  error?: string;","  qrCodeUrl?: string;\n  total?: number;\n  error?: string;",'result total');
p=one(p,"  clienteId,\n  valorLiquido,\n  clienteNome,","  clienteId,\n  clienteNome,",'remove value arg destructure');
p=one(p,"  clienteId: string;\n  valorLiquido: number;\n  clienteNome?: string;","  clienteId: string;\n  clienteNome?: string;",'remove value arg type');
p=one(p,"    const valorFinal = typeof valorLiquido === 'number' && valorLiquido > 0 ? valorLiquido : 0;","    const quote = await callClientRpc<any>('gsa_client_store_payment_quote', { p_orcamento_id: orcamentoId });\n    const valorFinal = Number(quote?.total || 0);\n    const codigoServidor = quote?.codigo_orcamento || codigoOrcamento;",'server quote');
p=p.replaceAll('`${codigoOrcamento}-${Date.now()}`','`${codigoServidor}-${Date.now()}`');
p=p.replaceAll('`Pedido ${codigoOrcamento} - Grupo GSA`','`Pedido ${codigoServidor} - Grupo GSA`');const valueLine="          valorLiquido: totalHojeFinal,\n";
const valueCount=c.split(valueLine).length-1;
if(valueCount!==2) throw new Error(`checkout provider value lines: ${valueCount}`);
c=c.replaceAll(valueLine,'');
c=one(c,"          total: totalHojeFinal,","          total: checkoutInfo.total ?? Number(data.total || 0),",'pix modal server total');
p=one(p,"      orderNsu: orderNsu,\n    };","      orderNsu: orderNsu,\n      total: valorFinal,\n    };",'return server total');

fs.writeFileSync(checkout,c,'utf8');
fs.writeFileSync(pix,p,'utf8');
console.log('CHECKOUT_HARDENING_PATCH_OK');