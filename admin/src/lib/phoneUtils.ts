/**
 * Utilitário para validação, normalização e formatação de números de WhatsApp
 */

export interface PhoneValidationResult {
  valid: boolean;
  normalized: string; // Ex: 5511951711181
  formatted: string;  // Ex: (11) 95171-1181
  error?: string;
}

/**
 * Normaliza e valida um número de WhatsApp brasileiro.
 * Aceita formatos com ou sem código do país (55), com ou sem pontuação.
 * Ex: (11) 95171-1181, 11951711181, 5511951711181, +55 11 95171-1181
 */
export function validateAndNormalizeBrazilianPhone(phone: string): PhoneValidationResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, normalized: '', formatted: '', error: 'Número não informado' };
  }

  const digits = phone.replace(/\D/g, '');

  if (digits.length === 0) {
    return { valid: false, normalized: '', formatted: '', error: 'Número não pode ser vazio' };
  }

  let finalDigits = digits;

  // Se já começar com 55 e tiver 12 ou 13 dígitos
  if (finalDigits.startsWith('55') && (finalDigits.length === 12 || finalDigits.length === 13)) {
    // Ok, já possui DDI 55
  } else if (finalDigits.length === 10 || finalDigits.length === 11) {
    // Adiciona o DDI do Brasil (55)
    finalDigits = `55${finalDigits}`;
  } else {
    return {
      valid: false,
      normalized: '',
      formatted: phone,
      error: 'Formato inválido. Digite o DDD + número (ex: (11) 95171-1181).'
    };
  }

  // Validar DDD (dígitos 2 e 3 do finalDigits)
  const ddd = parseInt(finalDigits.substring(2, 4), 10);
  if (isNaN(ddd) || ddd < 11 || ddd > 99) {
    return {
      valid: false,
      normalized: '',
      formatted: phone,
      error: 'DDD inválido. Informe um DDD brasileiro válido (ex: 11).'
    };
  }

  return {
    valid: true,
    normalized: finalDigits,
    formatted: formatBrazilianPhone(finalDigits),
  };
}

/**
 * Formata um número brasileiro para visualização amigável: (11) 95171-1181
 */
export function formatBrazilianPhone(phone: string): string {
  if (!phone) return '';
  let digits = phone.replace(/\D/g, '');

  // Remove 55 inicial se existir para exibir apenas (DDD) NÚMERO
  if (digits.startsWith('55') && digits.length >= 12) {
    digits = digits.substring(2);
  }

  if (digits.length === 11) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 7)}-${digits.substring(7)}`;
  } else if (digits.length === 10) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2, 6)}-${digits.substring(6)}`;
  } else if (digits.length > 2) {
    return `(${digits.substring(0, 2)}) ${digits.substring(2)}`;
  }
  return digits;
}
