/**
 * @sdd-task: Task #1 - Parser alias SelloCFD + fallback Comprobante@Sello
 * @sdd-spec: specs/bug-001-liu-sellos-pdf-margen/bug.md
 * @sdd-decision: ADR-010 - Alias SelloCFD + soft-wrap Base64 footer
 * @sdd-why: PAC emite SelloCFD (sin I); campo canónico timbre.selloCFDI intacto para QR/PDF
 * @human-debug: CFDI vacío en PDF → extractTimbre lee SelloCFDI||SelloCFD; si aún vacío →
 *               parseCFDI usa Comprobante@Sello antes de buildSatQrUrl (fe=).
 */

// ─── Helpers de extracción tolerantes a namespaces ───────────────────────────

/**
 * Busca el PRIMER nodo descendiente por localName, ignorando el prefijo de namespace.
 * Estrategia: getElementsByTagNameNS("*", name) → fallback array iteration por localName.
 *
 * @param {Document|Element} parent - Nodo raíz de búsqueda.
 * @param {string} localName        - Nombre local del tag (sin prefijo, ej: "Comprobante").
 * @returns {Element|null}
 */
function getNode(parent, localName) {
  if (!parent) return null;

  // Intento 1: búsqueda estándar por namespace wildcard (más rápida)
  const byNS = parent.getElementsByTagNameNS('*', localName);
  if (byNS && byNS.length > 0) return byNS[0];

  // Intento 2: iteración manual para casos donde el DOMParser no registró el namespace
  const all = parent.getElementsByTagName('*');
  for (const el of all) {
    if (el.localName === localName || el.tagName === localName) return el;
  }

  return null;
}

/**
 * Obtiene todos los nodos descendientes con el localName indicado.
 *
 * @param {Document|Element} parent
 * @param {string} localName
 * @returns {Element[]}
 */
function getAllNodes(parent, localName) {
  if (!parent) return [];

  const byNS = parent.getElementsByTagNameNS('*', localName);
  if (byNS && byNS.length > 0) return Array.from(byNS);

  const result = [];
  const all = parent.getElementsByTagName('*');
  for (const el of all) {
    if (el.localName === localName || el.tagName === localName) result.push(el);
  }
  return result;
}

/**
 * Lee un atributo de un nodo de forma segura, retornando '' si el nodo o atributo no existe.
 *
 * @param {Element|null} node
 * @param {string} attr
 * @returns {string}
 */
function getAttr(node, attr) {
  if (!node) return '';
  return node.getAttribute(attr) ?? '';
}

// ─── Generador de URL del SAT para código QR ────────────────────────────────

/**
 * Construye la URL oficial de verificación del SAT en el formato requerido por el Anexo 20.
 * Formato: https://sat.gob.mx/getcfdi?id={UUID}&re={RFC_EMISOR}&rr={RFC_RECEPTOR}&tt={TOTAL}&fe={SELLO_LAST8}
 *
 * @param {string} uuid
 * @param {string} rfcEmisor
 * @param {string} rfcReceptor
 * @param {string} total        - Monto total con decimales (ej. "1160.00")
 * @param {string} selloCFDI    - Sello completo del CFDI; se usarán los últimos 8 caracteres.
 * @returns {string}
 */
function buildSatQrUrl(uuid, rfcEmisor, rfcReceptor, total, selloCFDI) {
  const fe = selloCFDI ? selloCFDI.slice(-8) : '';
  return `https://sat.gob.mx/getcfdi?id=${uuid}&re=${rfcEmisor}&rr=${rfcReceptor}&tt=${total}&fe=${fe}`;
}

// ─── Extractores de secciones del CFDI ──────────────────────────────────────

