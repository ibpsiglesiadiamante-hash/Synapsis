/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Plus, Trash2, Edit2, BookOpen, GraduationCap, Users, ChevronLeft, ChevronRight, 
  Search, Sparkles, RefreshCw, Layers, LayoutGrid, Table as TableIcon, BookmarkCheck, ArrowRight
} from 'lucide-react';
import { Subject, User, Semester } from '../types';
import { uid, now, fmtDate, generateSubjectCode, backupAppState } from '../lib/db';
import { uploadTheologicalSubjectsToFirestore } from '../lib/firebase';

interface AsignaturasProps {
  subjects: Subject[];
  users: User[];
  semesters?: Semester[];
  onUpdateSubjects: (updated: Subject[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export const NIVEL_PASTORAL = 'NIVEL I : Biblioteología Pastoral';
export const NIVEL_MINISTERIAL = 'NIVEL II : Biblioteología Ministerial';

export const SEMESTRES_LIST = [
  'Semestre I',
  'Semestre II',
  'Semestre III',
  'Semestre IV',
  'Semestre V',
  'Semestre VI',
  'Semestre VII',
  'Semestre VIII',
  'Semestre IX'
];

export default function Asignaturas({ subjects, users, semesters = [], onUpdateSubjects, toast }: AsignaturasProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nivel, setNivel] = useState<string>(NIVEL_PASTORAL);
  const [semestre, setSemestre] = useState<string>('Semestre I');
  const [docenteId, setDocenteId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Filters and view modes
  const [searchQuery, setSearchQuery] = useState('');
  const [filterNivel, setFilterNivel] = useState<string>('todos');
  const [filterSemestre, setFilterSemestre] = useState<string>('todos');
  const [viewMode, setViewMode] = useState<'pensum' | 'tabla'>('pensum');

  const [isCodeAuto, setIsCodeAuto] = useState(true);
  const [isSyncingTheological, setIsSyncingTheological] = useState(false);

  // Function to load all 36 biblical subjects from backupAppState and push to Firestore
  const handleLoadOfficialCurriculum = async () => {
    try {
      setIsSyncingTheological(true);
      const defaultSubs = (backupAppState.subjects || []) as Subject[];
      const map = new Map<string, Subject>();
      // 1. Preload all 36 official subjects
      defaultSubs.forEach(ds => map.set(ds.id, ds));
      // 2. Preserve any existing edits or custom subjects
      subjects.forEach(s => {
        if (!s || !s.id) return;
        const matchingDefault = defaultSubs.find(ds => (ds.nombre || '').toLowerCase().trim() === (s.nombre || '').toLowerCase().trim());
        if (matchingDefault) {
          map.set(matchingDefault.id, {
            ...matchingDefault,
            ...s,
            id: matchingDefault.id,
            nivel: s.nivel || matchingDefault.nivel,
            semestre: s.semestre || matchingDefault.semestre,
            codigo: s.codigo || matchingDefault.codigo,
          });
        } else {
          map.set(s.id, s);
        }
      });
      const updated = Array.from(map.values());
      onUpdateSubjects(updated);
      await uploadTheologicalSubjectsToFirestore(updated);
      toast(`¡Cargadas y sincronizadas exitosamente las 36 materias del pensum teológico en la base de datos!`, 'success');
    } catch (e) {
      console.error('Error loading official curriculum:', e);
      toast('Error al sincronizar materias con la base de datos', 'error');
    } finally {
      setIsSyncingTheological(false);
    }
  };

  // Docentes
  const docentes = useMemo(() => users.filter(u => u.rol === 'docente' || u.rol === 'admin'), [users]);

  // Handle semester change inside modal to automatically set level
  const handleSemestreChange = (newSem: string) => {
    setSemestre(newSem);
    if (['Semestre I', 'Semestre II', 'Semestre III', 'Semestre IV', 'Semestre V'].includes(newSem)) {
      setNivel(NIVEL_PASTORAL);
    } else {
      setNivel(NIVEL_MINISTERIAL);
    }
  };

  const handleOpenCreateModal = (presetSem?: string, presetNivel?: string) => {
    setEditingId(null);
    setNombre('');
    setIsCodeAuto(true);
    const autoCode = generateSubjectCode('', subjects);
    setCodigo(autoCode);
    const initialSem = presetSem || 'Semestre I';
    setSemestre(initialSem);
    if (presetNivel) {
      setNivel(presetNivel);
    } else if (['Semestre I', 'Semestre II', 'Semestre III', 'Semestre IV', 'Semestre V'].includes(initialSem)) {
      setNivel(NIVEL_PASTORAL);
    } else {
      setNivel(NIVEL_MINISTERIAL);
    }
    setDocenteId('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sub: Subject) => {
    setEditingId(sub.id);
    setNombre(sub.nombre);
    setCodigo(sub.codigo || generateSubjectCode(sub.nombre, subjects));
    setIsCodeAuto(false);
    setNivel(sub.nivel || NIVEL_PASTORAL);
    setSemestre(sub.semestre || 'Semestre I');
    setDocenteId(sub.docenteId || '');
    setIsModalOpen(true);
  };

  const handleNombreChange = (val: string) => {
    setNombre(val);
    if (!editingId && isCodeAuto) {
      setCodigo(generateSubjectCode(val, subjects));
    }
  };

  const handleRegenerateCode = () => {
    const freshCode = generateSubjectCode(nombre, subjects);
    setCodigo(freshCode);
    setIsCodeAuto(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast('El nombre de la materia es obligatorio', 'error');
      return;
    }

    const finalCode = codigo.trim() || generateSubjectCode(nombre, subjects);
    const nextSubs = [...subjects];

    if (editingId) {
      const idx = nextSubs.findIndex(s => s.id === editingId);
      if (idx > -1) {
        nextSubs[idx] = {
          ...nextSubs[idx],
          nombre: nombre.trim(),
          codigo: finalCode,
          nivel,
          semestre,
          docenteId,
          actualizado: now(),
        };
        onUpdateSubjects(nextSubs);
        toast('Materia o asignatura actualizada con éxito', 'success');
      }
    } else {
      const newSub: Subject = {
        id: uid(),
        nombre: nombre.trim(),
        codigo: finalCode,
        nivel,
        semestre,
        docenteId,
        creado: now(),
      };
      onUpdateSubjects([...nextSubs, newSub]);
      toast(`Asignatura creada satisfactoriamente con código ${finalCode}`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const nextSubs = subjects.filter(s => s.id !== id);
    onUpdateSubjects(nextSubs);
    toast('Asignatura eliminada del catálogo correctamente', 'success');
  };

  // Filter subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter(sub => {
      // Search query filter
      const q = searchQuery.toLowerCase().trim();
      const doc = users.find(u => u.id === sub.docenteId);
      const docName = doc ? doc.nombre : '';
      const matchesSearch = !q || (
        sub.nombre.toLowerCase().includes(q) ||
        (sub.codigo || '').toLowerCase().includes(q) ||
        docName.toLowerCase().includes(q) ||
        (sub.semestre || '').toLowerCase().includes(q)
      );

      // Level filter
      const matchesNivel = filterNivel === 'todos' || sub.nivel === filterNivel;

      // Semester filter
      const matchesSemestre = filterSemestre === 'todos' || sub.semestre === filterSemestre;

      return matchesSearch && matchesNivel && matchesSemestre;
    });
  }, [subjects, users, searchQuery, filterNivel, filterSemestre]);

  // Pagination for table view
  const itemsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredSubjects.length / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;
  const currentTableSubjects = filteredSubjects.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  // Grouped curriculum data for pensum view
  const pensumGroups = useMemo(() => {
    const nivel1Semesters = ['Semestre I', 'Semestre II', 'Semestre III', 'Semestre IV', 'Semestre V'];
    const nivel2Semesters = ['Semestre VI', 'Semestre VII', 'Semestre VIII', 'Semestre IX'];

    const getSubjectsForSemester = (semName: string) => {
      return subjects.filter(s => {
        const matchesSem = (s.semestre || '').toLowerCase() === semName.toLowerCase();
        const q = searchQuery.toLowerCase().trim();
        if (!q) return matchesSem;
        const doc = users.find(u => u.id === s.docenteId);
        return matchesSem && (
          s.nombre.toLowerCase().includes(q) ||
          (s.codigo || '').toLowerCase().includes(q) ||
          (doc?.nombre || '').toLowerCase().includes(q)
        );
      });
    };

    return {
      nivel1: {
        title: NIVEL_PASTORAL,
        badge: 'NIVEL I',
        semesters: nivel1Semesters.map(name => ({
          name,
          subjects: getSubjectsForSemester(name)
        }))
      },
      nivel2: {
        title: NIVEL_MINISTERIAL,
        badge: 'NIVEL II',
        semesters: nivel2Semesters.map(name => ({
          name,
          subjects: getSubjectsForSemester(name)
        }))
      }
    };
  }, [subjects, users, searchQuery]);

  return (
    <div className="page-asignaturas animate-fade-in pb-12">
      {/* Header */}
      <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
              Plan de Estudios y Materias
            </h2>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              {subjects.length} materias registradas
            </span>
          </div>
          <div className="page-sub text-sm font-medium mt-1 text-slate-500 font-sans">
            Pensum teológico estructurado por Niveles y Semestres académicos (2026)
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Button to load all 36 biblical subjects to database */}
          <button
            type="button"
            onClick={handleLoadOfficialCurriculum}
            disabled={isSyncingTheological}
            className="btn flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 font-semibold text-xs shadow-xs cursor-pointer transition-all disabled:opacity-50"
            title="Cargar y sincronizar con Firestore las 36 materias teológicas oficiales del Instituto"
          >
            <Sparkles className={`w-3.5 h-3.5 text-emerald-600 ${isSyncingTheological ? 'animate-spin' : ''}`} />
            <span>{isSyncingTheological ? 'Sincronizando...' : 'Cargar 36 Materias'}</span>
          </button>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('pensum')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'pensum'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ver pensum distribuido por niveles y semestres"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Pensum por Niveles</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tabla')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === 'tabla'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ver listado en formato tabla con paginación"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Tabla de Materias</span>
            </button>
          </div>

          {/* New Subject Button */}
          <button
            onClick={() => handleOpenCreateModal()}
            className="btn btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow hover:scale-[1.02] transition-transform cursor-pointer"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <BookOpen className="w-4 h-4" />
            <span>Nueva materia</span>
          </button>
        </div>
      </div>

      {/* Banner if not all 36 subjects are loaded */}
      {subjects.length < 36 && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50/90 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-100 rounded-xl text-amber-700 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Pensum Incompleto ({subjects.length} de 36 materias teológicas registradas)
              </h4>
              <p className="text-[11px] text-amber-700 mt-0.5 font-medium">
                Carga de inmediato las 36 materias bíblicas/teológicas oficiales de los 9 semestres (Nivel I y II) con un solo clic.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLoadOfficialCurriculum}
            disabled={isSyncingTheological}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer shrink-0 transition-colors disabled:opacity-50"
          >
            {isSyncingTheological ? 'Cargando y subiendo...' : 'Cargar 36 Materias Ahora'}
          </button>
        </div>
      )}

