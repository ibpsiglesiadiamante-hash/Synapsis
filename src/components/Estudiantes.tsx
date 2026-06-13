/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Users, Plus, Trash2, Edit2, Search, BookOpen, GraduationCap, ChevronLeft, ChevronRight } from 'lucide-react';
import { User } from '../types';
import { uid, now, fmtDate, avatarColor, avatarLetter } from '../lib/db';

interface EstudiantesProps {
  users: User[];
  onUpdateUsers: (updated: User[]) => void;
  onNavigateToHistory: (studentId: string) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function Estudiantes({ 
  users, onUpdateUsers, onNavigateToHistory, toast 
}: EstudiantesProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Filter search
  const [query, setQuery] = useState('');

  // Form states
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [cedula, setCedula] = useState('');
  const [celular, setCelular] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Pagination states & calculations
  const itemsPerPage = 8;
  const [currentPage, setCurrentPage] = useState(1);

  const estudiantes = users.filter(u => u.rol === 'estudiante');

  const filteredEstudiantes = estudiantes.filter(e => 
    e.nombre.toLowerCase().includes(query.toLowerCase()) || 
    e.email.toLowerCase().includes(query.toLowerCase())
  );

  const totalPages = Math.ceil(filteredEstudiantes.length / itemsPerPage) || 1;
  const activePage = currentPage > totalPages ? totalPages : currentPage;

  const currentEstudiantes = filteredEstudiantes.slice((activePage - 1) * itemsPerPage, activePage * itemsPerPage);

  const handleOpenCreateModal = () => {
    setEditingId(null);
    setNombre('');
    setEmail('');
    setPass('');
    setCedula('');
    setCelular('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (st: User) => {
    setEditingId(st.id);
    setNombre(st.nombre);
    setEmail(st.email || '');
    setPass('');
    setCedula(st.cedula || '');
    setCelular(st.celular || '');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim()) {
      toast('Suministra el nombre del estudiante', 'error');
      return;
    }

    const nextUsers = [...users];

    // Determine final email
    let finalEmail = email.trim();
    if (!finalEmail) {
      // Auto-generate clean, unique email based on student name and a random number
      const cleanName = nombre.trim().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remove accents
        .replace(/[^a-z0-9]/g, "."); // replace non-alphanumeric with dots
      const slug = cleanName.split('.').filter(Boolean).join('.');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      finalEmail = `${slug || 'estudiante'}.${randomNum}@instituto.edu.co`;
    }

    if (editingId) {
      const idx = nextUsers.findIndex(u => u.id === editingId);
      if (idx > -1) {
        if (users.some(u => u.id !== editingId && u.email.toLowerCase() === finalEmail.toLowerCase())) {
          toast('Este correo de estudiante ya se encuentra en uso', 'error');
          return;
        }

        nextUsers[idx] = {
          ...nextUsers[idx],
          nombre: nombre.trim(),
          email: finalEmail,
          cedula: cedula.trim() || undefined,
          celular: celular.trim() || undefined,
          ...(pass ? { pass: pass.trim() } : {}),
        };
        onUpdateUsers(nextUsers);
        toast('Ficha del estudiante actualizada correctamente', 'success');
      }
    } else {
      if (users.some(u => u.email.toLowerCase() === finalEmail.toLowerCase())) {
        toast('El correo generado o ingresado ya está en uso', 'error');
        return;
      }

      // Automatically generate a 6-digit numeric/easy password
      const automaticPass = `est${Math.floor(1000 + Math.random() * 9000)}`;

      const newSt: User = {
        id: uid(),
        nombre: nombre.trim(),
        email: finalEmail,
        pass: automaticPass,
        rol: 'estudiante',
        creado: now(),
        cedula: cedula.trim() || undefined,
        celular: celular.trim() || undefined,
      };

      onUpdateUsers([...nextUsers, newSt]);
      toast(`Estudiante registrado. Correo: ${finalEmail} | Contraseña: ${automaticPass}`, 'success');
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    const nextUsers = users.filter(u => u.id !== id);
    onUpdateUsers(nextUsers);
    toast('Estudiante desvinculado del sistema correctamente', 'success');
  };

  return (
    <div className="page-estudiantes animate-fade-in pb-12">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
            Matrícula de Estudiantes
          </h2>
          <div className="page-sub text-sm font-medium mt-1 text-slate-500 font-sans">
            Gestiona la admisión, matrícula y consulta los historiales de notas correspondientes
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="btn btn-primary flex items-center gap-1.5 px-4.5 py-2 rounded-xl text-white font-semibold shadow hover:scale-[1.02] transition-transform cursor-pointer shrink-0"
          style={{ backgroundColor: 'var(--primary)' }}
        >
          <Plus className="w-4 h-4" />
          <span>Matricular estudiante</span>
        </button>
      </div>

      {/* FILTER CONTROLS */}
      <div className="filter-tools flex flex-col sm:flex-row gap-3.5 mb-5 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-2.5 top-2.5 w-4.5 h-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre o correo..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 p-2.5 text-xs font-semibold rounded-xl border border-slate-200 outline-none focus:border-indigo-550 bg-white"
          />
        </div>
        <span className="text-slate-400 text-xs font-semibold font-mono">{filteredEstudiantes.length} estudiantes admitidos</span>
      </div>

      <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden theme-bg-surface theme-border">
        {filteredEstudiantes.length === 0 ? (
          <div className="empty py-12 text-center text-slate-500 flex flex-col items-center">
            <Users className="w-12 h-12 text-slate-300 mb-3" />
            <h4 className="font-bold text-slate-755">No hay estudiantes admitidos</h4>
            <p className="text-xs text-slate-450 mt-1">Matricula alumnos utilizando el botón de la parte superior</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-600">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-medium text-xs uppercase tracking-wider theme-bg-surface border-b border-slate-200">
                  <th className="py-3 px-4">Estudiante</th>
                  <th className="py-3 px-4">Cédula</th>
                  <th className="py-3 px-4">Celular</th>
                  <th className="py-3 px-4">Código único</th>
                  <th className="py-3 px-4">Correo</th>
                  <th className="py-3 px-4">Fecha Matrícula</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {currentEstudiantes.map(st => (
                  <tr key={st.id} className="hover:bg-slate-50/50">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white shadow-sm shrink-0"
                          style={{ backgroundColor: avatarColor(st.nombre) }}
                        >
                          {avatarLetter(st.nombre)}
                        </div>
                        <span className="text-slate-900 font-extrabold" style={{ color: 'var(--gray-900)' }}>
                          {st.nombre}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-500">
                      {st.cedula || <span className="text-slate-350 italic text-[11px] font-normal">No registrada</span>}
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-slate-500">
                      {st.celular || <span className="text-slate-350 italic text-[11px] font-normal">No registrado</span>}
                    </td>
                    <td className="py-4 px-4 font-mono text-xs font-bold text-slate-500">
                      {st.id.substring(0,8).toUpperCase()}
                    </td>
                    <td className="py-4 px-4 text-xs sm:text-sm text-slate-500">{st.email}</td>
                    <td className="py-4 px-4 text-xs text-slate-400">{fmtDate(st.creado)}</td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex gap-1.5 items-center justify-end">
                        <button
                          onClick={() => onNavigateToHistory(st.id)}
                          className="btn text-xs px-2.5 py-1.5 rounded border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 flex items-center gap-1"
                          title="Explorar notas e historial de exámenes"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Historial</span>
                        </button>
                        <button
                          onClick={() => handleOpenEditModal(st)}
                          className="p-1 rounded border border-slate-200 hover:bg-slate-100 text-slate-500 cursor-pointer"
                          title="Editar estudiante"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {confirmDeleteId === st.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => {
                                handleDelete(st.id);
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
                            onClick={() => setConfirmDeleteId(st.id)}
                            className="p-1 rounded border border-rose-225 bg-rose-50 text-rose-600 hover:bg-rose-100 cursor-pointer"
                            title="Eliminar estudiante"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredEstudiantes.length > itemsPerPage && (
              <div className="px-4 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-3 theme-bg-surface">
                <div className="text-xs text-slate-500 select-none">
                  Mostrando <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{((activePage - 1) * itemsPerPage) + 1}</span> a{' '}
                  <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>
                    {Math.min(activePage * itemsPerPage, filteredEstudiantes.length)}
                  </span>{' '}
                  de <span className="font-semibold" style={{ color: 'var(--gray-900)' }}>{filteredEstudiantes.length}</span> estudiantes
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

      {/* STUDENT REGISTRATION DIALOG */}
      {isModalOpen && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-2xl shadow-xl w-full max-w-sm theme-bg-surface">
            <div className="modal-header border-b border-slate-100 p-4.5 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="modal-title font-bold text-slate-900 border-none">
                {editingId ? 'Editar matrícula' : 'Matricular nuevo alumno'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="modal-close hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-705 transition">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="modal-body p-5 space-y-4">
              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={e => setNombre(e.target.value)}
                  placeholder="Tu nombre completo académico"
                  className="form-control w-full p-2.5 border rounded-xl text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Cédula de Ciudadanía</label>
                <input
                  type="text"
                  value={cedula}
                  onChange={e => setCedula(e.target.value)}
                  placeholder="Número de documento de identidad"
                  className="form-control w-full p-2.5 border rounded-xl text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Celular</label>
                <input
                  type="text"
                  value={celular}
                  onChange={e => setCelular(e.target.value)}
                  placeholder="Número de teléfono celular"
                  className="form-control w-full p-2.5 border rounded-xl text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              <div className="form-group flex flex-col">
                <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Opcional (se autogenerará si está vacío)"
                  className="form-control w-full p-2.5 border rounded-xl text-sm focus:outline-indigo-650 bg-white"
                />
              </div>

              {editingId ? (
                <div className="form-group flex flex-col">
                  <label className="form-label text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Cambiar contraseña de acceso
                  </label>
                  <input
                    type="password"
                    value={pass}
                    onChange={e => setPass(e.target.value)}
                    placeholder="Dejar en blanco si conservas la anterior"
                    className="form-control w-full p-2.5 border rounded-xl text-sm focus:outline-indigo-650 bg-white"
                  />
                </div>
              ) : (
                <div className="form-group p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 theme-bg-surface select-none">
                  <span className="text-[10px] font-bold text-indigo-600 block mb-1 tracking-wider font-mono">🔐 SEGURIDAD AUTOMÁTICA</span>
                  <p className="text-[11px] text-slate-500 leading-normal font-sans font-medium">
                    La contraseña se generará de forma automática y segura tras la matrícula (ej: <span className="font-mono font-bold text-slate-700">est3928</span>).
                  </p>
                </div>
              )}

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
                  {editingId ? 'Guardar cambios' : 'Matricular alumno'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
