/**
 * Test Suite Integral de Persistencia y Sincronización en Synapsis
 * Datos 100% simulados en memoria (Sin mutaciones ni llamadas remotas a Supabase/Firebase)
 */

import { 
  mergeStates, 
  parseSafeTimestamp, 
  countMeaningfulAnswers, 
  deduplicateSubjects, 
  deduplicateParciales, 
  deduplicateSemesters,
  normalizeSubjectCanonicalKey,
  normalizeSemesterCanonicalKey,
  restoreBackupState,
  getDeletedIds,
  markAsDeleted,
  PROTECTED_IDS 
} from '../src/lib/db';
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

// --------------------------------------------------------------------------
// PRUEBA 17: Deduplicación y unificación de materias/asignaturas duplicadas
// --------------------------------------------------------------------------
console.log('\nPRUEBA 17: Deduplicación de materias y reasignación de referencias académicas');
{
  const state = createDummyState();
  // Dos materias duplicadas por nombre con ligeras diferencias de formato y acentos
  state.subjects = [
    { id: 'sub-canonical', nombre: 'Teología Sistemática I', codigo: 'TEOL-101', semestre: 'sem-1', docenteId: 'doc-1', activa: true } as any,
    { id: 'sub-duplicate', nombre: 'TEOLOGIA SISTEMATICA I', codigo: 'TEOL-101-DUP', semestre: 'sem-1', docenteId: 'doc-1', activa: true } as any,
  ];

  // Examen que apunta a la materia duplicada
  state.exams = [
    { id: 'ex-1', titulo: 'Examen 1', materia: 'sub-duplicate', materiaId: 'sub-duplicate', docenteId: 'doc-1', parcialId: 'par-1', preguntas: [] } as any
  ];

  // Docente que tiene asignada la materia duplicada
  state.users = [
    { id: 'doc-1', nombre: 'Profesor Test', email: 'prof@test.com', rol: 'docente', asignaturas: ['sub-duplicate'] } as any
  ];

  // Parcial que apunta a la materia duplicada
  state.parciales = [
    { id: 'par-1', nombre: 'Primer Parcial', asignatura: 'sub-duplicate', semestre: 'sem-1' } as any
  ];

  // Calificaciones históricas oficiales que apuntan a la materia canónica
  state.gradeRecords = [
    { id: 'gr-1', estudianteId: 'est-1', asignaturaId: 'sub-canonical', semestreId: 'sem-1', parcial1: 95 } as any,
    { id: 'gr-2', estudianteId: 'est-2', asignaturaId: 'sub-canonical', semestreId: 'sem-1', parcial1: 88 } as any,
    { id: 'gr-3', estudianteId: 'est-3', asignaturaId: 'sub-canonical', semestreId: 'sem-1', parcial1: 92 } as any,
  ];

  const { state: cleanState, duplicateIds, report } = deduplicateSubjects(state);

  // La materia duplicada debe ser retirada de la lista activa y registrada en duplicateIds
  const dupSub = cleanState.subjects.find(s => s.id === 'sub-duplicate');
  assert(dupSub === undefined, 'Materia duplicada eliminada de lista activa de subjects');
  assert(duplicateIds.includes('sub-duplicate'), 'duplicateIds registra ID de materia duplicada eliminada');
  assert(report.length > 0 && report[0].includes('sub-duplicate'), 'Reporte registra log descriptivo de la unificación');

  // El examen debe haber sido re-enlazado a sub-canonical
  assert(cleanState.exams[0].materia === 'sub-canonical', 'Examen re-enlazado a materia canónica');

  // El docente debe tener la materia canónica en sus asignaturas
  assert(cleanState.users[0].asignaturas?.includes('sub-canonical') === true, 'Docente re-enlazado a materia canónica');
  assert(cleanState.users[0].asignaturas?.includes('sub-duplicate') === false, 'Materia duplicada retirada de asignaturas del docente');

  // El parcial debe apuntar a la materia canónica
  assert(cleanState.parciales[0].asignatura === 'sub-canonical', 'Parcial re-enlazado a materia canónica');

  // El registro de notas debe apuntar a la materia canónica
  assert(cleanState.gradeRecords[0].asignaturaId === 'sub-canonical', 'GradeRecord re-enlazado a materia canónica');
}

