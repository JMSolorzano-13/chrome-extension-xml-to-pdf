/**
 * @sdd-task: Task #2 - wrapBase64Sello + buildFooterLegal soft-wrap
 * @sdd-spec: specs/bug-001-liu-sellos-pdf-margen/bug.md
 * @sdd-decision: ADR-010 - Alias SelloCFD + soft-wrap Base64 footer
 * @sdd-why: pdfmake no wrappea Base64 continuo; U+200B cada 64 chars fuerza quiebre en margen
 * @human-debug: SAT overflow → wrapBase64Sello en buildFooterLegal. CFDI vacío → parser ADR-010.
 */

import {
  labelTipoComprobante,
  labelFormaPago,
  labelMetodoPago,
  labelRegimenFiscal,
  labelUsoCFDI,
  labelClaveUnidad,
} from './catalogos-sat.js';

const QR_SIZE_PT = 85;
const LEGAL_DISCLAIMER = 'Este documento es una representación impresa de un CFDI';
const COLOR_BADGE_TIPO_BG = '#E8F1FB';
const COLOR_BADGE_TIPO_FG = '#1A5F9E';
const COLOR_BADGE_OK_BG = '#E6F6EC';
const COLOR_BADGE_OK_FG = '#1B7A3D';
const COLOR_TOTAL_BAR = '#1B3A5F';
const COLOR_PAGO_BOX = '#F0F0F0';

/**
 * @param {unknown} value
 * @returns {string}
 */
