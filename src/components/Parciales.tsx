/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Milestone, Plus, Trash2, Edit2, Calendar, Target, Award, ChevronLeft, ChevronRight } from 'lucide-react';
import { Parcial, Semester, Subject } from '../types';
import { uid, now, fmtDate } from '../lib/db';

interface ParcialesProps {
  parciales: Parcial[];
  semesters: Semester[];
  subjects: Subject[];
  onUpdateParciales: (updated: Parcial[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function Parciales({ 
  parciales, semesters, subjects, onUpdateParciales, toast 
}: ParcialesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form states
  const [nombre, setNombre] = useState('');
  const [semestre, setSemestre] = useState('');
  const [asignatura, setAsignatura] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [porcentaje, setPorcentaje] = useState(30);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Pagination states & calculations
  const itemsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.ceil(parciales.length / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;

  const currentParciales = parciales.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setNombre('');
    setSemestre(semesters[0]?.id || '');
    setAsignatura(subjects[0]?.id || '');
    setFechaInicio('');
    setFechaFin('');
    setPorcentaje(30);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: Parcial) => {
    setEditingId(p.id);
    setNombre(p.nombre);
    setSemestre(p.semestre || '');
    setAsignatura(p.asignatura || '');
    setFechaInicio(p.fechaInicio || '');
    setFechaFin(p.fechaFin || '');
    setPorcentaje(p.porcentaje || 30);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || !semestre || !asignatura) {
      toast('Completa los campos obligatorios del parcial', 'error');
      return;
    }

    const nextParciales = [...parciales];

    if (editingId) {
      const idx = nextParciales.findIndex(p => p.id === editingId);
      if (idx > -1) {
        nextParciales[idx] = {
          ...nextParciales[idx],
          nombre: nombre.trim(),
          semestre,
          asignatura,
          fechaInicio,
          fechaFin,
          porcentaje: Number(porcentaje) || 30,
          actualizado: now(),
        };
        onUpdateParciales(nextParciales);
        toast('Módulo parcial actualizado correctamente', 'success');
      }
    } else {
      const newParcial: Parcial = {
        id: uid(),
        nombre: nombre.trim(),
        semestre,
        asignatura,
        fechaInicio,
        fechaFin,
        estado: 'abierto',
        porcentaje: Number(porcentaje) || 30,
        creado: now(),
      };
      onUpdateParciales([...nextParciales, newParcial]);
      toast('Nuevo parcial creado exitosamente', 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const nextParciales = parciales.filter(p => p.id !== id);
    onUpdateParciales(nextParciales);
    toast('Corte o parcial eliminado correctamente', 'success');
  };

  return (
    <div className="page-parciales animate-fade-in pb-12">
      <div className="page-header flex items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
            Cortes y parciales evaluativos
          </h2>
          <div className="page-sub text-sm font-medium mt-1 text-slate-500 font-sans">
            Comanda los cronogramas por corte porcentual, metas académicas y parciales mensuales
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="btn btn-primary flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-white font-semibold shadow hover:scale-[1.02] transition-transform cursor-pointer"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Milestone className="w-4 h-4" />
          <span>Nuevo corte parcial</span>
        </button>
      </div>

      <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden theme-bg-surface theme-border">
        {parciales.length === 0 ? (
          <div className="empty py-12 text-center text-slate-500 flex flex-col items-center">
            <Milestone className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-755">No hay cortes evaluativos</h4>
            <button onClick={handleOpenCreateModal} className="text-xs text-indigo-600 hover:underline mt-2">Crear el primer parcial ahora</button>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-medium text-xs uppercase tracking-wider theme-bg-surface border-b border-slate-200">
                  <th className="py-3 px-4">Corte Parcial</th>
                  <th className="py-3 px-4">Syllabus Materia</th>
                  <th className="py-3 px-4">Periodo Calendario</th>
                  <th className="py-3 px-4">Ponderado %</th>
                  <th className="py-3 px-4">Vigencia corte</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentParciales.map(p => {
                  const sem = semesters.find(s => s.id === p.semestre);
                  const sub = subjects.find(s => s.id === p.asignatura);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/50">
                      <td className="py-4 px-4 font-bold text-slate-805" style={{ color: 'var(--gray-900)' }}>
                        {p.nombre}
                      </td>
                      <td className="py-4 px-4 text-xs font-bold text-indigo-700">
                        {sub ? sub.nombre : '—'}
                      </td>
                      <td className="py-4 px-4 text-slate-500 text-xs">
                        {sem ? sem.nombre : '—'}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="badge inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-indigo-50 border border-indigo-100 text-indigo-700 font-extrabold text-xs">
                          <Target className="w-3.5 h-3.5 text-indigo-600" />
                          <span>{p.porcentaje}%</span>
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs text-slate-400">
                        {p.fechaInicio && p.fechaFin ? (
                          <div className="flex items-center gap-1 font-semibold text-slate-505">
                            <Calendar className="w-3.5 h-3.5 text-slate-350" />
                            <span>{p.fechaInicio} al {p.fechaFin}</span>
                          </div>
                        ) : (
                          <span className="italic">Sin vigencia establecida</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="inline-flex gap-1.5 justify-end">
                          <button
                            onClick={() => handleOpenEditModal(p)}
                            className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-505 cursor-pointer"
                            title="Editar corte"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === p.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  handleDelete(p.id);
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
                              onClick={() => setConfirmDeleteId(p.id)}
                              className="p-1 rounded border border-rose-225 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                              title="Eliminar corte"
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

            {parciales.length > itemsPerPage && (
              <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 theme-bg-surface">
                <div className="text-xs text-slate-500 select-none">
                  Mostrando <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{((activePage - 1) * itemsPerPage) + 1}</span> a{' '}
                  <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                    {Math.min(activePage * itemsPerPage, parciales.length)}
                  </span>{' '}
                  de <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{parciales.length}</span> cortes parciales
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

      {/* PARCIAL MODAL */}
      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-2xl shadow-xl w-full max-w-md theme-bg-surface">
            <div className="modal-header border-b border-slate-100 p-4.5 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="modal-title font-bold text-slate-900 border-none">
                {editingId ? 'Editar corte' : 'Registrar nuevo corte'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-705 transition">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body p-5 space-y-4">
              <div className="form-group">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre del parcial o corte <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Ej / Primer corte de semestre"
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Semestre vinculante <span className="text-red-500">*</span></label>
                  <select
                    value={semestre}
                    onChange={e => setSemestre(e.target.value)}
                    className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-600 bg-white cursor-pointer"
                  >
                    {semesters.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Programa / Materia <span className="text-red-500">*</span></label>
                  <select
                    value={asignatura}
                    onChange={e => setAsignatura(e.target.value)}
                    className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-600 bg-white cursor-pointer"
                  >
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.nombre}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Fecha de Apertura</label>
                  <input
                    type="date"
                    value={fechaInicio}
                    onChange={e => setFechaInicio(e.target.value)}
                    className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 font-sans">Fecha de Cierre</label>
                  <input
                    type="date"
                    value={fechaFin}
                    onChange={e => setFechaFin(e.target.value)}
                    className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Ponderación académica (%) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={porcentaje}
                  onChange={e => setPorcentaje(Number(e.target.value))}
                  placeholder="Ej / 30"
                  className="form-control w-full p-2 border rounded-lg text-sm focus:outline-indigo-650 bg-white font-bold text-indigo-700"
                />
              </div>

              <div className="modal-footer border-t border-slate-100 flex justify-end gap-2.5 pt-4 mt-6 bg-slate-50 rounded-b-2xl -mx-5 -mb-5 p-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary px-4 py-2 border rounded-xl hover:bg-slate-100 text-slate-700 bg-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary px-4.5 py-2 text-white font-bold rounded-xl"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  {editingId ? 'Guardar cambios' : 'Crear corte'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
