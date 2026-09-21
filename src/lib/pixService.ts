import { supabase } from './supabase';
import { callClientRpc } from './clientRpc';

/**
 * Utilitário para cálculo de CRC16-CCITT (Padrão Banco Central / PIX EMV)
 */
export function crc16(str: string): string {
  let crc = 0xFFFF;
  const strlen = str.length;

  for (let c = 0; c < strlen; c++) {
    crc ^= str.charCodeAt(c) << 8;
    for (let i = 0; i < 8; i++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Formata um campo EMV (ID + Tamanho 2 dígitos + Conteúdo)
 */
export function formatEMV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

export interface PixPayloadParams {
  chavePix?: string;
  nomeRecebedor?: string;
  cidadeRecebedor?: string;
  valor?: number;
  txId?: string;
  descricao?: string;
}

/**
 * Gera a string do PIX Copia e Cola (BR Code) no padrão oficial do BACEN
 */
export function generatePixCopiaECola({
  chavePix = '+5511920857756',
  nomeRecebedor = 'GRUPO GSA SERVICOS',
  cidadeRecebedor = 'SAO PAULO',
  valor = 0,
  txId = 'GSAPEDIDO',
  descricao = 'Compra GSA Store',
}: PixPayloadParams): string {
  let cleanKey = chavePix.trim().replace(/\s+/g, '');
  if (/^\d{10,11}$/.test(cleanKey)) {
    cleanKey = `+55${cleanKey}`;
  }

  const cleanName = nomeRecebedor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 25)
    .toUpperCase();

  const cleanCity = cidadeRecebedor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .slice(0, 15)
    .toUpperCase();

  const cleanTxId = (txId || 'GSAPEDIDO').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'GSAPEDIDO';

  // Merchant Account Information (Tag 26)
  const gui = formatEMV('00', 'br.gov.bcb.pix');
  const key = formatEMV('01', cleanKey);
  const desc = descricao ? formatEMV('02', descricao.slice(0, 40)) : '';
  const merchantAccountInfo = formatEMV('26', `${gui}${key}${desc}`);

  // Additional Data (Tag 62)
  const additionalData = formatEMV('62', formatEMV('05', cleanTxId));

  // Montagem base do Payload
  let payload = [
    formatEMV('00', '01'), // Format Indicator
    formatEMV('01', valor > 0 ? '12' : '11'), // Point of Initiation
    merchantAccountInfo,
    formatEMV('52', '0000'), // Merchant Category Code
    formatEMV('53', '986'), // Currency BRL
  ].join('');

  if (valor > 0) {
    payload += formatEMV('54', valor.toFixed(2));
  }

  payload += [
    formatEMV('58', 'BR'), // Country Code
    formatEMV('59', cleanName), // Merchant Name
    formatEMV('60', cleanCity), // Merchant City
    additionalData,
    '6304', // CRC16 Tag + Tamanho
  ].join('');

  const crc = crc16(payload);
  return `${payload}${crc}`;
}

/**
 * Gera URL de renderização do QR Code visual a partir da string do PIX
 */
export function getQrCodeImageUrl(pixCode: string, size = 320): string {
  const encoded = encodeURIComponent(pixCode);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encoded}`;
}

export interface InfinitePayCheckoutResult {
  success: boolean;
  link?: string;
  orderNsu?: string;
  total?: number;
  pixCode?: string;
  qrCodeUrl?: string;
  error?: string;
}

const INFINITEPAY_HANDLE = 'getsemani-gsa';
const INFINITEPAY_API_URL = 'https://api.checkout.infinitepay.io/links';
const INFINITEPAY_CHECK_URL = 'https://api.checkout.infinitepay.io/payment_check';

/**
 * Cria link de checkout oficial na InfinitePay e persiste fatura no banco.
 * O QR Code e o código PIX Copia e Cola são gerados pela própria InfinitePay
 * e exibidos via iframe no modal — não são gerados localmente.
 */
export async function createInfinitePayOrderCheckout({
  orcamentoId,
  codigoOrcamento,
  clienteId,
  clienteNome,
  clienteEmail,
  clienteTelefone,
}: {
  orcamentoId: string;
  codigoOrcamento: string;
  clienteId: string;
  /** @deprecated Ignorado. O valor financeiro é sempre obtido no servidor. */
  valorLiquido?: number;
  clienteNome?: string;
  clienteEmail?: string;
  clienteTelefone?: string;
}): Promise<InfinitePayCheckoutResult> {
  try {
    const quote = await callClientRpc<any>('gsa_client_store_payment_quote', {
      p_orcamento_id: orcamentoId,
    });
    const valorFinal = Number(quote?.total ?? 0);
    if (!Number.isFinite(valorFinal) || valorFinal < 0) {
      throw new Error('O servidor retornou um total inválido para o pedido.');
    }

    // Pedidos integralmente quitados com pontos/carteira não possuem uma
    // parcela externa. Nunca transforme R$ 0,00 em uma cobrança mínima.
    if (valorFinal < 0.01) {
      return { success: true, total: valorFinal };
    }

    // Chamar a API da InfinitePay para registrar a transação e obter o link de checkout
    const valorEmCentavos = Math.round(valorFinal * 100);
    const orderNsu = `${codigoOrcamento}-${Date.now()}`;
    const redirectBase = typeof window !== 'undefined' ? window.location.origin : 'https://sistema.grupogsaservicos.com.br';
    const redirectUrl = `${redirectBase}/marketplace/loja/compras?orderId=${orcamentoId}`;
    const webhookUrl = 'https://api.147-15-43-141.nip.io/functions/v1/gsa-payments';

    const customer: any = {};
    if (clienteNome && clienteNome.trim().length >= 2) {
      customer.name = clienteNome.trim();
    }
    if (clienteEmail && clienteEmail.trim().length > 3 && clienteEmail.includes('@') && clienteEmail.includes('.')) {
      customer.email = clienteEmail.trim();
    }
    const rawPhone = clienteTelefone ? clienteTelefone.replace(/\D/g, '') : '';
    if (rawPhone.length >= 10) {
      customer.phone_number = rawPhone.startsWith('55') ? `+${rawPhone}` : `+55${rawPhone}`;
    }

    const ipPayload: any = {
      handle: INFINITEPAY_HANDLE,
      items: [{
        quantity: 1,
        price: valorEmCentavos,
        description: `Pedido ${codigoOrcamento} - Grupo GSA`,
      }],
      order_nsu: orderNsu,
      webhook_url: webhookUrl,
      redirect_url: redirectUrl,
    };

    if (Object.keys(customer).length > 0) {
      ipPayload.customer = customer;
    }

    let checkoutLink = '';

    try {
      const resp = await fetch(INFINITEPAY_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ipPayload),
      });

      if (resp.ok) {
        const ipData = await resp.json();
        checkoutLink = ipData.url || ipData.link || ipData.payment_url || ipData.checkout_url || '';
      }
    } catch (apiErr) {
      console.warn('[pixService] InfinitePay endpoint indisponível:', apiErr);
    }

    if (!checkoutLink) {
      return { success: false, total: valorFinal, error: 'A InfinitePay não retornou um link de pagamento válido.' };
    }

    // 3. Atualizar ou criar fatura se aplicável enriquecendo com os itens do orçamento
    try {
      const { data: orcData } = await supabase
        .from('orcamentos')
        .select(`
          *,
          loja_pedido_itens (
            id, nome, codigo, tipo, valor_unitario, quantidade, subtotal, is_brinde,
            produtos (id, nome, imagem_url, codigo_produto, codigo_barras, valor)
          ),
          ordens_compra (
            id, codigo_ordem, quantidade,
            produtos (id, nome, imagem_url, codigo_produto, codigo_barras, valor)
          )
        `)
        .eq('id', orcamentoId)
        .maybeSingle();

      let itemsFaturados: any[] = [];
      if (orcData?.loja_pedido_itens && orcData.loja_pedido_itens.length > 0) {
        itemsFaturados = orcData.loja_pedido_itens.map((li: any) => ({
          nome: li.nome,
          descricao: li.nome,
          codigo: li.codigo || li.produtos?.codigo_produto || '',
          quantidade: Number(li.quantidade) || 1,
          valor_unitario: Number(li.valor_unitario || li.produtos?.valor || 0),
          subtotal: Number(li.subtotal || ((li.valor_unitario || li.produtos?.valor || 0) * (li.quantidade || 1))),
          imagem_url: li.produtos?.imagem_url || null,
          tipo: li.tipo || 'produto'
        }));
      } else if (orcData?.ordens_compra && orcData.ordens_compra.length > 0) {
        itemsFaturados = orcData.ordens_compra.map((oc: any) => ({
          nome: oc.produtos?.nome || 'Produto',
          descricao: oc.produtos?.nome || 'Produto',
          codigo: oc.produtos?.codigo_produto || oc.codigo_ordem || '',
          quantidade: Number(oc.quantidade) || 1,
          valor_unitario: Number(oc.produtos?.valor || 0),
          subtotal: Number((oc.produtos?.valor || 0) * (oc.quantidade || 1)),
          imagem_url: oc.produtos?.imagem_url || null,
          tipo: 'produto'
        }));
      }

      const firstOcId = orcData?.ordens_compra?.[0]?.id || null;
      const subtotalBase = Number(orcData?.subtotal_preco_tabela || orcData?.subtotal_itens || valorFinal);

      await callClientRpc('gsa_client_sync_pix_invoice', {
        p_orcamento_id: orcamentoId,
        p_checkout_link: checkoutLink || null,
        p_order_nsu: orderNsu,
        p_itens: itemsFaturados,
      });
    } catch (dbErr) {
      console.warn('[pixService] Aviso ao persistir dados no banco:', dbErr);
    }

    return {
      success: true,
      link: checkoutLink,
      orderNsu: orderNsu,
      total: valorFinal,
    };
  } catch (err: any) {
    console.error('[pixService] Erro ao criar checkout:', err);
    return {
      success: false,
      error: err.message || 'Erro ao gerar dados do PIX.',
    };
  }
}

/**
 * Consulta o status real do pagamento no Supabase (Orçamento / Fatura)
 */
export async function checkOrderStatus(orcamentoId: string): Promise<{
  pago: boolean;
  status: string;
  statusDetalhe?: string;
}> {
  try {
    // 1. Verificar na tabela orcamentos
    const { data: orc } = await supabase
      .from('orcamentos')
      .select('status, fase_negociacao')
      .eq('id', orcamentoId)
      .maybeSingle();

    const statusOrc = String(orc?.status || '').toLowerCase();
    const isOrcPago = ['pago', 'aprovado', 'em_expedicao', 'em_transporte', 'concluido'].includes(statusOrc);

    if (isOrcPago) {
      return {
        pago: true,
        status: statusOrc,
        statusDetalhe: orc?.fase_negociacao,
      };
    }

    // 2. Verificar na tabela faturas vinculada
    const { data: fatura } = await supabase
      .from('faturas')
      .select('status')
      .eq('orcamento_id', orcamentoId)
      .maybeSingle();

    const statusFat = String(fatura?.status || '').toLowerCase();
    const isFatPaga = statusFat === 'pago';

    return {
      pago: isFatPaga,
      status: isFatPaga ? 'pago' : (statusOrc || statusFat || 'pendente'),
      statusDetalhe: orc?.fase_negociacao,
    };
  } catch {
    return { pago: false, status: 'erro' };
  }
}
