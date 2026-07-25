/**
 * @sdd-task: Task #1 - Parser alias SelloCFD + fallback Comprobante@Sello (regresión)
 * @sdd-spec: specs/bug-001-liu-sellos-pdf-margen/bug.md
 * @sdd-decision: ADR-010 - Alias SelloCFD + soft-wrap Base64 footer
 * @sdd-why: Fixture realista SelloCFD (sin SelloCFDI) + legacy SelloCFDI deben coexistir
 * @human-debug: Si selloCFDI vacío con SelloCFD → extractTimbre alias. Si fe= vacío →
 *               fallback Comprobante@Sello en parseCFDI. Ejecutar: node tests/test-parser.js
 */

/**
 * NOTA DE EJECUCIÓN:
 * Este archivo usa el módulo nativo `DOMParser` disponible en Node.js v18.x+ con la flag
 * --experimental-vm-modules, o bien se puede ejecutar en la consola del navegador (DevTools).
 *
 * Para Node.js < 18 o sin soporte de DOMParser nativo, instalar xmldom:
 *   npm install @xmldom/xmldom --save-dev
 * y descomentar el bloque de compatibilidad al inicio.
 */

// ─── Compatibilidad Node.js — DOMParser polyfill via @xmldom/xmldom ──────────
// En Chrome Extension la DOMParser es nativa. Para pruebas en Node.js (v25+),
// usamos @xmldom/xmldom (devDependency) para simular la misma interfaz.
import { DOMParser as XmlDomParser } from '@xmldom/xmldom';

// Registrar DOMParser globalmente para que parser.js lo use sin modificación.
if (typeof globalThis.DOMParser === 'undefined') {
  globalThis.DOMParser = XmlDomParser;
}

import { parseCFDI } from '../modules/parser.js';

// ─── Fixtures XML de prueba ───────────────────────────────────────────────────

const CFDI40_INGRESO = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 cfdv40.xsd"
  Version="4.0"
  Fecha="2026-07-23T10:00:00"
  Serie="A"
  Folio="1052"
  FormaPago="01"
  MetodoPago="PUE"
  TipoDeComprobante="I"
  Moneda="MXN"
  SubTotal="1000.00"
  Descuento="0.00"
  Total="1160.00"
  LugarExpedicion="01000"
  NoCertificado="00001000000500000001"
  Sello="SelloDelCFDIBase64=="
  Certificado="CertificadoBase64==">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR PRUEBA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="ZZZ010101ZZZ" Nombre="RECEPTOR PRUEBA SA DE CV" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" NoIdentificacion="SERV-01" Cantidad="1"
      ClaveUnidad="E48" Unidad="Servicio" Descripcion="Consultoría fiscal"
      ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="02">
      <cfdi:Impuestos>
        <cfdi:Traslados>
          <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
        </cfdi:Traslados>
      </cfdi:Impuestos>
    </cfdi:Concepto>
  </cfdi:Conceptos>
  <cfdi:Impuestos TotalImpuestosTrasladados="160.00">
    <cfdi:Traslados>
      <cfdi:Traslado Base="1000.00" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="160.00"/>
    </cfdi:Traslados>
  </cfdi:Impuestos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital
      xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
      Version="1.1"
      UUID="12345678-1234-1234-1234-1234567890AB"
      FechaTimbrado="2026-07-23T10:05:00"
      RfcProvCertif="SAT970701NN3"
      NoCertificadoSAT="00001000000500000000"
      SelloCFDI="SelloCFDIABCDEF123456"
      SelloSAT="SelloSATXYZ987==" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

const CFDI40_PAGO20 = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  xmlns:pago20="http://www.sat.gob.mx/Pagos20"
  Version="4.0" Fecha="2026-07-23T11:00:00"
  TipoDeComprobante="P" Moneda="XXX" SubTotal="0" Total="0" LugarExpedicion="01000"
  NoCertificado="00001" Sello="SelloPago==" Certificado="Cert==">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR PRUEBA" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="ZZZ010101ZZZ" Nombre="RECEPTOR PRUEBA" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="CP01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="ACT" Descripcion="Pago" ValorUnitario="0" Importe="0" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <pago20:Pagos Version="2.0">
      <pago20:Totales MontoTotalPagos="5000.00" TotalTrasladosBaseIVA16="4310.34" TotalTrasladosImpuestoIVA16="689.66"/>
      <pago20:Pago FechaPago="2026-07-23T09:00:00" FormaDePagoP="03" MonedaP="MXN" Monto="5000.00" NumOperacion="TRX-0001">
        <pago20:DoctoRelacionado IdDocumento="AAAABBBB-1234-5678-ABCD-111122223333"
          Serie="A" Folio="999" MonedaDR="MXN" EquivalenciaDR="1"
          NumParcialidad="1" ImpSaldoAnt="5000.00" ImpPagado="5000.00" ImpSaldoInsoluto="0.00" ObjetoImpDR="02"/>
      </pago20:Pago>
    </pago20:Pagos>
    <tfd:TimbreFiscalDigital Version="1.1"
      UUID="AAAABBBB-1234-5678-ABCD-000011112222"
      FechaTimbrado="2026-07-23T11:05:00" RfcProvCertif="SAT970701NN3"
      NoCertificadoSAT="00001000000500000000"
      SelloCFDI="SelloPagoABCDEFGH12345678"
      SelloSAT="SelloSATPago==" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

