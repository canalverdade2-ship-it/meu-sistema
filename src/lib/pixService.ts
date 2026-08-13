import { supabase } from './supabase';

/**
 * Utilitário para cálculo de CRC16-CCITT (Padrão Banco Central / PIX EMV)
 */
function crc16(str: string): string {
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
function formatEMV(id: string, value: string): string {
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
  chavePix = '11920857756',
  nomeRecebedor = 'GRUPO GSA SERVICOS',
  cidadeRecebedor = 'SAO PAULO',
  valor = 0,
  txId = 'GSAPEDIDO',
  descricao = 'Compra GSA Store',
}: PixPayloadParams): string {
  // Normalização
  const cleanKey = chavePix.trim().replace(/\s+/g, '');
  const cleanName = nomeRecebedor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 25).toUpperCase();
  const cleanCity = cidadeRecebedor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 15).toUpperCase();
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
    formatEMV('01', valor > 0 ? '12' : '11'), // Point of Initiation: 12 (Dinâmico) ou 11 (Estático)
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

  // Cálculo do CRC16 final
  const crc = crc16(payload);
  return `${payload}${crc}`;
}

/**
 * Gera URL de renderização do QR Code visual a partir da string do PIX
 */
export function getQrCodeImageUrl(pixCode: string, size = 300): string {
  const encoded = encodeURIComponent(pixCode);
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encoded}`;
}

export interface InfinitePayCheckoutResult {
  success: boolean;
  link?: string;
  orderNsu?: string;
  pixCode?: string;
  qrCodeUrl?: string;
  error?: string;
}

/**
 * Cria ou recupera link de pagamento e dados PIX via InfinitePay / Backend Edge Function
 */
export async function createInfinitePayOrderCheckout({
  orcamentoId,
  codigoOrcamento,
  clienteId,
  valorLiquido,
  clienteNome,
  clienteEmail,
  clienteTelefone,
}: {
  orcamentoId: string;
  codigoOrcamento: string;
  clienteId: string;
  valorLiquido: number;
  clienteNome?: string;
  clienteEmail?: string;
  clienteTelefone?: string;
}): Promise<InfinitePayCheckoutResult> {
  try {
    // 1. Gerar o Pix Copia e Cola padrão BACEN com a chave do Grupo GSA
    const pixCode = generatePixCopiaECola({
      chavePix: '11920857756', // Telefone / Chave PIX oficial Grupo GSA
      nomeRecebedor: 'GRUPO GSA SERVICOS',
      cidadeRecebedor: 'SAO PAULO',
      valor: valorLiquido,
      txId: codigoOrcamento.replace(/[^a-zA-Z0-9]/g, ''),
      descricao: `Pedido ${codigoOrcamento}`,
    });

    const qrCodeUrl = getQrCodeImageUrl(pixCode, 320);

    // 2. Chamar a API pública oficial da InfinitePay para gerar o link com token dinâmico
    const valorEmCentavos = Math.round(valorLiquido * 100);
    const orderNsu = `${codigoOrcamento}-${Date.now()}`;
    let checkoutLink = '';

    try {
      const redirectBase = typeof window !== 'undefined' ? window.location.origin : 'https://sistema.grupogsaservicos.com.br';
      const ipPayload: any = {
        handle: 'getsemani-gsa',
        items: [{
          quantity: 1,
          price: valorEmCentavos,
          description: `Pedido ${codigoOrcamento} - Grupo GSA`,
        }],
        order_nsu: orderNsu,
        redirect_url: `${redirectBase}/marketplace/loja/compras?orderId=${orcamentoId}`,
      };

      const customer: any = {};
      if (clienteNome && clienteNome.trim().length >= 2) {
        customer.name = clienteNome.trim();
      }
      if (clienteEmail && clienteEmail.trim().length > 3 && clienteEmail.includes('@') && clienteEmail.includes('.')) {
        customer.email = clienteEmail.trim();
      }
      const rawPhone = clienteTelefone ? clienteTelefone.replace(/\D/g, '') : '';
      if (rawPhone.length >= 10) {
        customer.phone_number = `+55${rawPhone}`;
      }

      if (Object.keys(customer).length > 0) {
        ipPayload.customer = customer;
      }

      const resp = await fetch('https://api.checkout.infinitepay.io/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ipPayload),
      });

      if (resp.ok) {
        const ipData = await resp.json();
        checkoutLink = ipData.url || ipData.link || ipData.payment_url || '';
      }
    } catch (apiErr) {
      console.warn('[pixService] Aviso ao gerar link dinâmico InfinitePay:', apiErr);
    }

    return {
      success: true,
      link: checkoutLink,
      orderNsu: orderNsu,
      pixCode: pixCode,
      qrCodeUrl: qrCodeUrl,
    };
  } catch (err: any) {
    console.error('[pixService] Erro ao preparar checkout:', err);
    return {
      success: false,
      error: err.message || 'Erro ao gerar dados do PIX.',
    };
  }
}

/**
 * Consulta o status do pagamento no Supabase (Orçamento / Fatura)
 */
export async function checkOrderStatus(orcamentoId: string): Promise<{
  pago: boolean;
  status: string;
  statusDetalhe?: string;
}> {
  try {
    const { data: orc, error } = await supabase
      .from('orcamentos')
      .select('status, fase_negociacao')
      .eq('id', orcamentoId)
      .maybeSingle();

    if (error || !orc) return { pago: false, status: 'desconhecido' };

    const status = String(orc.status || '').toLowerCase();
    const isPago = ['pago', 'aprovado', 'em_expedicao', 'em_transporte', 'concluido'].includes(status);

    return {
      pago: isPago,
      status: status,
      statusDetalhe: orc.fase_negociacao,
    };
  } catch {
    return { pago: false, status: 'erro' };
  }
}
