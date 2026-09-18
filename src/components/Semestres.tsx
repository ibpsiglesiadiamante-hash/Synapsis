/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { CalendarDays, Plus, Trash2, Edit2, CheckCircle2, XSquare, ChevronLeft, ChevronRight, Sparkles, RefreshCw } from 'lucide-react';
import { Semester } from '../types';
import { uid, now, fmtDate, generateSemesterCode } from '../lib/db';
import { saveDocToFirestore, deleteDocFromFirestore } from '../lib/firebase';

interface SemestresProps {
  semesters: Semester[];
  onUpdateSemesters: (updated: Semester[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export const NIVEL_PASTORAL = 'NIVEL I : Biblioteología Pastoral';
export const NIVEL_MINISTERIAL = 'NIVEL II : Biblioteología Ministerial';

export default function Semestres({ semesters, onUpdateSemesters, toast }: SemestresProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [nivel, setNivel] = useState<string>(NIVEL_PASTORAL);
  const [estado, setEstado] = useState<'activo' | 'inactivo'>('activo');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterNivel, setFilterNivel] = useState<string>('todos');

  // Filtered list
  const filteredSemesters = semesters.filter(s => {
    if (filterNivel === 'todos') return true;
    return s.nivel === filterNivel;
  });

  // Pagination states & calculations
  const itemsPerPage = 7;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(filteredSemesters.length / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;

  const currentSemesters = filteredSemesters.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const [isCodeAuto, setIsCodeAuto] = useState(true);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setNombre('');
    setIsCodeAuto(true);
    const autoCode = generateSemesterCode('', semesters);
    setCodigo(autoCode);
    setNivel(NIVEL_PASTORAL);
    setEstado('activo');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sem: Semester) => {
    setEditingId(sem.id);
    setNombre(sem.nombre);
    setCodigo(sem.codigo || generateSemesterCode(sem.nombre, semesters));
    setNivel(sem.nivel || (['Semestre I', 'Semestre II', 'Semestre III', 'Semestre IV', 'Semestre V'].includes(sem.nombre) ? NIVEL_PASTORAL : NIVEL_MINISTERIAL));
    setIsCodeAuto(false);
    setEstado(sem.estado);
    setIsModalOpen(true);
  };

  const handleNombreChange = (val: string) => {
    setNombre(val);
    if (!editingId && isCodeAuto) {
      try {
        setCodigo(generateSemesterCode(val, semesters));
      } catch (err) {
        console.warn('Error auto-generating semester code:', err);
      }
    }
    if (['Semestre VI', 'Semestre VII', 'Semestre VIII', 'Semestre IX', 'VI', 'VII', 'VIII', 'IX'].some(k => val.includes(k))) {
      setNivel(NIVEL_MINISTERIAL);
    } else if (['Semestre I', 'Semestre II', 'Semestre III', 'Semestre IV', 'Semestre V', 'I', 'II', 'III', 'IV', 'V'].some(k => val.includes(k))) {
      setNivel(NIVEL_PASTORAL);
    }
  };

  const handleRegenerateCode = () => {
    try {
      const freshCode = generateSemesterCode(nombre, semesters);
      setCodigo(freshCode);
      setIsCodeAuto(true);
    } catch (err) {
      console.warn('Error regenerating semester code:', err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNombre = (nombre || '').trim();
    if (!cleanNombre) {
      toast('El nombre del semestre es requerido', 'error');
      return;
    }

    const finalCode = (codigo || '').trim() || generateSemesterCode(cleanNombre, semesters);
    const safeSems = Array.isArray(semesters) ? semesters.filter((s): s is Semester => Boolean(s && s.id)) : [];
    const nextSems = [...safeSems];

    if (editingId) {
      const idx = nextSems.findIndex(s => s.id === editingId);
      if (idx > -1) {
        const updatedSem: Semester = {
          ...nextSems[idx],
          nombre: cleanNombre,
          codigo: finalCode,
          nivel,
          estado,
          actualizado: now(),
        };
        nextSems[idx] = updatedSem;
        onUpdateSemesters(nextSems);
        saveDocToFirestore('semesters', updatedSem).catch(err => {
          console.warn('Error saving semester update to Firestore:', err);
        });
        toast('Semestre actualizado correctamente y re-calculado', 'success');
      }
    } else {
      const newSem: Semester = {
        id: uid(),
        nombre: cleanNombre,
        codigo: finalCode,
        nivel,
        estado,
        creado: now(),
      };
      onUpdateSemesters([...nextSems, newSem]);
      saveDocToFirestore('semesters', newSem).catch(err => {
        console.warn('Error saving new semester to Firestore:', err);
      });
      toast(`Nuevo ciclo creado con código ${finalCode}`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const nextSems = semesters.filter(s => s && s.id !== id);
    onUpdateSemesters(nextSems);
    deleteDocFromFirestore('semesters', id).catch(err => {
      console.warn('Error deleting semester from Firestore:', err);
    });
    toast('Semestre eliminado correctamente', 'success');
  };

  return (
    <div className="page-semestres animate-fade-in pb-12">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
            Semestres académicos
          </h2>
          <div className="page-sub text-sm font-medium mt-1 text-slate-500 font-sans">
            Abre y cierra periodos de matrículas, cortes y cronogramas de exámenes en el instituto
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <select
            value={filterNivel}
            onChange={(e) => {
              setFilterNivel(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-xl px-3 py-2 font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer shadow-xs"
          >
            <option value="todos">Todos los Niveles</option>
            <option value={NIVEL_PASTORAL}>Nivel I: Pastoral (Sem I-V)</option>
            <option value={NIVEL_MINISTERIAL}>Nivel II: Ministerial (Sem VI-IX)</option>
          </select>
          <button
            onClick={handleOpenCreateModal}
            className="btn btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-white font-semibold shadow hover:scale-[1.02] transition-transform cursor-pointer text-xs"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Nuevo periodo</span>
          </button>
        </div>
      </div>

      <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden theme-bg-surface theme-border">
        {filteredSemesters.length === 0 ? (
          <div className="empty py-12 text-center text-slate-500 flex flex-col items-center">
            <CalendarDays className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-750">No hay semestres para este filtro</h4>
            <button onClick={handleOpenCreateModal} className="text-xs text-indigo-600 hover:underline mt-2">Crear semestre ahora</button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-medium text-xs uppercase tracking-wider theme-bg-surface border-b border-slate-200">
                  <th className="py-3 px-4">Semestre / Ciclo</th>
                  <th className="py-3 px-4">Código único</th>
                  <th className="py-3 px-4">Nivel Académico</th>
                  <th className="py-3 px-4">Estado del Ciclo</th>
                  <th className="py-3 px-4">Registrado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentSemesters.map(sem => {
                  const isActive = sem.estado === 'activo';
                  const isNivel1 = (sem.nivel || '').includes('NIVEL I') || ['Semestre I', 'Semestre II', 'Semestre III', 'Semestre IV', 'Semestre V'].includes(sem.nombre);
                  return (
                    <tr key={sem.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <CalendarDays className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                          </div>
                          <span className="text-slate-900 font-bold block" style={{ color: 'var(--gray-900)' }}>
                            {sem.nombre}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs font-bold text-slate-500 tracking-wider">
                        {sem.codigo}
                      </td>
                      <td className="py-4 px-4">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                          isNivel1
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                        }`}>
                          {isNivel1 ? 'Nivel I: Pastoral' : 'Nivel II: Ministerial'}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        {isActive ? (
                          <span className="badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 border border-emerald-100 text-emerald-700">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Vigente / Activo</span>
                          </span>
                        ) : (
                          <span className="badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-105 border border-slate-200 text-slate-500">
                            <XSquare className="w-3 h-3" />
                            <span>Cerrado / Histórico</span>
                          </span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-400">{fmtDate(sem.creado)}</td>
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex gap-1.5 justify-end">
                          <button
                            onClick={() => handleOpenEditModal(sem)}
                            className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                            title="Editar ciclo académico"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === sem.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  handleDelete(sem.id);
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
                              onClick={() => setConfirmDeleteId(sem.id)}
                              className="p-1 rounded border border-rose-225 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                              title="Eliminar ciclo académico"
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

            {semesters.length > itemsPerPage && (
              <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 theme-bg-surface">
                <div className="text-xs text-slate-500 select-none">
                  Mostrando <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{((activePage - 1) * itemsPerPage) + 1}</span> a{' '}
                  <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                    {Math.min(activePage * itemsPerPage, semesters.length)}
                  </span>{' '}
                  de <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{semesters.length}</span> semestres
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
                          ? 'text-white'
                          : 'border border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                      style={activePage === page ? { backgroundColor: 'var(--primary)', borderColor: 'var(--primary)' } : {}}
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

      {/* SEMESTERS MODAL */}
      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-2xl shadow-xl w-full max-w-sm theme-bg-surface">
            <div className="modal-header border-b border-slate-100 p-4.5 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="modal-title font-bold text-slate-900 border-none">
                {editingId ? 'Editar periodo' : 'Registrar nuevo ciclo'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-705 transition">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body p-5 space-y-4">
              <div className="form-group">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre del ciclo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={e => handleNombreChange(e.target.value)}
                  placeholder="Ej / Semestre 2026-I"
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              <div className="form-group">
                <div className="flex items-center justify-between mb-1">
                  <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Código de semestre <span className="text-indigo-600 font-semibold font-mono">(Automático)</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateCode}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition"
                    title="Regenerar código según el ciclo"
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
                    placeholder="Ej / SEM-26A"
                    className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-slate-50 font-mono font-bold text-indigo-900 uppercase"
                  />
                  <span className="absolute right-2.5 top-2.5 pointer-events-none">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 font-medium">
                  Se genera automáticamente con el formato académico o puedes personalizarlo si lo prefieres.
                </p>
              </div>

              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nivel Académico</label>
                <select
                  value={nivel}
                  onChange={e => setNivel(e.target.value)}
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-600 bg-white cursor-pointer text-slate-700 font-semibold"
                >
                  <option value={NIVEL_PASTORAL}>Nivel I : Biblioteología Pastoral (Sem I-V)</option>
                  <option value={NIVEL_MINISTERIAL}>Nivel II : Biblioteología Ministerial (Sem VI-IX)</option>
                </select>
              </div>

              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Habilitación temporal</label>
                <select
                  value={estado}
                  onChange={e => setEstado(e.target.value as 'activo' | 'inactivo')}
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-600 bg-white cursor-pointer text-slate-705 font-bold"
                >
                  <option value="activo">Vigente / Habilitado</option>
                  <option value="inactivo">Histórico / Cerrado</option>
                </select>
              </div>

              <div className="modal-footer border-t border-slate-100 flex justify-end gap-2.5 pt-4 mt-6 bg-slate-50 rounded-b-2xl -mx-5 -mb-5 p-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 border rounded-xl hover:bg-slate-100 text-slate-700 bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-4.5 py-2 text-white font-bold rounded-xl cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {editingId ? 'Guardar cambios' : 'Crear ciclo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
