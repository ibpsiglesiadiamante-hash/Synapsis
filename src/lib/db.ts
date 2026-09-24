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
    localStorage.setItem('ep_deleted_ids', JSON.stringify(Array.from(existingDeleted)));
  } catch (e) {
    console.warn('Failed to update ep_deleted_ids:', e);
  }

  saveState(restoredState);
  return restoredState;
}

export function restoreBackupState(): AppState {
  const backup = buildDefaultSeedData();
  const backupIds = new Set<string>();
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
    ((backup[k] || []) as any[]).forEach(item => {
      if (item && item.id) backupIds.add(item.id);
    });
  });

  const existingDeleted = getDeletedIds();
  backupIds.forEach(id => existingDeleted.delete(id));
  try {
    localStorage.setItem('ep_deleted_ids', JSON.stringify(Array.from(existingDeleted)));
  } catch (e) {
    console.warn('Failed to update ep_deleted_ids:', e);
  }

  saveState(backup);
  return backup;
}

export const PROTECTED_IDS = new Set<string>();
['users', 'subjects', 'semesters', 'parciales', 'exams', 'institutions'].forEach(k => {
  const list = (backupAppState as any)[k] || [];
  list.forEach((item: any) => {
    if (item && item.id) PROTECTED_IDS.add(item.id);
  });
});
PROTECTED_IDS.add('muecvgv0'); // Explicit protection for DORA INES LOPEZ SANTA

export function buildDefaultSeedData(): AppState {
  return JSON.parse(JSON.stringify(backupAppState));
}

export function getDeletedIds(): Set<string> {
  try {
    const raw = localStorage.getItem('ep_deleted_ids');
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
    localStorage.setItem('ep_deleted_ids', JSON.stringify(Array.from(deleted)));
  } catch (e) {
    console.error('Failed to mark entity as deleted', e);
  }
}

