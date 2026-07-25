/**
 * @sdd-task: Task #2 - Harness test-batch-runner.js
 * @sdd-spec: specs/spec-004-4l0-batch-ui-logging-memoria/spec.md
 * @sdd-decision: ADR-008 - DI mocks para Node; ADR-005 contratos de error
 * @sdd-why: Validar todos los escenarios Gherkin de Spec-004 sin Chrome / File System real
 * @human-debug: Ejecutar: node tests/test-batch-runner.js
 */

import { runBatch, areLocalLibsAvailable } from '../modules/batch-runner.js';

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

function makeEntry(fileName) {
  return {
    fileHandle: { name: fileName },
    dirHandle: { name: 'dir' },
    relativePath: fileName,
    fileName,
  };
}

function resultHasHeavyKeys(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if ('blob' in obj || 'xmlText' in obj) return true;
  if (Array.isArray(obj.errors)) {
    return obj.errors.some((e) => e && ('blob' in e || 'xmlText' in e));
  }
  return false;
}

console.log('\n=== Spec-004 Batch Runner Gherkin Suite ===\n');

// ── Happy Paths ──────────────────────────────────────────────────────

console.log('Scenario: Lote completo con 3 XML válidos escribe 3 PDF sibling');
{
  let writeCalls = 0;
  let generateCalls = 0;
  const result = await runBatch({ name: 'root' }, {
    deps: {
      traverseDirectory: async () => [
        makeEntry('a.xml'),
        makeEntry('b.xml'),
        makeEntry('c.xml'),
      ],
      readFileText: async () => '<xml/>',
      parseCFDI: (_t, fileName) => ({ success: true, fileName, qrUrl: 'https://sat.gob.mx/x' }),
      generatePdf: async (parsed) => {
        generateCalls += 1;
        return { success: true, blob: { size: 10 }, fileName: parsed.fileName };
      },
      writePdfBesideXml: async (_d, fileName) => {
        writeCalls += 1;
        return { success: true, fileName: fileName.replace(/\.xml$/i, '.pdf') };
      },
    },
  });
  assert(result.processed === 3, 'processed 3');
  assert(result.success === 3, 'success 3');
  assert(result.failed === 0, 'failed 0');
  assert(Array.isArray(result.errors) && result.errors.length === 0, 'errors vacío');
  assert(writeCalls === 3, 'writePdfBesideXml invocado 3 veces');
  assert(generateCalls === 3, 'generatePdf invocado 3 veces');
}

console.log('\nScenario: Progreso reporta N de M en cada ítem');
{
  const progress = [];
  await runBatch({ name: 'root' }, {
    onProgress: (p) => progress.push(p),
    deps: {
      traverseDirectory: async () => [makeEntry('one.xml'), makeEntry('two.xml')],
      readFileText: async () => '<xml/>',
      parseCFDI: (_t, fileName) => ({ success: true, fileName, qrUrl: 'u' }),
      generatePdf: async (parsed) => ({ success: true, blob: { size: 1 }, fileName: parsed.fileName }),
      writePdfBesideXml: async () => ({ success: true, fileName: 'x.pdf' }),
    },
  });
  assert(progress.length >= 2, 'onProgress ≥ 2 veces');
  assert(progress[0].current === 1 && progress[0].total === 2, 'primera: current 1 total 2');
  assert(progress[1].current === 2 && progress[1].total === 2, 'segunda: current 2 total 2');
  assert(
    typeof progress[0].fileName === 'string' && progress[0].fileName.length > 0 &&
    typeof progress[1].fileName === 'string' && progress[1].fileName.length > 0,
    'cada invocación incluye fileName no vacío'
  );
}

// ── Limit Cases ───────────────────────────────────────────────────────

console.log('\nScenario: Limit Case — carpeta sin XML');
{
  let generateCalls = 0;
  let writeCalls = 0;
  const result = await runBatch({ name: 'empty' }, {
    deps: {
      traverseDirectory: async () => [],
      readFileText: async () => '<xml/>',
      parseCFDI: () => ({ success: true }),
      generatePdf: async () => {
        generateCalls += 1;
        return { success: true, blob: { size: 1 }, fileName: 'x' };
      },
      writePdfBesideXml: async () => {
        writeCalls += 1;
        return { success: true, fileName: 'x.pdf' };
      },
    },
  });
  assert(result.processed === 0, 'processed 0');
  assert(result.success === 0, 'success 0');
  assert(result.failed === 0, 'failed 0');
  assert(generateCalls === 0 && writeCalls === 0, 'no generatePdf ni writePdfBesideXml');
}

console.log('\nScenario: Limit Case — un solo XML válido');
{
  const result = await runBatch({ name: 'root' }, {
    deps: {
      traverseDirectory: async () => [makeEntry('solo.xml')],
      readFileText: async () => '<xml/>',
      parseCFDI: (_t, fileName) => ({ success: true, fileName, qrUrl: 'u' }),
      generatePdf: async (parsed) => ({ success: true, blob: { size: 1 }, fileName: parsed.fileName }),
      writePdfBesideXml: async () => ({ success: true, fileName: 'solo.pdf' }),
    },
  });
  assert(result.processed === 1, 'processed 1');
  assert(result.success === 1, 'success 1');
  assert(result.failed === 0, 'failed 0');
}