function extractComprobante(doc) {
  // El nodo raíz puede llamarse "Comprobante" con o sin prefijo cfdi:
  const node = getNode(doc, 'Comprobante');
  if (!node) return null;
  return {
    version:            getAttr(node, 'Version') || getAttr(node, 'version'),
    serie:              getAttr(node, 'Serie'),
    folio:              getAttr(node, 'Folio'),
    fecha:              getAttr(node, 'Fecha'),
    formaPago:          getAttr(node, 'FormaPago'),
    metodoPago:         getAttr(node, 'MetodoPago'),
    tipoDeComprobante:  getAttr(node, 'TipoDeComprobante'),
    moneda:             getAttr(node, 'Moneda'),
    tipoCambio:         getAttr(node, 'TipoCambio'),
    subTotal:           getAttr(node, 'SubTotal'),
    descuento:          getAttr(node, 'Descuento'),
    total:              getAttr(node, 'Total'),
    lugarExpedicion:    getAttr(node, 'LugarExpedicion'),
    condicionesDePago:  getAttr(node, 'CondicionesDePago'),
    exportacion:        getAttr(node, 'Exportacion'),
    noCertificado:      getAttr(node, 'NoCertificado'),
    sello:              getAttr(node, 'Sello'),
  };
}

function extractEmisor(doc) {
  const node = getNode(doc, 'Emisor');
  if (!node) return null;
  return {
    rfc:          getAttr(node, 'Rfc'),
    nombre:       getAttr(node, 'Nombre'),
    regimenFiscal: getAttr(node, 'RegimenFiscal'),
  };
}

function extractReceptor(doc) {
  const node = getNode(doc, 'Receptor');
  if (!node) return null;
  return {
    rfc:                    getAttr(node, 'Rfc'),
    nombre:                 getAttr(node, 'Nombre'),
    usoCFDI:                getAttr(node, 'UsoCFDI'),
    regimenFiscalReceptor:  getAttr(node, 'RegimenFiscalReceptor'),
    domicilioFiscalReceptor: getAttr(node, 'DomicilioFiscalReceptor'),
    residenciaFiscal:       getAttr(node, 'ResidenciaFiscal'),
    numRegIdTrib:           getAttr(node, 'NumRegIdTrib'),
  };
}

/**
 * Impuestos hijos directos de un Concepto (no del Comprobante).
 * @param {Element} conceptoNode
 * @returns {{ traslados: object[], retenciones: object[] }}
 */
function extractImpuestosFromConcepto(conceptoNode) {
  const allImpuestos = getAllNodes(conceptoNode, 'Impuestos');
  const node = allImpuestos.find((n) => {
    const parentName = n.parentNode?.localName ?? '';
    return parentName === 'Concepto';
  }) ?? null;

  if (!node) return { traslados: [], retenciones: [] };

  const traslados = getAllNodes(node, 'Traslado').map((t) => ({
    base:       getAttr(t, 'Base'),
    impuesto:   getAttr(t, 'Impuesto'),
    tipoFactor: getAttr(t, 'TipoFactor'),
    tasaOCuota: getAttr(t, 'TasaOCuota'),
    importe:    getAttr(t, 'Importe'),
  }));

  const retenciones = getAllNodes(node, 'Retencion').map((r) => ({
    impuesto: getAttr(r, 'Impuesto'),
    importe:  getAttr(r, 'Importe'),
  }));

  return { traslados, retenciones };
}

function extractConceptos(doc) {
  const nodes = getAllNodes(doc, 'Concepto');
  return nodes.map((node) => ({
    claveProdServ:    getAttr(node, 'ClaveProdServ'),
    noIdentificacion: getAttr(node, 'NoIdentificacion'),
    cantidad:         getAttr(node, 'Cantidad'),
    claveUnidad:      getAttr(node, 'ClaveUnidad'),
    unidad:           getAttr(node, 'Unidad'),
    descripcion:      getAttr(node, 'Descripcion'),
    valorUnitario:    getAttr(node, 'ValorUnitario'),
    importe:          getAttr(node, 'Importe'),
    descuento:        getAttr(node, 'Descuento'),
    objetoImp:        getAttr(node, 'ObjetoImp'),
    impuestos:        extractImpuestosFromConcepto(node),
  }));
}