function text(value) {
  if (value == null) return '';
  return String(value);
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatMoney(value) {
  if (value == null || value === '') return '';
  const n = Number(String(value).replace(/,/g, ''));
  if (!Number.isFinite(n)) return text(value);
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function formatDateTime(value) {
  const s = text(value).trim();
  if (!s) return '';
  return s.replace('T', ' ').replace(/\.\d+Z?$/, '');
}

/**
 * Flatten docDefinition content to searchable strings (tests / Gherkin).
 * @param {unknown} node
 * @param {string[]} out
 */
export function collectStrings(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string') {
    out.push(node);
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectStrings(item, out);
    return out;
  }
  if (typeof node === 'object') {
    const obj = /** @type {Record<string, unknown>} */ (node);
    if (typeof obj.text === 'string') out.push(obj.text);
    if (Array.isArray(obj.text)) collectStrings(obj.text, out);
    if (obj.image && typeof obj.image === 'string') out.push(obj.image);
    for (const key of Object.keys(obj)) {
      if (key === 'text' || key === 'image') continue;
      collectStrings(obj[key], out);
    }
  }
  return out;
}

/**
 * @param {object} parsedDoc
 * @param {string} title
 * @returns {boolean}
 */
export function docHasSectionTitle(parsedDoc, title) {
  const strings = collectStrings(parsedDoc?.content);
  return strings.some((s) => s.includes(title));
}

/**
 * @param {object} parsedDoc
 * @returns {boolean}
 */
export function docHasQrDataImage(parsedDoc) {
  const strings = collectStrings(parsedDoc?.content);
  return strings.some((s) => typeof s === 'string' && s.startsWith('data:image'));
}

/**
 * @param {object} parsed
 * @returns {'nomina'|'pago'|'egreso'|'ingreso'}
 */
export function resolveLayoutKind(parsed) {
  const complementos = parsed?.complementos || {};
  const tipo = text(parsed?.comprobante?.tipoDeComprobante).toUpperCase();
  if (complementos.nomina) return 'nomina';
  if (tipo === 'P' || complementos.pago) return 'pago';
  if (tipo === 'E') return 'egreso';
  return 'ingreso';
}

/**
 * @param {string} tipoLabel
 * @param {string} serieFolioRight
 */
function buildHeaderBadges(tipoLabel, serieFolioRight) {
  return {
    columns: [
      {
        width: '*',
        columns: [
          {
            width: 'auto',
            table: {
              body: [[{
                text: tipoLabel,
                color: COLOR_BADGE_TIPO_FG,
                bold: true,
                fontSize: 9,
                margin: [6, 3, 6, 3],
              }]],
            },
            layout: {
              fillColor: () => COLOR_BADGE_TIPO_BG,
              hLineWidth: () => 0,
              vLineWidth: () => 0,
            },
          },
          { width: 6, text: '' },
          {
            width: 'auto',
            table: {
              body: [[{
                text: 'Vigente',
                color: COLOR_BADGE_OK_FG,
                bold: true,
                fontSize: 9,
                margin: [6, 3, 6, 3],
              }]],
            },
            layout: {
              fillColor: () => COLOR_BADGE_OK_BG,
              hLineWidth: () => 0,
              vLineWidth: () => 0,
            },
          },
        ],
      },
      {
        width: 'auto',
        text: serieFolioRight,
        alignment: 'right',
        bold: true,
        fontSize: 10,
        margin: [0, 4, 0, 0],
      },
    ],
    margin: [0, 0, 0, 10],
  };
}

/**
 * Inserta soft-breaks (U+200B) cada chunkSize chars para que pdfmake wrappee Base64.
 * El valor lógico se recupera con strip de \u200B.
 *
 * @param {unknown} value
 * @param {number} [chunkSize=64]
 * @returns {string}
 */
export function wrapBase64Sello(value, chunkSize = 64) {
  const raw = text(value);
  if (!raw) return '';
  const size = Number.isFinite(chunkSize) && chunkSize > 0 ? chunkSize : 64;
  if (raw.length <= size) return raw;
  /** @type {string[]} */
  const parts = [];
  for (let i = 0; i < raw.length; i += size) {
    parts.push(raw.slice(i, i + size));
  }
  return parts.join('\u200B');
}

/**
 * @param {object} timbre
 * @param {string} qrDataUrl
 * @param {object} [extraMeta]
 */
function buildFooterLegal(timbre, qrDataUrl, extraMeta = {}) {
  const selloCfdi = wrapBase64Sello(timbre.selloCFDI);
  const selloSat = wrapBase64Sello(timbre.selloSAT);
  /** @type {unknown[]} */
  const stack = [
    {
      columns: [
        {
          width: QR_SIZE_PT + 8,
          stack: [
            {
              image: qrDataUrl,
              width: QR_SIZE_PT,
              height: QR_SIZE_PT,
            },
          ],
        },
        {
          width: '*',
          stack: [
            { text: 'Sello digital del CFDI', bold: true, fontSize: 8, margin: [0, 0, 0, 2] },
            { text: selloCfdi || '—', fontSize: 6, margin: [0, 0, 0, 6] },
            { text: 'Sello del SAT', bold: true, fontSize: 8, margin: [0, 0, 0, 2] },
            { text: selloSat || '—', fontSize: 6 },
          ],
        },
      ],
      margin: [0, 12, 0, 8],
    },
    {
      columns: [
        {
          width: '*',
          stack: [
            { text: 'Fecha/Hora de Certificación:', bold: true, fontSize: 8 },
            { text: formatDateTime(timbre.fechaTimbrado), fontSize: 8 },
          ],
        },
        {
          width: '*',
          stack: [
            { text: 'Número de Serie Certificado del SAT:', bold: true, fontSize: 8 },
            { text: text(timbre.noCertificadoSAT), fontSize: 8 },
          ],
        },
        {
          width: '*',
          stack: [
            { text: 'RFC del PAC', bold: true, fontSize: 8 },
            { text: text(timbre.rfcProvCertif), fontSize: 8 },
          ],
        },
      ],
      margin: [0, 0, 0, 8],
    },
    {
      text: LEGAL_DISCLAIMER,
      alignment: 'center',
      fontSize: 8,
      margin: [0, 4, 0, 4],
    },
  ];

  if (extraMeta.footerLine) {
    stack.push({
      text: extraMeta.footerLine,
      fontSize: 7,
      color: '#555555',
      margin: [0, 4, 0, 0],
    });
  }

  return stack;
}

function baseDoc(content) {
  return {
    pageSize: 'LETTER',
    pageMargins: [36, 36, 36, 36],
    content,
    styles: {
      sectionTitle: { fontSize: 10, bold: true, margin: [0, 0, 0, 2] },
      tableHeader: { bold: true, fontSize: 7, color: '#333333' },
      label: { bold: true, fontSize: 8 },
      value: { fontSize: 8 },
    },
    defaultStyle: {
      fontSize: 8,
      color: '#222222',
    },
  };
}

/**
 * @param {object} parsed
 * @param {string} qrDataUrl
 * @param {'Ingreso'|'Egreso'} badgeTipo
 */
function buildIngresoEgresoDoc(parsed, qrDataUrl, badgeTipo) {
  const comprobante = parsed.comprobante || {};
  const emisor = parsed.emisor || {};
  const receptor = parsed.receptor || {};
  const timbre = parsed.timbre || {};
  const conceptos = Array.isArray(parsed.conceptos) ? parsed.conceptos : [];
  const impuestos = parsed.impuestos || {};
  const moneda = text(comprobante.moneda) || 'MXN';

  /** @type {unknown[]} */
  const content = [];

  const serie = text(comprobante.serie);
  const folio = text(comprobante.folio);
  const right = serie
    ? `Serie: ${serie}  Folio: ${folio}`
    : `Folio: ${folio || '—'}`;
  content.push(buildHeaderBadges(badgeTipo, right));

  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: [{ text: 'Emisor: ', bold: true }, text(emisor.nombre)] },
          { text: text(emisor.rfc), margin: [0, 2, 0, 0] },
          { text: `Lugar de Expedición: ${text(comprobante.lugarExpedicion)}` },
          { text: `Régimen Fiscal: ${labelRegimenFiscal(emisor.regimenFiscal)}` },
        ],
      },
      {
        width: '*',
        stack: [
          { text: [{ text: 'Receptor: ', bold: true }, text(receptor.nombre)] },
          { text: text(receptor.rfc), margin: [0, 2, 0, 0] },
          { text: `Domicilio fiscal: ${text(receptor.domicilioFiscalReceptor)}` },
          {
            text: `Régimen fiscal: ${labelRegimenFiscal(
              receptor.regimenFiscalReceptor || receptor.regimenFiscal,
            )}`,
          },
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  });

  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: 'Folio Fiscal:', bold: true },
          { text: text(timbre.uuid), fontSize: 7 },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'Fecha / Hora de Emisión:', bold: true },
          { text: formatDateTime(comprobante.fecha) },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'No. de Certificado Digital:', bold: true },
          { text: text(comprobante.noCertificado) },
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  });

  const conceptoBody = [
    [
      { text: 'Clave\nProducto', style: 'tableHeader' },
      { text: 'Cantidad', style: 'tableHeader' },
      { text: 'Clave Unidad', style: 'tableHeader' },
      { text: 'Concepto(s)', style: 'tableHeader' },
      { text: 'Precio\nUnitario', style: 'tableHeader', alignment: 'right' },
      { text: 'Importe', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  for (const c of conceptos) {
    const tras = Array.isArray(c.impuestos?.traslados) ? c.impuestos.traslados : [];
    /** @type {unknown[]} */
    const conceptoStack = [{ text: text(c.descripcion), fontSize: 8 }];
    if (tras.length > 0) {
      conceptoStack.push({ text: 'Traslados:', bold: true, fontSize: 7, margin: [0, 2, 0, 0] });
      for (const t of tras) {
        conceptoStack.push({
          text: `Impuesto: ${text(t.impuesto)}, Base: ${formatMoney(t.base)}, Tasa: ${text(t.tasaOCuota)}, Importe: ${formatMoney(t.importe)}`,
          fontSize: 7,
        });
      }
    }
    conceptoBody.push([
      text(c.claveProdServ),
      text(c.cantidad),
      labelClaveUnidad(c.claveUnidad, c.unidad),
      { stack: conceptoStack },
      { text: formatMoney(c.valorUnitario), alignment: 'right' },
      { text: formatMoney(c.importe), alignment: 'right' },
    ]);
  }
  if (conceptoBody.length === 1) {
    conceptoBody.push(['', '', '', '(sin conceptos)', '', '']);
  }

  content.push({
    table: {
      headerRows: 1,
      widths: [48, 36, 55, '*', 48, 48],
      body: conceptoBody,
    },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 8],
  });

  const ivaTraslado = Array.isArray(impuestos.traslados)
    ? impuestos.traslados
      .filter((t) => text(t.impuesto) === '002')
      .reduce((acc, t) => acc + (Number(t.importe) || 0), 0)
    : 0;
  const ivaLabel = impuestos.totalImpuestosTrasladados
    || (ivaTraslado ? ivaTraslado.toFixed(2) : '');

  content.push({
    columns: [
      {
        width: '*',
        text: `Moneda: ${moneda} - Peso Mexicano`,
        margin: [0, 18, 0, 0],
      },
      {
        width: 160,
        stack: [
          {
            columns: [
              { text: 'Subtotal:', alignment: 'left' },
              { text: formatMoney(comprobante.subTotal), alignment: 'right' },
            ],
          },
          ...(ivaLabel
            ? [{
              columns: [
                { text: 'Traslado IVA:', alignment: 'left' },
                { text: formatMoney(ivaLabel), alignment: 'right' },
              ],
              margin: [0, 2, 0, 0],
            }]
            : []),
          {
            table: {
              widths: ['*', 'auto'],
              body: [[
                { text: 'Total:', color: '#FFFFFF', bold: true, margin: [6, 4, 0, 4] },
                {
                  text: formatMoney(comprobante.total),
                  color: '#FFFFFF',
                  bold: true,
                  alignment: 'right',
                  margin: [0, 4, 6, 4],
                },
              ]],
            },
            layout: {
              fillColor: () => COLOR_TOTAL_BAR,
              hLineWidth: () => 0,
              vLineWidth: () => 0,
            },
            margin: [0, 4, 0, 0],
          },
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  });

  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: 'Forma de Pago:', bold: true },
          { text: labelFormaPago(comprobante.formaPago) },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'Método de Pago:', bold: true },
          { text: labelMetodoPago(comprobante.metodoPago) },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'Uso del CFDI:', bold: true },
          { text: labelUsoCFDI(receptor.usoCFDI) },
        ],
      },
    ],
    margin: [0, 0, 0, 4],
  });

  content.push(...buildFooterLegal(timbre, qrDataUrl));
  return baseDoc(content);
}

