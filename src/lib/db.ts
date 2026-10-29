/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  User, Subject, Semester, Parcial, GradeRecord, Assignment, AssignmentSubmission, Institution, Exam, Submission, AppState 
} from '../types';
import { backupAppState } from '../data/backupData';
export { backupAppState };

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function now(): string {
  return new Date().toISOString();
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}

export function avatarColor(name: string): string {
  const colors = ['#1a56db', '#0f7b3e', '#b45309', '#7c3aed', '#0e7490', '#be185d'];
  let h = 0;
  const target = name || 'A';
  for (let i = 0; i < target.length; i++) {
    h = (h * 31 + target.charCodeAt(i)) % colors.length;
  }
  return colors[Math.abs(h)];
}

export function avatarLetter(name: string): string {
  return (name || '?').charAt(0).toUpperCase();
}

/**
 * Genera automáticamente un código único para un estudiante (4 caracteres alfanuméricos en mayúscula).
 */
export function generateStudentCode(existingUsers: User[] = []): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let attempts = 0;
  do {
    code = Array.from({ length: 4 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
    attempts++;
  } while (existingUsers.some(u => (u.codigo || '').toUpperCase() === code) && attempts < 1000);
  return code;
}

/**
 * Genera automáticamente un código para una asignatura basado en su nombre o secuencia (ej. MAT-101, QUI-102, ASG-103).
 */
export function generateSubjectCode(nombre: string, existingSubjects: Subject[] = []): string {
  try {
    // Limpiar nombre y remover acentos
    const clean = (nombre || '')
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9\s]/g, "");

    const words = clean.split(/\s+/).filter(Boolean);
    let prefix = 'ASG';

    if (words.length >= 3) {
      prefix = words.slice(0, 3).map(w => w[0]).join('');
    } else if (words.length === 2) {
      prefix = (words[0].substring(0, 2) + words[1].substring(0, 1)).padEnd(3, 'X');
    } else if (words.length === 1 && words[0].length >= 3) {
      prefix = words[0].substring(0, 3);
    } else if (words.length === 1 && words[0].length > 0) {
      prefix = words[0].padEnd(3, 'X');
    }

    if (!prefix || prefix.length < 3) {
      prefix = (prefix || 'ASG').padEnd(3, 'X');
    }

    // Filtrar de manera segura únicamente objetos válidos con código
    const safeList = Array.isArray(existingSubjects)
      ? existingSubjects.filter((s): s is Subject => Boolean(s && typeof s === 'object' && s.codigo))
      : [];

    let num = 101;
    while (safeList.some(s => (s.codigo || '').toUpperCase().trim() === `${prefix}-${num}`)) {
      num++;
    }

    return `${prefix}-${num}`;
  } catch (err) {
    console.warn('Error generating subject code safely, falling back:', err);
    return `ASG-${Math.floor(100 + Math.random() * 899)}`;
  }
}

/**
 * Genera automáticamente un código para un semestre basado en su nombre o el año actual (ej. SEM-26A, SEM-26B, SEM-27A).
 */
export function generateSemesterCode(nombre: string, existingSemesters: Semester[] = []): string {
  try {
    const currentYear = new Date().getFullYear();
    const yearSuffix = currentYear.toString().slice(-2); // "26"

    // Intentar detectar si el nombre contiene año (ej: 2026, 2027) y período (I, II, 1, 2, A, B)
    const clean = (nombre || '').trim().toUpperCase();
    const yearMatch = clean.match(/(?:20)?(\d{2})/);
    const detectedYear = yearMatch ? yearMatch[1] : yearSuffix;

    let period = 'A';
    if (clean.includes('-II') || clean.includes(' II') || clean.includes('-2') || clean.includes(' 2') || clean.includes('-B') || clean.includes(' B')) {
      period = 'B';
    } else if (clean.includes('-III') || clean.includes(' III') || clean.includes('-3') || clean.includes(' C')) {
      period = 'C';
    } else if (clean.includes('-I') || clean.includes(' I') || clean.includes('-1') || clean.includes(' A')) {
      period = 'A';
    } else {
      const safeSemesters = Array.isArray(existingSemesters)
        ? existingSemesters.filter((s): s is Semester => Boolean(s && typeof s === 'object'))
        : [];
      const countForYear = safeSemesters.filter(s => (s.codigo || '').includes(detectedYear)).length;
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      period = alphabet[countForYear % alphabet.length] || 'A';
    }

    let code = `SEM-${detectedYear}${period}`;
    let counter = 1;
    const safeSemesters = Array.isArray(existingSemesters)
      ? existingSemesters.filter((s): s is Semester => Boolean(s && typeof s === 'object' && s.codigo))
      : [];

    while (safeSemesters.some(s => (s.codigo || '').toUpperCase().trim() === code)) {
      code = `SEM-${detectedYear}${period}${counter}`;
      counter++;
    }

    return code;
  } catch (err) {
    console.warn('Error generating semester code safely, falling back:', err);
    return `SEM-${new Date().getFullYear().toString().slice(-2)}A`;
  }
}

export function sanitizeUserAsignaturas(users: User[], subjects: Subject[]): User[] {
  const validSubIds = new Set<string>();
  const nameToIdMap = new Map<string, string>();
  (subjects || []).forEach(s => {
    if (s && s.id) {
      validSubIds.add(s.id);
      if (s.nombre) {
        nameToIdMap.set(s.nombre.toLowerCase().trim(), s.id);
      }
    }
  });

  return (users || []).map(u => {
    if (!u) return u;
    const rawAsg = Array.isArray(u.asignaturas) ? u.asignaturas : [];
    const cleanAsg: string[] = [];

    rawAsg.forEach(asg => {
      if (!asg || typeof asg !== 'string') return;
      const cleanItem = asg.trim();
      // Explicitly remove phantom / invalid default IDs
      if (cleanItem === '1a098f29063_36705202' || cleanItem === '1a098f1b4d4_ae34adfd' || cleanItem === '1a098efffdd_ce06e4fb') {
        return;
      }
      if (cleanItem === 'sub-intro-at') {
        const intro = (subjects || []).find(s => (s.nombre || '').toLowerCase().includes('introducción al a.t') || s.codigo === 'IAT-101');
        if (intro) cleanAsg.push(intro.id);
        return;
      }
      if (validSubIds.has(cleanItem)) {
        cleanAsg.push(cleanItem);
      } else {
        const mappedId = nameToIdMap.get(cleanItem.toLowerCase());
        if (mappedId) {
          cleanAsg.push(mappedId);
        }
      }
    });

    return {
      ...u,
      asignaturas: Array.from(new Set(cleanAsg))
    };
  });
}

