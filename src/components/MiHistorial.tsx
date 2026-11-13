/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Award, BookOpen, Clock, CheckCircle, XCircle, Search, 
  Printer, Sparkles, GraduationCap, FileCheck, ShieldCheck, Layers
} from 'lucide-react';
import { User, Exam, Submission, GradeRecord, Subject, Parcial, Semester, Assignment, AssignmentSubmission } from '../types';
import { 
  fmtDate, 
  fmtTime, 
  cleanExamTitle, 
  formatGrade5,
  getAllMatchingUserIds,
  getUserAssignedSubjects,
  normalizeString,
  normalizeSemesterCanonicalKey,
  resolveExamSubjectName,
  SEMESTRES_OFICIALES
} from '../lib/db';

interface MiHistorialProps {
  currentUser: User;
  users?: User[];
  exams: Exam[];
  submissions: Submission[];
  gradeRecords?: GradeRecord[];
  subjects?: Subject[];
  parciales?: Parcial[];
  semesters?: Semester[];
  assignments?: Assignment[];
  assignmentSubmissions?: AssignmentSubmission[];
  onNavigate?: (tab: string) => void;
}

export default function MiHistorial({ 
  currentUser, 
  users = [],
  exams, 
  submissions, 
  gradeRecords = [], 
  subjects = [], 
  parciales = [], 
  semesters = [],
  assignments = [],
  assignmentSubmissions = [],
  onNavigate
}: MiHistorialProps) {
  const isAdmin = currentUser.rol === 'admin';
  const isDocente = currentUser.rol === 'docente';
  const isStaff = isAdmin || isDocente;

  const matchingUserIds = useMemo(
    () => new Set(getAllMatchingUserIds(currentUser, users)),
    [currentUser, users]
  );

  const assignedSubjects = useMemo(
    () => getUserAssignedSubjects(currentUser, subjects, semesters, users),
    [currentUser, subjects, semesters, users]
  );

  const assignedSubIds = useMemo(() => new Set(assignedSubjects.map(s => s.id)), [assignedSubjects]);
  const assignedSubNames = useMemo(() => new Set(assignedSubjects.map(s => normalizeString(s.nombre))), [assignedSubjects]);

  const [staffScope, setStaffScope] = useState<'asignadas' | 'todas'>(() =>
    isAdmin && assignedSubjects.length === 0 ? 'todas' : 'asignadas'
  );
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('todas');
  const [activeTab, setActiveTab] = useState<'calificaciones' | 'trabajos' | 'examenes'>('calificaciones');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);

  const effectiveScope: 'asignadas' | 'todas' = isAdmin ? staffScope : 'asignadas';

  const matchesSemesterFilter = (rawSem?: string): boolean => {
    if (selectedSemester === 'todos') return true;
    if (!rawSem) return false;
    const targetKey = normalizeSemesterCanonicalKey(selectedSemester);
    const semObj = semesters.find(s => s.id === rawSem || normalizeString(s.nombre) === normalizeString(rawSem));
    const resolvedName = semObj?.nombre || rawSem;
    const recKey = normalizeSemesterCanonicalKey(resolvedName);
    if (targetKey && recKey && targetKey === recKey) return true;
    return normalizeString(resolvedName) === normalizeString(selectedSemester);
  };

  const resolveSubjectByAnyRef = (ref?: string): Subject | undefined => {
    if (!ref) return undefined;
    const refNorm = normalizeString(ref);
    return subjects.find(
      s => s.id === ref || normalizeString(s.nombre) === refNorm || normalizeString(s.codigo) === refNorm
    );
  };

  const isSubjectInStaffScope = (subRef?: string, examObj?: Exam): boolean => {
    if (effectiveScope === 'todas') return true;
    if (examObj?.docenteId && matchingUserIds.has(examObj.docenteId)) return true;
    if (!subRef) return false;
    if (assignedSubIds.has(subRef)) return true;
    const normRef = normalizeString(subRef);
    if (normRef && assignedSubNames.has(normRef)) return true;
    const subObj = resolveSubjectByAnyRef(subRef);
    if (subObj && (assignedSubIds.has(subObj.id) || assignedSubNames.has(normalizeString(subObj.nombre)))) {
      return true;
    }
    return false;
  };

  const matchesSelectedSubject = (subObj?: Subject, rawRef?: string): boolean => {
    if (selectedSubjectFilter === 'todas') return true;
    if (subObj?.id === selectedSubjectFilter) return true;
    if (rawRef === selectedSubjectFilter) return true;
    const filterSub = subjects.find(s => s.id === selectedSubjectFilter);
    if (filterSub && subObj && normalizeString(filterSub.nombre) === normalizeString(subObj.nombre)) return true;
    if (filterSub && rawRef && normalizeString(filterSub.nombre) === normalizeString(rawRef)) return true;
    return false;
  };

  // Base scoped collections (before search/semester filters, used for KPI cards)
  const scopedGradeRecords = useMemo(() => {
    if (!isStaff) {
      return gradeRecords.filter(r => matchingUserIds.has(r.estudianteId));
    }
    return gradeRecords.filter(r => isSubjectInStaffScope(r.asignaturaId));
  }, [gradeRecords, isStaff, matchingUserIds, effectiveScope, assignedSubIds, assignedSubNames, subjects]);

  const scopedAssignmentSubs = useMemo(() => {
    const base = isStaff
      ? assignmentSubmissions
      : assignmentSubmissions.filter(s => matchingUserIds.has(s.estudianteId));

    return base
      .map(sub => {
        const assign = assignments.find(a => a.id === (sub.assignmentId || sub.trabajoId));
        const subObj = resolveSubjectByAnyRef(assign?.asignatura);
        const parcObj = parciales.find(p => p.id === assign?.parcialId);
        const studentObj = users.find(u => u.id === sub.estudianteId);
        const maxPts = assign?.puntosMaximos || assign?.puntos || 100;
        const scaled5 = sub.calificacion != null
          ? (maxPts > 5 ? Number(((sub.calificacion / maxPts) * 5).toFixed(2)) : Number(sub.calificacion.toFixed(2)))
          : null;
        return {
          ...sub,
          assignment: assign,
          subject: subObj,
          parcial: parcObj,
          studentName: studentObj?.nombre || sub.estudianteNombre || 'Estudiante',
          scaled5
        };
      })
      .filter(item => !isStaff || isSubjectInStaffScope(item.assignment?.asignatura));
  }, [assignmentSubmissions, assignments, users, subjects, parciales, isStaff, matchingUserIds, effectiveScope, assignedSubIds, assignedSubNames]);

  const scopedExamSubs = useMemo(() => {
    if (!isStaff) {
      return submissions.filter(s => matchingUserIds.has(s.estudianteId));
    }
    return submissions.filter(s => {
      const exam = exams.find(e => e.id === s.examenId);
      return isSubjectInStaffScope(exam?.materia, exam);
    });
  }, [submissions, exams, isStaff, matchingUserIds, effectiveScope, assignedSubIds, assignedSubNames, subjects]);

  // 1. Filtered Grade Records
  const filteredGradeRecords = useMemo(() => {
    return scopedGradeRecords
      .filter(r => {
        const sub = resolveSubjectByAnyRef(r.asignaturaId);
        const parc = parciales.find(p => p.id === r.parcialId);
        const student = users.find(u => u.id === r.estudianteId);
        const matchSem = matchesSemesterFilter(sub?.semestre);
        const matchSubj = matchesSelectedSubject(sub, r.asignaturaId);
        const q = searchQuery.toLowerCase().trim();
        const matchQ = !q ||
          (sub?.nombre || '').toLowerCase().includes(q) ||
          (sub?.codigo || '').toLowerCase().includes(q) ||
          (parc?.nombre || '').toLowerCase().includes(q) ||
          (student?.nombre || '').toLowerCase().includes(q);
        return matchSem && matchSubj && matchQ;
      })
      .sort((a, b) => (b.creado || '').localeCompare(a.creado || ''));
  }, [scopedGradeRecords, subjects, parciales, users, selectedSemester, selectedSubjectFilter, searchQuery]);

  // Overall GPA from scoped grade records
  const averageGPA = useMemo(() => {
    const valid = scopedGradeRecords.filter(r => r.nota != null && !isNaN(Number(r.nota)));
    if (valid.length === 0) return null;
    const sum = valid.reduce((acc, r) => acc + Number(r.nota), 0);
    return Number((sum / valid.length).toFixed(2));
  }, [scopedGradeRecords]);

  const approvedCount = useMemo(() => {
    return scopedGradeRecords.filter(r => r.aprobado != null ? r.aprobado : Number(r.nota) >= 3.0).length;
  }, [scopedGradeRecords]);

  // 2. Filtered Assignment Submissions
  const filteredAssignmentSubmissions = useMemo(() => {
    return scopedAssignmentSubs
      .filter(item => {
        const matchSem = matchesSemesterFilter(item.subject?.semestre || item.assignment?.semestre);
        const matchSubj = matchesSelectedSubject(item.subject, item.assignment?.asignatura);
        const q = searchQuery.toLowerCase().trim();
        if (!q) return matchSem && matchSubj;
        return matchSem && matchSubj && (
          (item.assignment?.titulo || '').toLowerCase().includes(q) ||
          (item.subject?.nombre || '').toLowerCase().includes(q) ||
          (item.studentName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.fechaEntrega || '').localeCompare(a.fechaEntrega || ''));
  }, [scopedAssignmentSubs, selectedSemester, selectedSubjectFilter, searchQuery]);

  // 3. Filtered Exam Submissions
  const filteredExamSubs = useMemo(() => {
    return scopedExamSubs
      .filter(s => {
        const exam = exams.find(e => e.id === s.examenId);
        const subObj = resolveSubjectByAnyRef(exam?.materia);
        const studentObj = users.find(u => u.id === s.estudianteId);
        const studentName = studentObj?.nombre || s.estudianteNombre || '';
        const matchSem = matchesSemesterFilter(subObj?.semestre || exam?.semestre);
        const matchSubj = matchesSelectedSubject(subObj, exam?.materia);
        const q = searchQuery.toLowerCase().trim();
        if (!q) return matchSem && matchSubj;
        return matchSem && matchSubj && (
          (exam?.titulo || '').toLowerCase().includes(q) ||
          (exam?.materia || '').toLowerCase().includes(q) ||
          (subObj?.nombre || '').toLowerCase().includes(q) ||
          studentName.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }, [scopedExamSubs, exams, subjects, users, selectedSemester, selectedSubjectFilter, searchQuery]);

  // Subject dropdown options for filters
  const subjectFilterOptions = useMemo(() => {
    return (isStaff && effectiveScope === 'asignadas') ? assignedSubjects : subjects;
  }, [isStaff, effectiveScope, assignedSubjects, subjects]);

  // Reset pagination on filter/tab change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab, selectedSemester, selectedSubjectFilter, staffScope]);

  const itemsPerPage = 7;
  const currentTotal = activeTab === 'calificaciones' 
    ? filteredGradeRecords.length 
    : activeTab === 'trabajos' 
      ? filteredAssignmentSubmissions.length 
      : filteredExamSubs.length;
  const totalPages = Math.ceil(currentTotal / itemsPerPage) || 1;
  const activePage = Math.min(currentPage, totalPages);

  const paginatedGrades = filteredGradeRecords.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);
  const paginatedTrabajos = filteredAssignmentSubmissions.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);
  const paginatedSubs = filteredExamSubs.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-miHistorial animate-fade-in pb-12">
      {/* HEADER PROFILE BANNER */}
      <div className="mb-6 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-xl border border-indigo-800/40 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute right-32 bottom-0 w-32 h-32 bg-teal-500/10 rounded-full blur-xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2.5 text-xs font-bold text-teal-300 uppercase tracking-widest mb-1.5">
              {isStaff ? <ShieldCheck className="w-4 h-4 text-teal-400" /> : <GraduationCap className="w-4 h-4 text-teal-400" />}
              <span>
                {isAdmin
                  ? 'Panel Administrativo · Historial de Asignaturas y Evaluaciones'
                  : isDocente
                    ? 'Portal del Docente · Historial Académico de tus Cursos'
                    : 'Portal del Estudiante · Ficha Académica Personal'}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {currentUser.nombre}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              {isStaff
                ? 'Consulta en tiempo real el libro oficial de calificaciones, entregas de trabajos (33.3%) y exámenes online de los estudiantes en tus materias asignadas.'
                : 'Consulta en tiempo real tus calificaciones definitivas del libro oficial, tus notas de trabajos (33.3%) y tus evaluaciones online.'}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {currentUser.cedula && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-xs text-xs font-medium text-slate-200 border border-white/10">
                  <span>Cédula: <strong className="text-white">{currentUser.cedula}</strong></span>
                  {currentUser.semestre && (
                    <>
                      <span className="text-slate-400">·</span>
                      <span>Semestre: <strong className="text-teal-300">{currentUser.semestre}</strong></span>
                    </>
                  )}
                </div>
              )}
              {isStaff && (
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-xs font-bold text-cyan-200 border border-cyan-400/30">
                  <Layers className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{assignedSubjects.length} {assignedSubjects.length === 1 ? 'asignatura asignada' : 'asignaturas asignadas'}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0 print:hidden">
            {isStaff && onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('misMaterias')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-500/25 hover:bg-indigo-500/40 text-cyan-200 text-xs font-bold border border-cyan-400/30 backdrop-blur-xs shadow transition-all cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-cyan-300" />
                <span>Ver Mis Asignaturas</span>
              </button>
            )}
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold border border-white/20 backdrop-blur-xs shadow transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 text-teal-300" />
              <span>Imprimir / Guardar Ficha (PDF)</span>
            </button>
          </div>
        </div>

        {/* 4 SUMMARY STAT CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-5 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>{isStaff ? 'Promedio de Notas' : 'Promedio General'}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-amber-300">
                {averageGPA !== null ? averageGPA.toFixed(2) : '—'}
              </span>
              <span className="text-xs text-slate-400">/ 5.0</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Calculado con definitivas oficiales</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isStaff ? 'Registros Aprobados' : 'Cortes Aprobados'}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-emerald-300">
                {approvedCount}
              </span>
              <span className="text-xs text-slate-400">/ {scopedGradeRecords.length}</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Nota mínima de aprobación: 3.0</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <FileCheck className="w-3.5 h-3.5 text-teal-400" />
              <span>Trabajos Calificados</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-teal-300">
                {scopedAssignmentSubs.filter(s => s.estado === 'calificado').length}
              </span>
              <span className="text-xs text-slate-400">de {scopedAssignmentSubs.length} entregas</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Suman el 33.3% al libro de notas</div>
          </div>

          <div className="bg-white/5 backdrop-blur-xs rounded-2xl p-3.5 border border-white/10">
            <div className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isStaff ? 'Exámenes Recibidos' : 'Exámenes Presentados'}</span>
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-black text-cyan-300">
                {scopedExamSubs.length}
              </span>
              <span className="text-xs text-slate-400">evaluaciones</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Cuestionarios en plataforma</div>
          </div>
        </div>
      </div>

      {/* ADMIN SCOPE SWITCHER */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 mb-4 print:hidden">
          <button
            type="button"
            onClick={() => {
              setStaffScope('asignadas');
              setSelectedSubjectFilter('todas');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              staffScope === 'asignadas'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Solo Mis Materias Asignadas ({assignedSubjects.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setStaffScope('todas');
              setSelectedSubjectFilter('todas');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              staffScope === 'todas'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Historial Institucional Completo ({subjects.length} materias)
          </button>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-slate-200 pb-3 print:hidden">
        <button
          onClick={() => setActiveTab('calificaciones')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'calificaciones'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>{isStaff ? 'Calificaciones Oficiales (Definitivas & Parciales)' : 'Mis Calificaciones Oficiales (Definitivas & Parciales)'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'calificaciones' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {filteredGradeRecords.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('trabajos')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'trabajos'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <FileCheck className="w-4 h-4" />
          <span>{isStaff ? 'Trabajos y Talleres (33.3%)' : 'Mis Trabajos y Talleres (33.3%)'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'trabajos' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {filteredAssignmentSubmissions.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('examenes')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer ${
            activeTab === 'examenes'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>{isStaff ? 'Exámenes Online Recibidos' : 'Exámenes Online Presentados'}</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
            activeTab === 'examenes' ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-700'
          }`}>
            {filteredExamSubs.length}
          </span>
        </button>
      </div>

      {/* FILTER SEARCH BAR & SUBJECT / SEMESTER SELECTS */}
      <div className="mb-6 flex flex-col lg:flex-row items-stretch lg:items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm print:hidden justify-between">
        <div className="relative w-full lg:max-w-md flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isStaff
                ? 'Buscar por estudiante, materia, trabajo o examen...'
                : activeTab === 'calificaciones'
                  ? 'Buscar materia, código o parcial...'
                  : activeTab === 'trabajos'
                    ? 'Buscar por título de trabajo o materia...'
                    : 'Buscar por título de examen o asignatura...'
            }
            className="w-full pl-10 pr-9 py-2.5 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 transition placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-xs"
            >
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Materia:</span>
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer max-w-[220px]"
            >
              <option value="todas">Todas ({subjectFilterOptions.length})</option>
              {subjectFilterOptions.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-slate-500 whitespace-nowrap">Semestre:</span>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
            >
              <option value="todos">Todos los Semestres</option>
              {SEMESTRES_OFICIALES.map(semName => (
                <option key={semName} value={semName.toUpperCase()}>{semName.toUpperCase()}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: CALIFICACIONES OFICIALES (DEFINITIVAS Y PARCIALES) */}
      {/* ======================================================== */}
      {activeTab === 'calificaciones' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-amber-900 shadow-xs print:hidden">
            <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-extrabold text-amber-950 block">Sistema Oficial de Ponderación por Componentes:</strong>
              La nota definitiva de cada corte se compone de: <strong>Evaluación 1 (33.3%)</strong> + <strong>Evaluación 2 (33.3%)</strong> + <strong>Trabajos Académicos (33.3%)</strong>. La nota mínima para aprobar es <strong>3.0 / 5.0</strong>.
            </div>
          </div>

          <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredGradeRecords.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center px-4">
                <Award className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-base font-bold text-slate-700">
                  {searchQuery || selectedSubjectFilter !== 'todas' || selectedSemester !== 'todos'
                    ? 'No se encontraron notas coincidentes con los filtros'
                    : isStaff
                      ? 'Sin registros de notas en el libro oficial para estas materias'
                      : 'Aún no tienes calificaciones registradas'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-md">
                  {searchQuery
                    ? 'Intenta con otro término de búsqueda o cambia los filtros.'
                    : isStaff
                      ? 'Cuando se registren notas definitivas o de cortes en tus asignaturas asignadas, aparecerán automáticamente aquí.'
                      : 'Tus docentes o la coordinación registrarán aquí tus evaluaciones periódicas y notas definitivas.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                      {isStaff && <th className="py-3.5 px-4">Estudiante</th>}
                      <th className="py-3.5 px-4">Asignatura</th>
                      <th className="py-3.5 px-4">Corte / Parcial</th>
                      <th className="py-3.5 px-3 text-center">EV 1 (33.3%)</th>
                      <th className="py-3.5 px-3 text-center">EV 2 (33.3%)</th>
                      <th className="py-3.5 px-3 text-center">Trabajos (33.3%)</th>
                      <th className="py-3.5 px-4 text-center">Definitiva</th>
                      <th className="py-3.5 px-4 text-center">Estado</th>
                      <th className="py-3.5 px-4">Observaciones / Docente</th>
                      <th className="py-3.5 px-4">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedGrades.map(rec => {
                      const sub = resolveSubjectByAnyRef(rec.asignaturaId);
                      const parc = parciales.find(p => p.id === rec.parcialId);
                      const student = users.find(u => u.id === rec.estudianteId);
                      const ev1 = typeof rec.notaEV1 === 'number' && !isNaN(rec.notaEV1) ? rec.notaEV1 : (typeof rec.nota === 'number' ? rec.nota : 0);
                      const ev2 = typeof rec.notaEV2 === 'number' && !isNaN(rec.notaEV2) ? rec.notaEV2 : (typeof rec.nota === 'number' ? rec.nota : 0);
                      const nTrab = typeof rec.notaTrabajo === 'number' && !isNaN(rec.notaTrabajo) ? rec.notaTrabajo : (typeof rec.nota === 'number' ? rec.nota : 0);
                      const def = typeof rec.nota === 'number' && !isNaN(rec.nota) ? rec.nota : 0;
                      const isPassed = rec.aprobado != null ? rec.aprobado : (def >= 3.0);

                      return (
                        <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                          {isStaff && (
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{student?.nombre || 'Estudiante'}</div>
                              {student?.codigo && (
                                <div className="text-[10px] font-mono text-slate-400">Cód: {student.codigo}</div>
                              )}
                            </td>
                          )}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{sub?.nombre || 'Materia General'}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              {sub?.codigo && (
                                <span className="font-mono text-[10px] text-slate-500 font-semibold">{sub.codigo}</span>
                              )}
                              {sub?.semestre && (
                                <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-bold">{sub.semestre}</span>
                              )}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="badge inline-flex px-2.5 py-1 rounded-lg text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                              {parc?.nombre || 'Parcial Oficial'}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                              {ev1.toFixed(1)}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded-md">
                              {ev2.toFixed(1)}
                            </span>
                          </td>

                          <td className="py-3.5 px-3 text-center">
                            <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-1 rounded-md" title="Tercera nota (Trabajos Académicos)">
                              {nTrab.toFixed(1)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            <span className={`text-base font-black px-2.5 py-1 rounded-xl shadow-xs border ${
                              isPassed 
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}>
                              {def.toFixed(2)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isPassed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Aprobado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800">
                                <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Reprobado</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                            {rec.comentario ? (
                              <span className="italic">{rec.comentario}</span>
                            ) : (
                              <span className="text-slate-300 font-sans">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                            {rec.creado ? fmtDate(rec.creado) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {filteredGradeRecords.length > itemsPerPage && (
                  <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-500">
                      Mostrando {(activePage - 1) * itemsPerPage + 1} a {Math.min(activePage * itemsPerPage, filteredGradeRecords.length)} de {filteredGradeRecords.length} calificaciones
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={activePage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs transition"
                      >
                        Anterior
                      </button>
                      <button
                        disabled={activePage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs transition"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TRABAJOS Y TALLERES ACADÉMICOS */}
      {/* ======================================================== */}
      {activeTab === 'trabajos' && (
        <div className="space-y-4">
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 flex items-start gap-3 text-xs text-teal-900 shadow-xs print:hidden">
            <FileCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <div>
              <strong className="font-extrabold text-teal-950 block">Conexión con el Libro Oficial de Calificaciones:</strong>
              Cada trabajo calificado se escala a la nota de 0.0 a 5.0 y se sincroniza automáticamente a la planilla oficial como la <strong>tercera nota (Trabajos 33.3%)</strong> del corte correspondiente.
            </div>
          </div>

          <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {filteredAssignmentSubmissions.length === 0 ? (
              <div className="py-12 text-center text-slate-500 flex flex-col items-center px-4">
                <FileCheck className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-base font-bold text-slate-700">
                  {searchQuery ? 'No hay trabajos coincidentes' : 'Aún no hay entregas registradas'}
                </h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm">
                  {searchQuery 
                    ? 'Intenta con otro término de búsqueda.' 
                    : isStaff
                      ? 'Cuando los estudiantes envíen tareas o talleres de tus materias asignadas, aparecerán aquí.'
                      : 'Cuando envíes tareas, talleres o investigaciones desde el módulo Trabajos Académicos, verás aquí su estado y nota asignada.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                      {isStaff && <th className="py-3.5 px-4">Estudiante</th>}
                      <th className="py-3.5 px-4">Trabajo / Tarea</th>
                      <th className="py-3.5 px-4">Materia</th>
                      <th className="py-3.5 px-4">Corte / Parcial</th>
                      <th className="py-3.5 px-4 text-center">Puntaje</th>
                      <th className="py-3.5 px-4 text-center">Nota Escala 5.0 (33.3%)</th>
                      <th className="py-3.5 px-4 text-center">Estado</th>
                      <th className="py-3.5 px-4">Retroalimentación del Docente</th>
                      <th className="py-3.5 px-4">Fecha Entrega</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {paginatedTrabajos.map(subItem => {
                      const isGraded = subItem.estado === 'calificado' && subItem.calificacion != null;
                      const maxPts = subItem.assignment?.puntosMaximos || subItem.assignment?.puntos || 100;
                      const teacherFeedback = subItem.comentarioDocente || subItem.retroalimentacion;

                      return (
                        <tr key={subItem.id} className="hover:bg-slate-50/70 transition-colors">
                          {isStaff && (
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              {subItem.studentName}
                            </td>
                          )}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900">{subItem.assignment?.titulo || 'Trabajo Académico'}</div>
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">{subItem.assignment?.descripcion}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="badge inline-flex px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold">
                              {subItem.subject?.nombre || '—'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                            {subItem.parcial?.nombre || 'General'}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isGraded ? (
                              <div>
                                <span className="font-bold text-slate-800 text-sm">
                                  {subItem.calificacion}
                                </span>
                                <span className="text-slate-400 text-xs"> / {maxPts} pts</span>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-xs italic">Pendiente</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {subItem.scaled5 != null ? (
                              <span className={`text-sm font-black px-2.5 py-1 rounded-xl shadow-xs border ${
                                subItem.scaled5 >= 3.0
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border-rose-200'
                              }`}>
                                {subItem.scaled5.toFixed(2)} / 5.0
                              </span>
                            ) : (
                              <span className="text-slate-300 text-xs">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isGraded ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Calificado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>En Revisión</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-600 max-w-xs">
                            {teacherFeedback ? (
                              <div className="bg-slate-50 p-2 rounded-lg border border-slate-200 italic">
                                "{teacherFeedback}"
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Sin comentarios</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                            {subItem.fechaEntrega ? fmtDate(subItem.fechaEntrega) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Pagination */}
                {filteredAssignmentSubmissions.length > itemsPerPage && (
                  <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-xs font-semibold text-slate-500">
                      Mostrando {(activePage - 1) * itemsPerPage + 1} a {Math.min(activePage * itemsPerPage, filteredAssignmentSubmissions.length)} de {filteredAssignmentSubmissions.length} trabajos
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        disabled={activePage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs transition"
                      >
                        Anterior
                      </button>
                      <button
                        disabled={activePage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs transition"
                      >
                        Siguiente
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: EXÁMENES ONLINE PRESENTADOS / RECIBIDOS */}
      {/* ======================================================== */}
      {activeTab === 'examenes' && (
        <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {filteredExamSubs.length === 0 ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center px-4">
              <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="text-base font-bold text-slate-700">
                {searchQuery ? 'No se encontraron exámenes coincidentes' : isStaff ? 'Sin entregas de exámenes en estas materias' : 'Sin exámenes presentados'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                {searchQuery 
                  ? 'Prueba escribiendo otros términos de búsqueda de materia o examen.' 
                  : isStaff
                    ? 'Aún no se han recibido envíos de estudiantes en los exámenes de estas asignaturas.'
                    : 'Aún no has participado en ninguna evaluación online del instituto.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm text-slate-600">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold text-[11px] uppercase tracking-wider border-b border-slate-200">
                    {isStaff && <th className="py-3.5 px-4">Estudiante</th>}
                    <th className="py-3.5 px-4">Examen</th>
                    <th className="py-3.5 px-4">Materia</th>
                    <th className="py-3.5 px-4 text-center">Puntaje</th>
                    <th className="py-3.5 px-4 text-center">Estado</th>
                    <th className="py-3.5 px-4">Aciertos / Desaciertos</th>
                    <th className="py-3.5 px-4">Duración</th>
                    <th className="py-3.5 px-4">Fecha</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedSubs.map(s => {
                    const exam = exams.find(e => e.id === s.examenId);
                    const student = users.find(u => u.id === s.estudianteId);
                    const isPending = s.estado === 'pendiente';
                    const subjectLabel = exam ? resolveExamSubjectName(exam, subjects) : '—';

                    return (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                        {isStaff && (
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {student?.nombre || s.estudianteNombre || 'Estudiante'}
                          </td>
                        )}
                        <td className="py-3.5 px-4 font-bold text-slate-900" title={exam?.titulo}>
                          {exam ? cleanExamTitle(exam.titulo) : 'Examen institucional'}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="badge inline-flex px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 font-bold">
                            {subjectLabel}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="text-base font-extrabold" style={{ color: s.aprobado ? 'var(--success, #059669)' : 'var(--danger, #e11d48)' }}>
                            {formatGrade5(s.puntaje)}
                          </span>
                          <div className="text-[10px] text-slate-400 font-medium">({s.puntaje}%)</div>
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {isPending ? (
                            <span className="badge inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 border border-amber-100 text-amber-700 font-bold">
                              Pendiente Calificación
                            </span>
                          ) : s.aprobado ? (
                            <span className="badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold">
                              <CheckCircle className="w-3 h-3 text-emerald-600" />
                              <span>Aprobado</span>
                            </span>
                          ) : (
                            <span className="badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-50 border border-rose-100 text-rose-700 font-bold">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Reprobado</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-500">
                          <span className="text-emerald-700 font-bold">{s.correctas || 0} correctas</span>
                          <span className="mx-1 text-slate-300">/</span>
                          <span className="text-red-600 font-bold">{s.incorrectas || 0} incorrectas</span>
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">{s.tiempoUsado || '—'}</td>
                        <td className="py-3.5 px-4 text-xs text-slate-400">
                          <div>{fmtDate(s.fecha)}</div>
                          <div className="text-[10px] mt-0.5">{fmtTime(s.fecha)}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Pagination */}
              {filteredExamSubs.length > itemsPerPage && (
                <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                  <span className="text-xs font-semibold text-slate-400">
                    Mostrando {(activePage - 1) * itemsPerPage + 1} a {Math.min(activePage * itemsPerPage, filteredExamSubs.length)} de {filteredExamSubs.length} evaluaciones
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      disabled={activePage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs transition"
                    >
                      Anterior
                    </button>
                    <button
                      disabled={activePage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 cursor-pointer shadow-xs transition"
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

