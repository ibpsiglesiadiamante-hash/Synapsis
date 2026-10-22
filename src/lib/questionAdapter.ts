/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Question, Exam, Submission } from '../types';

/**
 * Normaliza una pregunta de forma segura en memoria (read-only adapter).
 * Preserva el ID original inmutable sin generar valores aleatorios destructivos.
 * Mapea tipos históricos como 'opcion_multiple' a 'multiple',
 * campos de texto alternativos ('enunciado' -> 'texto'),
 * y respuestas únicas legacy ('correcta' -> 'correctas').
 */
export function normalizeQuestion(raw: any, fallbackIdx: number = 0): Question {
  if (!raw || typeof raw !== 'object') {
    return {
      id: `fallback_q_${fallbackIdx}`,
      texto: 'Pregunta no válida',
      tipo: 'multiple',
      puntos: 10,
      opciones: [],
      correctas: []
    };
  }

  // Preservar ID existente intacto (NUNCA Math.random para evitar desincronizar respuestas)
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : `q_legacy_${fallbackIdx}`;

  // Mapear tipo de pregunta
  let tipo: Question['tipo'] = raw.tipo || 'multiple';
  if ((raw.tipo as string) === 'opcion_multiple') {
    tipo = 'multiple';
  }

  // Mapear texto: priorizar texto no vacío, o recuperar del campo histórico 'enunciado'
  const texto = typeof raw.texto === 'string' && raw.texto.trim()
    ? raw.texto
    : (typeof raw.enunciado === 'string' ? raw.enunciado : '');

  // Mapear puntos numéricos válidos
  let puntos = 10;
  if (typeof raw.puntos === 'number' && !isNaN(raw.puntos)) {
    puntos = raw.puntos;
  } else if (raw.puntos !== undefined && !isNaN(Number(raw.puntos))) {
    puntos = Number(raw.puntos);
  }

  // Mapear opciones
  const opciones: string[] = Array.isArray(raw.opciones) ? [...raw.opciones] : [];

  // Mapear correctas: si correctas está presente y tiene elementos, usarlas;
  // de lo contrario, si existe 'correcta' (índice único legacy), convertirlo a [correcta]
  let correctas: number[] = [];
  if (Array.isArray(raw.correctas) && raw.correctas.length > 0) {
    correctas = raw.correctas
      .map((c: any) => Number(c))
      .filter((n: number) => !isNaN(n));
  } else if (raw.correcta !== undefined && raw.correcta !== null && raw.correcta !== '' && !isNaN(Number(raw.correcta))) {
    correctas = [Number(raw.correcta)];
  }

  return {
    ...raw,
    id,
    tipo,
    texto,
    puntos,
    opciones,
    correctas,
    // Preservar metadatos opcionales para tipos compuestos
    opcionIds: Array.isArray(raw.opcionIds) ? [...raw.opcionIds] : undefined,
    enunciados: Array.isArray(raw.enunciados) ? [...raw.enunciados] : undefined,
    enunciadoIds: Array.isArray(raw.enunciadoIds) ? [...raw.enunciadoIds] : undefined,
    matchCorrectos: Array.isArray(raw.matchCorrectos) ? [...raw.matchCorrectos] : undefined,
    tableRows: Array.isArray(raw.tableRows) ? [...raw.tableRows] : undefined,
    columnas: Array.isArray(raw.columnas) ? [...raw.columnas] : undefined,
    tableColumns: Array.isArray(raw.tableColumns) ? [...raw.tableColumns] : undefined,
    tableOptions: Array.isArray(raw.tableOptions) ? [...raw.tableOptions] : undefined,
    palabrasCaja: Array.isArray(raw.palabrasCaja) ? [...raw.palabrasCaja] : undefined,
    maxRespuestas: typeof raw.maxRespuestas === 'number' ? raw.maxRespuestas : undefined,
  };
}

/**
 * Normaliza todas las preguntas de un examen para lectura segura en UI y calificación.
 */
export function normalizeExamQuestions(exam?: Exam | null): Question[] {
  if (!exam || !Array.isArray(exam.preguntas)) return [];
  return exam.preguntas.map((q, idx) => normalizeQuestion(q, idx));
}

export interface SubmissionIntegrityResult {
  hasOrphans: boolean;
  orphanKeys: string[];
  examQuestionIds: string[];
  isExamEmpty: boolean;
  isMissingAnswersWithGrade: boolean;
  hasOutOfRangeAnswers: boolean;
  outOfRangeDetails: string[];
  isBlocked: boolean;
  isWarning: boolean;
  reason?: string;
  warningReason?: string;
}

// Mantener compatibilidad retroactiva con llamadas a OrphanAnswerDetectionResult
export type OrphanAnswerDetectionResult = SubmissionIntegrityResult;