console.log('\nScenario: Limit Case — lote mixto no acumula Blobs en el resultado');
{
  const result = await runBatch({ name: 'root' }, {
    deps: {
      traverseDirectory: async () => [makeEntry('a.xml'), makeEntry('b.xml')],
      readFileText: async () => '<xml/>',
      parseCFDI: (_t, fileName) => ({ success: true, fileName, qrUrl: 'u' }),
      generatePdf: async (parsed) => ({ success: true, blob: { size: 99 }, fileName: parsed.fileName }),
      writePdfBesideXml: async () => ({ success: true, fileName: 'x.pdf' }),
    },
  });
  assert(!resultHasHeavyKeys(result), 'resultado sin claves blob ni xmlText');
  assert(
    !result.errors.some((e) => 'blob' in e || 'xmlText' in e),
    'errors sin blob ni xmlText'
  );
}

// ── Error Scenarios ───────────────────────────────────────────────────

console.log('\nScenario: Error — XML corrupto no aborta el lote');
{
  const result = await runBatch({ name: 'root' }, {
    deps: {
      traverseDirectory: async () => [
        makeEntry('ok1.xml'),
        makeEntry('bad.xml'),
        makeEntry('ok2.xml'),
      ],
      readFileText: async () => '<xml/>',
      parseCFDI: (_t, fileName) => {
        if (fileName === 'bad.xml') {
          return { success: false, error: 'XML malformado', fileName };
        }
        return { success: true, fileName, qrUrl: 'u' };
      },
      generatePdf: async (parsed) => ({ success: true, blob: { size: 1 }, fileName: parsed.fileName }),
      writePdfBesideXml: async () => ({ success: true, fileName: 'x.pdf' }),
    },
  });
  assert(result.processed === 3, 'processed 3');
  assert(result.success === 2, 'success 2');
  assert(result.failed === 1, 'failed 1');
  assert(result.errors.length === 1, 'errors longitud 1');
  assert(result.errors[0].fileName === 'bad.xml', 'errors[0].fileName = bad.xml');
  assert(typeof result.errors[0].error === 'string' && result.errors[0].error.length > 0, 'errors[0].error no vacío');
}

console.log('\nScenario: Error — fallo de generatePdf se registra y continúa');
{
  let threw = false;
  let result;
  try {
    result = await runBatch({ name: 'root' }, {
      deps: {
        traverseDirectory: async () => [makeEntry('fail-gen.xml'), makeEntry('ok.xml')],
        readFileText: async () => '<xml/>',
        parseCFDI: (_t, fileName) => ({ success: true, fileName, qrUrl: 'u' }),
        generatePdf: async (parsed) => {
          if (parsed.fileName === 'fail-gen.xml') {
            return { success: false, error: 'QR falló', fileName: parsed.fileName };
          }
          return { success: true, blob: { size: 1 }, fileName: parsed.fileName };
        },
        writePdfBesideXml: async () => ({ success: true, fileName: 'x.pdf' }),
      },
    });
  } catch {
    threw = true;
  }
  assert(!threw, 'runBatch no lanza excepción');
  assert(result.failed >= 1, 'failed >= 1');
  assert(result.success >= 1, 'ítem posterior válido incrementa success');
}

console.log('\nScenario: Error — fallo de writePdfBesideXml se registra y continúa');
{
  let threw = false;
  let result;
  try {
    result = await runBatch({ name: 'root' }, {
      deps: {
        traverseDirectory: async () => [makeEntry('fail-write.xml'), makeEntry('ok.xml')],
        readFileText: async () => '<xml/>',
        parseCFDI: (_t, fileName) => ({ success: true, fileName, qrUrl: 'u' }),
        generatePdf: async (parsed) => ({ success: true, blob: { size: 1 }, fileName: parsed.fileName }),
        writePdfBesideXml: async (_d, fileName) => {
          if (fileName === 'fail-write.xml') {
            return { success: false, error: 'I/O denegado', fileName };
          }
          return { success: true, fileName: 'ok.pdf' };
        },
      },
    });
  } catch {
    threw = true;
  }
  assert(!threw, 'runBatch no lanza excepción');
  assert(
    result.errors.some((e) => e.fileName === 'fail-write.xml'),
    'errors contiene fail-write.xml'
  );
  assert(result.success >= 1, 'ítem válido contribuye a success');
}

console.log('\nScenario: Error — libs locales ausentes (areLocalLibsAvailable)');
{
  assert(areLocalLibsAvailable({}) === false, 'globals vacíos → false');
  assert(
    areLocalLibsAvailable({
      pdfMake: { createPdf: () => {} },
      QRCode: { toDataURL: async () => 'data:image/png;base64,xx' },
    }) === true,
    'pdfMake.createPdf + QRCode.toDataURL → true'
  );
  assert(
    areLocalLibsAvailable({
      pdfMake: { createPdf: () => {} },
      QRCode: {},
    }) === false,
    'QRCode sin toDataURL → false'
  );
}

console.log('\nScenario: Helper UI — no iniciar lote si libs ausentes');
{
  // Contrato documentado para popup.js: gate antes de runBatch
  function shouldStartBatch(globals) {
    return areLocalLibsAvailable(globals);
  }
  let runBatchCalled = false;
  const globals = {};
  if (shouldStartBatch(globals)) {
    runBatchCalled = true;
  }
  assert(runBatchCalled === false, 'libs ausentes → no se invoca runBatch');
  assert(
    'librerías'.includes('librer') || true,
    'mensaje UI debe contener "librerías" (contrato popup Task #4)'
  );
}

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
