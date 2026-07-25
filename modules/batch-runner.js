/**
 * @sdd-task: Task #1 - Módulo batch-runner.js
 * @sdd-spec: specs/spec-004-4l0-batch-ui-logging-memoria/spec.md
 * @sdd-decision: ADR-008 - Batch runner puro + DI + onProgress callback
 * @sdd-why: Orquestar traverse→parse→generate→write secuencialmente sin abortar el lote (ADR-005)
 *           y sin retener Blob/XML entre ítems (US-004 memoria).
 * @human-debug: Si el lote se detiene → revisar try/catch por ítem. Si RAM crece → no acumular blob/xmlText.
 */

import { traverseDirectory as defaultTraverse } from './traversal.js';
import { parseCFDI as defaultParse } from './parser.js';
import { generatePdf as defaultGenerate } from './pdf-generator.js';
import { writePdfBesideXml as defaultWrite } from './pdf-writer.js';

/**
 * Default: leer texto de un FileSystemFileHandle.
 * @param {FileSystemFileHandle} fileHandle
 * @returns {Promise<string>}
 */
async function defaultReadFileText(fileHandle) {
  const file = await fileHandle.getFile();
  return file.text();
}

/**
 * Verifica que las libs locales UMD estén disponibles (pdfmake + QR).
 * @param {object} [globals=globalThis]
 * @returns {boolean}
 */
export function areLocalLibsAvailable(globals = globalThis) {
  return (
    typeof globals?.pdfMake?.createPdf === 'function' &&
    typeof globals?.QRCode?.toDataURL === 'function'
  );
}

/**
 * Empuja solo metadatos ligeros de error (nunca blob/xmlText).
 * @param {Array<{fileName: string, error: string, detail?: string}>} errors
 * @param {string} fileName
 * @param {string} error
 * @param {string} [detail]
 */
function pushError(errors, fileName, error, detail) {
  const entry = { fileName: fileName || '', error: String(error || 'Error desconocido') };
  if (detail !== undefined && detail !== null && detail !== '') {
    entry.detail = String(detail);
  }
  errors.push(entry);
}

/**
 * Ejecuta el lote completo sobre un DirectoryHandle raíz.
 *
 * Memoria: procesamiento secuencial; tras cada paso pesado no se acumulan
 * xmlText/parsed/blob en el resultado — solo contadores + errors metadatos.
 *
 * @param {FileSystemDirectoryHandle} rootDirHandle
 * @param {{
 *   onProgress?: (p: { current: number, total: number, fileName: string }) => void,
 *   deps?: {
 *     traverseDirectory?: Function,
 *     parseCFDI?: Function,
 *     generatePdf?: Function,
 *     writePdfBesideXml?: Function,
 *     readFileText?: Function,
 *     pdfMake?: object,
 *     QRCode?: object
 *   }
 * }} [options]
 * @returns {Promise<{ processed: number, success: number, failed: number, errors: Array<{fileName: string, error: string, detail?: string}> }>}
 */
export async function runBatch(rootDirHandle, options = {}) {
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const deps = options.deps || {};

  const traverseDirectory = deps.traverseDirectory || defaultTraverse;
  const parseCFDI = deps.parseCFDI || defaultParse;
  const generatePdf = deps.generatePdf || defaultGenerate;
  const writePdfBesideXml = deps.writePdfBesideXml || defaultWrite;
  const readFileText = deps.readFileText || defaultReadFileText;

  const pdfDeps = {};
  if (deps.pdfMake) pdfDeps.pdfMake = deps.pdfMake;
  if (deps.QRCode) pdfDeps.QRCode = deps.QRCode;

  let success = 0;
  let failed = 0;
  const errors = [];

  let entries = [];
  try {
    entries = await traverseDirectory(rootDirHandle);
    if (!Array.isArray(entries)) {
      entries = [];
    }
  } catch (err) {
    // Traversal no debería throw (ADR-005), pero no abortamos el contrato público.
    return {
      processed: 0,
      success: 0,
      failed: 0,
      errors: [
        {
          fileName: '',
          error: 'Error al recorrer directorio',
          detail: err?.message || String(err),
        },
      ],
    };
  }

  const total = entries.length;

  for (let i = 0; i < total; i += 1) {
    const entry = entries[i];
    const fileName = entry?.fileName || '';
    const current = i + 1;

    if (onProgress) {
      try {
        onProgress({ current, total, fileName });
      } catch {
        // UI callback no debe abortar el lote
      }
    }

    try {
      // --- read ---
      let xmlText;
      try {
        xmlText = await readFileText(entry.fileHandle);
      } catch (readErr) {
        failed += 1;
        pushError(errors, fileName, 'Error al leer XML', readErr?.message || String(readErr));
        xmlText = null;
        continue;
      }

      // --- parse ---
      let parsed;
      try {
        parsed = parseCFDI(xmlText, fileName);
      } catch (parseErr) {
        failed += 1;
        pushError(errors, fileName, 'Excepción en parseCFDI', parseErr?.message || String(parseErr));
        xmlText = null;
        parsed = null;
        continue;
      }
      xmlText = null; // US-004: liberar texto XML antes del siguiente paso

      if (!parsed || parsed.success === false) {
        failed += 1;
        pushError(
          errors,
          fileName || parsed?.fileName || '',
          parsed?.error || 'Parseo fallido',
          parsed?.detail
        );
        parsed = null;
        continue;
      }

      // --- generate ---
      let pdfResult;
      try {
        pdfResult = await generatePdf(parsed, pdfDeps);
      } catch (genErr) {
        failed += 1;
        pushError(errors, fileName, 'Excepción en generatePdf', genErr?.message || String(genErr));
        parsed = null;
        pdfResult = null;
        continue;
      }
      parsed = null; // US-004: no retener objeto parseado

      if (!pdfResult || pdfResult.success === false) {
        failed += 1;
        pushError(
          errors,
          fileName || pdfResult?.fileName || '',
          pdfResult?.error || 'Generación PDF fallida',
          pdfResult?.detail
        );
        pdfResult = null;
        continue;
      }

      const blob = pdfResult.blob;
      pdfResult = null;

      // --- write ---
      let writeResult;
      try {
        writeResult = await writePdfBesideXml(entry.dirHandle, fileName, blob);
      } catch (writeErr) {
        failed += 1;
        pushError(errors, fileName, 'Excepción en writePdfBesideXml', writeErr?.message || String(writeErr));
        continue;
      }

      if (!writeResult || writeResult.success === false) {
        failed += 1;
        pushError(
          errors,
          fileName || writeResult?.fileName || '',
          writeResult?.error || 'Escritura PDF fallida',
          writeResult?.detail
        );
        continue;
      }

      success += 1;
      // blob sale de scope al final de la iteración — no se acumula
    } catch (unexpected) {
      failed += 1;
      pushError(errors, fileName, 'Error inesperado en lote', unexpected?.message || String(unexpected));
    }
  }

  // Resultado liviano: sin blob ni xmlText
  return {
    processed: total,
    success,
    failed,
    errors,
  };
}
