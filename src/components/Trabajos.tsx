/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Plus, Trash2, Edit2, Calendar, FileText, Award, Layers, ChevronLeft, ChevronRight } from 'lucide-react';
import { Assignment, User, Parcial, Subject } from '../types';
import { uid, now, fmtDate } from '../lib/db';

interface TrabajosProps {
  currentUser: User;
  assignments: Assignment[];
  parciales: Parcial[];
  subjects: Subject[];
  onUpdateAssignments: (updated: Assignment[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function Trabajos({ 
  currentUser, assignments, parciales, subjects, onUpdateAssignments, toast 
}: TrabajosProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [titulo, setTitulo] = useState('');
  const [parcialId, setParcialId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [puntos, setPuntos] = useState(100);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Pagination states & calculations (Grid is 3 cols, so 9 works beautifully!)
  const itemsPerPage = 9;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(assignments.length / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;

  const currentAssignments = assignments.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const canManage = currentUser.rol === 'admin' || currentUser.rol === 'docente';

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setTitulo('');
    setParcialId(parciales[0]?.id || '');
    setDescripcion('');
    setFechaEntrega('');
    setPuntos(100);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: Assignment) => {
    setEditingId(task.id);
    setTitulo(task.titulo);
    setParcialId(task.parcialId || '');
    setDescripcion(task.descripcion || '');
    setFechaEntrega(task.fechaEntrega || '');
    setPuntos(task.puntos || 100);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !parcialId) {
      toast('El título y parcial son campos obligatorios', 'error');
      return;
    }

    const nextTasks = [...assignments];

    if (editingId) {
      const idx = nextTasks.findIndex(t => t.id === editingId);
      if (idx > -1) {
        nextTasks[idx] = {
          ...nextTasks[idx],
          titulo: titulo.trim(),
          parcialId,
          descripcion: descripcion.trim(),
          fechaEntrega,
          puntos: Number(puntos) || 100,
          actualizado: now(),
        };
        onUpdateAssignments(nextTasks);
        toast('Trabajo académico actualizado correctamente', 'success');
      }
    } else {
      const newAssignment: Assignment = {
        id: uid(),
        titulo: titulo.trim(),
        parcialId,
        descripcion: descripcion.trim(),
        fechaEntrega,
        puntos: Number(puntos) || 100,
        creado: now(),
      };
      onUpdateAssignments([...nextTasks, newAssignment]);
      toast('Trabajo o taller publicado exitosamente', 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const nextTasks = assignments.filter(t => t.id !== id);
    onUpdateAssignments(nextTasks);
    toast('Trabajo académico removido correctamente', 'success');
  };

  return (
    <div className="page-trabajos animate-fade-in pb-12">
      <div className="page-header flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
            Trabajos y tareas asignadas
          </h2>
          <div className="page-sub text-sm font-medium mt-1 text-slate-500 font-sans">
            Inspecciona o publica talleres, guías de práctica y proyectos de investigación
          </div>
        </div>
        {canManage && (
          <button
            onClick={handleOpenCreateModal}
            className="btn btn-primary flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-white font-semibold shadow hover:scale-[1.02] transition-transform cursor-pointer"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            <Plus className="w-4 h-4" />
            <span>Publicar trabajo</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {assignments.length === 0 ? (
          <div className="col-span-full card bg-white p-12 border rounded-2xl text-center flex flex-col items-center">
            <FileText className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-650">No hay actividades vigentes</h4>
            <p className="text-xs text-slate-400 mt-1">Inspecciona el listado en otro momento para comprobar asignaciones académicas</p>
          </div>
        ) : (
          currentAssignments.map(task => {
            const parc = parciales.find(p => p.id === task.parcialId);
            const sub = parc ? subjects.find(s => s.id === parc.asignatura) : null;

            return (
              <div key={task.id} className="card bg-white p-5 rounded-2xl border border-slate-205 flex flex-col justify-between shadow-sm hover:border-slate-350 transition theme-bg-surface theme-border animate-fade-in">
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <h4 className="font-extrabold text-slate-805 leading-snug" style={{ color: 'var(--gray-900)' }}>
                      {task.titulo}
                    </h4>
                    <span className="badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-indigo-50 border border-indigo-100 text-indigo-700">
                      <Award className="w-3.5 h-3.5 text-indigo-650" />
                      <span>{task.puntos} pts max</span>
                    </span>
                  </div>

                  <div className="mb-3.5">
                    {sub && (
                      <span className="badge inline-flex px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-amber-50 text-amber-700 border border-amber-100 rounded">
                        Materia: {sub.nombre}
                      </span>
                    )}
                    {parc && (
                      <span className="badge inline-block ml-1.5 px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-slate-100 text-slate-600 rounded">
                        {parc.nombre}
                      </span>
                    )}
                  </div>

                  {task.descripcion && (
                    <p className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-500 leading-relaxed italic mb-4 font-sans">
                      {task.descripcion}
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3.5 border-t border-slate-100 mt-3 flex-wrap gap-2 text-xs font-semibold text-slate-500 font-sans">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Límite: {task.fechaEntrega || 'Sin fecha'}</span>
                  </div>

                  {canManage && (
                    <div className="inline-flex gap-1 justify-end items-center">
                      <button
                        onClick={() => handleOpenEditModal(task)}
                        className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                        title="Editar tarea"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      {confirmDeleteId === task.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              handleDelete(task.id);
                              setConfirmDeleteId(null);
                            }}
                            className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                          >
                            Sí
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-0.5 rounded text-[9px] uppercase font-bold bg-slate-100 text-slate-500 hover:bg-slate-200 cursor-pointer"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(task.id)}
                          className="p-1 rounded border border-rose-225 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                          title="Eliminar tarea"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {assignments.length > itemsPerPage && (
        <div className="mt-6 px-5 py-3.5 bg-white border border-slate-200 rounded-2xl flex items-center justify-between flex-wrap gap-3 theme-bg-surface theme-border">
          <div className="text-xs text-slate-505 select-none font-medium">
            Mostrando <span className="font-bold" style={{ color: 'var(--gray-900)' }}>{((activePage - 1) * itemsPerPage) + 1}</span> a{' '}
            <span className="font-bold" style={{ color: 'var(--gray-900)' }}>
              {Math.min(activePage * itemsPerPage, assignments.length)}
            </span>{' '}
            de <span className="font-bold" style={{ color: 'var(--gray-900)' }}>{assignments.length}</span> asignaciones publicadas
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

      {/* ASSIGNMENTS MODAL */}
      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-2xl shadow-xl w-full max-w-sm theme-bg-surface">
            <div className="modal-header border-b border-slate-100 p-4.5 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="modal-title font-bold text-slate-900 border-none">
                {editingId ? 'Editar actividad' : 'Publicar nueva actividad'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-705 transition">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body p-5 space-y-4">
              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Título de la actividad <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ej / Taller de Ecuaciones"
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vincular Parcial Evaluativo <span className="text-red-500">*</span></label>
                <select
                  value={parcialId}
                  onChange={e => setParcialId(e.target.value)}
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-600 bg-white cursor-pointer text-slate-700"
                >
                  <option value="">-- Elige parcial --</option>
                  {parciales.map(p => {
                    const sb = subjects.find(s => s.id === p.asignatura);
                    return (
                      <option key={p.id} value={p.id}>{p.nombre} {sb ? `· ${sb.nombre}` : ''}</option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group flex flex-col font-sans">
                  <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Fecha de Entrega</label>
                  <input
                    type="date"
                    value={fechaEntrega}
                    onChange={e => setFechaEntrega(e.target.value)}
                    className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white"
                  />
                </div>
                <div className="form-group flex flex-col">
                  <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Puntos Máximos</label>
                  <input
                    type="number"
                    min={1}
                    value={puntos}
                    onChange={e => setPuntos(Number(e.target.value))}
                    className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white font-bold text-indigo-700"
                  />
                </div>
              </div>

              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Instrucciones o contenido descriptivo</label>
                <textarea
                  value={descripcion}
                  onChange={e => setDescripcion(e.target.value)}
                  placeholder="Detalla las instrucciones de entrega, rúbrica o contenido de la guía de estudio..."
                  rows={3}
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-600 bg-white resize-none"
                />
              </div>

              <div className="modal-footer border-t border-slate-100 flex justify-end gap-2.5 pt-4 mt-6 bg-slate-50 rounded-b-2xl -mx-5 -mb-5 p-4">
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
                  {editingId ? 'Actualizar' : 'Publicar actividad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