export function resolveStudentSemester(studentSem: string | undefined, semesters: Semester[]): Semester | undefined {
  if (!studentSem) return undefined;
  const clean = studentSem.toLowerCase().trim();
  return (semesters || []).find(s => 
    s && (
      s.id === studentSem || 
      (s.nombre && s.nombre.toLowerCase().trim() === clean) || 
      (s.codigo && s.codigo.toLowerCase().trim() === clean)
    )
  );
}

export function getStudentAssignedSubjects(student: User | null | undefined, subjects: Subject[], semesters: Semester[]): Subject[] {
  if (!student) return [];
  const userAsignaturas = student.asignaturas || [];
  const assignedByIdOrName = (subjects || []).filter(s => {
    if (!s || !s.id) return false;
    if (userAsignaturas.includes(s.id)) return true;
    if (userAsignaturas.some(asg => typeof asg === 'string' && asg.toLowerCase().trim() === (s.nombre || '').toLowerCase().trim())) return true;
    return false;
  });

  if (assignedByIdOrName.length > 0) {
    return assignedByIdOrName;
  }

  // Fallback: If student has a semester assigned, resolve the semester and return its curriculum subjects
  if (student.semestre) {
    const sem = resolveStudentSemester(student.semestre, semesters);
    const semName = sem?.nombre?.toLowerCase().trim() || student.semestre.toLowerCase().trim();
    const semId = sem?.id || student.semestre;
    const semesterSubs = (subjects || []).filter(s => {
      if (!s || !s.id) return false;
      const subSem = (s.semestre || '').toLowerCase().trim();
      return s.semestre === semId || (subSem && (subSem === semName || subSem.includes(semName) || semName.includes(subSem)));
    });
    if (semesterSubs.length > 0) {
      return semesterSubs;
    }
  }

  return [];
}

