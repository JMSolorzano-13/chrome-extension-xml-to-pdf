/**
 * @sdd-task: Task #2 - Módulo numero-a-letra.js
 * @sdd-spec: specs/spec-003-s4k-pdf-generator-pdfmake-qr/spec.md
 * @sdd-decision: ADR-006 - Módulos PDF separados + inyección de pdfMake/QRCode
 * @sdd-why: Total en letra español MXN sin dependencias externas (US-004)
 * @human-debug: Si salida vacía o incorrecta → revisar coerceAmount y bloques UNIDADES/DECENAS
 */

const UNIDADES = [
  '', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
  'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
  'DIECIOCHO', 'DIECINUEVE', 'VEINTE', 'VEINTIUN', 'VEINTIDOS', 'VEINTITRES',
  'VEINTICUATRO', 'VEINTICINCO', 'VEINTISEIS', 'VEINTISIETE', 'VEINTIOCHO', 'VEINTINUEVE',
];

const DECENAS = [
  '', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA',
  'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA',
];

const CENTENAS = [
  '', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
  'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS',
];

/**
 * @param {unknown} amount
 * @returns {{ pesos: number, centavos: number } | null}
 */
function coerceAmount(amount) {
  const n = typeof amount === 'number' ? amount : Number.parseFloat(String(amount ?? '').replace(/,/g, ''));
  if (!Number.isFinite(n) || n < 0) return null;
  const rounded = Math.round(n * 100) / 100;
  const pesos = Math.floor(rounded + 1e-9);
  const centavos = Math.round((rounded - pesos) * 100);
  return { pesos, centavos };
}

/**
 * Converts 0–999 to Spanish words.
 * @param {number} n
 * @returns {string}
 */
function hundredsToWords(n) {
  if (n === 0) return '';
  if (n === 100) return 'CIEN';

  const c = Math.floor(n / 100);
  const r = n % 100;
  const parts = [];

  if (c > 0) parts.push(CENTENAS[c]);

  if (r > 0) {
    if (r < 30) {
      parts.push(UNIDADES[r]);
    } else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      if (u === 0) parts.push(DECENAS[d]);
      else parts.push(`${DECENAS[d]} Y ${UNIDADES[u]}`);
    }
  }

  return parts.join(' ').trim();
}

/**
 * Converts integer pesos (0 … 999_999_999) to Spanish words.
 * @param {number} n
 * @returns {string}
 */
function integerToWords(n) {
  if (n === 0) return 'CERO';

  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts = [];

  if (millions > 0) {
    if (millions === 1) parts.push('UN MILLON');
    else parts.push(`${hundredsToWords(millions)} MILLONES`);
  }

  if (thousands > 0) {
    if (thousands === 1) parts.push('MIL');
    else parts.push(`${hundredsToWords(thousands)} MIL`);
  }

  if (rest > 0) parts.push(hundredsToWords(rest));

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Converts a monetary amount to Spanish letter form (MXN fiscal style).
 * Example: 1234.56 → "MIL DOSCIENTOS TREINTA Y CUATRO PESOS 56/100 M.N."
 *
 * @param {unknown} amount
 * @param {string} [moneda='MXN']
 * @returns {string}
 */
export function numeroALetra(amount, moneda = 'MXN') {
  const parsed = coerceAmount(amount);
  if (!parsed) {
    return 'CERO PESOS 00/100 M.N.';
  }

  const { pesos, centavos } = parsed;
  const words = integerToWords(pesos);
  const cent = String(centavos).padStart(2, '0');
  const currencySuffix = moneda === 'MXN' || moneda === 'MXP' || !moneda
    ? 'M.N.'
    : String(moneda);

  const pesoWord = pesos === 1 ? 'PESO' : 'PESOS';
  return `${words} ${pesoWord} ${cent}/100 ${currencySuffix}`.replace(/\s+/g, ' ').trim();
}