// Bug-001: PAC real TFD emits SelloCFD (no SelloCFDI); len≥64 for QR fe= + wrap regression
const SELLO_CFD_LONG =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/ABCDXYZ12345';
const SELLO_CFD_LAST8 = SELLO_CFD_LONG.slice(-8);

const CFDI40_INGRESO_SELLOCFD = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante
  xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  Version="4.0"
  Fecha="2026-07-24T10:00:00"
  Serie="B"
  Folio="2001"
  FormaPago="01"
  MetodoPago="PUE"
  TipoDeComprobante="I"
  Moneda="MXN"
  SubTotal="1000.00"
  Total="1160.00"
  LugarExpedicion="01000"
  NoCertificado="00001000000500000001"
  Sello="${SELLO_CFD_LONG}"
  Certificado="CertificadoBase64==">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR PRUEBA SA DE CV" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="ZZZ010101ZZZ" Nombre="RECEPTOR PRUEBA SA DE CV" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="E48" Descripcion="Servicio"
      ValorUnitario="1000.00" Importe="1000.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital
      Version="1.1"
      UUID="87654321-4321-4321-4321-BA0987654321"
      FechaTimbrado="2026-07-24T10:05:00"
      RfcProvCertif="SAT970701NN3"
      NoCertificadoSAT="00001000000500000000"
      SelloCFD="${SELLO_CFD_LONG}"
      SelloSAT="${SELLO_CFD_LONG}" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

const CFDI40_SOLO_COMPROBANTE_SELLO = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  Version="4.0" Fecha="2026-07-24T11:00:00"
  TipoDeComprobante="I" Moneda="MXN" SubTotal="100.00" Total="100.00"
  LugarExpedicion="01000" NoCertificado="00003"
  Sello="FALLBACKSELLOCOMPROBANTEXYZ99999" Certificado="Cert==">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="ZZZ010101ZZZ" Nombre="RECEPTOR" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="E48" Descripcion="X"
      ValorUnitario="100.00" Importe="100.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1"
      UUID="DDDD2222-DDDD-DDDD-DDDD-DDDD22223333"
      FechaTimbrado="2026-07-24T11:05:00" RfcProvCertif="SAT970701NN3"
      NoCertificadoSAT="00001000000500000000"
      SelloSAT="SelloSATSolo==" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

const CFDI40_AMBOS_SELLOS_TFD = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  Version="4.0" Fecha="2026-07-24T12:00:00"
  TipoDeComprobante="I" Moneda="MXN" SubTotal="50.00" Total="50.00"
  LugarExpedicion="01000" NoCertificado="00004"
  Sello="ComprobanteSelloDebeIgnorarseXXXX" Certificado="Cert==">
  <cfdi:Emisor Rfc="AAA010101AAA" Nombre="EMISOR" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="ZZZ010101ZZZ" Nombre="RECEPTOR" DomicilioFiscalReceptor="06000" RegimenFiscalReceptor="601" UsoCFDI="G03"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="E48" Descripcion="X"
      ValorUnitario="50.00" Importe="50.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1"
      UUID="EEEE3333-EEEE-EEEE-EEEE-EEEE33334444"
      FechaTimbrado="2026-07-24T12:05:00" RfcProvCertif="SAT970701NN3"
      NoCertificadoSAT="00001000000500000000"
      SelloCFDI="WINNER_SELLOCFDI_VALUE"
      SelloCFD="LOSER_SELLOCFD_VALUE"
      SelloSAT="SelloSATBoth==" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

const XML_CORRUPTO = `esto no es un xml válido <><>`;

const XML_NO_CFDI = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
  <circle cx="50" cy="50" r="40" fill="blue"/>
