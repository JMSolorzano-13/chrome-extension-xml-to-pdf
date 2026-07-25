/**
 * @sdd-task: Task #2 - wrapBase64Sello + footer soft-wrap (Bug-001)
 * @sdd-spec: specs/bug-001-liu-sellos-pdf-margen/bug.md
 * @sdd-decision: ADR-010 - Alias SelloCFD + soft-wrap Base64 footer
 * @sdd-why: Regresión: sellos largos deben contener U+200B; strip === original
 * @human-debug: Ejecutar: node tests/test-pdf-generator.js
 */

import { numeroALetra } from '../modules/numero-a-letra.js';
import { formatCatalog } from '../modules/catalogos-sat.js';
import {
  buildDocDefinition,
  generatePdf,
  docHasSectionTitle,
  docHasQrDataImage,
  collectStrings,
  formatMoney,
  resolveLayoutKind,
  wrapBase64Sello,
} from '../modules/pdf-generator.js';
import { writePdfBesideXml, derivePdfFileName } from '../modules/pdf-writer.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log(`  PASS — ${message}`);
  } else {
    failed += 1;
    console.error(`  FAIL — ${message}`);
  }
}

const SAMPLE_QR =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

function flatDoc(doc) {
  return collectStrings(doc?.content).join('\n');
}

function baseParsed(overrides = {}) {
  return {
    success: true,
    fileName: 'FAC-2026-001.xml',
    comprobante: {
      version: '4.0',
      serie: 'A',
      folio: '10010',
      fecha: '2026-07-20T16:15:15',
      formaPago: '03',
      metodoPago: 'PUE',
      tipoDeComprobante: 'I',
      moneda: 'MXN',
      subTotal: '1590.51',
      total: '1844.99',
      lugarExpedicion: '45118',
      noCertificado: '00001000000709697894',
    },
    emisor: { rfc: 'SIE200729UA0', nombre: 'SOLUCIONCP IDEAS EMPRESARIALES', regimenFiscal: '601' },
    receptor: {
      rfc: 'AME860107KD9',
      nombre: 'SICONT MEX',
      usoCFDI: 'G03',
      domicilioFiscalReceptor: '01010',
      regimenFiscalReceptor: '601',
    },
    conceptos: [
      {
        cantidad: '1.00',
        claveProdServ: '01010101',
        claveUnidad: 'XUN',
        unidad: 'SERVICIO',
        descripcion: 'Reembolso gastos generales',
        valorUnitario: '1590.51',
        importe: '1590.51',
        impuestos: {
          traslados: [
            {
              base: '1590.51',
              impuesto: '002',
              tasaOCuota: '0.160000',
              importe: '254.48',
            },
          ],
          retenciones: [],
        },
      },
    ],
    impuestos: {
      totalImpuestosTrasladados: '254.48',
      traslados: [{ impuesto: '002', tasaOCuota: '0.160000', importe: '254.48', base: '1590.51' }],
      retenciones: [],
    },
    timbre: {
      uuid: '3d9d1c61-dcbe-4213-b05a-d057b531fec9',
      fechaTimbrado: '2026-07-20T16:15:21',
      selloCFDI: 'ABCSELLOcfdiXXXXYYYY',
      selloSAT: 'ABCSELLOsatXXXXYYYY',
      noCertificadoSAT: '00001000000709182898',
      rfcProvCertif: 'MAS0810247C0',
    },
    complementos: { pago: null, nomina: null },
    qrUrl:
      'https://sat.gob.mx/getcfdi?id=3d9d1c61-dcbe-4213-b05a-d057b531fec9&re=SIE200729UA0&rr=AME860107KD9&tt=1844.99&fe=XXXXYYYY',
    ...overrides,
  };
}

function mockDeps(blobSize = 128) {
  return {
    pdfMake: {
      createPdf() {
        return {
          getBlob(cb) {
            cb(new Blob([new Uint8Array(blobSize)], { type: 'application/pdf' }));
          },
        };
      },
    },
    QRCode: {
      toDataURL() {
        return Promise.resolve(SAMPLE_QR);
      },
    },
  };
}

function createMockDirHandle({ failGet = false, failWrite = false, store = new Map() } = {}) {
  return {
    async getFileHandle(name, _opts) {
      if (failGet) throw new Error('getFileHandle denied');
      return {
        async createWritable() {
          if (failWrite) throw new Error('createWritable denied');
          const chunks = [];
          return {
            async write(data) {
              chunks.push(data);
            },
            async close() {
              const size = chunks.reduce((n, c) => n + (c?.size ?? c?.byteLength ?? 0), 0);
              store.set(name, { size: size || 1, chunks });
            },
          };
        },
      };
    },
    _store: store,
  };
}