function extractImpuestos(doc) {
  // Buscamos el nodo Impuestos que es hijo DIRECTO del Comprobante (no el de Concepto).
  // Filtramos por parentNode.localName para evitar capturar el Impuestos de los Conceptos.
  const allImpuestos = getAllNodes(doc, 'Impuestos');
  const node = allImpuestos.find(n => {
    const parentName = n.parentNode?.localName ?? '';
    return parentName === 'Comprobante';
  }) ?? allImpuestos[0] ?? null;

  if (!node) return { totalImpuestosTrasladados: '', totalImpuestosRetenidos: '', traslados: [], retenciones: [] };

  const traslados = getAllNodes(node, 'Traslado').map(t => ({
    base:        getAttr(t, 'Base'),
    impuesto:    getAttr(t, 'Impuesto'),
    tipoFactor:  getAttr(t, 'TipoFactor'),
    tasaOCuota:  getAttr(t, 'TasaOCuota'),
    importe:     getAttr(t, 'Importe'),
  }));

  const retenciones = getAllNodes(node, 'Retencion').map(r => ({
    impuesto: getAttr(r, 'Impuesto'),
    importe:  getAttr(r, 'Importe'),
  }));

  return {
    totalImpuestosTrasladados: getAttr(node, 'TotalImpuestosTrasladados'),
    totalImpuestosRetenidos:   getAttr(node, 'TotalImpuestosRetenidos'),
    traslados,
    retenciones,
  };
}

function extractTimbre(doc) {
  const node = getNode(doc, 'TimbreFiscalDigital');
  if (!node) return null;
  return {
    uuid:              getAttr(node, 'UUID'),
    fechaTimbrado:     getAttr(node, 'FechaTimbrado'),
    rfcProvCertif:     getAttr(node, 'RfcProvCertif'),
    noCertificadoSAT:  getAttr(node, 'NoCertificadoSAT'),
    noCertificadoCFDI: getAttr(node, 'NoCertificadoCFDI'),
    // ADR-010: schema docs use SelloCFDI; real PAC TFD often emits SelloCFD
    selloCFDI:         getAttr(node, 'SelloCFDI') || getAttr(node, 'SelloCFD'),
    selloSAT:          getAttr(node, 'SelloSAT'),
  };
}

// ─── Task 3: Complemento de Recepción de Pagos 2.0 ──────────────────────────

function extractPago20(doc) {
  const pagosNode = getNode(doc, 'Pagos');
  if (!pagosNode) return null;

  // Totales del complemento de pagos
  const totalesNode = getNode(pagosNode, 'Totales');
  const totales = totalesNode ? {
    totalRetencionesIVA:     getAttr(totalesNode, 'TotalRetencionesIVA'),
    totalRetencionesISR:     getAttr(totalesNode, 'TotalRetencionesISR'),
    totalRetencionesIEPS:    getAttr(totalesNode, 'TotalRetencionesIEPS'),
    totalTrasladosBaseIVA16: getAttr(totalesNode, 'TotalTrasladosBaseIVA16'),
    totalTrasladosImpuestoIVA16: getAttr(totalesNode, 'TotalTrasladosImpuestoIVA16'),
    montoTotalPagos:         getAttr(totalesNode, 'MontoTotalPagos'),
  } : {};

  // Lista de pagos individuales
  const pagosArr = getAllNodes(pagosNode, 'Pago').map(pago => {
    const doctosRelacionados = getAllNodes(pago, 'DoctoRelacionado').map(doc => ({
      idDocumento:       getAttr(doc, 'IdDocumento'),
      serie:             getAttr(doc, 'Serie'),
      folio:             getAttr(doc, 'Folio'),
      monedaDR:          getAttr(doc, 'MonedaDR'),
      equivalenciaDR:    getAttr(doc, 'EquivalenciaDR'),
      numParcialidad:    getAttr(doc, 'NumParcialidad'),
      impSaldoAnt:       getAttr(doc, 'ImpSaldoAnt'),
      impPagado:         getAttr(doc, 'ImpPagado'),
      impSaldoInsoluto:  getAttr(doc, 'ImpSaldoInsoluto'),
      objetoImpDR:       getAttr(doc, 'ObjetoImpDR'),
    }));

    return {
      fechaPago:      getAttr(pago, 'FechaPago'),
      formaDePagoP:   getAttr(pago, 'FormaDePagoP'),
      monedaP:        getAttr(pago, 'MonedaP'),
      tipoCambioP:    getAttr(pago, 'TipoCambioP'),
      monto:          getAttr(pago, 'Monto'),
      numOperacion:   getAttr(pago, 'NumOperacion'),
      rfcEmisorCtaOrd: getAttr(pago, 'RfcEmisorCtaOrd'),
      ctaOrdenante:   getAttr(pago, 'CtaOrdenante'),
      rfcEmisorCtaBen: getAttr(pago, 'RfcEmisorCtaBen'),
      ctaBeneficiario: getAttr(pago, 'CtaBeneficiario'),
      nombreBancoOrdEnNom: getAttr(pago, 'NomBancoOrdExt') || getAttr(pago, 'NombreBancoOrdEnNom'),
      doctosRelacionados,
    };
  });

  return { totales, pagos: pagosArr };
}