/**
 * @param {object} parsed
 * @param {string} qrDataUrl
 */
function buildPagoDoc(parsed, qrDataUrl) {
  const comprobante = parsed.comprobante || {};
  const emisor = parsed.emisor || {};
  const receptor = parsed.receptor || {};
  const timbre = parsed.timbre || {};
  const pagoWrap = parsed.complementos?.pago || {};
  const pagos = Array.isArray(pagoWrap.pagos) ? pagoWrap.pagos : [];
  const firstPago = pagos[0] || {};

  /** @type {unknown[]} */
  const content = [];
  content.push(buildHeaderBadges('Pago', `Folio: ${text(comprobante.folio) || '—'}`));

  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: [{ text: 'Emisor: ', bold: true }, text(emisor.nombre)] },
          { text: text(emisor.rfc) },
          { text: `Lugar de Expedición: ${text(comprobante.lugarExpedicion)}` },
          { text: `Régimen Fiscal: ${labelRegimenFiscal(emisor.regimenFiscal)}` },
        ],
      },
      {
        width: '*',
        stack: [
          { text: [{ text: 'Receptor: ', bold: true }, text(receptor.nombre)] },
          { text: text(receptor.rfc) },
          {
            text: `Régimen Fiscal: ${labelRegimenFiscal(
              receptor.regimenFiscalReceptor || receptor.regimenFiscal,
            )}`,
          },
        ],
      },
    ],
    margin: [0, 0, 0, 10],
  });

  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: 'Folio Fiscal:', bold: true },
          { text: text(timbre.uuid), fontSize: 7 },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'Fecha / Hora de Emisión:', bold: true },
          { text: formatDateTime(comprobante.fecha) },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'No. de Certificado Digital:', bold: true },
          { text: text(comprobante.noCertificado) },
        ],
      },
    ],
    margin: [0, 0, 0, 8],
  });

  content.push({
    table: {
      widths: ['*'],
      body: [[{
        stack: [
          {
            columns: [
              {
                width: '*',
                stack: [
                  { text: 'Fecha:', bold: true },
                  { text: formatDateTime(firstPago.fechaPago) },
                ],
              },
              {
                width: '*',
                stack: [
                  { text: 'Número de operación:', bold: true },
                  { text: text(firstPago.numOperacion) },
                ],
              },
              {
                width: '*',
                stack: [
                  { text: 'Nombre Banco Ordenante:', bold: true },
                  { text: text(firstPago.nombreBancoOrdEnNom) },
                ],
              },
            ],
          },
          {
            columns: [
              {
                width: '*',
                stack: [
                  { text: 'RFC Emisor Cuenta Ordenante:', bold: true, margin: [0, 6, 0, 0] },
                  { text: text(firstPago.rfcEmisorCtaOrd) },
                ],
              },
              {
                width: '*',
                stack: [
                  { text: 'Cuenta Ordenante:', bold: true, margin: [0, 6, 0, 0] },
                  { text: text(firstPago.ctaOrdenante) },
                ],
              },
              {
                width: '*',
                stack: [
                  { text: 'RFC Emisor Cuenta Beneficiario:', bold: true, margin: [0, 6, 0, 0] },
                  { text: text(firstPago.rfcEmisorCtaBen) },
                ],
              },
              {
                width: '*',
                stack: [
                  { text: 'Cuenta Beneficiario:', bold: true, margin: [0, 6, 0, 0] },
                  { text: text(firstPago.ctaBeneficiario) },
                ],
              },
            ],
          },
        ],
        fillColor: COLOR_PAGO_BOX,
        margin: [8, 8, 8, 8],
      }]],
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
    },
    margin: [0, 0, 0, 10],
  });

  content.push({ text: 'Documento relacionado', style: 'sectionTitle', margin: [0, 0, 0, 4] });

  const docRows = [
    [
      { text: 'UUID', style: 'tableHeader' },
      { text: 'Folio', style: 'tableHeader' },
      { text: 'Moneda', style: 'tableHeader' },
      { text: 'Método de pago', style: 'tableHeader' },
      { text: 'Parcialidad', style: 'tableHeader' },
      { text: 'Saldo anterior', style: 'tableHeader', alignment: 'right' },
      { text: 'Pagado', style: 'tableHeader', alignment: 'right' },
      { text: 'Saldo insoluto', style: 'tableHeader', alignment: 'right' },
    ],
  ];

  for (const p of pagos) {
    const doctos = Array.isArray(p.doctosRelacionados) ? p.doctosRelacionados : [];
    for (const d of doctos) {
      docRows.push([
        { text: text(d.idDocumento), fontSize: 6 },
        text(d.folio),
        text(d.monedaDR),
        text(p.formaDePagoP || comprobante.metodoPago),
        text(d.numParcialidad),
        { text: formatMoney(d.impSaldoAnt), alignment: 'right' },
        { text: formatMoney(d.impPagado), alignment: 'right' },
        { text: formatMoney(d.impSaldoInsoluto), alignment: 'right' },
      ]);
    }
  }
  if (docRows.length === 1) {
    docRows.push(['(sin documentos relacionados)', '', '', '', '', '', '', '']);
  }

  content.push({
    table: { headerRows: 1, widths: ['*', 28, 30, 40, 35, 45, 40, 45], body: docRows },
    layout: 'lightHorizontalLines',
    margin: [0, 0, 0, 8],
  });

  const monto = firstPago.monto || pagoWrap.totales?.montoTotalPagos || '';
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: `Moneda: ${text(firstPago.monedaP) || 'MXN'}` },
          { text: `Forma de pago: ${labelFormaPago(firstPago.formaDePagoP)}` },
          { text: `Tipo de cambio: ${text(firstPago.tipoCambioP) || '1.00'}` },
        ],
      },
      {
        width: 120,
        stack: [
          { text: 'Monto:', bold: true, alignment: 'right' },
          { text: formatMoney(monto), bold: true, fontSize: 12, alignment: 'right' },
        ],
      },
    ],
    margin: [0, 0, 0, 6],
  });

  content.push({
    text: `Uso del CFDI: ${labelUsoCFDI(receptor.usoCFDI)}`,
    margin: [0, 0, 0, 4],
  });

  content.push(...buildFooterLegal(timbre, qrDataUrl));
  return baseDoc(content);
}