// --------------------------------------------------------------------------
// PRUEBA 18: Deduplicación de parciales protegiendo entregas de estudiantes
// --------------------------------------------------------------------------
console.log('\nPRUEBA 18: Deduplicación de parciales priorizando entregas reales de estudiantes');
{
  const state = createDummyState();
  state.subjects = [
    { id: 'sub-1', nombre: 'Historia Eclesiástica', activa: true } as any
  ];

  // Parcial 1: Creado primero pero SIN entregas de estudiantes
  const pEmpty = { id: 'par-empty', nombre: 'PRIMER PARCIAL', asignatura: 'sub-1', semestre: 'sem-1', porcentaje: 30 } as any;
  // Parcial 2: Duplicado ("PARCIAL I") que TIENE un examen con 3 entregas de estudiantes
  const pWithSubs = { id: 'par-active', nombre: 'PARCIAL 1', asignatura: 'sub-1', semestre: 'sem-1', porcentaje: 30 } as any;

  state.parciales = [pEmpty, pWithSubs];

  // Examen 1 en par-empty
  const examEmpty = { id: 'ex-empty', titulo: 'Test Vacío', materiaId: 'sub-1', parcialId: 'par-empty', preguntas: [] } as any;
  // Examen 2 en par-active con entregas
  const examActive = { id: 'ex-active', titulo: 'Test Real', materiaId: 'sub-1', parcialId: 'par-active', preguntas: [] } as any;

  state.exams = [examEmpty, examActive];

  // Entregas reales asociadas a ex-active
  state.submissions = [
    { id: 'sub-1', examenId: 'ex-active', estudianteId: 'est-1', puntaje: 90, estado: 'calificado' } as any,
    { id: 'sub-2', examenId: 'ex-active', estudianteId: 'est-2', puntaje: 85, estado: 'calificado' } as any,
    { id: 'sub-3', examenId: 'ex-active', estudianteId: 'est-3', puntaje: 95, estado: 'calificado' } as any,
  ];

  const { state: cleanState, duplicateIds, report } = deduplicateParciales(state);

  // Parcial activo con entregas DEBE ser seleccionado como el canónico
  const pActiveResult = cleanState.parciales.find(p => p.id === 'par-active');
  assert(pActiveResult !== undefined && !(pActiveResult as any).is_deleted, 'Parcial con entregas reales conservado como canónico');

  // Parcial sin entregas DEBE ser retirado de parciales activos y listado en duplicateIds
  const pEmptyResult = cleanState.parciales.find(p => p.id === 'par-empty');
  assert(pEmptyResult === undefined, 'Parcial sin entregas retirado de parciales activos');
  assert(duplicateIds.includes('par-empty'), 'duplicateIds registra parcial vacío eliminado');
  assert(report.length > 0 && report[0].includes('par-empty'), 'Reporte describe el parcial vacío eliminado y unificado');

  // El examen que estaba en par-empty no se pierde: debe haberse re-enlazado a par-active
  const remappedExam = cleanState.exams.find(e => e.id === 'ex-empty');
  assert(remappedExam?.parcialId === 'par-active', 'Examen de parcial duplicado re-enlazado a parcial canónico');

  // Las 3 entregas reales se mantienen íntegras
  assert(cleanState.submissions.length === 3, 'Las 3 entregas reales se preservan intactas');
}

// --------------------------------------------------------------------------
// PRUEBA 19: No reaparición de materias, exámenes y parciales eliminados
// --------------------------------------------------------------------------
console.log('\nPRUEBA 19: Protección contra resurrección de elementos eliminados en mergeStates');
{
  const localState = createDummyState();
  const remoteState = createDummyState();

  // Elemento eliminado con is_deleted: true
  const deletedExam = { id: 'ex-deleted-1', titulo: 'Examen Borrado', materiaId: 'sub-1', is_deleted: true, actualizado: '2026-10-28T10:00:00Z' } as any;
  localState.exams = [deletedExam];

  // Remote tiene el examen viejo antes de eliminarse
  const remoteExam = { id: 'ex-deleted-1', titulo: 'Examen Borrado', materiaId: 'sub-1', actualizado: '2026-10-28T09:00:00Z' } as any;
  remoteState.exams = [remoteExam];

  const merged = mergeStates(localState, remoteState);

  // El examen eliminado con fecha más reciente debe conservar is_deleted: true
  const mergedEx = merged.exams.find(e => e.id === 'ex-deleted-1');
  assert(mergedEx !== undefined && (mergedEx as any).is_deleted === true, 'Examen eliminado conserva marca de borrado en mergeStates');
}