export function getInitialState(): AppState {
  const defaults = buildDefaultSeedData();
  const deletedIds = getDeletedIds();
  const isInitialized = localStorage.getItem('ep_initialized') === 'true';

  try {
    const rawU = localStorage.getItem('ep_users');
    const existingU: any[] = rawU ? JSON.parse(rawU) : [];
    const rawInst = localStorage.getItem('ep_instituciones');
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
      const raw = localStorage.getItem(key);
      if (raw !== null) {
        const loaded: any[] = JSON.parse(raw);
        if (Array.isArray(loaded) && loaded.length > 0) {
          const alive = loaded.filter(item => item && item.id && !deletedIds.has(item.id));
          if (alive.length > 0) return alive;
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

  // Guarantee that all 36 biblical subjects from curriculum are present
  const defaultSubs = (defaults.subjects || []).filter(item => item && item.id && !deletedIds.has(item.id));
  const subMap = new Map<string, Subject>();
  defaultSubs.forEach(s => subMap.set(s.id, s));
  rawSubjects.forEach(s => {
    if (!s || !s.id || deletedIds.has(s.id)) return;
    const matchingDefault = defaultSubs.find(ds => (ds.nombre || '').toLowerCase().trim() === (s.nombre || '').toLowerCase().trim());
    if (matchingDefault) {
      subMap.set(matchingDefault.id, {
        ...matchingDefault,
        ...s,
        id: matchingDefault.id,
        nivel: s.nivel || matchingDefault.nivel,
        semestre: s.semestre || matchingDefault.semestre,
        codigo: s.codigo || matchingDefault.codigo,
      });
    } else {
      subMap.set(s.id, s);
    }
  });
  const subjects = Array.from(subMap.values());

  // Guarantee that all 9 academic semesters are present
  const defaultSems = (defaults.semesters || []).filter(item => item && item.id && !deletedIds.has(item.id));
  const semMap = new Map<string, Semester>();
  defaultSems.forEach(s => semMap.set(s.id, s));
  rawSemesters.forEach(s => {
    if (!s || !s.id || deletedIds.has(s.id)) return;
    const matchingDefault = defaultSems.find(ds => (ds.nombre || '').toLowerCase().trim() === (s.nombre || '').toLowerCase().trim());
    if (matchingDefault) {
      semMap.set(matchingDefault.id, {
        ...matchingDefault,
        ...s,
        id: matchingDefault.id,
        nivel: s.nivel || matchingDefault.nivel,
      });
    } else {
      semMap.set(s.id, s);
    }
  });
  const semesters = Array.from(semMap.values());

  // Guarantee that all institutional exams from backup curriculum are present
  const defaultExams = (defaults.exams || []).filter(item => item && item.id && !deletedIds.has(item.id));
  const examMap = new Map<string, Exam>();
  defaultExams.forEach(e => examMap.set(e.id, e));
  rawExams.forEach(e => {
    if (!e || !e.id || deletedIds.has(e.id)) return;
    examMap.set(e.id, e);
  });
  const exams = Array.from(examMap.values());

  // Guarantee that all institutional parciales from backup curriculum are present
  const defaultParcs = (defaults.parciales || []).filter(item => item && item.id && !deletedIds.has(item.id));
  const parcMap = new Map<string, Parcial>();
  defaultParcs.forEach(p => parcMap.set(p.id, p));
  rawParciales.forEach(p => {
    if (!p || !p.id || deletedIds.has(p.id)) return;
    parcMap.set(p.id, p);
  });
  const parciales = Array.from(parcMap.values());

  const state: AppState = {
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

  saveState(state);
  return state;
}

export function saveState(state: AppState) {
  try {
    const deletedIds = getDeletedIds();

    const filterAlive = (list: any[] = []) => {
      if (!Array.isArray(list)) return [];
      return list.filter(item => item && item.id && !deletedIds.has(item.id));
    };

    localStorage.setItem('ep_users', JSON.stringify(filterAlive(state.users)));
    localStorage.setItem('ep_instituciones', JSON.stringify(filterAlive(state.institutions)));
    localStorage.setItem('ep_subjects', JSON.stringify(filterAlive(state.subjects)));
    localStorage.setItem('ep_semesters', JSON.stringify(filterAlive(state.semesters)));
    localStorage.setItem('ep_parciales', JSON.stringify(filterAlive(state.parciales)));
    localStorage.setItem('ep_exams', JSON.stringify(filterAlive(state.exams)));
    localStorage.setItem('ep_submissions', JSON.stringify(filterAlive(state.submissions)));
    localStorage.setItem('ep_notas', JSON.stringify(filterAlive(state.gradeRecords)));
    localStorage.setItem('ep_trabajos', JSON.stringify(filterAlive(state.assignments)));
    localStorage.setItem('ep_entregas_trabajos', JSON.stringify(filterAlive(state.assignmentSubmissions || [])));
    localStorage.setItem('ep_initialized', 'true');
  } catch (e) {
    console.warn('Unable to persist full state to localStorage:', e);
  }
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
    const isInit = localStorage.getItem('ep_initialized') === 'true';
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

    // 2. Local items: add new ones, or overwrite remote if local has newer timestamp
    localList.forEach((localItem: any) => {
      if (!localItem || !localItem.id || deletedIds.has(localItem.id)) return;

      const remoteItem = itemMap.get(localItem.id);
      if (!remoteItem) {
        itemMap.set(localItem.id, localItem);
      } else {
        const localTime = localItem.actualizado || localItem.creado || '';
        const remoteTime = remoteItem.actualizado || remoteItem.creado || '';
        if (localTime > remoteTime) {
          itemMap.set(localItem.id, localItem);
        }
      }
    });

    // 3. Guarantee that official subjects, semesters and students are present
    if (key === 'users') {
      const defaultUsers = (defaults.users || []).filter(item => item && item.id && !deletedIds.has(item.id));
      defaultUsers.forEach(dUser => {
        const existing = itemMap.get(dUser.id) || Array.from(itemMap.values()).find((u: any) =>
          (u.cedula && dUser.cedula && u.cedula.trim() === dUser.cedula.trim()) ||
          (u.email && dUser.email && u.email.trim().toLowerCase() === dUser.email.trim().toLowerCase()) ||
          (u.codigo && dUser.codigo && u.codigo.trim().toUpperCase() === dUser.codigo.trim().toUpperCase())
        );

        if (!existing) {
          itemMap.set(dUser.id, dUser);
        } else {
          // Preserve assigned subjects: never erase subjects if dUser has them and existing has empty
          const dAsg = Array.isArray(dUser.asignaturas) ? dUser.asignaturas : [];
          const eAsg = Array.isArray(existing.asignaturas) ? existing.asignaturas : [];
          const mergedAsignaturas = eAsg.length > 0 ? eAsg : dAsg;

          const mergedUser: User = {
            ...dUser,
            ...existing,
            id: dUser.id,
            nombre: existing.nombre || dUser.nombre,
            cedula: existing.cedula || dUser.cedula,
            celular: existing.celular || dUser.celular,
            email: existing.email || dUser.email,
            codigo: existing.codigo || dUser.codigo,
            semestre: existing.semestre || dUser.semestre,
            asignaturas: mergedAsignaturas
          };
          itemMap.set(dUser.id, mergedUser);
          if (existing.id && existing.id !== dUser.id) {
            itemMap.delete(existing.id);
          }
        }
      });
    }

    if (key === 'subjects') {
      const defaultSubs = (defaults.subjects || []).filter(item => item && item.id && !deletedIds.has(item.id));
      defaultSubs.forEach(dSub => {
        const existingByName = Array.from(itemMap.values()).find(
          (item: any) => (item.nombre || '').toLowerCase().trim() === (dSub.nombre || '').toLowerCase().trim()
        );
        if (!existingByName) {
          itemMap.set(dSub.id, dSub);
        } else {
          // Keep the existing subject but ensure nivel, semestre and codigo are set
          if (!existingByName.nivel || !existingByName.semestre || !existingByName.codigo) {
            existingByName.nivel = existingByName.nivel || dSub.nivel;
            existingByName.semestre = existingByName.semestre || dSub.semestre;
            existingByName.codigo = existingByName.codigo || dSub.codigo;
          }
        }
      });
    }

    if (key === 'semesters') {
      const defaultSems = (defaults.semesters || []).filter(item => item && item.id && !deletedIds.has(item.id));
      defaultSems.forEach(dSem => {
        const existingByName = Array.from(itemMap.values()).find(
          (item: any) => (item.nombre || '').toLowerCase().trim() === (dSem.nombre || '').toLowerCase().trim()
        );
        if (!existingByName) {
          itemMap.set(dSem.id, dSem);
        } else if (!existingByName.nivel) {
          existingByName.nivel = dSem.nivel;
        }
      });
    }

    if (key === 'exams') {
      const defaultExams = (defaults.exams || []).filter(item => item && item.id && !deletedIds.has(item.id));
      defaultExams.forEach(dExam => {
        const existing = itemMap.get(dExam.id);
        if (!existing) {
          itemMap.set(dExam.id, dExam);
        }
      });
    }

    if (key === 'parciales') {
      const defaultParcs = (defaults.parciales || []).filter(item => item && item.id && !deletedIds.has(item.id));
      defaultParcs.forEach(dParc => {
        const existing = itemMap.get(dParc.id);
        if (!existing) {
          itemMap.set(dParc.id, dParc);
        }
      });
    }

    if (key === 'submissions') {
      const defaultSubs = (defaults.submissions || []).filter(item => item && item.id && !deletedIds.has(item.id));
      defaultSubs.forEach(dSub => {
        const existing = itemMap.get(dSub.id);
        if (!existing) {
          itemMap.set(dSub.id, dSub);
        }
      });
    }

    if (key === 'gradeRecords') {
      const defaultGrades = (defaults.gradeRecords || []).filter(item => item && item.id && !deletedIds.has(item.id));
      defaultGrades.forEach(dGrade => {
        const existing = itemMap.get(dGrade.id);
        if (!existing) {
          itemMap.set(dGrade.id, dGrade);
        }
      });
    }

    merged[key] = Array.from(itemMap.values()) as any;
  });

  if (merged.users && merged.subjects) {
    merged.users = sanitizeUserAsignaturas(merged.users, merged.subjects);
  }

  return merged;
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
