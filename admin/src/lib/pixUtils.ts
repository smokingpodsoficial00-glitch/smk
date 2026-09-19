// Utilitário para cálculo e geração do Payload Oficial Pix (Padrão Banco Central do Brasil - BR Code)

function emvField(id: string, value: string): string {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
}

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = (crc << 1) ^ 0x1021;
      } else {
        crc = crc << 1;
      }
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

export interface PixPayloadOptions {
  pixKey: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txId?: string;
  description?: string;
}

export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity,
  amount,
  txId = 'SMKSYSTEM',
  description
}: PixPayloadOptions): string {
  // Limpa nome e cidade para caracteres ASCII básicos
  const cleanName = (merchantName || 'SMK SYSTEM')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);

  const cleanCity = (merchantCity || 'SAO BERNARDO DO CAMPO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);

  const cleanKey = pixKey.trim();
  const formattedAmount = amount.toFixed(2);

  // 00: Payload Format Indicator
  let payload = emvField('00', '01');

  // 01: Point of Initiation Method (12 = múltiplo uso)
  payload += emvField('01', '12');

  // 26: Merchant Account Information
  let merchantAccount = emvField('00', 'br.gov.bcb.pix');
  merchantAccount += emvField('01', cleanKey);
  if (description) {
    merchantAccount += emvField('02', description.slice(0, 40));
  }
  payload += emvField('26', merchantAccount);

  // 52: Merchant Category Code
  payload += emvField('52', '0000');

  // 53: Transaction Currency (986 = BRL)
  payload += emvField('53', '986');

  // 54: Transaction Amount
  payload += emvField('54', formattedAmount);

  // 58: Country Code
  payload += emvField('58', 'BR');

  // 59: Merchant Name
  payload += emvField('59', cleanName);

  // 60: Merchant City
  payload += emvField('60', cleanCity);

  // 62: Additional Data Field Template
  const cleanTxId = (txId || '***').replace(/[^a-zA-Z0-9]/g, '').slice(0, 25) || '***';
  const additionalData = emvField('05', cleanTxId);
  payload += emvField('62', additionalData);

  // 63: CRC16
  payload += '6304';
  const checksum = crc16(payload);

  return `${payload}${checksum}`;
}

export function getQrCodeImageUrl(payload: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(payload)}`;
}