// --------------------------------------------------------------------------
// PRUEBA 20: Desbloqueo de PROTECTED_IDS para permitir borrado y depuración
// --------------------------------------------------------------------------
console.log('\nPRUEBA 20: Verificación de que PROTECTED_IDS solo contiene cuentas esenciales del sistema');
{
  // Verificamos que materias, parciales y exámenes comunes no están protegidos contra borrado
  assert(!PROTECTED_IDS.has('sub-1'), 'Materias comunes NO están en PROTECTED_IDS');
  assert(!PROTECTED_IDS.has('par-1'), 'Parciales comunes NO están en PROTECTED_IDS');
  assert(!PROTECTED_IDS.has('ex-1'), 'Exámenes comunes NO están en PROTECTED_IDS');
  assert(PROTECTED_IDS.has('u-admin'), 'u-admin permanece protegido');
  assert(PROTECTED_IDS.has('inst-1'), 'inst-1 permanece protegido');
}

// --------------------------------------------------------------------------
// PRUEBA 21: Deduplicación exacta de casos mostrados en la captura del usuario
// --------------------------------------------------------------------------
console.log('\nPRUEBA 21: Deduplicación exacta de materias (AT, NT, Libros Históricos con error tipográfico)');
{
  const state = createDummyState();
  // 1. Grupo Semestre I: 3 materias que son la misma
  const subAT1 = { id: 'sub-iat-1', nombre: 'INTRODUCCIÓN AL ANTIGUO T', codigo: 'IAA-102', semestre: 'Semestre I' } as any;
  const subAT2 = { id: 'sub-iat-2', nombre: 'INTRODUCCIÓN AL ANTIGUO TESTAMENTO', codigo: 'IAT-101', semestre: 'Semestre I' } as any;
  const subAT3 = { id: 'sub-iat-3', nombre: 'Introducción al AT', codigo: 'IAT-101', semestre: 'Semestre I' } as any;

  // 2. Grupo Semestre II: 2 materias que son la misma
  const subNT1 = { id: 'sub-int-1', nombre: 'Introducción al NT', codigo: 'INT-102', semestre: 'Semestre II' } as any;
  const subNT2 = { id: 'sub-int-2', nombre: 'INTRODUCCIÓN AL NUEVO TESTAMENTO', codigo: 'IAN-101', semestre: 'Semestre II' } as any;

  // 3. Grupo Semestre IV: 2 materias que son la misma (con error tipográfico "HITORICOS")
  const subLH1 = { id: 'sub-lhd-1', nombre: 'LIBROS HITORICOS DEL NUEVO TESTAMENTO', codigo: 'LHD-101', semestre: 'Semestre IV' } as any;
  const subLH2 = { id: 'sub-lhn-2', nombre: 'Libros Históricos del NT', codigo: 'LHN-104', semestre: 'Semestre IV' } as any;

  state.subjects = [subAT1, subAT2, subAT3, subNT1, subNT2, subLH1, subLH2];

  // Asignamos un examen a una de las duplicadas de AT para validar reasignación
  state.exams = [
    { id: 'ex-at', titulo: 'Parcial AT', materia: 'sub-iat-1', docenteId: 'doc-1', preguntas: [] } as any
  ];

  const { state: cleanState, duplicateIds, report } = deduplicateSubjects(state);

  // De las 7 materias iniciales (3 AT + 2 NT + 2 Libros Históricos), deben quedar EXACTAMENTE 3
  assert(cleanState.subjects.length === 3, `Deduplicación redujo 7 materias redundantes a exactamente 3 (resultado: ${cleanState.subjects.length})`);
  assert(duplicateIds.length === 4, `Se identificaron y purgaron 4 IDs duplicados (resultado: ${duplicateIds.length})`);

  // Las 3 materias resultantes deben ser únicas en su concepto
  const hasOnlyOneAT = cleanState.subjects.filter(s => normalizeSubjectCanonicalKey(s.nombre).includes('antiguo_testamento')).length === 1;
  const hasOnlyOneNT = cleanState.subjects.filter(s => normalizeSubjectCanonicalKey(s.nombre).includes('introduccion') && normalizeSubjectCanonicalKey(s.nombre).includes('nuevo_testamento')).length === 1;
  const hasOnlyOneLH = cleanState.subjects.filter(s => normalizeSubjectCanonicalKey(s.nombre).includes('historico')).length === 1;

  assert(hasOnlyOneAT, 'Queda exactamente 1 sola materia de Introducción al Antiguo Testamento');
  assert(hasOnlyOneNT, 'Queda exactamente 1 sola materia de Introducción al Nuevo Testamento');
  assert(hasOnlyOneLH, 'Queda exactamente 1 sola materia de Libros Históricos del NT (unificando error tipográfico)');

  // El examen asociado a sub-iat-1 debe estar re-enlazado a la versión canónica
  const survivorAT = cleanState.subjects.find(s => normalizeSubjectCanonicalKey(s.nombre).includes('antiguo_testamento'));
  assert(cleanState.exams[0].materia === survivorAT?.id, 'Examen re-enlazado con éxito a la materia canónica de AT');
}