      {/* Quick Level Filter Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFilterNivel(NIVEL_PASTORAL);
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer border ${
            filterNivel === NIVEL_PASTORAL
              ? 'bg-[#ea580c] text-white border-[#ea580c] shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:text-amber-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span>NIVEL I : Biblioteología Pastoral (Sem I-V)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterNivel(NIVEL_MINISTERIAL);
            setCurrentPage(1);
          }}
          className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer border ${
            filterNivel === NIVEL_MINISTERIAL
              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
              : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-400 hover:text-indigo-800'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-white"></span>
          <span>NIVEL II : Biblioteología Ministerial (Sem VI-IX)</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setFilterNivel('todos');
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

      {/* Filter and Search Bar */}
      <div className="mb-6 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center gap-3 justify-between">
        <div className="relative w-full md:max-w-xs flex-1">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Buscar materia, código o docente..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs font-semibold text-slate-800 transition placeholder:text-slate-400 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400 hover:text-slate-600 cursor-pointer font-bold text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Level and Semester Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Nivel:</span>
            <select
              value={filterNivel}
              onChange={(e) => {
                setFilterNivel(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="todos">Todos los Niveles</option>
              <option value={NIVEL_PASTORAL}>Nivel I: Pastoral (Sem I-V)</option>
              <option value={NIVEL_MINISTERIAL}>Nivel II: Ministerial (Sem VI-IX)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-500 font-medium">Semestre:</span>
            <select
              value={filterSemestre}
              onChange={(e) => {
                setFilterSemestre(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1.5 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="todos">Todos los Semestres</option>
              {SEMESTRES_LIST.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="text-[11px] font-bold text-indigo-700 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-100 shrink-0">
            {filteredSubjects.length} encontradas
          </div>
        </div>
      </div>

      {/* VIEW 1: PENSUM CURRICULAR GRID (Matching the study plan PDF and reference layout) */}
      {viewMode === 'pensum' ? (
        <div className="space-y-8">
          {/* NIVEL I SECTION */}
          {(filterNivel === 'todos' || filterNivel === NIVEL_PASTORAL) && (
            <div className="bg-white rounded-3xl p-5 sm:p-6 border border-amber-200/90 shadow-sm">
              {/* Header matching image reference */}
              <div className="text-center pb-4 mb-5 border-b border-amber-100">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase">
                  NIVEL I : Biblioteología Pastoral
                </h3>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-3 py-0.5 rounded-full">
                    Semestres I al V • 20 Materias Troncales
                  </span>
                </div>
              </div>

              {/* Columns for Semestres I to V */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4">
                {pensumGroups.nivel1.semesters
                  .filter(sem => filterSemestre === 'todos' || sem.name === filterSemestre)
                  .map(sem => (
                    <div key={sem.name} className="bg-slate-50/70 rounded-2xl border border-slate-200 shadow-xs flex flex-col overflow-hidden hover:border-amber-400 transition-all">
                      {/* Column Header matching reference: orange rounded tab */}
                      <div className="bg-[#ea580c] text-white py-2.5 px-3 text-center shadow-xs">
                        <div className="text-xs sm:text-[13px] font-black uppercase tracking-wider">{sem.name}</div>
                      </div>

                      {/* Subjects list */}
                      <div className="p-3 flex-1 flex flex-col gap-3.5 justify-around">
                        {sem.subjects.length === 0 ? (
                          <div className="text-center py-8 text-slate-400 text-xs italic">
                            Sin materias registradas
                          </div>
                        ) : (
                          sem.subjects.map(sub => {
                            const doc = users.find(u => u.id === sub.docenteId);
                            return (
                              <div
                                key={sub.id}
                                className="group relative bg-white hover:bg-amber-50/60 p-3 sm:p-3.5 rounded-xl border border-slate-200/90 hover:border-amber-400 transition-all flex flex-col justify-center min-h-[90px] shadow-xs"
                              >
                                <div className="flex items-center gap-2.5">
                                  {/* Orange Arrow exactly as in user reference */}
                                  <ArrowRight className="w-5 h-5 text-[#ea580c] shrink-0 stroke-[2.5]" />
                                  <div className="font-extrabold text-xs sm:text-[13px] text-slate-900 leading-snug flex-1 text-center pr-1">
                                    {sub.nombre}
                                  </div>
                                </div>

                                {/* Subtle meta footer (code & docent & actions) */}
                                <div className="mt-2 pt-1.5 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px] text-slate-500">
                                  <span className="font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/60">
                                    {sub.codigo || 'S/C'}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(sub)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 rounded cursor-pointer transition-colors"
                                      title="Editar materia"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(sub.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                                      title="Eliminar materia"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
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
                        onClick={() => handleOpenCreateModal(sem.name, NIVEL_PASTORAL)}
                        className="m-2.5 p-1.5 rounded-xl border border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/60 hover:bg-amber-100 text-[11px] font-bold text-amber-900 flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Agregar materia</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* NIVEL II SECTION */}
          {(filterNivel === 'todos' || filterNivel === NIVEL_MINISTERIAL) && (
            <div className="bg-gradient-to-br from-indigo-50/40 via-white to-purple-50/30 rounded-3xl p-5 border border-indigo-200/80 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-indigo-100">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 bg-indigo-600 text-white font-black text-xs uppercase tracking-wider rounded-lg shadow-xs">
                    {pensumGroups.nivel2.badge}
                  </span>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    {pensumGroups.nivel2.title}
                  </h3>
                </div>
                <span className="text-xs font-semibold text-indigo-800 bg-indigo-100/70 px-3 py-1 rounded-full w-fit">
                  4 Semestres Académicos (VI al IX)
                </span>
              </div>

              {/* Columns for Semestres VI to IX */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3.5">
                {pensumGroups.nivel2.semesters
                  .filter(sem => filterSemestre === 'todos' || sem.name === filterSemestre)
                  .map(sem => (
                    <div key={sem.name} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden hover:border-indigo-300 transition">
                      {/* Column Header */}
                      <div className="bg-slate-900 text-white p-3 text-center">
                        <div className="text-xs font-black uppercase tracking-wider">{sem.name}</div>
                        <div className="text-[10px] text-indigo-300 font-semibold">{sem.subjects.length} materias</div>
                      </div>

                      {/* Subjects list */}
                      <div className="p-2.5 flex-1 flex flex-col gap-2">
                        {sem.subjects.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs italic">
                            Sin materias registradas
                          </div>
                        ) : (
                          sem.subjects.map(sub => {
                            const doc = users.find(u => u.id === sub.docenteId);
                            return (
                              <div
                                key={sub.id}
                                className="group relative bg-slate-50 hover:bg-indigo-50/50 p-2.5 rounded-xl border border-slate-100 hover:border-indigo-200 transition text-left"
                              >
                                <div className="flex items-start justify-between gap-1 mb-1">
                                  <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-100/80 px-1.5 py-0.5 rounded">
                                    {sub.codigo || 'S/C'}
                                  </span>
                                  <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditModal(sub)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer"
                                      title="Editar materia"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(sub.id)}
                                      className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                                      title="Eliminar materia"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                                <div className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                                  {sub.nombre}
                                </div>
                                <div className="mt-1.5 flex items-center gap-1 text-[10px] text-slate-500">
                                  <Users className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate">{doc ? doc.nombre : 'Sin docente asignado'}</span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Quick Add Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenCreateModal(sem.name, NIVEL_MINISTERIAL)}
                        className="m-2 p-1.5 rounded-xl border border-dashed border-indigo-300 hover:border-indigo-500 bg-indigo-50/50 hover:bg-indigo-100/50 text-[11px] font-bold text-indigo-800 flex items-center justify-center gap-1 cursor-pointer transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Agregar materia</span>
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VIEW 2: TABLE VIEW */
        <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden theme-bg-surface theme-border">
          {filteredSubjects.length === 0 ? (
            <div className="empty py-12 text-center text-slate-500 flex flex-col items-center">
              <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
              <h4 className="font-bold text-slate-800">No se encontraron materias</h4>
              <p className="text-xs text-slate-400 mt-1">
                Prueba cambiando los filtros de búsqueda o registra una nueva materia.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm text-slate-600">
                <thead>
                  <tr className="bg-slate-50 text-slate-400 font-medium text-xs uppercase tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Asignatura</th>
                    <th className="py-3 px-4">Código</th>
                    <th className="py-3 px-4">Nivel Académico</th>
                    <th className="py-3 px-4">Semestre</th>
                    <th className="py-3 px-4">Docente a cargo</th>
                    <th className="py-3 px-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {currentTableSubjects.map(sub => {
                    const doc = users.find(u => u.id === sub.docenteId);
                    const isNivel1 = (sub.nivel || '').includes('NIVEL I');
                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                              <GraduationCap className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                            </div>
                            <span className="text-slate-900 font-bold block" style={{ color: 'var(--gray-900)' }}>
                              {sub.nombre}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-xs font-bold text-indigo-600">{sub.codigo || '—'}</td>
                        <td className="py-3.5 px-4">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                            isNivel1 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                          }`}>
                            {sub.nivel ? (isNivel1 ? 'Nivel I : Pastoral' : 'Nivel II : Ministerial') : 'Nivel I'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {sub.semestre || 'Semestre I'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {doc ? (
                            <div className="flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-slate-400" />
                              <span>{doc.nombre}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No asignado</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleOpenEditModal(sub)}
                              className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                              title="Editar materia"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {confirmDeleteId === sub.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    handleDelete(sub.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                                >
                                  Sí
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 rounded text-[10px] uppercase font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(sub.id)}
                                className="p-1 rounded border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                                title="Eliminar materia"
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

              {filteredSubjects.length > itemsPerPage && (
                <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-xs text-slate-500 select-none">
                    Mostrando <b>{((activePage - 1) * itemsPerPage) + 1}</b> a{' '}
                    <b>{Math.min(activePage * itemsPerPage, filteredSubjects.length)}</b> de{' '}
                    <b>{filteredSubjects.length}</b> materias
                  </div>
                  <div className="flex items-center gap-1.5 font-sans">
                    <button
                      disabled={activePage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1 text-xs font-semibold rounded-lg transition cursor-pointer ${
                          activePage === page
                            ? 'bg-indigo-600 text-white'
                            : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      disabled={activePage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT SUBJECT MODAL */}
      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
            <div className="modal-header border-b border-slate-100 p-5 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-600" />
                <h3 className="modal-title font-bold text-slate-900 text-base">
                  {editingId ? 'Editar Asignatura' : 'Registrar Nueva Asignatura'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Nombre */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Nombre de la materia <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={e => handleNombreChange(e.target.value)}
                  placeholder="Ej. Teología, Pentateuco, Hermenéutica..."
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 bg-white font-medium"
                />
              </div>

              {/* Semestre & Nivel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Semestre <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={semestre}
                    onChange={e => handleSemestreChange(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 bg-white cursor-pointer text-slate-800"
                  >
                    {SEMESTRES_LIST.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Nivel Académico
                  </label>
                  <select
                    value={nivel}
                    onChange={e => setNivel(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-600 bg-slate-50 cursor-pointer text-slate-800"
                  >
                    <option value={NIVEL_PASTORAL}>Nivel I : Pastoral</option>
                    <option value={NIVEL_MINISTERIAL}>Nivel II : Ministerial</option>
                  </select>
                </div>
              </div>

              {/* Código */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Código de materia <span className="text-indigo-600 font-mono">(Automático)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateCode}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition"
                    title="Regenerar código según el nombre"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerar</span>
                  </button>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={codigo}
                    onChange={e => {
                      setCodigo(e.target.value);
                      setIsCodeAuto(false);
                    }}
                    placeholder="Ej. TEO-101"
                    className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 bg-slate-50 font-mono font-bold text-indigo-900 uppercase"
                  />
                  <span className="absolute right-3 top-3 pointer-events-none">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                  </span>
                </div>
              </div>

              {/* Docente a cargo */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Docente a cargo
                </label>
                <select
                  value={docenteId}
                  onChange={e => setDocenteId(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-600 bg-white cursor-pointer text-slate-700"
                >
                  <option value="">-- Sin docente asignado --</option>
                  {docentes.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre} ({d.rol})</option>
                  ))}
                </select>
              </div>

              {/* Footer */}
              <div className="border-t border-slate-100 flex justify-end gap-2.5 pt-4 mt-6 bg-slate-50 -mx-5 -mb-5 p-4 rounded-b-3xl">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl hover:bg-slate-100 text-slate-600 font-semibold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-white font-bold rounded-xl text-xs shadow hover:opacity-95 cursor-pointer bg-indigo-600 hover:bg-indigo-700"
                >
                  {editingId ? 'Guardar Cambios' : 'Crear Asignatura'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
