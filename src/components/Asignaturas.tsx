/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, BookOpen, GraduationCap, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { Subject, User } from '../types';
import { uid, now, fmtDate } from '../lib/db';

interface AsignaturasProps {
  subjects: Subject[];
  users: User[];
  onUpdateSubjects: (updated: Subject[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function Asignaturas({ subjects, users, onUpdateSubjects, toast }: AsignaturasProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [codigo, setCodigo] = useState('');
  const [docenteId, setDocenteId] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Pagination states & calculations
  const itemsPerPage = 7;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(subjects.length / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;

  const currentSubjects = subjects.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const docentes = users.filter(u => u.rol === 'docente' || u.rol === 'admin');

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setNombre('');
    setCodigo('');
    setDocenteId('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (sub: Subject) => {
    setEditingId(sub.id);
    setNombre(sub.nombre);
    setCodigo(sub.codigo || '');
    setDocenteId(sub.docenteId || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast('El nombre de la materia es obligatorio', 'error');
      return;
    }

    const nextSubs = [...subjects];

    if (editingId) {
      const idx = nextSubs.findIndex(s => s.id === editingId);
      if (idx > -1) {
        nextSubs[idx] = {
          ...nextSubs[idx],
          nombre: nombre.trim(),
          codigo: codigo.trim(),
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
        codigo: codigo.trim(),
        docenteId,
        creado: now(),
      };
      onUpdateSubjects([...nextSubs, newSub]);
      toast('Asignatura creada satisfactoriamente', 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const nextSubs = subjects.filter(s => s.id !== id);
    onUpdateSubjects(nextSubs);
    toast('Asignatura eliminada del catálogo correctamente', 'success');
  };

  return (
    <div className="page-asignaturas animate-fade-in pb-12">
      <div className="page-header flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
            Asignaturas y materias
          </h2>
          <div className="page-sub text-sm font-medium mt-1 text-slate-500 font-sans">
            Gestiona los programas de estudio, silabos y docentes asignados a cada materia
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="btn btn-primary flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-white font-semibold shadow hover:scale-[1.02] transition-transform cursor-pointer"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <BookOpen className="w-4 h-4" />
          <span>Nueva materia</span>
        </button>
      </div>

      <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden theme-bg-surface theme-border">
        {subjects.length === 0 ? (
          <div className="empty py-12 text-center text-slate-500 flex flex-col items-center">
            <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-750">No hay asignaturas en el catálogo</h4>
            <button onClick={handleOpenCreateModal} className="text-xs text-indigo-600 hover:underline mt-2">Crear la primera materia ahora</button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-medium text-xs uppercase tracking-wider theme-bg-surface border-b border-slate-200">
                  <th className="py-3 px-4">Asignatura</th>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Docente a cargo</th>
                  <th className="py-3 px-4">Registrado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentSubjects.map(sub => {
                  const doc = users.find(u => u.id === sub.docenteId);
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                            <GraduationCap className="w-4 h-4" style={{ color: 'var(--primary)' }} />
                          </div>
                          <span className="text-slate-900 font-bold block" style={{ color: 'var(--gray-900)' }}>
                            {sub.nombre}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-4 font-mono text-xs font-bold text-indigo-600">{sub.codigo || '—'}</td>
                      <td className="py-4 px-4 text-slate-755">
                        {doc ? (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                            <span>{doc.nombre}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">No asignado</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-400">{fmtDate(sub.creado)}</td>
                      <td className="py-4 px-4 text-right">
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
                              className="p-1 rounded border border-rose-225 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
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

            {subjects.length > itemsPerPage && (
              <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 theme-bg-surface">
                <div className="text-xs text-slate-500 select-none">
                  Mostrando <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{((activePage - 1) * itemsPerPage) + 1}</span> a{' '}
                  <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                    {Math.min(activePage * itemsPerPage, subjects.length)}
                  </span>{' '}
                  de <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{subjects.length}</span> asignaturas
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

      {/* SUBJECTS MODAL */}
      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-2xl shadow-xl w-full max-w-sm theme-bg-surface">
            <div className="modal-header border-b border-slate-100 p-4.5 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="modal-title font-bold text-slate-900 border-none">
                {editingId ? 'Editar asignatura' : 'Registrar nueva asignatura'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-705 transition">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body p-5 space-y-4">
              <div className="form-group">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre de la materia <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej / Química Orgánica"
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              <div className="form-group col-span-2">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Código de curso</label>
                <input
                  type="text"
                  value={codigo}
                  onChange={e => setCodigo(e.target.value)}
                  placeholder="Ej / MAT-201"
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Docente a cargo</label>
                <select
                  value={docenteId}
                  onChange={e => setDocenteId(e.target.value)}
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-600 bg-white cursor-pointer text-slate-700"
                >
                  <option value="">-- No asignar docente --</option>
                  {docentes.map(d => (
                    <option key={d.id} value={d.id}>{d.nombre} ({d.rol})</option>
                  ))}
                </select>
              </div>

              <div className="modal-footer border-t border-slate-100 flex justify-end gap-2.5 pt-4 mt-6 bg-slate-50 rounded-b-2xl -mx-5 -mb-5 p-4 font-medium">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 border rounded-xl hover:bg-slate-100 text-slate-705 bg-white cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-4.5 py-2 text-white font-bold rounded-xl cursor-pointer"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {editingId ? 'Guardar cambios' : 'Crear materia'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