console.log('\n=== Spec-005 Formato PDF Gherkin Suite ===\n');

console.log('# Happy Paths');

{
  const parsed = baseParsed();
  assert(resolveLayoutKind(parsed) === 'ingreso', 'Ingreso: resolveLayoutKind ingreso');
  const result = await generatePdf(parsed, mockDeps());
  assert(result.success === true, 'Ingreso: success true');
  assert(result.blob?.type?.includes('pdf') === true, 'Ingreso: blob.type contiene pdf');
  assert(result.blob?.size > 0, 'Ingreso: blob.size > 0');
  const flat = flatDoc(result.docDefinition);
  assert(flat.includes('Ingreso') && flat.includes('Vigente'), 'Ingreso: badges Ingreso + Vigente');
  assert(flat.includes('Emisor') && flat.includes('Receptor'), 'Ingreso: Emisor/Receptor');
  assert(flat.includes('Folio Fiscal'), 'Ingreso: Folio Fiscal');
  assert(flat.includes('Fecha / Hora de Emisión'), 'Ingreso: Fecha / Hora de Emisión');
  assert(flat.includes('No. de Certificado Digital'), 'Ingreso: No. de Certificado Digital');
  assert(flat.includes('Clave') && flat.includes('Concepto'), 'Ingreso: encabezados conceptos');
  assert(flat.includes('Subtotal') && flat.includes('Total'), 'Ingreso: Subtotal/Total');
  assert(flat.includes('$'), 'Ingreso: montos con $');
  assert(flat.includes('Sello digital del CFDI'), 'Ingreso: Sello digital del CFDI');
  assert(flat.includes('Sello del SAT'), 'Ingreso: Sello del SAT');
  assert(
    flat.includes('Este documento es una representación impresa de un CFDI'),
    'Ingreso: disclaimer legal',
  );
  assert(!/ezaudita/i.test(flat), 'Ingreso: sin ezaudita');
  assert(docHasQrDataImage(result.docDefinition), 'Ingreso: QR data:image');
}

{
  const parsed = baseParsed({
    complementos: {
      pago: {
        totales: { montoTotalPagos: '10487.33' },
        pagos: [
          {
            fechaPago: '2025-02-24T12:00:00',
            formaDePagoP: '03',
            monedaP: 'MXN',
            tipoCambioP: '1',
            monto: '10487.33',
            numOperacion: '',
            rfcEmisorCtaBen: 'BBA830831LJ2',
            ctaBeneficiario: '0142428067',
            doctosRelacionados: [
              {
                idDocumento: '8f9583f4-8c76-4ed6-b8bd-58533ebf583d',
                folio: '815',
                monedaDR: 'MXN',
                numParcialidad: '1',
                impSaldoAnt: '10487.33',
                impPagado: '10487.33',
                impSaldoInsoluto: '0.00',
              },
            ],
          },
        ],
      },
      nomina: null,
    },
    comprobante: {
      ...baseParsed().comprobante,
      tipoDeComprobante: 'P',
      folio: '5669',
      total: '0',
      subTotal: '0',
    },
    receptor: { ...baseParsed().receptor, usoCFDI: 'CP01' },
  });
  assert(resolveLayoutKind(parsed) === 'pago', 'Pago: resolveLayoutKind pago');
  const result = await generatePdf(parsed, mockDeps());
  assert(result.success === true, 'Pago: success true');
  assert(result.blob?.size > 0, 'Pago: blob.size > 0');
  const flat = flatDoc(result.docDefinition);
  assert(flat.includes('Pago') && flat.includes('Vigente'), 'Pago: badges');
  assert(flat.includes('Documento relacionado'), 'Pago: Documento relacionado');
  assert(flat.includes('Parcialidad') && flat.includes('Saldo anterior'), 'Pago: columnas DR');
  assert(flat.includes('Monto') && flat.includes('$'), 'Pago: Monto con $');
  assert(docHasQrDataImage(result.docDefinition), 'Pago: QR');
  assert(flat.includes('Sello digital del CFDI'), 'Pago: sellos');
  assert(!/ezaudita/i.test(flat), 'Pago: sin ezaudita');
}

