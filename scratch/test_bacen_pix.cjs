'use strict';

function crc16(str) {
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

function formatEMV(id, value) {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function generatePixCopiaECola({
  chavePix = '+5511920857756',
  nomeRecebedor = 'GRUPO GSA SERVICOS',
  cidadeRecebedor = 'SAO PAULO',
  valor = 0,
  txId = 'GSAPEDIDO',
  descricao = 'Compra GSA Store',
}) {
  let cleanKey = chavePix.trim().replace(/\s+/g, '');
  if (/^\d{10,11}$/.test(cleanKey)) {
    cleanKey = `+55${cleanKey}`;
  }
  const cleanName = nomeRecebedor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 25).toUpperCase();
  const cleanCity = cidadeRecebedor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').slice(0, 15).toUpperCase();
  const cleanTxId = (txId || 'GSAPEDIDO').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || 'GSAPEDIDO';

  const gui = formatEMV('00', 'br.gov.bcb.pix');
  const key = formatEMV('01', cleanKey);
  const desc = descricao ? formatEMV('02', descricao.slice(0, 40)) : '';
  const merchantAccountInfo = formatEMV('26', `${gui}${key}${desc}`);
  const additionalData = formatEMV('62', formatEMV('05', cleanTxId));

  let payload = [
    formatEMV('00', '01'),
    formatEMV('01', valor > 0 ? '12' : '11'),
    merchantAccountInfo,
    formatEMV('52', '0000'),
    formatEMV('53', '986'),
  ].join('');

  if (valor > 0) {
    payload += formatEMV('54', valor.toFixed(2));
  }

  payload += [
    formatEMV('58', 'BR'),
    formatEMV('59', cleanName),
    formatEMV('60', cleanCity),
    additionalData,
    '6304',
  ].join('');

  const crc = crc16(payload);
  return `${payload}${crc}`;
}

const code = generatePixCopiaECola({
  valor: 0.05,
  txId: 'ODC9AC950BCD7'
});

console.log('Generated PIX payload:');
console.log(code);