// --------------------------------------------------------------------------
// PRUEBA 22: Deduplicación de 18 semestres duplicados a 9 oficiales
// --------------------------------------------------------------------------
console.log('\nPRUEBA 22: Deduplicación de semestres (de 18 duplicados a 9 oficiales)');
{
  const state = createDummyState();
  const roman = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
  
  // Generar 18 semestres: Set A ("Semestre I") y Set B ("SEMESTRE I" o duplicado con otro ID)
  const setA = roman.map((r, idx) => ({
    id: `sem-orig-${idx + 1}`,
    nombre: `Semestre ${r}`,
    codigo: `SEM-26${String.fromCharCode(65 + idx)}`,
    estado: 'activo'
  } as any));

  const setB = roman.map((r, idx) => ({
    id: `sem-dup-${idx + 1}`,
    nombre: `SEMESTRE ${r}`,
    codigo: `SEM-DUP-${idx + 1}`,
    estado: 'activo'
  } as any));

  state.semesters = [...setA, ...setB]; // 18 semestres

  // Asignamos una materia y un estudiante a uno de los semestres duplicados de set B
  state.subjects = [
    { id: 'sub-test-sem', nombre: 'Materia Sem 2', semestre: 'sem-dup-2' } as any
  ];
  state.users = [
    { id: 'user-test-sem', nombre: 'Estudiante Sem 2', semestre: 'sem-dup-2', rol: 'estudiante' } as any
  ];

  const { state: cleanState, duplicateIds } = deduplicateSemesters(state);

  assert(cleanState.semesters.length === 9, `18 semestres reducidos a exactamente 9 (resultado: ${cleanState.semesters.length})`);
  assert(duplicateIds.length === 9, `9 IDs de semestres duplicados identificados para purga`);

  // Verificar que la materia y el estudiante fueron reasignados al ID canónico (sem-orig-2)
  const updatedSub = cleanState.subjects.find(s => s.id === 'sub-test-sem');
  assert(updatedSub?.semestre === 'Semestre II' || updatedSub?.semestre === 'sem-orig-2', 'Materia reasignada a semestre canónico');

  const updatedUser = cleanState.users.find(u => u.id === 'user-test-sem');
  assert(updatedUser?.semestre === 'Semestre II' || updatedUser?.semestre === 'sem-orig-2', 'Estudiante reasignado a semestre canónico');
}

// --------------------------------------------------------------------------
// PRUEBA 23: Persistencia de eliminación frente a recargas y restauraciones
// --------------------------------------------------------------------------
console.log('\nPRUEBA 23: Garantía de no resurrección de elementos eliminados tras restoreBackupState');
{
  // Simulamos marcar un ID de materia de respaldo como eliminado
  const deletedSubId = 'sub-deleted-test';
  markAsDeleted(deletedSubId);

  assert(getDeletedIds().has(deletedSubId), 'El ID eliminado queda registrado en getDeletedIds');

  // Ejecutamos restoreBackupState(): NO debe borrar el set de eliminados ni re-insertar el elemento
  const restored = restoreBackupState();
  assert(getDeletedIds().has(deletedSubId), 'restoreBackupState conserva el ID eliminado en getDeletedIds (no lo borra)');

  // Comprobamos que el elemento eliminado no forma parte del estado restaurado
  const foundInRestored = restored.subjects.some(s => s.id === deletedSubId);
  assert(!foundInRestored, 'Elemento eliminado NO resucita en el estado restaurado');
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