/**
 * Valida si una respuesta individual hace referencia a opciones o elementos inexistentes
 * según la estructura actual de la pregunta (por ejemplo, opciones reducidas post-entrega).
 * Tolera representaciones numéricas históricas (como '0' o 0).
 */
export function isAnswerOutOfRange(q: Question, ans: any): boolean {
  if (ans === undefined || ans === null || ans === '') return false;

  switch (q.tipo) {
    case 'multiple':
    case 'tf':
    case 'dropdown':
    case 'opcion_multiple': {
      const parsed = Number(ans);
      if (isNaN(parsed) || !Number.isInteger(parsed)) return true;
      const maxOptions = (q.opciones || []).length;
      return parsed < 0 || parsed >= maxOptions;
    }

    case 'checkbox': {
      if (!Array.isArray(ans)) return true;
      const maxOptions = (q.opciones || []).length;
      return ans.some(item => {
        const parsed = Number(item);
        return isNaN(parsed) || !Number.isInteger(parsed) || parsed < 0 || parsed >= maxOptions;
      });
    }

    case 'matching': {
      if (typeof ans !== 'object' || Array.isArray(ans)) return true;
      const totalEnunciados = (q.enunciados || []).length;
      const totalOpciones = (q.opciones || []).length;
      for (const [key, val] of Object.entries(ans)) {
        const eIdx = Number(key);
        const oIdx = Number(val);
        if (isNaN(eIdx) || !Number.isInteger(eIdx) || eIdx < 0 || eIdx >= totalEnunciados) return true;
        if (isNaN(oIdx) || !Number.isInteger(oIdx) || oIdx < 0 || oIdx >= totalOpciones) return true;
      }
      return false;
    }

    case 'table': {
      if (typeof ans !== 'object' || Array.isArray(ans)) return true;
      const rows = q.tableRows || [];
      const totalOpciones = (q.opciones || []).length;
      for (const [coord, val] of Object.entries(ans)) {
        const parts = coord.split('-');
        if (parts.length !== 2) return true;
        const rIdx = Number(parts[0]);
        const cIdx = Number(parts[1]);
        if (isNaN(rIdx) || isNaN(cIdx) || rIdx < 0 || rIdx >= rows.length) return true;
        const targetCell = rows[rIdx]?.cells?.[cIdx];
        if (!targetCell || targetCell.tipo !== 'blank') return true;
        const oIdx = Number(val);
        if (isNaN(oIdx) || !Number.isInteger(oIdx) || oIdx < 0 || oIdx >= totalOpciones) return true;
      }
      return false;
    }

    case 'table_matching': {
      if (typeof ans !== 'object' || Array.isArray(ans)) return true;
      const rows = q.tableRows || [];
      const totalOptions = (q.tableOptions || []).length;
      for (const [key, val] of Object.entries(ans)) {
        const rIdx = Number(key);
        const oIdx = Number(val);
        if (isNaN(rIdx) || !Number.isInteger(rIdx) || rIdx < 0 || rIdx >= rows.length) return true;
        if (isNaN(oIdx) || !Number.isInteger(oIdx) || oIdx < 0 || oIdx >= totalOptions) return true;
      }
      return false;
    }

    case 'abierta':
    case 'escala':
      return typeof ans !== 'string' && typeof ans !== 'number';

    default:
      return false;
  }
}

/**
 * Detecta respuestas huérfanas, inconsistencias estructurales o desajustes de versiones en una entrega.
 * 
 * Bloqueo Duro (Hard Block):
 * - Examen sin preguntas.
 * - Respuestas con IDs no existentes en el examen.
 * - Entregas históricas consolidadas sin desglose de respuestas pero con nota previa.
 * - Respuestas con índices u opciones fuera del rango válido actual.
 * 
 * Advertencia de Riesgo (Soft Warning):
 * - El examen fue actualizado después de la entrega (exam.actualizado > sub.fecha),
 *   pero todos los IDs y respuestas son compatibles y válidos dentro de rango.
 */