{
  const parsed = baseParsed({
    comprobante: {
      ...baseParsed().comprobante,
      tipoDeComprobante: 'N',
      folio: '1',
      total: '20981.54',
      metodoPago: 'PUE',
    },
    receptor: { ...baseParsed().receptor, usoCFDI: 'CN01', nombre: 'OSCAR ARMANDO GALLO GUIDO' },
    complementos: {
      pago: null,
      nomina: {
        version: '1.2',
        tipoNomina: 'O',
        fechaPago: '2024-01-15T00:00:00',
        fechaInicialPago: '2024-01-01T00:00:00',
        fechaFinalPago: '2024-01-15T00:00:00',
        numDiasPagados: '15.000',
        totalPercepciones: '28537.74',
        totalDeducciones: '7556.24',
        emisor: { registroPatronal: 'Z2966043106' },
        receptor: {
          curp: 'GAGO860503HSRLDS08',
          numSeguridadSocial: '24078612751',
          numEmpleado: '014',
          departamento: 'DESARROLLO',
          puesto: 'FRONT END DEVELOPER',
          antiguedad: 'P58W',
          tipoRegimen: '02',
          fechaInicioRelLaboral: '2022-12-01T00:00:00',
          salarioBaseCotApor: '1903.76',
          salarioDiarioIntegrado: '1811.92',
        },
        percepciones: {
          detalle: [
            { clave: '001', concepto: 'Sueldo', importeGravado: '27178.80', importeExento: '0' },
          ],
        },
        deducciones: {
          detalle: [
            { clave: '052', concepto: 'I.M.S.S.', importe: '773.77' },
          ],
        },
        otrosPagos: { detalle: [] },
      },
    },
  });
  assert(resolveLayoutKind(parsed) === 'nomina', 'Nómina: resolveLayoutKind nomina');
  const result = await generatePdf(parsed, mockDeps());
  assert(result.success === true, 'Nómina: success true');
  assert(result.blob?.size > 0, 'Nómina: blob.size > 0');
  const flat = flatDoc(result.docDefinition);
  assert(flat.includes('Nómina') && flat.includes('Vigente'), 'Nómina: badges');
  assert(flat.includes('Periodo de pago'), 'Nómina: Periodo de pago');
  assert(flat.includes('Neto a pagar'), 'Nómina: Neto a pagar');
  assert(flat.includes('Percepciones'), 'Nómina: Percepciones');
  assert(flat.includes('Deducciones'), 'Nómina: Deducciones');
  assert(flat.includes('001') && flat.includes('Sueldo'), 'Nómina: fila percepción');
  assert(flat.includes('052') && flat.includes('I.M.S.S.'), 'Nómina: fila deducción');
  assert(!/ezaudita/i.test(flat), 'Nómina: sin ezaudita');
}

console.log('\n# Limit Cases');

{
  const parsed = baseParsed({
    conceptos: [
      {
        cantidad: '1',
        claveProdServ: '84111506',
        claveUnidad: 'E48',
        descripcion: 'Sin impuestos anidados',
        valorUnitario: '100',
        importe: '100',
        impuestos: { traslados: [], retenciones: [] },
      },
    ],
    impuestos: { traslados: [], retenciones: [], totalImpuestosTrasladados: '' },
  });
  const doc = buildDocDefinition(parsed, SAMPLE_QR);
  const flat = flatDoc(doc);
  assert(!flat.includes('Traslados:'), 'Sin impuestos concepto: no bloque Traslados');
  const result = await generatePdf(parsed, mockDeps());
  assert(result.success === true && result.blob.size > 0, 'Sin impuestos concepto: PDF ok');
}

{
  assert(formatCatalog('99', { '01': 'Efectivo' }) === '99', 'Catálogo sin match: solo código');
  const parsed = baseParsed({
    comprobante: { ...baseParsed().comprobante, formaPago: '99' },
  });
  const result = await generatePdf(parsed, mockDeps());
  assert(result.success === true && result.blob.size > 0, 'FormaPago 99: success PDF');
  assert(flatDoc(result.docDefinition).includes('99'), 'FormaPago 99: muestra código');
}

{
  const parsed = baseParsed({
    comprobante: { ...baseParsed().comprobante, tipoDeComprobante: 'E' },
  });
  assert(resolveLayoutKind(parsed) === 'egreso', 'Egreso: resolveLayoutKind egreso');
  const flat = flatDoc(buildDocDefinition(parsed, SAMPLE_QR));
  assert(flat.includes('Egreso'), 'Egreso: badge Egreso');
  assert(!/\bIngreso\b/.test(flat), 'Egreso: no badge Ingreso');
}

