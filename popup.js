/**
 * @sdd-task: Task #4 - Wiring popup.js ES module + picker + lote
 * @sdd-spec: specs/spec-004-4l0-batch-ui-logging-memoria/spec.md
 * @sdd-decision: ADR-008 - Batch runner puro + popup ES module + progreso por callback
 * @sdd-why: Conectar showDirectoryPicker → runBatch con UI N de M, resumen y log de errores
 * @human-debug: Si no arranca el lote → verificar areLocalLibsAvailable / consola libs.
 *               Si picker cancela → AbortError es esperado (no error de lote).
 */

import { runBatch, areLocalLibsAvailable } from './modules/batch-runner.js';

const btnSelectFolder = document.getElementById('btnSelectFolder');
const statusContainer = document.getElementById('statusContainer');
const statusMessage = document.getElementById('statusMessage');
const progressSection = document.getElementById('progressSection');
const progressBar = document.getElementById('progressBar');
const progressLabel = document.getElementById('progressLabel');
const summaryBox = document.getElementById('summaryBox');
const errorLog = document.getElementById('errorLog');

function showStatus(text) {
  if (statusContainer) statusContainer.classList.remove('hidden');
  if (statusMessage) statusMessage.textContent = text;
}

function resetBatchUi() {
  if (progressSection) progressSection.classList.add('hidden');
  if (summaryBox) {
    summaryBox.classList.add('hidden');
    summaryBox.textContent = '';
  }
  if (errorLog) {
    errorLog.classList.add('hidden');
    errorLog.innerHTML = '';
  }
  if (progressBar) {
    progressBar.max = 1;
    progressBar.value = 0;
  }
  if (progressLabel) progressLabel.textContent = '0 de 0';
}

function updateProgress({ current, total, fileName }) {
  if (progressSection) progressSection.classList.remove('hidden');
  if (progressBar) {
    progressBar.max = Math.max(total, 1);
    progressBar.value = current;
  }
  if (progressLabel) {
    progressLabel.textContent = `${current} de ${total}`;
  }
  showStatus(`Procesando: ${fileName || '…'}`);
}

function renderSummary(result) {
  if (!summaryBox) return;
  summaryBox.classList.remove('hidden');
  summaryBox.textContent =
    `Procesados: ${result.processed} · Éxitos: ${result.success} · Fallos: ${result.failed}`;
}

function renderErrors(errors) {
  if (!errorLog) return;
  errorLog.innerHTML = '';
  if (!errors || errors.length === 0) {
    errorLog.classList.add('hidden');
    return;
  }
  errorLog.classList.remove('hidden');
  for (const item of errors) {
    const li = document.createElement('li');
    const name = item.fileName || '(sin nombre)';
    const err = item.error || 'Error';
    li.textContent = `${name} — ${err}`;
    errorLog.appendChild(li);
  }
}

async function handleSelectFolder() {
  resetBatchUi();

  if (!areLocalLibsAvailable(globalThis)) {
    showStatus('Error: No se pudieron cargar las librerías locales.');
    return;
  }

  if (typeof window.showDirectoryPicker !== 'function') {
    showStatus('Error: File System Access API no disponible en este navegador.');
    return;
  }

  let rootDirHandle;
  try {
    rootDirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (err) {
    if (err?.name === 'AbortError') {
      showStatus('Selección cancelada.');
      return;
    }
    showStatus(`Error al seleccionar carpeta: ${err?.message || err}`);
    return;
  }

  if (btnSelectFolder) btnSelectFolder.disabled = true;
  showStatus('Escaneando carpeta…');

  try {
    const result = await runBatch(rootDirHandle, {
      onProgress: updateProgress,
    });

    renderSummary(result);
    renderErrors(result.errors);

    if (result.processed === 0) {
      showStatus('No se encontraron archivos XML en la carpeta seleccionada.');
    } else if (result.failed === 0) {
      showStatus(`Lote completado: ${result.success} PDF generados.`);
    } else {
      showStatus(
        `Lote terminado con fallos: ${result.success} OK, ${result.failed} con error.`
      );
    }
  } catch (err) {
    showStatus(`Error inesperado en el lote: ${err?.message || err}`);
  } finally {
    if (btnSelectFolder) btnSelectFolder.disabled = false;
  }
}

if (!areLocalLibsAvailable(globalThis)) {
  console.error('Librerías locales no disponibles');
  showStatus('Error: No se pudieron cargar las librerías locales.');
}

if (btnSelectFolder) {
  btnSelectFolder.addEventListener('click', () => {
    handleSelectFolder();
  });
}