</svg>`;

const CFDI40_EGRESO_TOTAL_CERO = `<?xml version="1.0" encoding="UTF-8"?>
<cfdi:Comprobante xmlns:cfdi="http://www.sat.gob.mx/cfd/4"
  xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital"
  Version="4.0" Fecha="2026-07-23T12:00:00"
  TipoDeComprobante="E" Moneda="MXN" SubTotal="100.00" Descuento="100.00" Total="0.00"
  LugarExpedicion="01000" NoCertificado="00002" Sello="SelloEgreso==" Certificado="Cert==">
  <cfdi:Emisor Rfc="BBB020202BBB" Nombre="EMISOR NOTA DE CREDITO" RegimenFiscal="601"/>
  <cfdi:Receptor Rfc="CCC030303CCC" Nombre="RECEPTOR NC" DomicilioFiscalReceptor="64000" RegimenFiscalReceptor="601" UsoCFDI="G01"/>
  <cfdi:Conceptos>
    <cfdi:Concepto ClaveProdServ="84111506" Cantidad="1" ClaveUnidad="E48" Descripcion="Devolución" ValorUnitario="100.00" Importe="100.00" Descuento="100.00" ObjetoImp="01"/>
  </cfdi:Conceptos>
  <cfdi:Complemento>
    <tfd:TimbreFiscalDigital Version="1.1"
      UUID="CCCC1111-CCCC-CCCC-CCCC-CCCC11112222"
      FechaTimbrado="2026-07-23T12:05:00" RfcProvCertif="SAT970701NN3"
      NoCertificadoSAT="00001000000500000000"
      SelloCFDI="SelloEgresoNC98765432"
      SelloSAT="SelloSAT_NC==" />
  </cfdi:Complemento>
</cfdi:Comprobante>`;

// ─── Motor de pruebas minimalista ─────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(description, condition, received = '') {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${description}`);
    if (received !== '') console.error(`     Received: ${JSON.stringify(received)}`);
    failed++;
  }
}

function describe(title, fn) {
  console.log(`\n📋 ${title}`);
  fn();
}

// ─── Escenarios de prueba ─────────────────────────────────────────────────────

describe('Scenario: Parseo completo de CFDI 4.0 Ingreso con Timbre Fiscal Digital', () => {
  const result = parseCFDI(CFDI40_INGRESO, 'cfdi40_ingreso.xml');
  assert('success es true',                    result.success === true);
  assert('comprobante.version es "4.0"',       result.comprobante?.version === '4.0', result.comprobante?.version);
  assert('emisor.rfc es "AAA010101AAA"',        result.emisor?.rfc === 'AAA010101AAA', result.emisor?.rfc);
  assert('receptor.rfc es "ZZZ010101ZZZ"',      result.receptor?.rfc === 'ZZZ010101ZZZ', result.receptor?.rfc);
  assert('timbre.uuid es el UUID esperado',     result.timbre?.uuid === '12345678-1234-1234-1234-1234567890AB', result.timbre?.uuid);
  assert('qrUrl comienza con sat.gob.mx/getcfdi', result.qrUrl?.startsWith('https://sat.gob.mx/getcfdi?id=12345678-1234-1234-1234-1234567890AB'), result.qrUrl);
  assert('comprobante.total es "1160.00"',      result.comprobante?.total === '1160.00', result.comprobante?.total);
  assert('tiene al menos 1 concepto',           result.conceptos?.length >= 1, result.conceptos?.length);
  assert('impuestos.totalImpuestosTrasladados "160.00"', result.impuestos?.totalImpuestosTrasladados === '160.00', result.impuestos?.totalImpuestosTrasladados);
  assert('complementos.pago es null',           result.complementos?.pago === null);
  assert('complementos.nomina es null',         result.complementos?.nomina === null);
  // Spec-005 layout fields
  assert('comprobante.noCertificado presente',  result.comprobante?.noCertificado === '00001000000500000001', result.comprobante?.noCertificado);
  assert('concepto[0].impuestos.traslados >= 1', (result.conceptos?.[0]?.impuestos?.traslados?.length ?? 0) >= 1, result.conceptos?.[0]?.impuestos?.traslados?.length);
  assert('traslado concepto importe 160.00',    result.conceptos?.[0]?.impuestos?.traslados?.[0]?.importe === '160.00');
});