// ─── Task 3: Complemento de Nómina 1.2 ──────────────────────────────────────

function extractNomina12(doc) {
  const nominaNode = getNode(doc, 'Nomina');
  if (!nominaNode) return null;

  const emisorNominaNode = getNode(nominaNode, 'Emisor');
  const emisor = emisorNominaNode ? {
    curp:             getAttr(emisorNominaNode, 'Curp'),
    registroPatronal: getAttr(emisorNominaNode, 'RegistroPatronal'),
    rfcPatronOrigen:  getAttr(emisorNominaNode, 'RfcPatronOrigen'),
  } : {};

  const receptorNode = getNode(nominaNode, 'Receptor');
  const receptor = receptorNode ? {
    curp:                   getAttr(receptorNode, 'Curp'),
    numSeguridadSocial:     getAttr(receptorNode, 'NumSeguridadSocial'),
    fechaInicioRelLaboral:  getAttr(receptorNode, 'FechaInicioRelLaboral'),
    antiguedad:             getAttr(receptorNode, 'Antiguedad'),
    tipoContrato:           getAttr(receptorNode, 'TipoContrato'),
    sindicalizado:          getAttr(receptorNode, 'Sindicalizado'),
    tipoJornada:            getAttr(receptorNode, 'TipoJornada'),
    tipoRegimen:            getAttr(receptorNode, 'TipoRegimen'),
    numEmpleado:            getAttr(receptorNode, 'NumEmpleado'),
    departamento:           getAttr(receptorNode, 'Departamento'),
    puesto:                 getAttr(receptorNode, 'Puesto'),
    riesgoPuesto:           getAttr(receptorNode, 'RiesgoPuesto'),
    periodicidadPago:       getAttr(receptorNode, 'PeriodicidadPago'),
    banco:                  getAttr(receptorNode, 'Banco'),
    cuentaBancaria:         getAttr(receptorNode, 'CuentaBancaria'),
    salarioBaseCotApor:     getAttr(receptorNode, 'SalarioBaseCotApor'),
    salarioDiarioIntegrado: getAttr(receptorNode, 'SalarioDiarioIntegrado'),
    claveEntFed:            getAttr(receptorNode, 'ClaveEntFed'),
  } : {};

  const percepcionesNode = getNode(nominaNode, 'Percepciones');
  const percepciones = percepcionesNode ? {
    totalSueldos:       getAttr(percepcionesNode, 'TotalSueldos'),
    totalSeparacionIndemnizacion: getAttr(percepcionesNode, 'TotalSeparacionIndemnizacion'),
    totalJubilacionPensionRetiro: getAttr(percepcionesNode, 'TotalJubilacionPensionRetiro'),
    totalGravado:       getAttr(percepcionesNode, 'TotalGravado'),
    totalExento:        getAttr(percepcionesNode, 'TotalExento'),
    detalle: getAllNodes(percepcionesNode, 'Percepcion').map(p => ({
      tipoPercepcion:     getAttr(p, 'TipoPercepcion'),
      clave:              getAttr(p, 'Clave'),
      concepto:           getAttr(p, 'Concepto'),
      importeGravado:     getAttr(p, 'ImporteGravado'),
      importeExento:      getAttr(p, 'ImporteExento'),
    })),
  } : {};

  const deduccionesNode = getNode(nominaNode, 'Deducciones');
  const deducciones = deduccionesNode ? {
    totalOtrasDeducciones:    getAttr(deduccionesNode, 'TotalOtrasDeducciones'),
    totalImpuestosRetenidos:  getAttr(deduccionesNode, 'TotalImpuestosRetenidos'),
    detalle: getAllNodes(deduccionesNode, 'Deduccion').map(d => ({
      tipoDeduccion:  getAttr(d, 'TipoDeduccion'),
      clave:          getAttr(d, 'Clave'),
      concepto:       getAttr(d, 'Concepto'),
      importe:        getAttr(d, 'Importe'),
    })),
  } : {};

  const otrosPagosNode = getNode(nominaNode, 'OtrosPagos');
  const otrosPagos = otrosPagosNode ? {
    detalle: getAllNodes(otrosPagosNode, 'OtroPago').map((o) => ({
      tipoOtroPago: getAttr(o, 'TipoOtroPago'),
      clave:        getAttr(o, 'Clave'),
      concepto:     getAttr(o, 'Concepto'),
      importe:      getAttr(o, 'Importe'),
    })),
  } : { detalle: [] };

  return {
    version:         getAttr(nominaNode, 'Version'),
    tipoNomina:      getAttr(nominaNode, 'TipoNomina'),
    fechaPago:       getAttr(nominaNode, 'FechaPago'),
    fechaInicialPago: getAttr(nominaNode, 'FechaInicialPago'),
    fechaFinalPago:  getAttr(nominaNode, 'FechaFinalPago'),
    numDiasPagados:  getAttr(nominaNode, 'NumDiasPagados'),
    totalPercepciones: getAttr(nominaNode, 'TotalPercepciones'),
    totalDeducciones:  getAttr(nominaNode, 'TotalDeducciones'),
    totalOtrosPagos:   getAttr(nominaNode, 'TotalOtrosPagos'),
    emisor,
    receptor,
    percepciones,
    deducciones,
    otrosPagos,
  };
}

