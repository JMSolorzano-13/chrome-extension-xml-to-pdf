/**
 * @sdd-task: Task #1 - Módulo Directory Traversal
 * @sdd-spec: specs/spec-002-w7x-traversal-and-parsing/spec.md
 * @sdd-decision: ADR-002 - File System Access API para Acceso Local y Guardado Directo
 * @sdd-why: Recorrido recursivo 100% local usando File System Access API nativa del navegador.
 *           Sin dependencias externas. Cumple arquitectura Zero Cloud y MV3.
 * @human-debug: Si traverseDirectory no encuentra XMLs → verificar que el usuario dio permiso
 *               a la carpeta raíz correcta. Revisar línea 52 (filtro de extensión).
 */

/**
 * Realiza un recorrido recursivo de un DirectoryHandle buscando archivos .xml.
 *
 * @param {FileSystemDirectoryHandle} dirHandle  - Handle del directorio a explorar.
 * @param {string} [pathPrefix='']               - Ruta relativa acumulada para referencia (ej. "2026/Enero").
 * @returns {Promise<Array<{fileHandle: FileSystemFileHandle, dirHandle: FileSystemDirectoryHandle, relativePath: string, fileName: string}>>}
 */
export async function traverseDirectory(dirHandle, pathPrefix = '') {
  const results = [];

  try {
    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'directory') {
        // Recorrido recursivo hacia subcarpetas
        const subPath = pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name;
        const subResults = await traverseDirectory(entry, subPath);
        results.push(...subResults);

      } else if (entry.kind === 'file') {
        // Filtro insensible a mayúsculas: captura .xml, .XML, .Xml, etc.
        if (entry.name.toLowerCase().endsWith('.xml')) {
          results.push({
            fileHandle: entry,
            dirHandle: dirHandle,
            relativePath: pathPrefix ? `${pathPrefix}/${entry.name}` : entry.name,
            fileName: entry.name,
          });
        }
      }
    }
  } catch (err) {
    // Si una subcarpeta no tiene permisos o está vacía, no interrumpimos el lote.
    // Propagamos como warning en consola pero no como excepción de runtime.
    console.warn(`[traversal.js] Advertencia al leer directorio "${pathPrefix || 'raíz'}": ${err.message}`);
  }

  return results;
}