describe('Scenario: Parseo de CFDI con Complemento de Recepción de Pagos 2.0', () => {
  const result = parseCFDI(CFDI40_PAGO20, 'cfdi40_pago20.xml');
  assert('success es true',                                result.success === true);
  assert('complementos.pago existe',                       result.complementos?.pago !== null);
  assert('pago tiene totales',                             result.complementos?.pago?.totales !== undefined);
  assert('pago.pagos es un arreglo no vacío',              (result.complementos?.pago?.pagos?.length ?? 0) >= 1);
  const primerPago = result.complementos?.pago?.pagos?.[0];
  assert('primer pago tiene monto "5000.00"',              primerPago?.monto === '5000.00', primerPago?.monto);
  const doctosRelacionados = primerPago?.doctosRelacionados ?? [];
  assert('doctosRelacionados tiene al menos 1 elemento',   doctosRelacionados.length >= 1, doctosRelacionados.length);
  const primerDocto = doctosRelacionados[0];
  assert('idDocumento tiene 36 caracteres (UUID)',         primerDocto?.idDocumento?.length === 36, primerDocto?.idDocumento?.length);
});

describe('Scenario: Limit Case — CFDI Egreso con Total 0.00 (Nota de Crédito)', () => {
  const result = parseCFDI(CFDI40_EGRESO_TOTAL_CERO, 'cfdi40_egreso_nc.xml');
  assert('success es true',                    result.success === true);
  assert('comprobante.total es "0.00"',        result.comprobante?.total === '0.00', result.comprobante?.total);
  assert('qrUrl contiene tt=0.00',             result.qrUrl?.includes('tt=0.00'), result.qrUrl);
  assert('qrUrl empieza con https://sat.gob.mx', result.qrUrl?.startsWith('https://sat.gob.mx'), result.qrUrl);
});

describe('Scenario: Error — Archivo XML no válido o corrupto', () => {
  const result = parseCFDI(XML_CORRUPTO, 'corrupto.xml');
  assert('success es false',         result.success === false);
  assert('error contiene parsererror', result.error?.toLowerCase().includes('parsererror'), result.error);
  assert('fileName es "corrupto.xml"', result.fileName === 'corrupto.xml');
});

describe('Scenario: Error — XML válido en sintaxis pero no es un CFDI SAT', () => {
  const result = parseCFDI(XML_NO_CFDI, 'imagen.svg');
  assert('success es false',                         result.success === false);
  assert('error indica que no es un Comprobante',    result.error === 'El nodo raíz no es un cfdi:Comprobante válido', result.error);
});

describe('Bug-001: TFD solo SelloCFD (sin SelloCFDI) — sello poblado + fe=', () => {
  assert('fixture SelloCFD len >= 64', SELLO_CFD_LONG.length >= 64, SELLO_CFD_LONG.length);
  const result = parseCFDI(CFDI40_INGRESO_SELLOCFD, 'cfdi40_sellocfd.xml');
  assert('success es true', result.success === true);
  assert('timbre.selloCFDI === valor SelloCFD', result.timbre?.selloCFDI === SELLO_CFD_LONG, result.timbre?.selloCFDI?.slice(0, 20));
  assert('comprobante.sello expuesto', result.comprobante?.sello === SELLO_CFD_LONG, result.comprobante?.sello?.slice(0, 20));
  assert('qrUrl contiene fe= últimos 8', result.qrUrl?.includes(`fe=${SELLO_CFD_LAST8}`), result.qrUrl);
  assert('legacy SelloCFDI fixture sigue poblado', parseCFDI(CFDI40_INGRESO).timbre?.selloCFDI === 'SelloCFDIABCDEF123456');
});

describe('Bug-001: fallback Comprobante@Sello cuando TFD sin sello CFDI', () => {
  const result = parseCFDI(CFDI40_SOLO_COMPROBANTE_SELLO, 'cfdi40_fallback_sello.xml');
  assert('success es true', result.success === true);
  assert('selloCFDI = Comprobante@Sello', result.timbre?.selloCFDI === 'FALLBACKSELLOCOMPROBANTEXYZ99999', result.timbre?.selloCFDI);
  assert('fe= últimos 8 del fallback', result.qrUrl?.includes('fe=XYZ99999'), result.qrUrl);
});

describe('Bug-001: SelloCFDI gana sobre SelloCFD si ambos existen', () => {
  const result = parseCFDI(CFDI40_AMBOS_SELLOS_TFD, 'cfdi40_ambos_sellos.xml');
  assert('success es true', result.success === true);
  assert('prioridad SelloCFDI', result.timbre?.selloCFDI === 'WINNER_SELLOCFDI_VALUE', result.timbre?.selloCFDI);
});

// ─── Reporte final ────────────────────────────────────────────────────────────

console.log('\n═══════════════════════════════════════════');
console.log(`Resultados: ${passed} ✅ passed  |  ${failed} ❌ failed`);
if (failed === 0) {
  console.log('🎉 TODOS LOS ESCENARIOS PASARON — parser + Bug-001 SelloCFD');
} else {
  console.error('⚠️  HAY FALLOS — Revisar los tests anteriores antes de continuar.');
  process.exit(1);
}
