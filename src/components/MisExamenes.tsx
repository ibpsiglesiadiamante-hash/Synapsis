/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, BookOpen, Trash2, Edit2, Play, Power, Search, Copy, Download, 
  LayoutGrid, Table as TableIcon, ArrowRight, Layers, Clock, FileQuestion, 
  CheckCircle2, Sparkles, Filter, ChevronRight, GraduationCap, X, RotateCcw,
  SlidersHorizontal
} from 'lucide-react';
import { User, Exam, Parcial, Subject, Semester } from '../types';
import { fmtDate, uid, now, cleanExamTitle, resolveExamSemester, SEMESTRES_OFICIALES } from '../lib/db';
import { SearchableSelect, SelectOption } from './SearchableSelect';

interface MisExamenesProps {
  currentUser: User;
  exams: Exam[];
  parciales: Parcial[];
  subjects: Subject[];
  semesters: Semester[];
  submissions: any[];
  onOpenBuilder: (examId: string) => void;
  onUpdateExams: (updated: Exam[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  users?: User[];
  onSendToRecycle?: (exam: Exam) => void;
}

export const NIVEL_PASTORAL = 'NIVEL I : Biblioteología Pastoral';
export const NIVEL_MINISTERIAL = 'NIVEL II : Biblioteología Ministerial';

export default function MisExamenes({ 
  currentUser, exams, parciales, subjects, semesters, submissions, 
  onOpenBuilder, onUpdateExams, toast, users, onSendToRecycle 
}: MisExamenesProps) {
  
  const isTeacher = currentUser.rol === 'docente';
  const allMyUserIds = (users && currentUser)
    ? users.filter(u => u.nombre === currentUser.nombre || u.email.toLowerCase() === currentUser.email.toLowerCase()).map(u => u.id)
    : [currentUser.id];

  const teacherSubjects = isTeacher 
    ? subjects.filter(s => (s.docenteId && allMyUserIds.includes(s.docenteId)) || currentUser.asignaturas?.includes(s.id))
    : subjects;

  // View Mode: 'semestres' (Columns layout matching reference image) or 'tabla' (classic table)
  const [viewMode, setViewMode] = useState<'semestres' | 'tabla'>('semestres');
  const [filterNivel, setFilterNivel] = useState<'todos' | 'nivel1' | 'nivel2'>('todos');
  const [filterSemestre, setFilterSemestre] = useState<string>('todos');
  const [filterMateria, setFilterMateria] = useState<string>('todos');
  const [filterStatus, setFilterStatus] = useState<'all' | 'activo' | 'borrador' | 'cerrado'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Form Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedSemestre, setSelectedSemestre] = useState('Semestre I');
  const [materia, setMateria] = useState('');
  const [parcialId, setParcialId] = useState('');
  const [description, setDescription] = useState('');
  const [tiempo, setTiempo] = useState(60);
  const [intentos, setIntentos] = useState(1);
  const [aprobacion, setAprobacion] = useState(60);
  const [estado, setEstado] = useState<'borrador' | 'activo'>('borrador');
  const [aleatorio, setAleatorio] = useState(false);
  const [mostrarNota, setMostrarNota] = useState(true);

  // Filtered subjects based on selected semester in creation modal
  const modalSubjectOptions: SelectOption[] = useMemo(() => {
    let list = teacherSubjects;
    if (selectedSemestre && selectedSemestre !== 'todos') {
      const matchSubs = list.filter(s => (s.semestre || '').toLowerCase().trim() === selectedSemestre.toLowerCase().trim());
      if (matchSubs.length > 0) list = matchSubs;
    }
    return list.map(s => ({
      value: s.nombre,
      label: s.nombre,
      subLabel: `${s.codigo ? `[${s.codigo}] ` : ''}${s.semestre ? `· ${s.semestre}` : ''}`,
    }));
  }, [teacherSubjects, selectedSemestre]);

  const userAsignaturas = currentUser.asignaturas || [];

  // Filter exams by teacher assignment
  const userFilteredExams = useMemo(() => {
    return exams.filter(e => {
      if (currentUser.rol === 'admin') return true;
      if (e.docenteId && allMyUserIds.includes(e.docenteId)) return true;
      if (currentUser.id === e.docenteId) return true;
      const subj = subjects.find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === (e.materia || '').toLowerCase().trim());
      if (subj && (userAsignaturas.includes(subj.id) || (subj.docenteId && allMyUserIds.includes(subj.docenteId)))) return true;
      if (e.materia && userAsignaturas.includes(e.materia)) return true;
      return false;
    });
  }, [exams, currentUser, allMyUserIds, subjects, userAsignaturas]);

