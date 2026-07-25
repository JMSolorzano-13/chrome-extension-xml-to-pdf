/**
 * @sdd-task: Task #1 - Módulo catalogos-sat.js
 * @sdd-spec: specs/spec-005-jwy-formato-pdf/spec.md
 * @sdd-decision: ADR-009 - Layouts PDF tipados + catálogos locales (sin branding ezaudita)
 * @sdd-why: Etiquetas "COD - Descripción" 100% offline (Constitución §2); subset para examples-pdf
 * @human-debug: Si falta descripción → formatCatalog devuelve solo el código (no falla PDF)
 */

/** @type {Record<string, string>} */
const TIPO_COMPROBANTE = {
  I: 'Ingreso',
  E: 'Egreso',
  T: 'Traslado',
  N: 'Nómina',
  P: 'Pago',
};

/** @type {Record<string, string>} */
const FORMA_PAGO = {
  '01': 'Efectivo',
  '02': 'Cheque nominativo',
  '03': 'Transferencia electrónica de fondos',
  '04': 'Tarjeta de crédito',
  '28': 'Tarjeta de débito',
  '99': 'Por definir',
};

/** @type {Record<string, string>} */
const METODO_PAGO = {
  PUE: 'Pago en una sola exhibición',
  PPD: 'Pago en parcialidades o diferido',
};

/** @type {Record<string, string>} */
const REGIMEN_FISCAL = {
  '601': 'General de Ley Personas Morales',
  '603': 'Personas Morales con Fines no Lucrativos',
  '605': 'Sueldos y Salarios e Ingresos Asimilados a Salarios',
  '606': 'Arrendamiento',
  '612': 'Personas Físicas con Actividades Empresariales y Profesionales',
  '616': 'Sin obligaciones fiscales',
  '621': 'Incorporación Fiscal',
  '626': 'Régimen Simplificado de Confianza',
};

/** @type {Record<string, string>} */
const USO_CFDI = {
  G01: 'Adquisición de mercancías',
  G02: 'Devoluciones, descuentos o bonificaciones',
  G03: 'Gastos en general',
  I01: 'Construcciones',
  I08: 'Otra maquinaria y equipo',
  D01: 'Honorarios médicos, dentales y gastos hospitalarios',
  CN01: 'Nómina',
  CP01: 'Pagos',
  S01: 'Sin efectos fiscales',
};

/** @type {Record<string, string>} */
const CLAVE_UNIDAD = {
  ACT: 'Actividad',
  E48: 'Unidad de servicio',
  H87: 'Pieza',
  XUN: 'Unidad',
  SERVICIO: 'SERVICIO',
};

/**
 * @param {unknown} code
 * @param {Record<string, string>} map
 * @returns {string} "COD - Desc" | code | ""
 */
export function formatCatalog(code, map) {
  if (code == null) return '';
  const key = String(code).trim();
  if (!key) return '';
  const desc = map[key] ?? map[key.toUpperCase()];
  if (!desc) return key;
  return `${key} - ${desc}`;
}

/**
 * Badge / título corto (sin código).
 * @param {unknown} code
 * @returns {string}
 */
export function labelTipoComprobante(code) {
  if (code == null) return '';
  const key = String(code).trim().toUpperCase();
  return TIPO_COMPROBANTE[key] || key;
}

/** @param {unknown} code */
export function labelFormaPago(code) {
  return formatCatalog(code, FORMA_PAGO);
}

/** @param {unknown} code */
export function labelMetodoPago(code) {
  return formatCatalog(code, METODO_PAGO);
}

/** @param {unknown} code */
export function labelRegimenFiscal(code) {
  return formatCatalog(code, REGIMEN_FISCAL);
}

/** @param {unknown} code */
export function labelUsoCFDI(code) {
  return formatCatalog(code, USO_CFDI);
}

/**
 * @param {unknown} code
 * @param {unknown} [unidadText]
 * @returns {string}
 */
export function labelClaveUnidad(code, unidadText) {
  if (code == null || String(code).trim() === '') {
    return unidadText != null ? String(unidadText) : '';
  }
  const key = String(code).trim();
  const desc = CLAVE_UNIDAD[key] ?? CLAVE_UNIDAD[key.toUpperCase()];
  if (desc) return `${key} - ${desc}`;
  if (unidadText) return `${key} - ${unidadText}`;
  return key;
}
