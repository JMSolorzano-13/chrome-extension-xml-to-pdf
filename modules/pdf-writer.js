/**
 * @sdd-task: Task #4 - Módulo pdf-writer.js
 * @sdd-spec: specs/spec-003-s4k-pdf-generator-pdfmake-qr/spec.md
 * @sdd-decision: ADR-002 - File System Access API; ADR-005 errores estructurados
 * @sdd-why: Persistir PDF en el mismo dirHandle / nombre base que el XML (Constitución §3)
 * @human-debug: Si write falla → revisar permiso del dirHandle y createWritable(); nunca throw
 */

/**
 * Derives sibling PDF file name from an XML file name (case-insensitive .xml).
 * @param {string} xmlFileName
 * @returns {string}
 */
export function derivePdfFileName(xmlFileName) {
  const name = String(xmlFileName ?? '');
  if (/\.xml$/i.test(name)) {
    return name.replace(/\.xml$/i, '.pdf');
  }
  return `${name}.pdf`;
}

/**
 * Writes a PDF Blob beside the source XML in the same directory handle.
 *
 * @param {FileSystemDirectoryHandle} dirHandle
 * @param {string} xmlFileName
 * @param {Blob} blob
 * @returns {Promise<{ success: boolean, fileName: string, error?: string, detail?: string }>}
 */
export async function writePdfBesideXml(dirHandle, xmlFileName, blob) {
  const pdfName = derivePdfFileName(xmlFileName);

  try {
    if (!dirHandle || typeof dirHandle.getFileHandle !== 'function') {
      return {
        success: false,
        error: 'dirHandle inválido o sin getFileHandle',
        fileName: pdfName,
      };
    }
    if (!blob || typeof blob.size !== 'number') {
      return {
        success: false,
        error: 'blob PDF inválido',
        fileName: pdfName,
      };
    }

    const fileHandle = await dirHandle.getFileHandle(pdfName, { create: true });
    const writable = await fileHandle.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }

    return { success: true, fileName: pdfName };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      error: 'Fallo al escribir PDF en disco',
      fileName: pdfName,
      detail,
    };
  }
}