export function evaluateSubmissionIntegrity(
  sub?: Submission | null, 
  exam?: Exam | null
): SubmissionIntegrityResult {
  const examQuestions = normalizeExamQuestions(exam);
  const examQuestionIds = examQuestions.map(q => q.id);
  const isExamEmpty = examQuestions.length === 0;

  const studentAnswers = sub?.respuestas || {};
  const answerKeys = Object.keys(studentAnswers);
  const orphanKeys = answerKeys.filter(k => !examQuestionIds.includes(k));
  const hasOrphans = orphanKeys.length > 0;

  // Entrega histórica consolidada sin respuestas detalladas
  const isMissingAnswersWithGrade = answerKeys.length === 0 && 
    sub?.puntaje !== undefined && 
    sub?.puntaje !== null;

  // Validación de respuestas fuera de rango por tipo
  const outOfRangeDetails: string[] = [];
  if (!isExamEmpty && !isMissingAnswersWithGrade) {
    examQuestions.forEach(q => {
      const ans = studentAnswers[q.id];
      if (ans !== undefined && ans !== null && ans !== '') {
        if (isAnswerOutOfRange(q, ans)) {
          outOfRangeDetails.push(`Pregunta #${q.id} (${q.tipo}): índice u opción fuera de rango.`);
        }
      }
    });
  }
  const hasOutOfRangeAnswers = outOfRangeDetails.length > 0;

  // Bloqueo duro: corrupción o incompatibilidad estructural demostrada
  const isBlocked = isExamEmpty || hasOrphans || isMissingAnswersWithGrade || hasOutOfRangeAnswers;
  let reason: string | undefined = undefined;

  if (isExamEmpty) {
    reason = 'El examen actual no tiene preguntas registradas en el sistema.';
  } else if (hasOrphans) {
    reason = `La entrega contiene ${orphanKeys.length} respuesta(s) huérfana(s) no vinculadas a las preguntas del examen actual.`;
  } else if (isMissingAnswersWithGrade) {
    reason = `Esta entrega cuenta con una calificación histórica (${sub?.puntaje}%), pero no registra respuestas individuales desglosadas. Se bloquea el recálculo para impedir que sea sobrescrita a 0%.`;
  } else if (hasOutOfRangeAnswers) {
    reason = `La entrega contiene ${outOfRangeDetails.length} respuesta(s) con opciones eliminadas o fuera de rango. Se bloquea el recálculo para proteger la calificación.`;
  }

  // Advertencia de riesgo temporal (exam.actualizado > sub.fecha)
  // No bloquea la calificación manual de preguntas abiertas ni la persistencia si la estructura es compatible
  let isWarning = false;
  let warningReason: string | undefined = undefined;
  if (!isBlocked && exam?.actualizado && sub?.fecha) {
    const examTime = new Date(exam.actualizado).getTime();
    const subTime = new Date(sub.fecha).getTime();
    if (!isNaN(examTime) && !isNaN(subTime) && examTime > subTime) {
      isWarning = true;
      warningReason = `El examen fue actualizado (${exam.actualizado.slice(0, 10)}) después de la entrega del estudiante (${sub.fecha.slice(0, 10)}). Las preguntas son compatibles; se recomienda verificar antes de guardar.`;
    }
  }

  return {
    hasOrphans,
    orphanKeys,
    examQuestionIds,
    isExamEmpty,
    isMissingAnswersWithGrade,
    hasOutOfRangeAnswers,
    outOfRangeDetails,
    isBlocked,
    isWarning,
    reason,
    warningReason
  };
}

/**
 * Función exportada compatible con las implementaciones preexistentes.
 */
export function detectOrphanAnswers(
  sub?: Submission | null, 
  exam?: Exam | null
): SubmissionIntegrityResult {
  return evaluateSubmissionIntegrity(sub, exam);
}

export interface CompositeQuestionCount {
  totalQuestions: number;
  totalEvaluableItems: number;
  breakdown: Record<string, { count: number; items: number }>;
}

/**
 * Contador mejorado de preguntas compuestas:
 * Calcula tanto el número de preguntas macro como el número real de ítems evaluables
 * (por ejemplo, parejas en preguntas de relación 'matching' o celdas en blanco en 'table').
 */
export function countCompoundQuestions(exam?: Exam | null): CompositeQuestionCount {
  const questions = normalizeExamQuestions(exam);
  let totalEvaluableItems = 0;
  const breakdown: Record<string, { count: number; items: number }> = {};

  questions.forEach(q => {
    let itemsInQ = 1;

    if (q.tipo === 'matching') {
      itemsInQ = (q.enunciados && q.enunciados.length > 0) ? q.enunciados.length : 1;
    } else if (q.tipo === 'table') {
      let blanks = 0;
      (q.tableRows || []).forEach((row: any) => {
        (row.cells || []).forEach((cell: any) => {
          if (cell.tipo === 'blank') blanks++;
        });
      });
      itemsInQ = blanks > 0 ? blanks : 1;
    } else if (q.tipo === 'table_matching') {
      itemsInQ = (q.tableRows && q.tableRows.length > 0) ? q.tableRows.length : 1;
    }

    totalEvaluableItems += itemsInQ;

    if (!breakdown[q.tipo]) {
      breakdown[q.tipo] = { count: 0, items: 0 };
    }
    breakdown[q.tipo].count++;
    breakdown[q.tipo].items += itemsInQ;
  });

  return {
    totalQuestions: questions.length,
    totalEvaluableItems,
    breakdown
  };
}