{
  assert(formatMoney('1844.99') === '$1,844.99', 'formatMoney 1844.99');
  assert(numeroALetra(1234.56, 'MXN').includes('MIL'), 'numeroALetra sigue disponible');
  assert(derivePdfFileName('recibo.XML') === 'recibo.pdf', 'recibo.XML → recibo.pdf');
}

{
  const store = new Map();
  const dirHandle = createMockDirHandle({ store });
  const blob = new Blob([new Uint8Array(64)], { type: 'application/pdf' });
  const result = await writePdfBesideXml(dirHandle, 'FAC-2026-001.xml', blob);
  assert(result.success === true, 'Write: success true');
  assert(result.fileName === 'FAC-2026-001.pdf', 'Write: fileName FAC-2026-001.pdf');
}

console.log('\n# Error Scenarios');

{
  let threw = false;
  let result;
  try {
    result = await generatePdf(baseParsed({ qrUrl: '' }), mockDeps());
  } catch {
    threw = true;
  }
  assert(!threw, 'qrUrl vacío: no throw');
  assert(result?.success === false, 'qrUrl vacío: success false');
  assert(typeof result?.error === 'string' && result.error.length > 0, 'qrUrl vacío: error no vacío');
}

{
  let threw = false;
  let result;
  try {
    result = await generatePdf(
      { success: false, error: 'XML malformado', fileName: 'bad.xml' },
      mockDeps(),
    );
  } catch {
    threw = true;
  }
  assert(!threw, 'parse fail: no throw');
  assert(result?.success === false, 'parse fail: success false');
  assert(result?.fileName === 'bad.xml', 'parse fail: fileName bad.xml');
}

{
  let threw = false;
  let result;
  try {
    result = await generatePdf(baseParsed(), { pdfMake: null, QRCode: null });
  } catch {
    threw = true;
  }
  assert(!threw, 'libs ausentes: no throw');
  assert(result?.success === false, 'libs ausentes: success false');
  assert(typeof result?.error === 'string' && result.error.length > 0, 'libs ausentes: error');
}

{
  let threw = false;
  let result;
  try {
    const blob = new Blob([new Uint8Array(8)], { type: 'application/pdf' });
    result = await writePdfBesideXml(createMockDirHandle({ failGet: true }), 'FAC-001.xml', blob);
  } catch {
    threw = true;
  }
  assert(!threw, 'I/O fail: no throw');
  assert(result?.success === false, 'I/O fail: success false');
}

// ─── Bug-001: soft-wrap Base64 sellos en footer ───────────────────────────────
{
  assert(wrapBase64Sello('') === '', 'wrapBase64Sello: vacío → ""');
  assert(wrapBase64Sello('SHORT') === 'SHORT', 'wrapBase64Sello: len < 64 sin ZWSP');
  const long128 = 'A'.repeat(128);
  const wrapped = wrapBase64Sello(long128, 64);
  assert(wrapped.includes('\u200B'), 'wrapBase64Sello: len≥128 contiene U+200B');
  assert(wrapped.replace(/\u200B/g, '') === long128, 'wrapBase64Sello: strip ZWSP === original');
  assert(wrapped.indexOf('\u200B') === 64, 'wrapBase64Sello: primer ZWSP en pos 64');
}

{
  const longSello = 'B'.repeat(128) + 'C'.repeat(64) + '+/=XYZ';
  const parsed = baseParsed({
    timbre: {
      uuid: '3d9d1c61-dcbe-4213-b05a-d057b531fec9',
      fechaTimbrado: '2026-07-20T16:15:21',
      selloCFDI: longSello,
      selloSAT: longSello,
      noCertificadoSAT: '00001000000709182898',
      rfcProvCertif: 'MAS0810247C0',
    },
  });
  const doc = buildDocDefinition(parsed, SAMPLE_QR);
  const flat = flatDoc(doc);
  assert(flat.includes('Sello digital del CFDI'), 'Bug-001 footer: etiqueta CFDI');
  assert(flat.includes('Sello del SAT'), 'Bug-001 footer: etiqueta SAT');
  assert(flat.includes('\u200B'), 'Bug-001 footer: sellos largos con soft-wrap');
  assert(flat.replace(/\u200B/g, '').includes(longSello), 'Bug-001 footer: strip ZWSP == sello');
  assert(flat.includes('representación impresa'), 'Bug-001 footer: disclaimer intacto');
  assert(docHasQrDataImage(doc), 'Bug-001 footer: QR image intacto');
}

console.log(`\n=== Results: ${passed} PASS / ${failed} FAIL ===\n`);
process.exit(failed > 0 ? 1 : 0);
