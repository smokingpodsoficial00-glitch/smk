import QRCode from 'qrcode';

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
  merchantCity?: string;
  amount: number;
  txId?: string;
  description?: string;
}

export function generatePixPayload({
  pixKey,
  merchantName,
  merchantCity = 'SAO PAULO',
  amount,
  txId = '***'
}: PixPayloadOptions): string {
  // Limpa nome e cidade para caracteres ASCII básicos sem acentos conforme manual do Bacen
  const cleanName = (merchantName || 'EDUARDO DE OLIVEIRA PIZZA')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 25);

  const cleanCity = (merchantCity || 'SAO PAULO')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .slice(0, 15);

  const cleanKey = pixKey.trim();
  const formattedAmount = amount.toFixed(2);

  // 00: Payload Format Indicator (01)
  let payload = emvField('00', '01');

  // 01: Point of Initiation Method: 11 = QR Code Estático
  // CRÍTICO: 12 é apenas para QR Dinâmico (que exige URL de API de banco).
  // Bancos (Nubank, Itaú, Santander, etc.) rejeitam o QR Code estático se estiver marcado como 12.
  payload += emvField('01', '11');

  // 26: Merchant Account Information
  let merchantAccount = emvField('00', 'br.gov.bcb.pix');
  merchantAccount += emvField('01', cleanKey);
  payload += emvField('26', merchantAccount);

  // 52: Merchant Category Code (0000 = Padrão)
  payload += emvField('52', '0000');

  // 53: Transaction Currency (986 = BRL)
  payload += emvField('53', '986');

  // 54: Transaction Amount
  payload += emvField('54', formattedAmount);

  // 58: Country Code
  payload += emvField('58', 'BR');

  // 59: Merchant Name (máximo 25 caracteres)
  payload += emvField('59', cleanName);

  // 60: Merchant City (máximo 15 caracteres)
  payload += emvField('60', cleanCity);

  // 62: Additional Data Field (05 = txid, '***' é a convenção oficial do BACEN para QR estático)
  const cleanTxId = (txId || '***').replace(/[^a-zA-Z0-9*]/g, '').slice(0, 25) || '***';
  const additionalData = emvField('05', cleanTxId);
  payload += emvField('62', additionalData);

  // 63: CRC16
  payload += '6304';
  const checksum = crc16(payload);

  return `${payload}${checksum}`;
}

/**
 * Gera um Data URL base64 de alta resolução diretamente no navegador (sem dependência de API externa)
 */
export async function generateQrCodeDataUrl(payload: string, width = 360): Promise<string> {
  return QRCode.toDataURL(payload, {
    errorCorrectionLevel: 'M',
    margin: 2,
    width,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  });
}

// Fallback de URL pública caso necessário
export function getQrCodeImageUrl(payload: string, size = 300): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=10&data=${encodeURIComponent(payload)}`;
}