// ─── Función principal de parseo ─────────────────────────────────────────────

/**
 * Parsea el contenido de texto de un XML CFDI y retorna un objeto de datos estructurado.
 *
 * @param {string} xmlText   - Contenido textual del archivo XML.
 * @param {string} [fileName=''] - Nombre del archivo (para mensajes de error descriptivos).
 * @returns {{ success: boolean, data?: object, error?: string, fileName: string }}
 */
export function parseCFDI(xmlText, fileName = '') {
  let doc;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlText, 'application/xml');
  } catch (parseException) {
    // @xmldom/xmldom lanza excepción en XML malformado (diferente al browser que retorna <parsererror>).
    return {
      success: false,
      error: 'Error al parsear estructura XML (parsererror)',
      detail: parseException?.message?.substring(0, 200) ?? '',
      fileName,
    };
  }

  // Detectar error de parseo (modo browser: DOMParser devuelve doc con <parsererror>)
  const parseError = doc.getElementsByTagName('parsererror');
  if (parseError.length > 0) {
    return {
      success: false,
      error: 'Error al parsear estructura XML (parsererror)',
      detail: parseError[0]?.textContent?.substring(0, 200) ?? '',
      fileName,
    };
  }

  // Validar que el nodo raíz sea un Comprobante CFDI
  const comprobante = extractComprobante(doc);
  if (!comprobante) {
    return {
      success: false,
      error: 'El nodo raíz no es un cfdi:Comprobante válido',
      fileName,
    };
  }

  // Extracción de los nodos principales
  const emisor   = extractEmisor(doc);
  const receptor = extractReceptor(doc);
  const conceptos = extractConceptos(doc);
  const impuestos = extractImpuestos(doc);
  const timbre   = extractTimbre(doc);

  // Complementos opcionales (Pago 2.0 y Nómina 1.2)
  const pago   = extractPago20(doc);
  const nomina = extractNomina12(doc);

  // ADR-010: fallback Comprobante@Sello when TFD sello CFDI attrs are absent
  if (timbre && !timbre.selloCFDI) {
    timbre.selloCFDI = comprobante.sello || '';
  }

  // Generación de URL del QR del SAT (requiere timbre); fe= uses resolved selloCFDI
  const qrUrl = timbre
    ? buildSatQrUrl(timbre.uuid, emisor?.rfc ?? '', receptor?.rfc ?? '', comprobante.total, timbre.selloCFDI)
    : '';

  return {
    success: true,
    fileName,
    comprobante,
    emisor,
    receptor,
    conceptos,
    impuestos,
    timbre,
    complementos: {
      pago:   pago   ?? null,
      nomina: nomina ?? null,
    },
    qrUrl,
  };
}
