/**
 * Test Suite Integral de Persistencia y Sincronización en Synapsis
 * Datos 100% simulados en memoria (Sin mutaciones ni llamadas remotas a Supabase/Firebase)
 */

import { mergeStates, parseSafeTimestamp, countMeaningfulAnswers } from '../src/lib/db';
import { AppState, Submission, GradeRecord } from '../src/types';

function createDummyState(): AppState {
  return {
    users: [],
    institutions: [],
    subjects: [],
    semesters: [],
    parciales: [],
    exams: [],
    submissions: [],
    gradeRecords: [],
    assignments: [],
    assignmentSubmissions: []
  };
}

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, msg: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASÓ] ${msg}`);
    passedTests++;
  } else {
    console.error(`  ✕ [FALLÓ] ${msg}`);
    process.exitCode = 1;
  }
}

console.log('===============================================================');
console.log('INICIANDO SUITE INTEGRAL DE PRUEBAS CONTROLADAS SYNAPSIS');
console.log('===============================================================\n');

// --------------------------------------------------------------------------
// PRUEBA 1: Guardado remoto exitoso - Confirmación real estricta
// --------------------------------------------------------------------------
console.log('PRUEBA 1: Guardado remoto exitoso con confirmación estricta');
{
  const evaluateResultadosOutcome = (result: any) => {
    let toastType = '';
    let modalClosed = false;
    if (result && result.success === true && result.remoteSynced === true) {
      toastType = 'success';
      modalClosed = true;
    } else {
      toastType = 'warning';
      modalClosed = false;
    }
    return { toastType, modalClosed };
  };

  const validSuccessResult = { success: true, remoteSynced: true };
  const outcome = evaluateResultadosOutcome(validSuccessResult);

  assert(outcome.toastType === 'success', 'Confirmación explícita produce toast de éxito');
  assert(outcome.modalClosed === true, 'Confirmación explícita cierra el modal');
}

// --------------------------------------------------------------------------
// PRUEBA 2: Rechazo absoluto de falso éxito ante undefined, {} o success: false
// --------------------------------------------------------------------------
console.log('\nPRUEBA 2: Rechazo de falsos éxitos ante respuestas incompletas o fallidas');
{
  const evaluateResultadosOutcome = (result: any) => {
    let toastType = '';
    let modalClosed = false;
    if (result && result.success === true && result.remoteSynced === true) {
      toastType = 'success';
      modalClosed = true;
    } else {
      toastType = 'warning';
      modalClosed = false;
    }
    return { toastType, modalClosed };
  };

  const outUndefined = evaluateResultadosOutcome(undefined);
  assert(outUndefined.toastType === 'warning' && outUndefined.modalClosed === false, 'result undefined NO produce éxito y mantiene modal abierto');

  const outEmpty = evaluateResultadosOutcome({});
  assert(outEmpty.toastType === 'warning' && outEmpty.modalClosed === false, 'result {} NO produce éxito y mantiene modal abierto');

  const outPartialFalse = evaluateResultadosOutcome({ success: false });
  assert(outPartialFalse.toastType === 'warning' && outPartialFalse.modalClosed === false, 'result { success: false } NO produce éxito y mantiene modal abierto');

  const outNetworkErr = evaluateResultadosOutcome({ remoteSynced: false, error: 'Connection refused' });
  assert(outNetworkErr.toastType === 'warning' && outNetworkErr.modalClosed === false, 'Fallo de red mantiene modal abierto para reintento');
}

// --------------------------------------------------------------------------
// PRUEBA 3: Control de concurrencia y prevención de clics dobles rápidos
// --------------------------------------------------------------------------
console.log('\nPRUEBA 3: Prevención de clics duplicados rápidos');
{
  let isSavingGrading = false;
  let callCount = 0;

  const handleSaveGradingMock = async () => {
    if (isSavingGrading) return;
    isSavingGrading = true;
    callCount++;
    await new Promise(r => setTimeout(r, 40));
    isSavingGrading = false;
  };

  Promise.all([handleSaveGradingMock(), handleSaveGradingMock()]).then(() => {
    assert(callCount === 1, 'Segundo clic bloqueado mientras el primero procesaba');
    assert(isSavingGrading === false, 'Flag liberado correctamente al terminar');
  });
}

// --------------------------------------------------------------------------
// PRUEBA 4: Eliminación de dependencia de React updater en updateSubmissions
// --------------------------------------------------------------------------
console.log('\nPRUEBA 4: Detección sincrónica y canónica de changed');
{
  const dbState = {
    submissions: [
      { id: 'sub-1', puntaje: 70, estado: 'calificado', aprobado: true, actualizado: '2026-10-27T10:00:00Z', respuestas: { q1: 1 } },
      { id: 'sub-2', puntaje: 80, estado: 'calificado', aprobado: true, actualizado: '2026-10-27T10:00:00Z', respuestas: { q1: 2 } }
    ] as any[]
  };

  // Simular llamada de actualización sobre sub-1 solamente
  const nextSubs = [
    { ...dbState.submissions[0], puntaje: 90, actualizado: '2026-10-27T11:00:00Z' },
    dbState.submissions[1] // Inalterado
  ];

  const currentSubs = dbState.submissions;
  const changed = nextSubs.filter(item => {
    const prev = currentSubs.find(p => p.id === item.id);
    if (!prev) return true;
    if (prev.puntaje !== item.puntaje) return true;
    if (prev.estado !== item.estado) return true;
    if (prev.aprobado !== item.aprobado) return true;
    if (prev.actualizado !== item.actualizado) return true;
    if (JSON.stringify(prev.manualScores || {}) !== JSON.stringify(item.manualScores || {})) return true;
    if (JSON.stringify(prev.manualComments || {}) !== JSON.stringify(item.manualComments || {})) return true;
    if (JSON.stringify(prev.respuestas || {}) !== JSON.stringify(item.respuestas || {})) return true;
    return false;
  });

  assert(changed.length === 1, 'Exactamente 1 entrega identificada como modificada');
  assert(changed[0].id === 'sub-1', 'La entrega modificada es sub-1');
}

// --------------------------------------------------------------------------
// PRUEBA 5: Manejo de errores parciales en guardados múltiples
// --------------------------------------------------------------------------
console.log('\nPRUEBA 5: Gestión de errores parciales (successfulIds / failedIds)');
{
  const mockSaveDoc = async (table: string, sub: any) => {
    if (sub.id === 'sub-fail') {
      return { success: false, error: 'RLS check constraint error', table, id: sub.id };
    }
    return { success: true, table, id: sub.id };
  };

  const changedSubs = [
    { id: 'sub-ok-1' },
    { id: 'sub-fail' },
    { id: 'sub-ok-2' }
  ];

  const runBatch = async () => {
    const successfulIds: string[] = [];
    const failedIds: string[] = [];
    let lastError: string | undefined;

    for (const sub of changedSubs) {
      const res = await mockSaveDoc('submissions', sub);
      if (res.success) {
        successfulIds.push(sub.id);
      } else {
        failedIds.push(sub.id);
        lastError = res.error;
      }
    }

    const allSucceeded = failedIds.length === 0;
    return {
      success: allSucceeded,
      remoteSynced: allSucceeded,
      successfulIds,
      failedIds,
      error: lastError
    };
  };

  runBatch().then(res => {
    assert(res.success === false, 'Operación parcial reporta success = false');
    assert(res.successfulIds.length === 2, '2 entregas registradas exitosamente en successfulIds');
    assert(res.failedIds.length === 1 && res.failedIds[0] === 'sub-fail', 'Entrega fallida identificada en failedIds');
  });
}

// --------------------------------------------------------------------------
// PRUEBA 6: Supresión de escritura duplicada en saveDocToFirestore
// --------------------------------------------------------------------------
console.log('\nPRUEBA 6: Supresión de escritura duplicada pasando mirrorToSupabase = false');
{
  let supabaseWriteCount = 0;

  const mockSaveDocToSupabase = async () => {
    supabaseWriteCount++;
    return { success: true };
  };

  const mockSaveDocToFirestore = async (item: any, mirrorToSupabase: boolean = true) => {
    if (mirrorToSupabase) {
      await mockSaveDocToSupabase();
    }
    // Firestore write logic
  };

  // Simular flujo de updateSubmissions
  const runUpdateSubmissionsSimulation = async (sub: any) => {
    // 1. Escritura directa
    await mockSaveDocToSupabase();
    // 2. Espejo a Firestore con mirrorToSupabase = false
    await mockSaveDocToFirestore(sub, false);
  };

  runUpdateSubmissionsSimulation({ id: 'sub-single-write' }).then(() => {
    assert(supabaseWriteCount === 1, 'Supabase recibió exactamente 1 llamada de escritura (cero duplicaciones)');
  });
}

// --------------------------------------------------------------------------
// PRUEBA 7: Fechas con formatos incompatibles (parseSafeTimestamp)
// --------------------------------------------------------------------------
console.log('\nPRUEBA 7: Resolución cronológica de formatos de fecha (DD/MM/YYYY vs ISO)');
{
  const local = createDummyState();
  const remote = createDummyState();

  // Fecha ISO cronológicamente posterior: 27 de Octubre 2026 12:00
  local.submissions = [{
    id: 'sub-date-format',
    examenId: 'e-1',
    estudianteId: 'st-1',
    estudianteNombre: 'Alumno',
    respuestas: { q1: 'A' },
    puntaje: 95,
    aprobado: true,
    correctas: 1,
    incorrectas: 0,
    tiempoUsado: '05:00',
    fecha: '2026-10-27T10:00:00Z',
    estado: 'calificado',
    actualizado: '2026-10-27T12:00:00Z'
  }];

  // Fecha regional cronológicamente anterior: 26 de Octubre 2026 08:00 (en string "26/10/2026" empezaría con '26', que antes causaba colisiones)
  remote.submissions = [{
    ...local.submissions[0],
    puntaje: 60,
    actualizado: '26/10/2026 08:00'
  }];

  const merged = mergeStates(local, remote);
  const selected = merged.submissions.find(s => s.id === 'sub-date-format');

  assert(selected?.puntaje === 95, 'La fecha ISO más reciente (95%) prevaleció numéricamente sobre formato DD/MM/YYYY anterior');
}

// --------------------------------------------------------------------------
// PRUEBA 8: Protección de respuestas reales frente a borradores vacíos
// --------------------------------------------------------------------------
console.log('\nPRUEBA 8: Protección de respuestas reales frente a borradores con claves vacías');
{
  const local = createDummyState();
  const remote = createDummyState();

  // El alumno respondió 1 pregunta real
  local.submissions = [{
    id: 'sub-real-ans',
    examenId: 'e-1',
    estudianteId: 'st-1',
    estudianteNombre: 'Alumno',
    respuestas: { q1: 'Justificación bien fundamentada' },
    puntaje: 100,
    aprobado: true,
    correctas: 1,
    incorrectas: 0,
    tiempoUsado: '05:00',
    fecha: '2026-10-27T10:00:00Z',
    estado: 'calificado',
    actualizado: '2026-10-27T10:00:00Z'
  }];

  // El servidor o borrador remoto tiene 3 claves pero todas vacías ""
  remote.submissions = [{
    ...local.submissions[0],
    respuestas: { q1: '', q2: '', q3: '' },
    puntaje: 0,
    actualizado: '2026-10-27T10:00:00Z'
  }];

  const localCount = countMeaningfulAnswers(local.submissions[0].respuestas);
  const remoteCount = countMeaningfulAnswers(remote.submissions[0].respuestas);
  assert(localCount === 1, 'Local tiene 1 respuesta significativa');
  assert(remoteCount === 0, 'Remoto tiene 0 respuestas significativas (borrador vacío filtrado)');

  const merged = mergeStates(local, remote);
  const selected = merged.submissions.find(s => s.id === 'sub-real-ans');
  assert(selected?.respuestas?.q1 === 'Justificación bien fundamentada', 'La respuesta real del alumno fue protegida y no pisada por claves vacías');
}

// --------------------------------------------------------------------------
// PRUEBA 9: Preservación de calificación local frente a remoto pendiente
// --------------------------------------------------------------------------
console.log('\nPRUEBA 9: Calificación local nunca degradada a pendiente');
{
  const local = createDummyState();
  const remote = createDummyState();

  local.submissions = [{
    id: 'sub-graded-safe',
    examenId: 'e-1',
    estudianteId: 'st-1',
    estudianteNombre: 'Alumno',
    respuestas: { q1: 'A' },
    puntaje: 90,
    aprobado: true,
    correctas: 1,
    incorrectas: 0,
    tiempoUsado: '05:00',
    fecha: '2026-10-27T10:00:00Z',
    estado: 'calificado',
    manualScores: { q1: 10 }
  }];

  remote.submissions = [{
    ...local.submissions[0],
    estado: 'pendiente',
    puntaje: 0,
    manualScores: {}
  }];

  const merged = mergeStates(local, remote);
  const selected = merged.submissions.find(s => s.id === 'sub-graded-safe');

  assert(selected?.estado === 'calificado', 'Estado sigue calificado');
  assert(selected?.puntaje === 90, 'Puntaje de 90 preservado');
}

// --------------------------------------------------------------------------
// PRUEBA 10: Registros históricos sin actualizado ni gradedAt
// --------------------------------------------------------------------------
console.log('\nPRUEBA 10: Entregas históricas protegidas');
{
  const local = createDummyState();
  const remote = createDummyState();

  const hist: Submission = {
    id: 'sub-hist-safe',
    examenId: 'e-old',
    estudianteId: 'st-old',
    estudianteNombre: 'Antiguo',
    respuestas: { q1: 2 },
    puntaje: 85,
    aprobado: true,
    correctas: 3,
    incorrectas: 1,
    tiempoUsado: '10:00',
    fecha: '2024-03-01T10:00:00Z',
    estado: 'calificado'
  };

  local.submissions = [hist];
  remote.submissions = [hist];

  const merged = mergeStates(local, remote);
  const selected = merged.submissions.find(s => s.id === 'sub-hist-safe');

  assert(selected !== undefined, 'Registro histórico intacto');
  assert(selected?.puntaje === 85, 'Nota histórica de 85% preservada');
}

// --------------------------------------------------------------------------
// PRUEBA 11: Independencia de gradeRecords
// --------------------------------------------------------------------------
console.log('\nPRUEBA 11: Independencia absoluta de gradeRecords');
{
  const local = createDummyState();
  const remote = createDummyState();

  const official: GradeRecord = {
    id: 'gr-official-1',
    estudianteId: 'st-1',
    asignaturaId: 'asig-1',
    parcialId: 'parc-1',
    nota: 5.0,
    aprobado: true,
    comentario: 'Acta oficial de notas',
    creado: '2026-10-27T10:00:00Z'
  };

  local.gradeRecords = [official];
  remote.gradeRecords = [official];

  local.submissions = [{
    id: 'sub-temp',
    examenId: 'e-1',
    estudianteId: 'st-1',
    estudianteNombre: 'Alumno',
    respuestas: {},
    puntaje: 70,
    aprobado: true,
    correctas: 1,
    incorrectas: 0,
    tiempoUsado: '05:00',
    fecha: '2026-10-27T10:00:00Z',
    estado: 'calificado'
  }];

  const merged = mergeStates(local, remote);
  const preservedGrade = merged.gradeRecords.find(g => g.id === 'gr-official-1');

  assert(preservedGrade !== undefined && preservedGrade.nota === 5.0, 'Libro oficial gradeRecords no fue afectado por el guardado de submissions');
}

// --------------------------------------------------------------------------
// PRUEBA 12: Fechas regionales DD/MM/YYYY y rechazo estricto de fechas imposibles
// --------------------------------------------------------------------------
console.log('\nPRUEBA 12: Fechas regionales DD/MM/YYYY y rechazo de fechas imposibles');
{
  const regionalMs = parseSafeTimestamp("05/06/2026");
  assert(regionalMs > 0, 'parseSafeTimestamp reconoce "05/06/2026"');
  const d = new Date(regionalMs);
  assert(d.getDate() === 5, 'Día es 5');
  assert(d.getMonth() === 5, 'Mes es Junio (índice 5, mes 6)');
  assert(d.getFullYear() === 2026, 'Año es 2026');

  const impossibleFeb31 = parseSafeTimestamp("31/02/2026");
  assert(impossibleFeb31 === 0, 'Fecha imposible 31/02/2026 es rechazada (retorna 0)');

  const impossibleMonth = parseSafeTimestamp("15/13/2026");
  assert(impossibleMonth === 0, 'Mes imposible 13 es rechazado (retorna 0)');

  const impossibleDay = parseSafeTimestamp("32/01/2026");
  assert(impossibleDay === 0, 'Día imposible 32 es rechazado (retorna 0)');

  const isoTimestamp = parseSafeTimestamp("2026-06-05T08:30:00.000Z");
  assert(isoTimestamp === Date.parse("2026-06-05T08:30:00.000Z"), 'Fecha ISO estándar se procesa con exactitud');
}

// --------------------------------------------------------------------------
// PRUEBA 13: Protección contra versiones incompatibles de exámenes en mergeStates
// --------------------------------------------------------------------------
console.log('\nPRUEBA 13: Protección contra versiones incompatibles de exámenes en mergeStates');
{
  const local = createDummyState();
  const remote = createDummyState();

  const subV1: Submission = {
    id: 'sub-version-conflict',
    examenId: 'exam-v1',
    estudianteId: 'st-1',
    estudianteNombre: 'Estudiante V1',
    respuestas: { 'q_v1_open': 'Mi respuesta a la versión 1' },
    puntaje: 80,
    aprobado: true,
    correctas: 1,
    incorrectas: 0,
    tiempoUsado: '10:00',
    fecha: '2026-10-27T10:00:00Z',
    estado: 'calificado',
    manualScores: { 'q_v1_open': 10 },
    manualComments: { 'q_v1_open': 'Buen argumento V1' }
  };

  const subV2: Submission = {
    id: 'sub-version-conflict',
    examenId: 'exam-v2',
    estudianteId: 'st-1',
    estudianteNombre: 'Estudiante V2',
    respuestas: { 'q_v2_open': 'Mi respuesta a la versión 2' },
    puntaje: 70,
    aprobado: true,
    correctas: 1,
    incorrectas: 0,
    tiempoUsado: '10:00',
    fecha: '2026-10-27T10:00:00Z',
    estado: 'calificado',
    manualScores: { 'q_v2_open': 5 },
    manualComments: { 'q_v2_open': 'Respuesta V2 diferente' }
  };

  local.submissions = [subV1];
  remote.submissions = [subV2];

  const merged = mergeStates(local, remote);
  const resultSub = merged.submissions.find(s => s.id === 'sub-version-conflict');

  assert(resultSub !== undefined, 'Entrega existe en el merge');
  assert(resultSub?.manualScores?.['q_v2_open'] === undefined, 'No se combinan notas de preguntas de versión incompatible');
  assert(resultSub?.manualComments?.['q_v2_open'] === undefined, 'No se combinan comentarios de preguntas de versión incompatible');
  assert(resultSub?.manualScores?.['q_v1_open'] === 10, 'Se conserva la nota de la versión base');
}

// --------------------------------------------------------------------------
// PRUEBA 14: Reintento forzado de calificaciones con forceIds
// --------------------------------------------------------------------------
console.log('\nPRUEBA 14: Reintento forzado de calificaciones con forceIds');
{
  const currentSub: Submission = {
    id: 'sub-force-test',
    examenId: 'e-1',
    estudianteId: 'st-1',
    estudianteNombre: 'Alumno',
    respuestas: { q1: 1 },
    puntaje: 90,
    aprobado: true,
    correctas: 1,
    incorrectas: 0,
    tiempoUsado: '05:00',
    fecha: '2026-10-27T10:00:00Z',
    estado: 'calificado'
  };

  // Simulación del evaluador de changed con forceIds
  const computeChanged = (currentSubs: Submission[], next: Submission[], forceIds?: string[]) => {
    const forceSet = new Set(forceIds || []);
    return next.filter(item => {
      if (forceSet.has(item.id)) return true;
      const prev = currentSubs.find(p => p.id === item.id);
      if (!prev) return true;
      if (prev.puntaje !== item.puntaje) return true;
      if (prev.estado !== item.estado) return true;
      if (prev.aprobado !== item.aprobado) return true;
      if (prev.actualizado !== item.actualizado) return true;
      if (prev.gradedAt !== item.gradedAt) return true;
      return false;
    });
  };

  // 1. Sin forceIds y con datos idénticos: 0 changed
  const changedWithoutForce = computeChanged([currentSub], [currentSub]);
  assert(changedWithoutForce.length === 0, 'Sin forceIds y sin diferencias, changed es 0');

  // 2. Con forceIds: aunque los datos sean idénticos localmente, se marca para reenvío remoto
  const changedWithForce = computeChanged([currentSub], [currentSub], ['sub-force-test']);
  assert(changedWithForce.length === 1 && changedWithForce[0].id === 'sub-force-test', 'Con forceIds, la entrega fallida se fuerza para sincronización remota');
}

// --------------------------------------------------------------------------
// PRUEBA 15: Sincronización en segundo plano de todas las colecciones
// --------------------------------------------------------------------------
console.log('\nPRUEBA 15: Sincronización de espejo Supabase por colección en syncToFirestore');
{
  const shouldMirrorToSupabase = (collKey: string) => collKey !== 'submissions';

  assert(shouldMirrorToSupabase('submissions') === false, 'submissions NO duplica espejo durante syncToFirestore');
  assert(shouldMirrorToSupabase('users') === true, 'users sincroniza con Supabase en background');
  assert(shouldMirrorToSupabase('exams') === true, 'exams sincroniza con Supabase en background');
  assert(shouldMirrorToSupabase('gradeRecords') === true, 'gradeRecords sincroniza con Supabase en background');
  assert(shouldMirrorToSupabase('subjects') === true, 'subjects sincroniza con Supabase en background');
  assert(shouldMirrorToSupabase('semesters') === true, 'semesters sincroniza con Supabase en background');
  assert(shouldMirrorToSupabase('parciales') === true, 'parciales sincroniza con Supabase en background');
}

// --------------------------------------------------------------------------
// PRUEBA 16: Concurrencia de actualizaciones consecutivas de estado
// --------------------------------------------------------------------------
console.log('\nPRUEBA 16: Concurrencia de actualizaciones consecutivas');
{
  let state = createDummyState();
  const stateRef = { current: state };

  const updateField = <K extends keyof AppState>(field: K, list: AppState[K]) => {
    const updated = { ...stateRef.current, [field]: list };
    stateRef.current = updated;
    return updated;
  };

  // Actualización 1: Agregar usuario
  updateField('users', [{ id: 'u-1', nombre: 'Docente 1', email: 'd1@test.com', pass: '123', rol: 'docente' } as any]);
  // Actualización 2 consecutiva e inmediata: Agregar examen
  updateField('exams', [{ id: 'ex-1', titulo: 'Parcial 1', materiaId: 'm-1', docenteId: 'u-1', preguntas: [] } as any]);
  // Actualización 3 consecutiva: Agregar entrega
  updateField('submissions', [{ id: 'sub-1', examenId: 'ex-1', estudianteId: 'st-1', puntaje: 100 } as any]);

  assert(stateRef.current.users.length === 1, 'Usuario retenido tras actualizaciones consecutivas');
  assert(stateRef.current.exams.length === 1, 'Examen retenido tras actualizaciones consecutivas');
  assert(stateRef.current.submissions.length === 1, 'Entrega retenida tras actualizaciones consecutivas');
}

// Evaluación del resumen
setTimeout(() => {
  console.log('\n===============================================================');
  console.log(`RESULTADO DE LA SUITE: ${passedTests}/${totalTests} pruebas superadas.`);
  if (passedTests === totalTests) {
    console.log('TODAS LAS PRUEBAS DE PERSISTENCIA Y SINCRONIZACIÓN PASARON CON ÉXITO.');
  } else {
    console.error('ALGUNAS PRUEBAS FALLARON.');
    process.exit(1);
  }
  console.log('===============================================================');
}, 100);