  // Distinct subjects available for the teacher to filter by, with exam counts
  const availableFilterSubjects = useMemo(() => {
    const map = new Map<string, { id: string; nombre: string; semestre: string; codigo?: string; count: number }>();

    // Seed from teacherSubjects
    teacherSubjects.forEach(s => {
      const key = s.nombre.toLowerCase().trim();
      map.set(key, {
        id: s.id,
        nombre: s.nombre,
        semestre: s.semestre || '',
        codigo: s.codigo,
        count: 0
      });
    });

    // Count exams and capture any exam whose subject is not in teacherSubjects
    userFilteredExams.forEach(e => {
      const sem = resolveExamSemester(e, subjects, semesters, parciales);
      const subj = subjects.find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === (e.materia || '').toLowerCase().trim());
      const rawName = subj ? subj.nombre : (e.materia || 'General');
      const key = rawName.toLowerCase().trim();

      if (!map.has(key)) {
        map.set(key, {
          id: subj ? subj.id : rawName,
          nombre: rawName,
          semestre: sem || '',
          codigo: subj?.codigo,
          count: 1
        });
      } else {
        const item = map.get(key)!;
        item.count += 1;
        if (!item.semestre && sem) item.semestre = sem;
      }
    });

    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }));
  }, [teacherSubjects, userFilteredExams, subjects, semesters, parciales]);

  // Exams filtered simultaneously by status, semester, materia, and search query
  const fullyFilteredExams = useMemo(() => {
    return userFilteredExams.filter(e => {
      // 1. Status Filter
      if (filterStatus !== 'all' && e.estado !== filterStatus) return false;

      // 2. Semester Filter
      const examSem = resolveExamSemester(e, subjects, semesters, parciales);
      if (filterSemestre !== 'todos') {
        if (examSem.toLowerCase().trim() !== filterSemestre.toLowerCase().trim()) return false;
      }

      // 3. Materia Filter
      if (filterMateria !== 'todos') {
        const normFilterMateria = filterMateria.toLowerCase().trim();
        const examSubj = subjects.find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === (e.materia || '').toLowerCase().trim());
        const examSubjName = (examSubj ? examSubj.nombre : e.materia || '').toLowerCase().trim();
        const examSubjId = examSubj ? examSubj.id : e.materia;

        const matches = examSubjName === normFilterMateria ||
                        examSubjId === filterMateria ||
                        e.materia === filterMateria;

        if (!matches) return false;
      }

      // 4. Search Query Filter
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;

      const subj = subjects.find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === (e.materia || '').toLowerCase().trim());
      const subjName = (subj ? subj.nombre : e.materia || '').toLowerCase();
      const subjCode = (subj?.codigo || '').toLowerCase();
      const examTitle = (e.titulo || '').toLowerCase();
      const semName = examSem.toLowerCase();

      return examTitle.includes(q) || subjName.includes(q) || subjCode.includes(q) || semName.includes(q);
    });
  }, [userFilteredExams, filterStatus, filterSemestre, filterMateria, searchQuery, subjects, semesters, parciales]);

  // Semesters list with exams grouped (uses fullyFilteredExams)
  const semesterGroups = useMemo(() => {
    const sem1to5 = ['Semestre I', 'Semestre II', 'Semestre III', 'Semestre IV', 'Semestre V'];
    const sem6to9 = ['Semestre VI', 'Semestre VII', 'Semestre VIII', 'Semestre IX'];

    const buildGroup = (semName: string) => {
      const examsInSem = fullyFilteredExams.filter(e => {
        const resolved = resolveExamSemester(e, subjects, semesters, parciales);
        return resolved.toLowerCase().trim() === semName.toLowerCase().trim();
      });

      // Subjects belonging to this semester
      const semSubjects = subjects.filter(s => (s.semestre || '').toLowerCase().trim() === semName.toLowerCase().trim());

      return {
        name: semName,
        exams: examsInSem,
        subjects: semSubjects
      };
    };

    return {
      nivel1: {
        title: NIVEL_PASTORAL,
        badge: 'NIVEL I (Semestres I al V)',
        semesters: sem1to5.map(buildGroup)
      },
      nivel2: {
        title: NIVEL_MINISTERIAL,
        badge: 'NIVEL II (Semestres VI al IX)',
        semesters: sem6to9.map(buildGroup)
      }
    };
  }, [fullyFilteredExams, subjects, semesters, parciales]);

  // Table pagination based on fullyFilteredExams
  const examsPerPage = 10;
  const tableFilteredExams = fullyFilteredExams;

  const totalPages = Math.ceil(tableFilteredExams.length / examsPerPage) || 1;
  const currentActivePage = Math.min(currentPage, totalPages);
  const paginatedTableExams = tableFilteredExams.slice((currentActivePage - 1) * examsPerPage, currentActivePage * examsPerPage);

  const handleSemestreChange = (newSem: string) => {
    setFilterSemestre(newSem);
    setCurrentPage(1);
    if (newSem !== 'todos') {
      const sem1to5 = ['Semestre I', 'Semestre II', 'Semestre III', 'Semestre IV', 'Semestre V'];
      const sem6to9 = ['Semestre VI', 'Semestre VII', 'Semestre VIII', 'Semestre IX'];
      if (sem1to5.includes(newSem) && filterNivel === 'nivel2') {
        setFilterNivel('nivel1');
      } else if (sem6to9.includes(newSem) && filterNivel === 'nivel1') {
        setFilterNivel('nivel2');
      }
    }
  };

  const handleMateriaChange = (newMat: string) => {
    setFilterMateria(newMat);
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    setFilterSemestre('todos');
    setFilterMateria('todos');
    setFilterStatus('all');
    setFilterNivel('todos');
    setSearchQuery('');
    setCurrentPage(1);
  };

  const hasActiveFilters = filterSemestre !== 'todos' || filterMateria !== 'todos' || filterStatus !== 'all' || filterNivel !== 'todos' || !!searchQuery.trim();

  const handleOpenModal = (presetSemestre?: string) => {
    setTitle('');
    const targetSem = presetSemestre || (filterSemestre !== 'todos' ? filterSemestre : 'Semestre I');
    setSelectedSemestre(targetSem);
    
    // Auto-select materia if filterMateria is active and matches, or first in that semester
    if (filterMateria !== 'todos') {
      const matchFilterMat = teacherSubjects.find(s => s.nombre.toLowerCase().trim() === filterMateria.toLowerCase().trim());
      if (matchFilterMat) {
        setMateria(matchFilterMat.nombre);
        if (matchFilterMat.semestre) setSelectedSemestre(matchFilterMat.semestre);
      } else {
        setMateria(filterMateria);
      }
    } else {
      const firstSub = teacherSubjects.find(s => (s.semestre || '').toLowerCase().trim() === targetSem.toLowerCase().trim()) || teacherSubjects[0];
      setMateria(firstSub ? firstSub.nombre : '');
    }
    
    setParcialId('');
    setDescription('');
    setTiempo(60);
    setIntentos(1);
    setAprobacion(60);
    setEstado('borrador');
    setAleatorio(false);
    setMostrarNota(true);
    setIsModalOpen(true);
  };

  const handleCreateExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!materia.trim()) {
      toast('Debes seleccionar la materia o asignatura', 'error');
      return;
    }
    const resolvedTitle = title.trim() || `Examen - ${materia.trim()}`;

    // Link semester explicitly to preserve robust relation
    const targetSubject = subjects.find(s => s.nombre.toLowerCase().trim() === materia.toLowerCase().trim() || s.id === materia);
    const resolvedSem = selectedSemestre || targetSubject?.semestre || 'Semestre I';

    const newExam: Exam = {
      id: uid(),
      titulo: resolvedTitle.trim(),
      materia: materia.trim(),
      parcialId: parcialId || null,
      semestre: resolvedSem,
      descripcion: description.trim(),
      docenteId: currentUser.id,
      estado,
      tiempo: Number(tiempo) || 0,
      intentos: Number(intentos) || 0,
      aprobacion: Number(aprobacion) || 60,
      aleatorio,
      mostrarNota,
      creado: now(),
      preguntas: [],
      bannerUrl: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=1200&q=80',
    };

    const nextExams = [...exams, newExam];
    onUpdateExams(nextExams);
    setIsModalOpen(false);

    toast(`Examen organizado en ${resolvedSem} con éxito. Abriendo editor...`, 'success');
    onOpenBuilder(newExam.id);
  };

  const toggleExamStatus = (id: string) => {
    const nextExams = exams.map(e => {
      if (e.id === id) {
        const nextState: 'activo' | 'borrador' | 'cerrado' = e.estado === 'activo' ? 'cerrado' : 'activo';
        return { ...e, estado: nextState };
      }
      return e;
    });
    onUpdateExams(nextExams);
    toast('Estado del examen actualizado', 'success');
  };

  const handleDeleteExam = (exam: Exam) => {
    if (onSendToRecycle) {
      onSendToRecycle(exam);
    } else {
      const nextExams = exams.filter(e => e.id !== exam.id);
      onUpdateExams(nextExams);
      toast('Examen eliminado correctamente', 'success');
    }
    setConfirmDeleteId(null);
  };

  const handleDuplicateExam = (sourceExam: Exam) => {
    const newId = uid();
    const clonedExam: Exam = {
      ...JSON.parse(JSON.stringify(sourceExam)),
      id: newId,
      titulo: `${sourceExam.titulo} (Copia)`,
      estado: 'borrador',
      creado: now(),
      actualizado: now()
    };
    onUpdateExams([clonedExam, ...exams]);
    toast(`Examen duplicado con éxito en su semestre: "${clonedExam.titulo}"`, 'success');
  };

  const handleExportAllExamsJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ exams }, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `examenes_backup_${now().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast('Copia de seguridad descargada correctamente', 'success');
  };

  return (
    <div className="page-misExamenes animate-fade-in w-full pb-14">
      {/* HEADER SECTION */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
              Mis exámenes y evaluaciones
            </h2>
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-orange-100 text-[#ea580c] border border-orange-200">
              {fullyFilteredExams.length} {fullyFilteredExams.length === 1 ? 'evaluación' : 'evaluaciones'}
              {hasActiveFilters && userFilteredExams.length > fullyFilteredExams.length && (
                <span className="text-[10px] text-slate-500 font-medium ml-1">
                  (de {userFilteredExams.length} totales)
                </span>
              )}
            </span>
          </div>
          <div className="page-sub text-sm font-medium mt-1 text-slate-500">
            Estructura académica de evaluaciones ordenadas por Semestre y Materia (Docente)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Switcher: Semestres (Columns like image) vs Tabla */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('semestres')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'semestres'
                  ? 'bg-white text-[#ea580c] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ver evaluaciones organizadas por columnas de Semestre (como el Pensum oficial)"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Por Semestres</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tabla')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'tabla'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ver listado en tabla tradicional"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Vista Tabla</span>
            </button>
          </div>

          <button 
            type="button"
            onClick={handleExportAllExamsJson}
            className="btn btn-secondary flex items-center gap-1.5 px-3 py-2 rounded-xl text-slate-700 bg-white border border-slate-200 text-xs font-semibold shadow-xs hover:bg-slate-50 transition cursor-pointer"
            title="Exportar respaldo JSON de todos los exámenes"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Backup ({exams.length})</span>
          </button>

          <button 
            type="button"
            onClick={() => handleOpenModal()}
            className="btn btn-primary flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-white font-semibold shadow hover:scale-[1.02] transition-transform cursor-pointer"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo examen</span>
          </button>
        </div>
      </div>

      {/* LEVEL FILTER TABS (MATCHING REFERENCE IMAGE STYLING) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFilterNivel('nivel1');
            setFilterSemestre('todos');
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer border ${
            filterNivel === 'nivel1'
              ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:text-amber-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span>NIVEL I : Biblioteología Pastoral (Semestres I al V)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterNivel('nivel2');
            setFilterSemestre('todos');
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer border ${
            filterNivel === 'nivel2'
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400 hover:text-indigo-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span>NIVEL II : Biblioteología Ministerial (Semestres VI al IX)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterNivel('todos');
            setFilterSemestre('todos');
            setCurrentPage(1);
          }}
          className={`px-3.5 py-2 rounded-xl font-semibold text-xs sm:text-sm transition-all flex items-center gap-1.5 cursor-pointer border ${
            filterNivel === 'todos'
              ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <span>Todos los Niveles</span>
        </button>
      </div>

      {/* FILTER & SEARCH TOOLBAR WITH SIMULTANEOUS SEMESTER & MATERIA SELECTORS */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5 mb-6">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3.5">
          {/* DUAL SELECTOR: SEMESTRE & MATERIA SIMULTANEOUSLY */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 flex-1 min-w-0">
            {/* 1. Selector de Semestre */}
            <div className="flex-1 min-w-[170px] sm:max-w-[250px]">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#ea580c]" />
                <span>Semestre:</span>
              </label>
              <div className="relative">
                <select
                  value={filterSemestre}
                  onChange={(e) => handleSemestreChange(e.target.value)}
                  className={`w-full bg-slate-50 border text-xs rounded-xl px-3 py-2 font-semibold transition cursor-pointer appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-orange-500/20 ${
                    filterSemestre !== 'todos'
                      ? 'border-[#ea580c] text-orange-950 bg-orange-50/50 ring-1 ring-orange-400/40'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <option value="todos">Todos los Semestres ({userFilteredExams.length})</option>
                  {SEMESTRES_OFICIALES.map(s => {
                    const countInSem = userFilteredExams.filter(e => {
                      const sem = resolveExamSemester(e, subjects, semesters, parciales);
                      return sem.toLowerCase().trim() === s.toLowerCase().trim();
                    }).length;
                    return (
                      <option key={s} value={s}>
                        {s} ({countInSem})
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>
            </div>

            {/* 2. Selector de Materia */}
            <div className="flex-1 min-w-[210px] sm:max-w-[340px]">
              <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                <span>Materia / Asignatura:</span>
              </label>
              <div className="relative">
                <select
                  value={filterMateria}
                  onChange={(e) => handleMateriaChange(e.target.value)}
                  className={`w-full bg-slate-50 border text-xs rounded-xl px-3 py-2 font-semibold transition cursor-pointer appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 truncate ${
                    filterMateria !== 'todos'
                      ? 'border-indigo-500 text-indigo-950 bg-indigo-50/50 ring-1 ring-indigo-400/40'
                      : 'border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <option value="todos">Todas las Materias ({availableFilterSubjects.length})</option>
                  {filterSemestre !== 'todos' ? (
                    <>
                      <optgroup label={`Materias de ${filterSemestre}`}>
                        {availableFilterSubjects
                          .filter(s => (s.semestre || '').toLowerCase().trim() === filterSemestre.toLowerCase().trim())
                          .map(s => (
                            <option key={s.id} value={s.nombre}>
                              {s.codigo ? `[${s.codigo}] ` : ''}{s.nombre} ({s.count} exám.)
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Otras materias">
                        {availableFilterSubjects
                          .filter(s => (s.semestre || '').toLowerCase().trim() !== filterSemestre.toLowerCase().trim())
                          .map(s => (
                            <option key={s.id} value={s.nombre}>
                              {s.codigo ? `[${s.codigo}] ` : ''}{s.nombre} {s.semestre ? `· ${s.semestre}` : ''} ({s.count} exám.)
                            </option>
                          ))}
                      </optgroup>
                    </>
                  ) : (
                    availableFilterSubjects.map(s => (
                      <option key={s.id} value={s.nombre}>
                        {s.codigo ? `[${s.codigo}] ` : ''}{s.nombre} {s.semestre ? `· ${s.semestre}` : ''} ({s.count} exám.)
                      </option>
                    ))
                  )}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-slate-400">
                  <ChevronRight className="w-3.5 h-3.5 rotate-90" />
                </div>
              </div>
            </div>
          </div>

          {/* Status Chips & Search Bar */}
          <div className="flex flex-wrap items-center gap-2.5 self-end lg:self-auto w-full lg:w-auto">
            {/* Status Chips */}
            <div className="chip-tabs flex gap-1.5 flex-wrap items-center">
              {(['all', 'activo', 'borrador', 'cerrado'] as const).map(tabKey => {
                const labels = { all: 'Todos', activo: 'Activos', borrador: 'Borradores', cerrado: 'Cerrados' };
                const isActive = filterStatus === tabKey;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => {
                      setFilterStatus(tabKey);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer border transition-all ${
                      isActive 
                        ? 'bg-slate-900 border-slate-900 text-white shadow-xs' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {labels[tabKey]}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-56 lg:w-60">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
                <Search className="w-3.5 h-3.5" />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Buscar examen o materia..."
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 transition placeholder:text-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ACTIVE FILTERS STRIP & ONE-CLICK RESET */}
        {hasActiveFilters && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-slate-400 flex items-center gap-1 mr-1 text-[11px]">
                <Filter className="w-3 h-3 text-[#ea580c]" /> Filtros activos:
              </span>

              {filterSemestre !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 text-[#ea580c] border border-orange-200 font-bold text-[11px]">
                  <span>Semestre: {filterSemestre}</span>
                  <button
                    type="button"
                    onClick={() => handleSemestreChange('todos')}
                    className="hover:text-orange-900 cursor-pointer ml-0.5"
                    title="Quitar filtro de semestre"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterMateria !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 font-bold text-[11px]">
                  <span>Materia: {filterMateria}</span>
                  <button
                    type="button"
                    onClick={() => handleMateriaChange('todos')}
                    className="hover:text-indigo-950 cursor-pointer ml-0.5"
                    title="Quitar filtro de materia"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterStatus !== 'all' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 font-bold text-[11px]">
                  <span>Estado: {filterStatus}</span>
                  <button
                    type="button"
                    onClick={() => { setFilterStatus('all'); setCurrentPage(1); }}
                    className="hover:text-black cursor-pointer ml-0.5"
                    title="Quitar filtro de estado"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {filterNivel !== 'todos' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[11px]">
                  <span>{filterNivel === 'nivel1' ? 'Nivel I (Semestres I-V)' : 'Nivel II (Semestres VI-IX)'}</span>
                  <button
                    type="button"
                    onClick={() => { setFilterNivel('todos'); setCurrentPage(1); }}
                    className="hover:text-black cursor-pointer ml-0.5"
                    title="Ver todos los niveles"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-bold text-[11px]">
                  <span>Buscar: "{searchQuery}"</span>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="hover:text-black cursor-pointer ml-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={handleResetFilters}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-rose-600 transition cursor-pointer px-2 py-1 rounded-lg hover:bg-rose-50"
              title="Restablecer todos los filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar filtros</span>
            </button>
          </div>
        )}
      </div>

      {/* ============================================================== */}
      {/* VIEW 1: ORGANIZADO POR SEMESTRES (COLUMN-BASED LIKE REFERENCE) */}
      {/* ============================================================== */}
      {viewMode === 'semestres' ? (
        <div className="space-y-8">
          {/* EMPTY STATE IF FILTERS MATCH 0 EXAMS */}
          {fullyFilteredExams.length === 0 && (
            <div className="bg-white rounded-3xl p-10 border border-slate-200 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#ea580c] flex items-center justify-center mx-auto mb-3">
                <Filter className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-800">
                No se encontraron evaluaciones con los filtros seleccionados
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {filterSemestre !== 'todos' && `Semestre: "${filterSemestre}". `}
                {filterMateria !== 'todos' && `Materia: "${filterMateria}". `}
                {filterStatus !== 'all' && `Estado: "${filterStatus}". `}
                {searchQuery && `Búsqueda: "${searchQuery}". `}
                Ajusta o limpia los filtros para explorar el banco de evaluaciones.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer filtros</span>
              </button>
            </div>
          )}
          {/* SECTION: NIVEL I */}
          {(filterNivel === 'todos' || filterNivel === 'nivel1') && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-amber-200/90 shadow-xs">
              <div className="text-center pb-4 mb-5 border-b border-amber-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-left">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    NIVEL I : Biblioteología Pastoral
                  </h3>
                  <div className="text-xs font-semibold text-amber-800 mt-0.5">
                    Evaluaciones de Semestres I al V
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-xs font-bold text-amber-800 bg-amber-100/90 px-3 py-1 rounded-full border border-amber-200">
                    {semesterGroups.nivel1.semesters.reduce((acc, s) => acc + s.exams.length, 0)} evaluaciones registradas
                  </span>
                </div>
              </div>

              {/* Grid of Semesters I to V */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
                {semesterGroups.nivel1.semesters
                  .filter(sem => filterSemestre === 'todos' || sem.name === filterSemestre)
                  .map(sem => (
                    <div key={sem.name} className="bg-slate-50/80 rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden hover:border-amber-400 transition-all">
                      {/* Column Header matching reference: orange rounded tab */}
                      <div className="bg-[#ea580c] text-white py-2.5 px-3 text-center shadow-xs flex items-center justify-between">
                        <div className="text-xs sm:text-[13px] font-black uppercase tracking-wider">{sem.name}</div>
                        <span className="text-[10px] font-extrabold bg-white/20 px-2 py-0.5 rounded-full">
                          {sem.exams.length}
                        </span>
                      </div>

                      {/* Evaluations cards list */}
                      <div className="p-2.5 flex-1 flex flex-col gap-3">
                        {sem.exams.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-xs italic bg-white rounded-xl border border-dashed border-slate-200 p-4">
                            Sin evaluaciones creadas en {sem.name}
                          </div>
                        ) : (
                          sem.exams.map(e => {
                            const numSubs = submissions.filter(s => s.examenId === e.id).length;
                            const subjectObj = subjects.find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === (e.materia || '').toLowerCase().trim());
                            const subjectName = subjectObj?.nombre || e.materia || 'General';
                            const statusColor = e.estado === 'activo' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : e.estado === 'borrador' 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-slate-100 text-slate-600 border-slate-200';

                            return (
                              <div
                                key={e.id}
                                className="group relative bg-white hover:bg-amber-50/40 p-3 rounded-xl border border-slate-200/90 hover:border-amber-400 shadow-xs transition-all flex flex-col justify-between"
                              >
                                <div>
                                  {/* Subject & Status */}
                                  <div className="flex items-center justify-between gap-1 mb-1.5">
                                    <span className="font-mono text-[10px] font-extrabold text-amber-900 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded truncate max-w-[130px]" title={subjectName}>
                                      {subjectObj?.codigo ? `${subjectObj.codigo} · ` : ''}{subjectName}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleExamStatus(e.id)}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase transition cursor-pointer ${statusColor}`}
                                      title="Haz clic para alternar estado"
                                    >
                                      {e.estado}
                                    </button>
                                  </div>

                                  {/* Exam Title */}
                                  <h4 className="font-extrabold text-xs text-slate-900 leading-snug line-clamp-2" title={e.titulo}>
                                    {cleanExamTitle(e.titulo)}
                                  </h4>

                                  {/* Metadata chips */}
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                    <span className="inline-flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                      <FileQuestion className="w-2.5 h-2.5 text-indigo-500" />
                                      {e.preguntas?.length || 0} preg.
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                      <Clock className="w-2.5 h-2.5 text-amber-500" />
                                      {e.tiempo ? `${e.tiempo}m` : 'S/L'}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                      {numSubs} ent.
                                    </span>
                                  </div>
                                </div>

                                {/* Action Bar */}
                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenBuilder(e.id)}
                                    className="px-2 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition cursor-pointer"
                                    title="Editar preguntas en el Builder"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Contenido</span>
                                  </button>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateExam(e)}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                      title="Duplicar examen"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>

                                    {confirmDeleteId === e.id ? (
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteExam(e)}
                                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white cursor-pointer"
                                        >
                                          Sí
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteId(null)}
                                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-600 cursor-pointer"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(e.id)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                        title="Eliminar examen"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Quick Add Button per Semester */}
                      <button
                        type="button"
                        onClick={() => handleOpenModal(sem.name)}
                        className="m-2 p-1.5 rounded-xl border border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/70 hover:bg-amber-100 text-[11px] font-bold text-amber-900 flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nueva en {sem.name}</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* SECTION: NIVEL II */}
          {(filterNivel === 'todos' || filterNivel === 'nivel2') && (
            <div className="bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 rounded-3xl p-5 sm:p-6 border border-indigo-200/80 shadow-xs">
              <div className="text-center pb-4 mb-5 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="text-left">
                  <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                    NIVEL II : Biblioteología Ministerial
                  </h3>
                  <div className="text-xs font-semibold text-indigo-700 mt-0.5">
                    Evaluaciones de Semestres VI al IX
                  </div>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-center">
                  <span className="text-xs font-bold text-indigo-800 bg-indigo-100/90 px-3 py-1 rounded-full border border-indigo-200">
                    {semesterGroups.nivel2.semesters.reduce((acc, s) => acc + s.exams.length, 0)} evaluaciones registradas
                  </span>
                </div>
              </div>

              {/* Grid of Semesters VI to IX */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4">
                {semesterGroups.nivel2.semesters
                  .filter(sem => filterSemestre === 'todos' || sem.name === filterSemestre)
                  .map(sem => (
                    <div key={sem.name} className="bg-slate-50/80 rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden hover:border-indigo-400 transition-all">
                      {/* Column Header */}
                      <div className="bg-indigo-600 text-white py-2.5 px-3 text-center shadow-xs flex items-center justify-between">
                        <div className="text-xs sm:text-[13px] font-black uppercase tracking-wider">{sem.name}</div>
                        <span className="text-[10px] font-extrabold bg-white/20 px-2 py-0.5 rounded-full">
                          {sem.exams.length}
                        </span>
                      </div>

                      {/* Evaluations list */}
                      <div className="p-2.5 flex-1 flex flex-col gap-3">
                        {sem.exams.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-xs italic bg-white rounded-xl border border-dashed border-slate-200 p-4">
                            Sin evaluaciones creadas en {sem.name}
                          </div>
                        ) : (
                          sem.exams.map(e => {
                            const numSubs = submissions.filter(s => s.examenId === e.id).length;
                            const subjectObj = subjects.find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === (e.materia || '').toLowerCase().trim());
                            const subjectName = subjectObj?.nombre || e.materia || 'General';
                            const statusColor = e.estado === 'activo' 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                              : e.estado === 'borrador' 
                                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                : 'bg-slate-100 text-slate-600 border-slate-200';

                            return (
                              <div
                                key={e.id}
                                className="group relative bg-white hover:bg-indigo-50/40 p-3 rounded-xl border border-slate-200/90 hover:border-indigo-400 shadow-xs transition-all flex flex-col justify-between"
                              >
                                <div>
                                  {/* Subject & Status */}
                                  <div className="flex items-center justify-between gap-1 mb-1.5">
                                    <span className="font-mono text-[10px] font-extrabold text-indigo-900 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded truncate max-w-[130px]" title={subjectName}>
                                      {subjectObj?.codigo ? `${subjectObj.codigo} · ` : ''}{subjectName}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => toggleExamStatus(e.id)}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase transition cursor-pointer ${statusColor}`}
                                      title="Haz clic para alternar estado"
                                    >
                                      {e.estado}
                                    </button>
                                  </div>

                                  {/* Exam Title */}
                                  <h4 className="font-extrabold text-xs text-slate-900 leading-snug line-clamp-2" title={e.titulo}>
                                    {cleanExamTitle(e.titulo)}
                                  </h4>

                                  {/* Metadata chips */}
                                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                    <span className="inline-flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                      <FileQuestion className="w-2.5 h-2.5 text-indigo-500" />
                                      {e.preguntas?.length || 0} preg.
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                      <Clock className="w-2.5 h-2.5 text-amber-500" />
                                      {e.tiempo ? `${e.tiempo}m` : 'S/L'}
                                    </span>
                                    <span className="inline-flex items-center gap-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                                      {numSubs} ent.
                                    </span>
                                  </div>
                                </div>

                                {/* Action Bar */}
                                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => onOpenBuilder(e.id)}
                                    className="px-2 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition cursor-pointer"
                                    title="Editar preguntas en el Builder"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                    <span>Contenido</span>
                                  </button>

                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleDuplicateExam(e)}
                                      className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                                      title="Duplicar examen"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>

                                    {confirmDeleteId === e.id ? (
                                      <div className="flex items-center gap-0.5">
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteExam(e)}
                                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-600 text-white cursor-pointer"
                                        >
                                          Sí
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setConfirmDeleteId(null)}
                                          className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-200 text-slate-600 cursor-pointer"
                                        >
                                          No
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmDeleteId(e.id)}
                                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                        title="Eliminar examen"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Quick Add Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenModal(sem.name)}
                        className="m-2 p-1.5 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/70 hover:bg-indigo-100 text-[11px] font-bold text-indigo-900 flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nueva en {sem.name}</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ============================================================== */
        /* VIEW 2: CLASSIC TABLE VIEW WITH FULL DETAILS                   */
        /* ============================================================== */
        <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden theme-bg-surface theme-border">
          {tableFilteredExams.length === 0 ? (
            <div className="empty-state py-12 text-center text-slate-500 flex flex-col items-center">
              <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="empty-title text-base font-semibold text-slate-700">Sin exámenes en este criterio</h4>
              <p className="empty-sub text-xs text-slate-400 mt-1 max-w-sm">
                {hasActiveFilters 
                  ? 'No hay evaluaciones que coincidan con la combinación de filtros aplicada.'
                  : 'Crea tu primera evaluación organizada por semestre.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-3.5 px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer filtros</span>
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm text-slate-600">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-semibold text-xs tracking-wide border-b border-slate-200 theme-bg-surface">
                    <th className="py-3 px-4">Título</th>
                    <th className="py-3 px-4">Semestre</th>
                    <th className="py-3 px-4">Materia</th>
                    <th className="py-3 px-4">Preguntas</th>
                    <th className="py-3 px-4">Entregas</th>
                    <th className="py-3 px-4">Estado</th>
                    <th className="py-3 px-4">Creado</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {paginatedTableExams.map((e) => {
                    const numSubs = submissions.filter(s => s.examenId === e.id).length;
                    const statusBg = e.estado === 'activo' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : e.estado === 'borrador' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-100 text-slate-600 border-slate-200';
                    const subjectObj = subjects.find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === (e.materia || '').toLowerCase().trim());
                    const subjectName = subjectObj?.nombre || e.materia || 'General';
                    const semName = resolveExamSemester(e, subjects, semesters, parciales);

                    return (
                      <tr key={e.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-semibold text-slate-900" style={{ color: 'var(--gray-900)' }}>
                          <div className="flex items-center gap-3">
                            <img
                              src={e.bannerUrl || 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=1200&q=80'}
                              alt={e.titulo}
                              className="w-12 h-8 rounded-lg object-cover border border-slate-200 shadow-xs shrink-0 bg-slate-50"
                              referrerPolicy="no-referrer"
                            />
                            <div className="min-w-0">
                              <span className="block font-extrabold truncate max-w-xs sm:max-w-md xl:max-w-xl" title={e.titulo}>
                                {cleanExamTitle(e.titulo)}
                              </span>
                              {e.subtitulo && (
                                <span className="block text-[10px] font-medium text-slate-400 italic line-clamp-1">{e.subtitulo}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-bold bg-orange-50 text-[#ea580c] border border-orange-200">
                            {semName}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {subjectName}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-500 font-bold">{e.preguntas?.length || 0}</td>
                        <td className="py-3 px-4 text-slate-500 font-bold">{numSubs}</td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${statusBg}`}>
                            {e.estado}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">{fmtDate(e.creado)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex gap-1.5 items-center justify-end">
                            <button 
                              onClick={() => onOpenBuilder(e.id)}
                              className="text-xs px-2.5 py-1 flex items-center gap-1 rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 font-semibold cursor-pointer"
                              title="Editar preguntas en el Builder"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>Contenido</span>
                            </button>
                            <button 
                              onClick={() => handleDuplicateExam(e)}
                              className="text-xs px-2.5 py-1 flex items-center gap-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer"
                              title="Duplicar examen"
                            >
                              <Copy className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Copiar</span>
                            </button>
                            <button 
                              onClick={() => toggleExamStatus(e.id)}
                              className={`text-xs px-2 py-1 flex items-center gap-1 rounded-lg border cursor-pointer ${
                                e.estado === 'activo' 
                                  ? 'bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100' 
                                  : 'bg-emerald-50 border-emerald-250 text-emerald-700 hover:bg-emerald-100'
                              }`}
                            >
                              {e.estado === 'activo' ? <Power className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              <span>{e.estado === 'activo' ? 'Cerrar' : 'Activar'}</span>
                            </button>
                            {confirmDeleteId === e.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteExam(e)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white cursor-pointer"
                                >
                                  Sí
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500 cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setConfirmDeleteId(e.id)} 
                                className="p-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                title="Eliminar examen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {tableFilteredExams.length > examsPerPage && (
                <div className="flex items-center justify-between p-4 border-t border-slate-100 bg-slate-50/50">
                  <span className="text-xs font-semibold text-slate-400">
                    Mostrando { (currentActivePage - 1) * examsPerPage + 1 } a { Math.min(currentActivePage * examsPerPage, tableFilteredExams.length) } de { tableFilteredExams.length } evaluaciones
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-500 mr-2">
                      Página {currentActivePage} de {totalPages}
                    </span>
                    <button
                      disabled={currentActivePage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm transition"
                    >
                      Anterior
                    </button>
                    <button
                      disabled={currentActivePage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-sm transition"
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

      {/* ============================================================== */}
      {/* MODAL: CREAR NUEVO EXAMEN VINCULADO AL SEMESTRE Y MATERIA      */}
      {/* ============================================================== */}
      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[200] p-4">
          <div className="modal bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-y-auto max-h-[92vh] border border-slate-200">
            <div className="modal-header border-b border-slate-100 p-5 flex items-center justify-between sticky top-0 bg-white z-10">
              <div>
                <h3 className="modal-title font-extrabold text-lg text-slate-900">
                  Nueva Evaluación / Examen
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Organizado en su semestre correspondiente del pensum oficial
                </p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="modal-body p-6 space-y-4">
              {/* Step 1: Select Semestre & Materia */}
              <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-200/80 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-orange-950">
                  <span className="w-5 h-5 rounded-full bg-[#ea580c] text-white flex items-center justify-center text-[10px] font-black">
                    1
                  </span>
                  <span>Ubicación Curricular (Semestre y Materia)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Semestre Académico <span className="text-[#ea580c]">*</span>
                    </label>
                    <select
                      value={selectedSemestre}
                      onChange={e => {
                        const newSem = e.target.value;
                        setSelectedSemestre(newSem);
                        // Filter matching subjects and set first
                        const matchingSub = teacherSubjects.find(s => (s.semestre || '').toLowerCase().trim() === newSem.toLowerCase().trim());
                        if (matchingSub) {
                          setMateria(matchingSub.nombre);
                          if (!title.trim() || title.startsWith('Examen de ')) {
                            setTitle(`Examen de ${matchingSub.nombre}`);
                          }
                        }
                      }}
                      className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-[#ea580c]"
                    >
                      {SEMESTRES_OFICIALES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Materia / Asignatura <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={modalSubjectOptions}
                      value={materia}
                      placeholder="-- Selecciona materia --"
                      searchPlaceholder="Buscar materia..."
                      noResultsText="Sin materias en este semestre"
                      onChange={selectedMat => {
                        setMateria(selectedMat);
                        if (!title.trim() || title.startsWith('Examen de ')) {
                          setTitle(`Examen de ${selectedMat}`);
                        }
                        // Auto-sync semester if subject has it
                        const foundSub = subjects.find(s => s.nombre === selectedMat);
                        if (foundSub?.semestre) {
                          setSelectedSemestre(foundSub.semestre);
                        }
                        const matchingParc = foundSub ? parciales.find(p => p.asignatura === foundSub.id) : null;
                        setParcialId(matchingParc?.id || '');
                      }}
                    />
                  </div>
                </div>

                {/* Parcial Relativo opcional */}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Vincular a Parcial / Corte Evaluativo (Opcional)
                  </label>
                  <select 
                    value={parcialId} 
                    onChange={e => setParcialId(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Sin parcial relativo (Evaluación independiente) --</option>
                    {(() => {
                      const matchingSub = subjects.find(s => s.nombre === materia);
                      const filteredParcs = matchingSub ? parciales.filter(p => p.asignatura === matchingSub.id) : parciales;
                      return filteredParcs.map(p => {
                        const sub = subjects.find(s => s.id === p.asignatura);
                        return (
                          <option key={p.id} value={p.id}>
                            {p.nombre} {sub ? `(${sub.nombre})` : ''}
                          </option>
                        );
                      });
                    })()}
                  </select>
                </div>
              </div>

              {/* Step 2: Basic Info */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Título de la Evaluación <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required 
                    value={title} 
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Ej: EVALUACIÓN I - TEOLOGÍA" 
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 bg-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Instrucciones generales para el estudiante
                  </label>
                  <textarea 
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Instrucciones para la presentación del examen..." 
                    rows={2}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-indigo-600 bg-white"
                  />
                </div>
              </div>

              {/* Step 3: Rules & Limits */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Tiempo (min)</label>
                  <input 
                    type="number" 
                    min={0} 
                    value={tiempo} 
                    onChange={e => setTiempo(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 bg-white"
                  />
                  <span className="text-[10px] text-slate-400">0 = Ilimitado</span>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Intentos</label>
                  <input 
                    type="number" 
                    min={0} 
                    value={intentos} 
                    onChange={e => setIntentos(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 bg-white"
                  />
                  <span className="text-[10px] text-slate-400">0 = Infinitos</span>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">Aprobación (%)</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={100}
                    value={aprobacion} 
                    onChange={e => setAprobacion(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-600 bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Min. aprobatorio</span>
                </div>
              </div>

              {/* Estado y opciones */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Estado inicial:</span>
                  <select
                    value={estado}
                    onChange={e => setEstado(e.target.value as any)}
                    className="p-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-800"
                  >
                    <option value="borrador">Borrador (Oculto)</option>
                    <option value="activo">Activo (Publicado)</option>
                  </select>
                </div>

                <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={aleatorio} 
                      onChange={e => setAleatorio(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Aleatorio</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={mostrarNota} 
                      onChange={e => setMostrarNota(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-0"
                    />
                    <span>Ver nota al final</span>
                  </label>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="modal-footer pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-md hover:scale-[1.02] transition-transform flex items-center gap-1.5 cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <span>Crear y Abrir Builder</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