/**
 * @param {object} parsed
 * @param {string} qrDataUrl
 */
function buildNominaDoc(parsed, qrDataUrl) {
  const comprobante = parsed.comprobante || {};
  const emisor = parsed.emisor || {};
  const receptor = parsed.receptor || {};
  const timbre = parsed.timbre || {};
  const nomina = parsed.complementos?.nomina || {};
  const emisorNom = nomina.emisor || {};
  const receptorNom = nomina.receptor || {};
  const percepciones = nomina.percepciones || {};
  const deducciones = nomina.deducciones || {};
  const otrosPagos = nomina.otrosPagos || { detalle: [] };
  const detPerc = Array.isArray(percepciones.detalle) ? percepciones.detalle : [];
  const detDed = Array.isArray(deducciones.detalle) ? deducciones.detalle : [];
  const detOtros = Array.isArray(otrosPagos.detalle) ? otrosPagos.detalle : [];

  /** @type {unknown[]} */
  const content = [];
  content.push(buildHeaderBadges('Nómina', `Folio: ${text(comprobante.folio) || '—'}`));

  content.push({
    text: [{ text: 'Emisor    ', bold: true }, { text: text(emisor.nombre), bold: true, fontSize: 10 }],
    margin: [0, 0, 0, 4],
  });
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: `RFC: ${text(emisor.rfc)}` },
          { text: `Registro patronal: ${text(emisorNom.registroPatronal)}` },
          { text: `Régimen fiscal: ${labelRegimenFiscal(emisor.regimenFiscal)}` },
        ],
      },
      {
        width: '*',
        stack: [
          { text: `Lugar de Emisión: ${text(comprobante.lugarExpedicion)}` },
          { text: `Fecha de emisión: ${formatDateTime(comprobante.fecha)}` },
        ],
      },
      {
        width: '*',
        stack: [
          { text: 'Folio Fiscal:', bold: true },
          { text: text(timbre.uuid), fontSize: 6 },
        ],
      },
    ],
    margin: [0, 0, 0, 8],
  });

  content.push({
    text: [{ text: 'Receptor    ', bold: true }, { text: text(receptor.nombre), bold: true, fontSize: 10 }],
    margin: [0, 0, 0, 4],
  });
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: `RFC: ${text(receptor.rfc)}` },
          { text: `CURP: ${text(receptorNom.curp)}` },
          { text: `Núm. seguro social: ${text(receptorNom.numSeguridadSocial)}` },
          { text: `Domicilio fiscal: ${text(receptor.domicilioFiscalReceptor)}` },
        ],
      },
      {
        width: '*',
        stack: [
          { text: `Ingreso: ${formatDateTime(receptorNom.fechaInicioRelLaboral)}` },
          { text: `Antigüedad: ${text(receptorNom.antiguedad)}` },
          { text: `Núm. de empleado: ${text(receptorNom.numEmpleado)}` },
          { text: `Tipo de régimen: ${text(receptorNom.tipoRegimen)}` },
        ],
      },
      {
        width: '*',
        stack: [
          { text: `Departamento: ${text(receptorNom.departamento)}` },
          { text: `Puesto: ${text(receptorNom.puesto)}` },
          { text: `Salario base cotización: ${formatMoney(receptorNom.salarioBaseCotApor)}` },
          { text: `Salario diario integrado: ${formatMoney(receptorNom.salarioDiarioIntegrado)}` },
        ],
      },
    ],
    margin: [0, 0, 0, 8],
  });

  content.push({ text: 'Periodo de pago', style: 'sectionTitle', margin: [0, 0, 0, 4] });
  content.push({
    columns: [
      {
        width: '*',
        stack: [
          { text: `Fecha de pago: ${formatDateTime(nomina.fechaPago)}` },
          { text: `Tipo de nómina: ${text(nomina.tipoNomina)}` },
        ],
      },
      {
        width: '*',
        stack: [
          { text: `Fecha inicial: ${formatDateTime(nomina.fechaInicialPago)}` },
          { text: `Fecha final: ${formatDateTime(nomina.fechaFinalPago)}` },
        ],
      },
      {
        width: '*',
        stack: [
          { text: `Días pagados: ${text(nomina.numDiasPagados)}` },
        ],
      },
    ],
    margin: [0, 0, 0, 8],
  });

  /** @type {unknown[][]} */
  const percRows = [[{ text: 'Percepciones y otros pagos', bold: true, colSpan: 3 }, {}, {}]];
  percRows[0] = [
    { text: 'Percepciones y otros pagos', bold: true, colSpan: 3, fillColor: '#F5F5F5' },
    {},
    {},
  ];
  let totalPerc = 0;
  for (const p of detPerc) {
    const amount = Number(p.importeGravado || 0) + Number(p.importeExento || 0);
    totalPerc += amount;
    percRows.push([
      text(p.clave),
      text(p.concepto),
      { text: formatMoney(amount), alignment: 'right' },
    ]);
  }
  for (const o of detOtros) {
    const amount = Number(o.importe || 0);
    totalPerc += amount;
    percRows.push([
      text(o.clave),
      text(o.concepto),
      { text: formatMoney(amount), alignment: 'right' },
    ]);
  }
  if (percRows.length === 1) {
    percRows.push(['', '(sin percepciones)', '']);
  }
  const totalPercLabel = nomina.totalPercepciones || totalPerc;
  percRows.push([
    { text: 'Total de Percepciones y otros pagos', bold: true, colSpan: 2 },
    {},
    { text: formatMoney(totalPercLabel), bold: true, alignment: 'right' },
  ]);

  /** @type {unknown[][]} */
  const dedRows = [[
    { text: 'Deducciones', bold: true, colSpan: 3, fillColor: '#F5F5F5' },
    {},
    {},
  ]];
  let totalDed = 0;
  for (const d of detDed) {
    const amount = Number(d.importe || 0);
    totalDed += amount;
    dedRows.push([
      text(d.clave),
      text(d.concepto),
      { text: formatMoney(amount), alignment: 'right' },
    ]);
  }
  if (dedRows.length === 1) {
    dedRows.push(['', '(sin deducciones)', '']);
  }
  const totalDedLabel = nomina.totalDeducciones || totalDed;
  dedRows.push([
    { text: 'Total de deducciones', bold: true, colSpan: 2 },
    {},
    { text: formatMoney(totalDedLabel), bold: true, alignment: 'right' },
  ]);

  content.push({
    columns: [
      {
        width: '*',
        table: { widths: [28, '*', 50], body: percRows },
        layout: 'lightHorizontalLines',
      },
      { width: 8, text: '' },
      {
        width: '*',
        table: { widths: [28, '*', 50], body: dedRows },
        layout: 'lightHorizontalLines',
      },
    ],
    margin: [0, 0, 0, 6],
  });

  const neto = Number(comprobante.total)
    || (Number(totalPercLabel) - Number(totalDedLabel));
  content.push({
    text: [
      { text: 'Neto a pagar  ', bold: true, fontSize: 11 },
      { text: formatMoney(neto || comprobante.total), bold: true, fontSize: 11 },
    ],
    alignment: 'right',
    margin: [0, 4, 0, 8],
  });

  const footerLine = [
    labelMetodoPago(comprobante.metodoPago) || text(comprobante.metodoPago),
    `Versión del comprobante: ${text(comprobante.version)}`,
    `Versión del complemento: ${text(nomina.version)}`,
    `Uso del CFDI: ${text(receptor.usoCFDI)}`,
  ].filter(Boolean).join('   ');

  content.push(...buildFooterLegal(timbre, qrDataUrl, { footerLine }));
  return baseDoc(content);
}