export function exportFullBackupState(state: AppState): void {
  try {
    const exportPayload = {
      metadata: {
        version: '2026.1',
        exportedAt: new Date().toISOString(),
        institution: state.institutions?.[0]?.nombre || 'Instituto Bíblico',
        summary: {
          subjects: state.subjects?.length || 0,
          semesters: state.semesters?.length || 0,
          parciales: state.parciales?.length || 0,
          users: state.users?.length || 0,
          exams: state.exams?.length || 0,
          gradeRecords: state.gradeRecords?.length || 0,
          assignments: state.assignments?.length || 0
        }
      },
      users: state.users || [],
      institutions: state.institutions || [],
      subjects: state.subjects || [],
      semesters: state.semesters || [],
      parciales: state.parciales || [],
      exams: state.exams || [],
      submissions: state.submissions || [],
      gradeRecords: state.gradeRecords || [],
      assignments: state.assignments || [],
      assignmentSubmissions: state.assignmentSubmissions || []
    };

    const jsonStr = JSON.stringify(exportPayload, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().split('T')[0];
    a.href = url;
    a.download = `respaldo_completo_instituto_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error exporting full backup:', err);
    throw err;
  }
}

export function validateAndParseBackup(jsonString: string): AppState {
  const parsed = JSON.parse(jsonString);
  const target = parsed.users ? parsed : (parsed.data || parsed);
  
  const ensureArray = <T>(val: any): T[] => Array.isArray(val) ? val : [];

  const restoredState: AppState = {
    users: ensureArray(target.users),
    institutions: ensureArray(target.institutions),
    subjects: ensureArray(target.subjects),
    semesters: ensureArray(target.semesters),
    parciales: ensureArray(target.parciales),
    exams: ensureArray(target.exams),
    submissions: ensureArray(target.submissions),
    gradeRecords: ensureArray(target.gradeRecords),
    assignments: ensureArray(target.assignments),
    assignmentSubmissions: ensureArray(target.assignmentSubmissions)
  };

  // Restore deleted IDs protection
  const backupIds = new Set<string>();
  const keys: (keyof AppState)[] = [
    'users', 'institutions', 'subjects', 'semesters', 'parciales',
    'exams', 'submissions', 'gradeRecords', 'assignments', 'assignmentSubmissions'
  ];
  keys.forEach(k => {
    (restoredState[k] as any[]).forEach(item => {
      if (item && item.id) backupIds.add(item.id);
    });
  });
  const existingDeleted = getDeletedIds();
  backupIds.forEach(id => existingDeleted.delete(id));
  try {
    safeStorage.setItem('ep_deleted_ids', JSON.stringify(Array.from(existingDeleted)));
  } catch (e) {
    console.warn('Failed to update ep_deleted_ids:', e);
  }

  saveState(restoredState);
  return restoredState;
}

export function restoreBackupState(): AppState {
  const backup = buildDefaultSeedData();
  const deletedIds = getDeletedIds();
  const keys: (keyof AppState)[] = [
    'users',
    'institutions',
    'subjects',
    'semesters',
    'parciales',
    'exams',
    'submissions',
    'gradeRecords',
    'assignments',
    'assignmentSubmissions'
  ];
  keys.forEach(k => {
    (backup[k] as any) = ((backup[k] || []) as any[]).filter(item => item && item.id && !deletedIds.has(item.id));
  });

  saveState(backup);
  return backup;
}

const memoryStore = new Map<string, string>();
export const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(key);
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch {}
    return memoryStore.get(key) ?? null;
  },
  setItem: (key: string, val: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, val);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, val);
        return;
      }
    } catch {}
    memoryStore.set(key, val);
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
        return;
      }
    } catch {}
    memoryStore.delete(key);
  }
};

export const PROTECTED_IDS = new Set<string>(['u-admin', 'u-1', 'inst-1', 'muecvgv0']);

export function buildDefaultSeedData(): AppState {
  return JSON.parse(JSON.stringify(backupAppState));
}

export function getDeletedIds(): Set<string> {
  try {
    const raw = safeStorage.getItem('ep_deleted_ids');
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    PROTECTED_IDS.forEach(id => set.delete(id));
    return set;
  } catch (e) {
    return new Set();
  }
}

export function markAsDeleted(id: string) {
  if (!id || PROTECTED_IDS.has(id)) return;
  try {
    const deleted = getDeletedIds();
    deleted.add(id);
    safeStorage.setItem('ep_deleted_ids', JSON.stringify(Array.from(deleted)));
  } catch (e) {
    console.error('Failed to mark entity as deleted', e);
  }
}

export function getInitialState(): AppState {
  const defaults = buildDefaultSeedData();
  const deletedIds = getDeletedIds();
  const isInitialized = safeStorage.getItem('ep_initialized') === 'true';

  try {
    const rawU = safeStorage.getItem('ep_users');
    const existingU: any[] = rawU ? JSON.parse(rawU) : [];
    const rawInst = safeStorage.getItem('ep_instituciones');
    const existingInst: any[] = rawInst ? JSON.parse(rawInst) : [];
    const hasPatricio = existingInst.some((i: any) => i.nombre && i.nombre.toUpperCase().includes('PATRICIO'));
    if (!isInitialized || existingU.length < 15 || !hasPatricio) {
      return restoreBackupState();
    }
  } catch (e) {
    return restoreBackupState();
  }

  const loadCollection = (key: string, defaultItems: any[] = []) => {
    try {
      const raw = safeStorage.getItem(key);
      if (raw !== null) {
        const loaded: any[] = JSON.parse(raw);
        if (Array.isArray(loaded)) {
          return loaded.filter(item => item && item.id && !deletedIds.has(item.id));
        }
      }
      return defaultItems.filter(item => item && item.id && !deletedIds.has(item.id));
    } catch (e) {
      return defaultItems.filter(item => item && item.id && !deletedIds.has(item.id));
    }
  };

  const rawUsers = loadCollection('ep_users', defaults.users);
  const institutions = loadCollection('ep_instituciones', defaults.institutions);
  const rawSubjects = loadCollection('ep_subjects', defaults.subjects);
  const rawSemesters = loadCollection('ep_semesters', defaults.semesters);
  const rawParciales = loadCollection('ep_parciales', defaults.parciales);
  const rawExams = loadCollection('ep_exams', defaults.exams);
  const rawSubmissions = loadCollection('ep_submissions', defaults.submissions);
  const rawGrades = loadCollection('ep_notas', defaults.gradeRecords);
  const assignments = loadCollection('ep_trabajos', defaults.assignments);
  const assignmentSubmissions = loadCollection('ep_entregas_trabajos', defaults.assignmentSubmissions);

  // Guarantee that all institutional completed evaluations (submissions) are present
  const defaultSubmissions = (defaults.submissions || []).filter(item => item && item.id && !deletedIds.has(item.id));
  const submisMap = new Map<string, Submission>();
  defaultSubmissions.forEach(s => submisMap.set(s.id, s));
  rawSubmissions.forEach(s => {
    if (!s || !s.id || deletedIds.has(s.id)) return;
    submisMap.set(s.id, s);
  });
  const submissions = Array.from(submisMap.values());

  // Guarantee that all institutional grade records are present
  const defaultGrades = (defaults.gradeRecords || []).filter(item => item && item.id && !deletedIds.has(item.id));
  const gradeMap = new Map<string, GradeRecord>();
  defaultGrades.forEach(g => gradeMap.set(g.id, g));
  rawGrades.forEach(g => {
    if (!g || !g.id || deletedIds.has(g.id)) return;
    gradeMap.set(g.id, g);
  });
  const gradeRecords = Array.from(gradeMap.values());

  // Guarantee that all students and staff from institute records are present
  const defaultUsers = (defaults.users || []).filter(item => item && item.id && !deletedIds.has(item.id));
  const userMap = new Map<string, User>();
  defaultUsers.forEach(u => userMap.set(u.id, u));
  rawUsers.forEach(u => {
    if (!u || !u.id || deletedIds.has(u.id)) return;
    const existing = userMap.get(u.id) || Array.from(userMap.values()).find(
      du => (du.cedula && u.cedula && du.cedula.trim() === u.cedula.trim()) ||
            (du.email && u.email && du.email.trim().toLowerCase() === u.email.trim().toLowerCase()) ||
            (du.codigo && u.codigo && du.codigo.trim().toUpperCase() === u.codigo.trim().toUpperCase())
    );
    if (existing) {
      const uAsg = Array.isArray(u.asignaturas) ? u.asignaturas : [];
      const exAsg = Array.isArray(existing.asignaturas) ? existing.asignaturas : [];
      const mergedAsg = uAsg.length > 0 ? uAsg : exAsg;
      const combined: User = {
        ...existing,
        ...u,
        id: existing.id,
        nombre: u.nombre || existing.nombre,
        cedula: u.cedula || existing.cedula,
        celular: u.celular || existing.celular,
        email: u.email || existing.email,
        codigo: u.codigo || existing.codigo,
        semestre: u.semestre || existing.semestre,
        asignaturas: mergedAsg
      };
      userMap.set(existing.id, combined);
      if (u.id !== existing.id) {
        userMap.delete(u.id);
      }
    } else {
      userMap.set(u.id, u);
    }
  });
  const users = Array.from(userMap.values());

  const subjects: Subject[] = isInitialized && rawSubjects.length > 0
    ? rawSubjects.filter(s => s && s.id && !deletedIds.has(s.id))
    : (() => {
        const defaultSubs = (defaults.subjects || []).filter(item => item && item.id && !deletedIds.has(item.id));
        const subMap = new Map<string, Subject>();
        defaultSubs.forEach(s => subMap.set(s.id, s));
        rawSubjects.forEach(s => {
          if (!s || !s.id || deletedIds.has(s.id)) return;
          subMap.set(s.id, s);
        });
        return Array.from(subMap.values());
      })();

  const semesters: Semester[] = isInitialized && rawSemesters.length > 0
    ? rawSemesters.filter(s => s && s.id && !deletedIds.has(s.id))
    : (() => {
        const defaultSems = (defaults.semesters || []).filter(item => item && item.id && !deletedIds.has(item.id));
        const semMap = new Map<string, Semester>();
        defaultSems.forEach(s => semMap.set(s.id, s));
        rawSemesters.forEach(s => {
          if (!s || !s.id || deletedIds.has(s.id)) return;
          semMap.set(s.id, s);
        });
        return Array.from(semMap.values());
      })();

  const exams: Exam[] = isInitialized && rawExams.length > 0
    ? rawExams.filter(e => e && e.id && !deletedIds.has(e.id))
    : (() => {
        const defaultExams = (defaults.exams || []).filter(item => item && item.id && !deletedIds.has(item.id));
        const examMap = new Map<string, Exam>();
        defaultExams.forEach(e => examMap.set(e.id, e));
        rawExams.forEach(e => {
          if (!e || !e.id || deletedIds.has(e.id)) return;
          examMap.set(e.id, e);
        });
        return Array.from(examMap.values());
      })();

  const parciales: Parcial[] = isInitialized && rawParciales.length > 0
    ? rawParciales.filter(p => p && p.id && !deletedIds.has(p.id))
    : (() => {
        const defaultParcs = (defaults.parciales || []).filter(item => item && item.id && !deletedIds.has(item.id));
        const parcMap = new Map<string, Parcial>();
        defaultParcs.forEach(p => parcMap.set(p.id, p));
        rawParciales.forEach(p => {
          if (!p || !p.id || deletedIds.has(p.id)) return;
          parcMap.set(p.id, p);
        });
        return Array.from(parcMap.values());
      })();

  const rawState: AppState = {
    users: sanitizeUserAsignaturas(users, subjects),
    institutions,
    subjects,
    semesters,
    parciales,
    exams,
    submissions,
    gradeRecords,
    assignments,
    assignmentSubmissions,
  };

  const { state: cleanSemDb } = deduplicateSemesters(rawState);
  const { state: cleanSubsDb } = deduplicateSubjects(cleanSemDb);
  const { state: cleanState } = deduplicateParciales(cleanSubsDb);

  saveState(cleanState);
  return cleanState;
}

/**
 * Normaliza cadenas de texto para comparación segura (sin acentos, minúsculas, espacios colapsados)
 */
export function normalizeString(str?: string): string {
  if (!str) return '';
  return str
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Clave canónica unificada para materias bíblicas/teológicas.
 * Resuelve abreviaturas comunes (AT / Antiguo Testamento / Antiguo T, NT / Nuevo Testamento),
 * errores ortográficos (hitoricos / historicos), numerales romanos y conectores.
 */
export function normalizeSubjectCanonicalKey(name?: string, codigo?: string): string {
  const norm = normalizeString(name);
  if (!norm && !codigo) return '';

  let key = norm;

  // Unificar abreviaturas bíblicas fundamentales
  key = key.replace(/\b(a\.?\s*t\.?|antiguo\s+t\b|antiguo\s+testamento)\b/g, 'antiguo_testamento');
  key = key.replace(/\b(n\.?\s*t\.?|nuevo\s+t\b|nuevo\s+testamento)\b/g, 'nuevo_testamento');

  // Corregir errores ortográficos / variantes comunes
  key = key.replace(/\bhitoric(o|a)s?\b/g, 'historico');
  key = key.replace(/\bhistoric(o|a)s?\b/g, 'historico');

  // Numerales romanos o cardinales
  key = key.replace(/\b(i|primer|primera|1)\b/g, '1');
  key = key.replace(/\b(ii|segundo|segunda|2)\b/g, '2');
  key = key.replace(/\b(iii|tercer|tercera|3)\b/g, '3');
  key = key.replace(/\b(iv|cuarto|cuarta|4)\b/g, '4');
  key = key.replace(/\b(v|quinto|quinta|5)\b/g, '5');

  // Teología propia vs Teología
  key = key.replace(/\bteologia\s+propia\b/g, 'teologia');

  // Remover palabras conectoras (de, del, la, el, los, las, y, e, al, en, sobre)
  key = key.replace(/\b(de|del|la|el|los|las|y|e|al|en|sobre)\b/g, ' ');

  // Limpiar caracteres no alfanuméricos y colapsar espacios
  key = key.replace(/[^a-z0-9]/g, ' ').trim().replace(/\s+/g, '_');

  return key;
}

/**
 * Clave canónica unificada para semestres (Semestre 1 a 9).
 */
export function normalizeSemesterCanonicalKey(name?: string): string {
  const norm = normalizeString(name);
  if (!norm) return '';
  if (/\b(1|i|primer|primero|1er)\b/i.test(norm) || norm.endsWith(' 1') || norm.endsWith(' i') || (norm.includes('sem-26a') && !norm.includes('sem-26a1'))) return 'semestre_1';
  if (/\b(2|ii|segundo|2do)\b/i.test(norm) || norm.endsWith(' 2') || norm.endsWith(' ii') || norm.includes('sem-26b')) return 'semestre_2';
  if (/\b(3|iii|tercer|tercero|3er)\b/i.test(norm) || norm.endsWith(' 3') || norm.endsWith(' iii') || norm.includes('sem-27b')) return 'semestre_3';
  if (/\b(4|iv|cuarto|4to)\b/i.test(norm) || norm.endsWith(' 4') || norm.endsWith(' iv') || norm.includes('sem-26e')) return 'semestre_4';
  if (/\b(5|v|quinto|5to)\b/i.test(norm) || norm.endsWith(' 5') || norm.endsWith(' v') || norm.includes('sem-26c')) return 'semestre_5';
  if (/\b(6|vi|sexto|6to)\b/i.test(norm) || norm.endsWith(' 6') || norm.endsWith(' vi') || norm.includes('sem-26d')) return 'semestre_6';
  if (/\b(7|vii|septimo|7mo)\b/i.test(norm) || norm.endsWith(' 7') || norm.endsWith(' vii') || norm.includes('sem-26f')) return 'semestre_7';
  if (/\b(8|viii|octavo|8vo)\b/i.test(norm) || norm.endsWith(' 8') || norm.endsWith(' viii') || norm.includes('sem-26g')) return 'semestre_8';
  if (/\b(9|ix|noveno|9no)\b/i.test(norm) || norm.endsWith(' 9') || norm.endsWith(' ix') || norm.includes('sem-26a1')) return 'semestre_9';
  return norm;
}

/**
 * Deduplica semestres redundantes (ej. 18 semestres en lugar de 9),
 * unificándolos a los 9 periodos canónicos oficiales y reasignando referencias.
 */
export function deduplicateSemesters(state: AppState): {
  state: AppState;
  duplicateIds: string[];
  report: string[];
} {
  const deletedIds = getDeletedIds();
  const semesters = (state.semesters || []).filter(s => s && s.id && !deletedIds.has(s.id));
  const duplicateIds: string[] = [];
  const report: string[] = [];
  const remapping = new Map<string, string>(); // duplicateId -> canonicalId
  const nameRemapping = new Map<string, string>(); // duplicateName -> canonicalName

  const groups = new Map<string, Semester[]>();
  semesters.forEach(s => {
    const key = normalizeSemesterCanonicalKey(s.nombre || s.codigo);
    if (!key) return;
    const list = groups.get(key) || [];
    list.push(s);
    groups.set(key, list);
  });

  const survivors: Semester[] = [];

  groups.forEach((group) => {
    if (group.length === 1) {
      survivors.push(group[0]);
      return;
    }

    // Clasificar semestre canónico
    const ranked = [...group].map(sem => {
      const subjectsLinked = (state.subjects || []).filter(s => s.semestre === sem.id || s.semestre === sem.nombre).length;
      const studentsLinked = (state.users || []).filter(u => u.semestre === sem.id || u.semestre === sem.nombre).length;
      const parcialesLinked = (state.parciales || []).filter(p => p.semestre === sem.id || p.semestre === sem.nombre).length;
      const isOfficialName = /^Semestre\s+(I|II|III|IV|V|VI|VII|VIII|IX)$/.test(sem.nombre || '');
      const score = (subjectsLinked * 10) + (studentsLinked * 5) + (parcialesLinked * 5) + (isOfficialName ? 50 : 0);
      return { sem, score };
    });

    ranked.sort((a, b) => b.score - a.score);
    const canonical = ranked[0].sem;
    survivors.push(canonical);

    for (let i = 1; i < ranked.length; i++) {
      const dup = ranked[i].sem;
      duplicateIds.push(dup.id);
      remapping.set(dup.id, canonical.id);
      if (dup.nombre && canonical.nombre) {
        nameRemapping.set(dup.nombre.toLowerCase().trim(), canonical.nombre);
      }
      markAsDeleted(dup.id);
      report.push(`Semestre duplicado unificado: "${dup.nombre}" (${dup.id}) -> "${canonical.nombre}" (${canonical.id})`);
    }
  });

  // Reasignar referencias en materias
  const updatedSubjects = (state.subjects || []).map(s => {
    if (!s) return s;
    const targetId = s.semestre ? remapping.get(s.semestre) : undefined;
    const targetName = s.semestre ? nameRemapping.get(s.semestre.toLowerCase().trim()) : undefined;
    if (targetId || targetName) {
      return { ...s, semestre: targetName || targetId || s.semestre };
    }
    return s;
  });

  // Reasignar referencias en estudiantes
  const updatedUsers = (state.users || []).map(u => {
    if (!u) return u;
    const targetId = u.semestre ? remapping.get(u.semestre) : undefined;
    const targetName = u.semestre ? nameRemapping.get(u.semestre.toLowerCase().trim()) : undefined;
    if (targetId || targetName) {
      return { ...u, semestre: targetName || targetId || u.semestre };
    }
    return u;
  });

  // Reasignar referencias en parciales
  const updatedParciales = (state.parciales || []).map(p => {
    if (!p) return p;
    const targetId = p.semestre ? remapping.get(p.semestre) : undefined;
    if (targetId) {
      return { ...p, semestre: targetId };
    }
    return p;
  });

  const nextState: AppState = {
    ...state,
    semesters: survivors,
    subjects: updatedSubjects,
    users: updatedUsers,
    parciales: updatedParciales
  };

  return { state: nextState, duplicateIds, report };
}

/**
 * Identifica el periodo canónico de un parcial (Parcial 1, 2, 3, 4, Final)
 */
export function normalizeParcialPeriod(name?: string): string {
  const norm = normalizeString(name);
  if (/\b(1|i|primer|primero|corte\s*1)\b/i.test(norm) || norm.endsWith(' 1') || norm.endsWith(' i')) return 'parcial_1';
  if (/\b(2|ii|segundo|corte\s*2)\b/i.test(norm) || norm.endsWith(' 2') || norm.endsWith(' ii')) return 'parcial_2';
  if (/\b(3|iii|tercer|tercero|corte\s*3)\b/i.test(norm) || norm.endsWith(' 3') || norm.endsWith(' iii')) return 'parcial_3';
  if (/\b(4|iv|cuarto|corte\s*4)\b/i.test(norm) || norm.endsWith(' 4') || norm.endsWith(' iv')) return 'parcial_4';
  if (norm.includes('final')) return 'parcial_final';
  return norm;
}

/**
 * Detecta y unifica materias o asignaturas duplicadas (por nombre canónico, abreviaturas o código)
 * conservando la versión canónica más completa y reasignando referencias de exámenes, usuarios y parciales.
 */
export function deduplicateSubjects(state: AppState): {
  state: AppState;
  duplicateIds: string[];
  report: string[];
} {
  const deletedIds = getDeletedIds();
  const subjects = (state.subjects || []).filter(s => s && s.id && !deletedIds.has(s.id));
  const duplicateIds: string[] = [];
  const report: string[] = [];
  const remapping = new Map<string, string>(); // duplicateId -> canonicalId

  // Agrupar materias por clave canónica normalizada y por código compartido
  const groups = new Map<string, Subject[]>();
  const codeToGroupKey = new Map<string, string>();

  subjects.forEach(s => {
    let key = normalizeSubjectCanonicalKey(s.nombre, s.codigo);
    const cleanCode = (s.codigo || '').trim().toUpperCase();

    if (cleanCode && codeToGroupKey.has(cleanCode)) {
      key = codeToGroupKey.get(cleanCode)!;
    } else if (cleanCode && key) {
      codeToGroupKey.set(cleanCode, key);
    }

    if (!key) return;
    const list = groups.get(key) || [];
    list.push(s);
    groups.set(key, list);
  });

  const survivors: Subject[] = [];

  groups.forEach((group) => {
    if (group.length === 1) {
      survivors.push(group[0]);
      return;
    }

    // Clasificar candidatos para elegir la versión canónica
    const ranked = [...group].map(sub => {
      const examsCount = (state.exams || []).filter(e => e.materia === sub.id || (e as any).materiaId === sub.id).length;
      const usersCount = (state.users || []).filter(u => Array.isArray(u.asignaturas) && u.asignaturas.includes(sub.id)).length;
      const parcialesCount = (state.parciales || []).filter(p => p.asignatura === sub.id).length;
      const gradeRecordsCount = (state.gradeRecords || []).filter(g => g.asignaturaId === sub.id).length;
      const hasCode = Boolean(sub.codigo && sub.codigo.trim());
      const titleBonus = (sub.nombre || '').includes('Testamento') ? 5 : 0;
      const score = (gradeRecordsCount * 20) + (examsCount * 10) + (usersCount * 5) + (parcialesCount * 2) + (hasCode ? 1 : 0) + titleBonus;
      return { sub, score };
    });

    ranked.sort((a, b) => b.score - a.score);
    const canonical = ranked[0].sub;
    survivors.push(canonical);

    // Los demás son duplicados
    for (let i = 1; i < ranked.length; i++) {
      const dup = ranked[i].sub;
      duplicateIds.push(dup.id);
      remapping.set(dup.id, canonical.id);
      markAsDeleted(dup.id);
      report.push(`Asignatura duplicada unificada: "${dup.nombre}" (${dup.id}) -> "${canonical.nombre}" (${canonical.id})`);
    }
  });

  // Reasignar referencias en exámenes
  const updatedExams = (state.exams || []).map(e => {
    const targetMateria = remapping.get(e.materia);
    const targetMateriaId = (e as any).materiaId ? remapping.get((e as any).materiaId) : undefined;
    if (targetMateria || targetMateriaId) {
      return {
        ...e,
        materia: targetMateria || targetMateriaId || e.materia,
        materiaId: targetMateriaId || targetMateria || (e as any).materiaId
      };
    }
    return e;
  });

  // Reasignar referencias en parciales
  const updatedParciales = (state.parciales || []).map(p => {
    const target = remapping.get(p.asignatura);
    if (target) {
      return { ...p, asignatura: target };
    }
    return p;
  });

  // Reasignar referencias en asignaturas asignadas a usuarios
  const updatedUsers = (state.users || []).map(u => {
    if (!Array.isArray(u.asignaturas)) return u;
    const remapped = Array.from(new Set(u.asignaturas.map(id => remapping.get(id) || id)));
    return { ...u, asignaturas: remapped };
  });

  // Reasignar referencias en registros de notas oficiales
  const updatedGradeRecords = (state.gradeRecords || []).map(gr => {
    const target = remapping.get(gr.asignaturaId);
    if (target) {
      return { ...gr, asignaturaId: target };
    }
    return gr;
  });

  // Reasignar referencias en trabajos
  const updatedAssignments = (state.assignments || []).map(a => {
    const target = a.asignatura ? remapping.get(a.asignatura) : undefined;
    if (target) {
      return { ...a, asignatura: target };
    }
    return a;
  });

  const nextState: AppState = {
    ...state,
    subjects: survivors,
    exams: updatedExams,
    parciales: updatedParciales,
    users: updatedUsers,
    gradeRecords: updatedGradeRecords,
    assignments: updatedAssignments,
  };

  return { state: nextState, duplicateIds, report };
}

/**
 * Detecta y elimina parciales duplicados para la misma asignatura/periodo,
 * protegiendo prioritariamente aquellos que ya tienen exámenes y entregas presentadas por estudiantes.
 * Los exámenes vinculados a los parciales duplicados se reasocian automáticamente al parcial canónico.
 */
export function deduplicateParciales(state: AppState): {
  state: AppState;
  duplicateIds: string[];
  report: string[];
} {
  const deletedIds = getDeletedIds();
  const parciales = (state.parciales || []).filter(p => p && p.id && !deletedIds.has(p.id));
  const duplicateIds: string[] = [];
  const report: string[] = [];
  const remapping = new Map<string, string>(); // duplicateId -> canonicalId

  // Agrupar por asignatura y periodo normalizado
  const groups = new Map<string, Parcial[]>();
  parciales.forEach(p => {
    const asigKey = p.asignatura || 'sin_asignatura';
    const periodKey = normalizeParcialPeriod(p.nombre);
    const key = `${asigKey}__${periodKey}`;
    const list = groups.get(key) || [];
    list.push(p);
    groups.set(key, list);
  });

  const survivors: Parcial[] = [];

  groups.forEach((group) => {
    if (group.length === 1) {
      survivors.push(group[0]);
      return;
    }

    // Evaluar cada parcial del grupo para priorizar entregas reales de estudiantes
    const ranked = group.map(p => {
      const examsLinked = (state.exams || []).filter(e => e.parcialId === p.id);
      const studentSubs = (state.submissions || []).filter(s => examsLinked.some(e => e.id === s.examenId));
      const gradeRecords = (state.gradeRecords || []).filter(g => g.parcialId === p.id);
      const assignments = (state.assignments || []).filter(a => a.parcialId === p.id);

      // Prioridad máxima: entregas de estudiantes > actas oficiales > exámenes creados > tareas
      const score = (studentSubs.length * 1000) + (gradeRecords.length * 500) + (examsLinked.length * 10) + (assignments.length * 5);
      return {
        p,
        score,
        studentSubsCount: studentSubs.length,
        examsCount: examsLinked.length,
        gradeRecordsCount: gradeRecords.length
      };
    });

    ranked.sort((a, b) => b.score - a.score);
    const canonical = ranked[0].p;
    survivors.push(canonical);

    // Los parciales restantes son duplicados (especialmente aquellos con 0 entregas)
    for (let i = 1; i < ranked.length; i++) {
      const dup = ranked[i];
      duplicateIds.push(dup.p.id);
      remapping.set(dup.p.id, canonical.id);
      markAsDeleted(dup.p.id);
      report.push(
        `Parcial duplicado eliminado: "${dup.p.nombre}" (ID: ${dup.p.id}, ${dup.studentSubsCount} entregas de alumnos) -> Unificado en "${canonical.nombre}" (ID: ${canonical.id}, ${ranked[0].studentSubsCount} entregas)`
      );
    }
  });

  // Reasociar exámenes que apuntaban a parciales duplicados hacia el parcial canónico
  const updatedExams = (state.exams || []).map(e => {
    if (e.parcialId && remapping.has(e.parcialId)) {
      return { ...e, parcialId: remapping.get(e.parcialId)! };
    }
    return e;
  });

  const updatedGradeRecords = (state.gradeRecords || []).map(gr => {
    if (gr.parcialId && remapping.has(gr.parcialId)) {
      return { ...gr, parcialId: remapping.get(gr.parcialId)! };
    }
    return gr;
  });

  const updatedAssignments = (state.assignments || []).map(a => {
    if (a.parcialId && remapping.has(a.parcialId)) {
      return { ...a, parcialId: remapping.get(a.parcialId)! };
    }
    return a;
  });

  const nextState: AppState = {
    ...state,
    parciales: survivors,
    exams: updatedExams,
    gradeRecords: updatedGradeRecords,
    assignments: updatedAssignments,
  };

  return { state: nextState, duplicateIds, report };
}

export function saveState(state: AppState) {
  try {
    const deletedIds = getDeletedIds();

    const filterAlive = (list: any[] = []) => {
      if (!Array.isArray(list)) return [];
      return list.filter(item => item && item.id && !deletedIds.has(item.id));
    };

    safeStorage.setItem('ep_users', JSON.stringify(filterAlive(state.users)));
    safeStorage.setItem('ep_instituciones', JSON.stringify(filterAlive(state.institutions)));
    safeStorage.setItem('ep_subjects', JSON.stringify(filterAlive(state.subjects)));
    safeStorage.setItem('ep_semesters', JSON.stringify(filterAlive(state.semesters)));
    safeStorage.setItem('ep_parciales', JSON.stringify(filterAlive(state.parciales)));
    safeStorage.setItem('ep_exams', JSON.stringify(filterAlive(state.exams)));
    safeStorage.setItem('ep_submissions', JSON.stringify(filterAlive(state.submissions)));
    safeStorage.setItem('ep_notas', JSON.stringify(filterAlive(state.gradeRecords)));
    safeStorage.setItem('ep_trabajos', JSON.stringify(filterAlive(state.assignments)));
    safeStorage.setItem('ep_entregas_trabajos', JSON.stringify(filterAlive(state.assignmentSubmissions || [])));
    safeStorage.setItem('ep_initialized', 'true');
  } catch (e) {
    console.warn('Unable to persist full state to localStorage:', e);
  }
}

/**
 * Parses timestamps safely across multiple formats (ISO, epoch, regional DD/MM/YYYY)
 * to avoid lexical string comparison errors and regional date ambiguities.
 */
export function parseSafeTimestamp(val?: string | number | null): number {
  if (!val) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const str = String(val).trim();
  if (!str) return 0;
  if (/^\d+$/.test(str)) {
    const num = Number(str);
    return isNaN(num) ? 0 : num;
  }

  // 1. Prioritize regional DD/MM/YYYY (or DD-MM-YYYY) before Date.parse to avoid V8 MM/DD/YYYY misinterpretation
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const hour = Number(dmyMatch[4] || 0);
    const minute = Number(dmyMatch[5] || 0);
    const second = Number(dmyMatch[6] || 0);

    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) {
      return 0;
    }
    const d = new Date(year, month - 1, day, hour, minute, second);
    // Reject impossible calendar dates (e.g. 31/02/2026 rolls over to March)
    if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
      return 0;
    }
    return d.getTime();
  }

  // 2. Standard ISO 8601 or other standard formats
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) return parsed;

  return 0;
}

/**
 * Counts non-empty answers to prevent empty draft payloads from overwriting real student responses
 */
export function countMeaningfulAnswers(resObj: Record<string, any> = {}): number {
  if (!resObj || typeof resObj !== 'object') return 0;
  return Object.values(resObj).filter(v => {
    if (v === undefined || v === null || v === '') return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === 'object' && Object.keys(v).length === 0) return false;
    return true;
  }).length;
}

export function mergeStates(local: AppState, remote: AppState): AppState {
  const defaults = buildDefaultSeedData();
  const deletedIds = getDeletedIds();
  const merged: AppState = { ...remote };

  const keys: (keyof AppState)[] = [
    'users',
    'institutions',
    'subjects',
    'semesters',
    'parciales',
    'exams',
    'submissions',
    'gradeRecords',
    'assignments',
    'assignmentSubmissions'
  ];

  keys.forEach((key) => {
    let localList = ((local[key] || []) as any[]).filter(item => item && item.id && !deletedIds.has(item.id));
    let remoteList = ((remote[key] || []) as any[]).filter(item => item && item.id && !deletedIds.has(item.id));

    // Fall back to seed defaults only if both are empty and not initialized
    const isInit = typeof localStorage !== 'undefined' && localStorage.getItem('ep_initialized') === 'true';
    if (!isInit && localList.length === 0 && remoteList.length === 0 && defaults[key] && defaults[key].length > 0) {
      localList = (defaults[key] as any[]).filter(item => item && item.id && !deletedIds.has(item.id));
    }

    const itemMap = new Map<string, any>();

    // 1. Remote items from Cloud Firestore
    remoteList.forEach((remoteItem: any) => {
      if (remoteItem && remoteItem.id && !deletedIds.has(remoteItem.id)) {
        itemMap.set(remoteItem.id, remoteItem);
      }
    });

    // 2. Local items: add new ones, or merge with remote with conflict and integrity protection
    localList.forEach((localItem: any) => {
      if (!localItem || !localItem.id || deletedIds.has(localItem.id)) return;

      const remoteItem = itemMap.get(localItem.id);
      if (!remoteItem) {
        itemMap.set(localItem.id, localItem);
      } else {
        if (key === 'submissions') {
          // Dedicated safe merge for exam submissions
          const localGraded = localItem.estado === 'calificado' || (localItem.manualScores && Object.keys(localItem.manualScores).length > 0);
          const remoteGraded = remoteItem.estado === 'calificado' || (remoteItem.manualScores && Object.keys(remoteItem.manualScores).length > 0);

          if (localGraded && !remoteGraded) {
            // Local tiene calificación del docente; remoto sigue pendiente -> preservar local
            itemMap.set(localItem.id, localItem);
          } else if (!localGraded && remoteGraded) {
            // Remoto tiene calificación; local sigue pendiente -> preservar remoto
            itemMap.set(localItem.id, remoteItem);
          } else {
            // Ambos calificados o ambos pendientes: comparar prioridad temporal numérica exacta
            const localMs = parseSafeTimestamp(localItem.actualizado || localItem.gradedAt || localItem.fecha || localItem.creado);
            const remoteMs = parseSafeTimestamp(remoteItem.actualizado || remoteItem.gradedAt || remoteItem.fecha || remoteItem.creado);

            if (localMs > remoteMs) {
              itemMap.set(localItem.id, localItem);
            } else if (remoteMs > localMs) {
              itemMap.set(localItem.id, remoteItem);
            } else {
              // Timestamps idénticos o no especificados:
              if (localItem.puntaje !== remoteItem.puntaje) {
                console.warn(`[Sync Conflict] Calificaciones divergentes en entrega ${localItem.id}: local=${localItem.puntaje}% vs remoto=${remoteItem.puntaje}%. Se preserva versión activa local.`);
              }

              // Contar únicamente respuestas con contenido real (evitando borradores vacíos)
              const localMeaningful = countMeaningfulAnswers(localItem.respuestas);
              const remoteMeaningful = countMeaningfulAnswers(remoteItem.respuestas);

              // Si uno de los dos tiene respuestas significativas y el otro no (o menos), priorizar el significativo
              let baseItem: any;
              if (localMeaningful > remoteMeaningful) {
                baseItem = localItem;
              } else if (remoteMeaningful > localMeaningful) {
                baseItem = remoteItem;
              } else {
                baseItem = localItem;
              }

              // Protección contra versiones incompatibles de exámenes:
              // Comprobar si las preguntas respondidas en local y remoto pertenecen a versiones incompatibles
              const localRespKeys = Object.keys(localItem.respuestas || {});
              const remoteRespKeys = Object.keys(remoteItem.respuestas || {});
              const hasBothResp = localRespKeys.length > 0 && remoteRespKeys.length > 0;
              const sharedKeys = hasBothResp ? localRespKeys.filter(k => remoteRespKeys.includes(k)) : [];
              const isDifferentExam = localItem.examenId && remoteItem.examenId && localItem.examenId !== remoteItem.examenId;
              const incompatibleVersions = isDifferentExam || (hasBothResp && sharedKeys.length === 0);

              let finalScores: Record<string, number> = {};
              let finalComments: Record<string, string> = {};

              if (incompatibleVersions) {
                console.warn(`[Sync Conflict] Incompatibilidad de versión de examen detectada en entrega ${localItem.id}. Se preserva versión base sin mezclar preguntas ni notas ajenas.`);
                finalScores = baseItem.manualScores || {};
                finalComments = baseItem.manualComments || {};
              } else {
                // Versiones compatibles: fusionar notas y comentarios manuales respetando únicamente preguntas válidas
                const mergedComments = { ...(remoteItem.manualComments || {}), ...(localItem.manualComments || {}) };
                const mergedScores = { ...(remoteItem.manualScores || {}), ...(localItem.manualScores || {}) };

                const allowedQuestions = new Set(Object.keys(baseItem.respuestas || {}));
                if (allowedQuestions.size > 0) {
                  Object.entries(mergedScores).forEach(([qId, val]) => {
                    if (allowedQuestions.has(qId)) finalScores[qId] = val as number;
                  });
                  Object.entries(mergedComments).forEach(([qId, val]) => {
                    if (allowedQuestions.has(qId)) finalComments[qId] = val as string;
                  });
                } else {
                  finalScores = mergedScores;
                  finalComments = mergedComments;
                }
              }

              itemMap.set(localItem.id, {
                ...baseItem,
                manualScores: Object.keys(finalScores).length > 0 ? finalScores : baseItem.manualScores,
                manualComments: Object.keys(finalComments).length > 0 ? finalComments : baseItem.manualComments,
              });
            }
          }
        } else {
          // Comparación robusta para las demás entidades usando milisegundos numéricos
          const localMs = parseSafeTimestamp(localItem.actualizado || localItem.creado || localItem.fecha);
          const remoteMs = parseSafeTimestamp(remoteItem.actualizado || remoteItem.creado || remoteItem.fecha);
          if (localMs > remoteMs) {
            itemMap.set(localItem.id, localItem);
          } else if (remoteMs > localMs) {
            itemMap.set(localItem.id, remoteItem);
          } else if (localMs === 0 && remoteMs === 0) {
            const localKeys = Object.keys(localItem).length;
            const remoteKeys = Object.keys(remoteItem).length;
            if (localKeys >= remoteKeys) {
              itemMap.set(localItem.id, localItem);
            }
          }
        }
      }
    });

    // 3. Fallback for uninitialized databases only: seed defaults if the collection is entirely empty
    if (!isInit && itemMap.size === 0 && defaults[key] && (defaults[key] as any[]).length > 0) {
      (defaults[key] as any[]).forEach(dItem => {
        if (dItem && dItem.id && !deletedIds.has(dItem.id)) {
          itemMap.set(dItem.id, dItem);
        }
      });
    }

    merged[key] = Array.from(itemMap.values()) as any;
  });

  if (merged.users && merged.subjects) {
    merged.users = sanitizeUserAsignaturas(merged.users, merged.subjects);
  }

  const { state: dedupedSemestersDb } = deduplicateSemesters(merged);
  const { state: dedupedSubjectsDb } = deduplicateSubjects(dedupedSemestersDb);
  const { state: finalCleanMerged } = deduplicateParciales(dedupedSubjectsDb);

  return finalCleanMerged;
}

export function cleanExamTitle(rawTitle?: string): string {
  if (!rawTitle) return '—';
  let t = rawTitle
    .replace(/\r?\n/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/EVALUACIÓN\s+(I|II|III|IV|V)\s*-\s*INSTITUTO\s+BÍBLICO\s+PATRICIO\s+SYMES\s*-\s*/gi, 'EVALUACIÓN $1 - ')
    .replace(/APOCALIPSIS\s+(I|II|III|IV|V)\s*-\s*INSTITUTO\s+BÍBLICO\s+PATRICIO\s+SYMES\s*-\s*/gi, 'EVALUACIÓN $1 - ')
    .replace(/INSTITUTO\s+BÍBLICO\s+PATRICIO\s+SYMES\s*-\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return t;
}

export function formatGrade5(score?: number): string {
  if (typeof score !== 'number' || isNaN(score)) return '0.0';
  const val = score <= 5 ? score : (score / 20);
  return val.toFixed(1);
}
