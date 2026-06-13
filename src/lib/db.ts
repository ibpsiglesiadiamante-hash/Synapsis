/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  User, Subject, Semester, Parcial, GradeRecord, Assignment, Institution, Exam, Submission 
} from '../types';

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

interface AppState {
  users: User[];
  institutions: Institution[];
  subjects: Subject[];
  semesters: Semester[];
  parciales: Parcial[];
  exams: Exam[];
  submissions: Submission[];
  gradeRecords: GradeRecord[];
  assignments: Assignment[];
}

export function getInitialState(): AppState {
  const isInitialized = localStorage.getItem('ep_initialized');

  if (isInitialized) {
    try {
      return {
        users: JSON.parse(localStorage.getItem('ep_users') || '[]'),
        institutions: JSON.parse(localStorage.getItem('ep_instituciones') || '[]'),
        subjects: JSON.parse(localStorage.getItem('ep_subjects') || '[]'),
        semesters: JSON.parse(localStorage.getItem('ep_semesters') || '[]'),
        parciales: JSON.parse(localStorage.getItem('ep_parciales') || '[]'),
        exams: JSON.parse(localStorage.getItem('ep_exams') || '[]'),
        submissions: JSON.parse(localStorage.getItem('ep_submissions') || '[]'),
        gradeRecords: JSON.parse(localStorage.getItem('ep_notas') || '[]'),
        assignments: JSON.parse(localStorage.getItem('ep_trabajos') || '[]'),
      };
    } catch (e) {
      console.error('Failed to parse storage, loading defaults...', e);
    }
  }

  // Pre-loaded seed database
  const uAdminId = uid();
  const uDocenteId = uid();
  const uEstudiante1Id = uid();
  const uEstudiante2Id = uid();

  const users: User[] = [
    { id: uAdminId, nombre: 'Administrador Synapsis', email: 'admin@synapsis.edu', pass: 'admin123', rol: 'admin', creado: now() },
    { id: uDocenteId, nombre: 'Prof. de Jesús María García', email: 'juan.docente@synapsis.edu', pass: 'docente123', rol: 'docente', creado: now() },
    { id: uEstudiante1Id, nombre: 'Carlos Andrés Pérez', email: 'maria.estudiante@synapsis.edu', pass: 'estudiante123', rol: 'estudiante', creado: now() },
    { id: uEstudiante2Id, nombre: 'Ana Isabel Rodríguez', email: 'ana.estudiante@synapsis.edu', pass: 'estudiante123', rol: 'estudiante', creado: now() },
  ];

  const subMathId = uid();
  const subSocialId = uid();
  const subLangId = uid();

  const subjects: Subject[] = [
    { id: subMathId, nombre: 'Matemáticas', codigo: 'MAT-101', docenteId: uDocenteId, creado: now() },
    { id: subSocialId, nombre: 'Ciencias Sociales', codigo: 'SOC-102', docenteId: uDocenteId, creado: now() },
    { id: subLangId, nombre: 'Lengua y Literatura', codigo: 'LEN-103', docenteId: uDocenteId, creado: now() },
  ];

  const sem1Id = uid();
  const sem2Id = uid();

  const semesters: Semester[] = [
    { id: sem1Id, nombre: 'Semestre 2026-I', codigo: 'SEM-26A', estado: 'activo', creado: now() },
    { id: sem2Id, nombre: 'Semestre 2026-II', codigo: 'SEM-26B', estado: 'inactivo', creado: now() },
  ];

  const arc1Id = uid();
  const arc2Id = uid();

  const parciales: Parcial[] = [
    { id: arc1Id, nombre: 'Primer Corte - 30%', semestre: sem1Id, asignatura: subMathId, estado: 'abierto', porcentaje: 30, fechaInicio: '2026-02-01', fechaFin: '2026-04-10', creado: now() },
    { id: arc2Id, nombre: 'Segundo Corte - 30%', semestre: sem1Id, asignatura: subSocialId, estado: 'abierto', porcentaje: 30, fechaInicio: '2026-04-11', fechaFin: '2026-06-30', creado: now() },
  ];

  const gradeRecords: GradeRecord[] = [
    {
      id: uid(),
      estudianteId: uEstudiante1Id,
      asignaturaId: subMathId,
      parcialId: arc1Id,
      nota: 4.2,
      notaEV1: 4.3,
      notaEV2: 4.7,
      notaTrabajo: 3.6,
      aprobado: true,
      comentario: 'Excelente sustentación del análisis diferencial.',
      creado: now(),
      actualizado: now(),
    },
    {
      id: uid(),
      estudianteId: uEstudiante2Id,
      asignaturaId: subSocialId,
      parcialId: arc2Id,
      nota: 2.8,
      notaEV1: 2.5,
      notaEV2: 3.0,
      notaTrabajo: 2.9,
      aprobado: false,
      comentario: 'Requiere repasar los hitos del frente de reforma social colombiana.',
      creado: now(),
      actualizado: now(),
    },
  ];

  const assignments: Assignment[] = [
    {
      id: uid(),
      titulo: 'Ensayo Crítico de Sociales',
      descripcion: 'Redacta un análisis de 500 palabras sobre el impacto institucional del Frente Nacional.',
      parcialId: arc2Id,
      puntos: 100,
      fechaEntrega: '2026-06-25',
      creado: now(),
      actualizado: now(),
    },
  ];

  const institutions: Institution[] = [
    {
      id: uid(),
      nombre: 'Instituto Synapsis',
      tipo: 'Colegio',
      codigo: 'NIT-322199',
      ciudad: 'Bogotá D.C.',
      direccion: 'Avenida El Dorado #68-12',
      telefono: '+57 (1) 456-7890',
      email: 'contacto@synapsis.edu',
      creado: now(),
    },
  ];

  const exams: Exam[] = [
    {
      id: uid(),
      titulo: 'Álgebra básica y Ecuaciones',
      materia: 'Matemáticas',
      parcialId: arc1Id,
      descripcion: 'Evaluación cronometrada de sistemas de ecuaciones de primer y segundo grado.',
      docenteId: uDocenteId,
      estado: 'activo',
      tiempo: 60,
      intentos: 1,
      aprobacion: 60,
      aleatorio: false,
      mostrarNota: true,
      creado: now(),
      preguntas: [
        {
          id: uid(),
          texto: '¿Cuál es el valor de x que satisface la ecuación: 2x - 3 = 7?',
          tipo: 'multiple',
          puntos: 25,
          opciones: ['x = 2', 'x = 5', 'x = 4', 'x = 10'],
          correctas: [1],
        },
        {
          id: uid(),
          texto: 'Resuelve el siguiente binomio al cuadrado: (a + b)².',
          tipo: 'multiple',
          puntos: 25,
          opciones: [
            'a² + 2ab + b²',
            'a² + b²',
            'a² - 2ab + b²',
            '2a + 2b',
          ],
          correctas: [0],
        },
        {
          id: uid(),
          texto: '¿La fórmula cuadrática permite obtener las raíces de funciones polinómicas de grado 2?',
          tipo: 'tf',
          puntos: 25,
          opciones: ['Verdadero', 'Falso'],
          correctas: [0],
        },
        {
          id: uid(),
          texto: 'Menciona una aplicación práctica de los sistemas de ecuaciones en problemas de optimización.',
          tipo: 'abierta',
          puntos: 25,
          opciones: [],
          correctas: [],
        },
      ],
    },
  ];

  const submissions: Submission[] = [];

  const state: AppState = {
    users,
    institutions,
    subjects,
    semesters,
    parciales,
    exams,
    submissions,
    gradeRecords,
    assignments,
  };

  saveState(state);
  return state;
}

export function saveState(state: AppState) {
  localStorage.setItem('ep_users', JSON.stringify(state.users));
  localStorage.setItem('ep_instituciones', JSON.stringify(state.institutions));
  localStorage.setItem('ep_subjects', JSON.stringify(state.subjects));
  localStorage.setItem('ep_semesters', JSON.stringify(state.semesters));
  localStorage.setItem('ep_parciales', JSON.stringify(state.parciales));
  localStorage.setItem('ep_exams', JSON.stringify(state.exams));
  localStorage.setItem('ep_submissions', JSON.stringify(state.submissions));
  localStorage.setItem('ep_notas', JSON.stringify(state.gradeRecords));
  localStorage.setItem('ep_trabajos', JSON.stringify(state.assignments));
  localStorage.setItem('ep_initialized', 'true');
}