/**
 * Builds pdfmake docDefinition from a successful parse result + QR DataURI.
 *
 * @param {object} parsed - success payload from parseCFDI
 * @param {string} qrDataUrl
 * @returns {object}
 */
export function buildDocDefinition(parsed, qrDataUrl) {
  const kind = resolveLayoutKind(parsed);
  if (kind === 'nomina') return buildNominaDoc(parsed, qrDataUrl);
  if (kind === 'pago') return buildPagoDoc(parsed, qrDataUrl);
  if (kind === 'egreso') return buildIngresoEgresoDoc(parsed, qrDataUrl, 'Egreso');
  return buildIngresoEgresoDoc(parsed, qrDataUrl, 'Ingreso');
}

/**
 * @param {object} QRCode
 * @param {string} qrUrl
 * @returns {Promise<string>}
 */
async function toQrDataUrl(QRCode, qrUrl) {
  if (!QRCode || typeof QRCode.toDataURL !== 'function') {
    throw new Error('QRCode.toDataURL no disponible');
  }
  const result = QRCode.toDataURL(qrUrl);
  if (result && typeof result.then === 'function') {
    return await result;
  }
  return await new Promise((resolve, reject) => {
    try {
      QRCode.toDataURL(qrUrl, (err, url) => {
        if (err) reject(err);
        else resolve(url);
      });
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * @param {object} pdfMake
 * @param {object} docDefinition
 * @returns {Promise<Blob>}
 */
function createPdfBlob(pdfMake, docDefinition) {
  return new Promise((resolve, reject) => {
    try {
      if (!pdfMake || typeof pdfMake.createPdf !== 'function') {
        reject(new Error('pdfMake.createPdf no disponible'));
        return;
      }
      const pdf = pdfMake.createPdf(docDefinition);
      if (typeof pdf.getBlob === 'function') {
        pdf.getBlob((blob) => {
          if (!blob) reject(new Error('getBlob retornó vacío'));
          else resolve(blob);
        });
        return;
      }
      if (typeof pdf.getBuffer === 'function') {
        pdf.getBuffer((buf) => {
          resolve(new Blob([buf], { type: 'application/pdf' }));
        });
        return;
      }
      reject(new Error('pdfMake no expone getBlob/getBuffer'));
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Generates a PDF Blob from a parseCFDI success result.
 *
 * @param {object} parsedResult
 * @param {{ pdfMake?: object, QRCode?: object }} [deps]
 * @returns {Promise<{ success: boolean, blob?: Blob, fileName: string, docDefinition?: object, error?: string, detail?: string }>}
 */
export async function generatePdf(parsedResult, deps = {}) {
  const fileName = parsedResult?.fileName || '';

  try {
    if (!parsedResult || parsedResult.success === false) {
      return {
        success: false,
        error: parsedResult?.error || 'Resultado de parseo no exitoso',
        fileName: fileName || parsedResult?.fileName || '',
        detail: parsedResult?.detail,
      };
    }

    const qrUrl = parsedResult.qrUrl;
    if (!qrUrl || String(qrUrl).trim() === '') {
      return {
        success: false,
        error: 'qrUrl vacío — no se puede generar QR SAT',
        fileName,
      };
    }

    const pdfMake = deps.pdfMake ?? globalThis.pdfMake;
    const QRCode = deps.QRCode ?? globalThis.QRCode;

    const qrDataUrl = await toQrDataUrl(QRCode, String(qrUrl));
    if (!qrDataUrl || !String(qrDataUrl).startsWith('data:image')) {
      return {
        success: false,
        error: 'QR DataURI inválido',
        fileName,
      };
    }

    const docDefinition = buildDocDefinition(parsedResult, qrDataUrl);
    const blob = await createPdfBlob(pdfMake, docDefinition);

    if (!blob || !(blob.size > 0)) {
      return {
        success: false,
        error: 'PDF Blob vacío — verificar libs pdfmake/vfs_fonts',
        fileName,
      };
    }

    return {
      success: true,
      blob,
      fileName,
      docDefinition,
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: 'Fallo al generar PDF',
      fileName,
      detail,
    };
  }
}
