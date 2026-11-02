/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { 
  Trash2, RotateCcw, AlertTriangle, Search, Filter, 
  Milestone, Users, FileText, BookOpen, Layers, 
  Sparkles, CheckCircle2, ShieldAlert
} from 'lucide-react';
import { RecycleItem } from '../types';
import { fmtDate } from '../lib/db';

interface PapeleraProps {
  items: RecycleItem[];
  onRestore: (item: RecycleItem) => void;
  onPermanentDelete: (itemId: string, originalId: string, tipo: string) => void;
  onEmptyTrash: () => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function Papelera({
  items = [],
  onRestore,
  onPermanentDelete,
  onEmptyTrash,
  toast
}: PapeleraProps) {
  const [filterType, setFilterType] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  // Group counters
  const counts = useMemo(() => {
    const map: Record<string, number> = { todos: items.length, parcial: 0, estudiante: 0, examen: 0, otros: 0 };
    items.forEach(it => {
      if (it.tipo === 'parcial') map.parcial = (map.parcial || 0) + 1;
      else if (it.tipo === 'estudiante') map.estudiante = (map.estudiante || 0) + 1;
      else if (it.tipo === 'examen') map.examen = (map.examen || 0) + 1;
      else map.otros = (map.otros || 0) + 1;
    });
    return map;
  }, [items]);

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      if (filterType !== 'todos') {
        if (filterType === 'otros') {
          if (['parcial', 'estudiante', 'examen'].includes(it.tipo)) return false;
        } else if (it.tipo !== filterType) {
          return false;
        }
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (it.titulo || '').toLowerCase().includes(q);
        const matchSub = (it.subtitulo || '').toLowerCase().includes(q);
        const matchDet = (it.detalles || '').toLowerCase().includes(q);
        return matchTitle || matchSub || matchDet;
      }
      return true;
    });
  }, [items, filterType, searchQuery]);

  const getItemIcon = (tipo: string) => {
    switch (tipo) {
      case 'parcial':
        return <Milestone className="w-4 h-4 text-teal-400" />;
      case 'estudiante':
        return <Users className="w-4 h-4 text-emerald-400" />;
      case 'examen':
        return <FileText className="w-4 h-4 text-cyan-400" />;
      case 'materia':
        return <BookOpen className="w-4 h-4 text-indigo-400" />;
      case 'semestre':
        return <Layers className="w-4 h-4 text-purple-400" />;
      default:
        return <Trash2 className="w-4 h-4 text-slate-400" />;
    }
  };

  const getItemBadgeStyle = (tipo: string) => {
    switch (tipo) {
      case 'parcial':
        return 'bg-teal-50 border-teal-200 text-teal-800';
      case 'estudiante':
        return 'bg-emerald-50 border-emerald-200 text-emerald-800';
      case 'examen':
        return 'bg-cyan-50 border-cyan-200 text-cyan-800';
      case 'materia':
        return 'bg-indigo-50 border-indigo-200 text-indigo-800';
      case 'semestre':
        return 'bg-purple-50 border-purple-200 text-purple-800';
      default:
        return 'bg-slate-100 border-slate-200 text-slate-700';
    }
  };

  return (
    <div className="page-papelera animate-fade-in pb-12 text-left">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
                Papelera de Reciclaje
              </h2>
              <p className="text-xs font-medium text-slate-500 font-sans mt-0.5">
                Los elementos eliminados se conservan aquí temporalmente para que puedas recuperarlos o destruirlos de manera definitiva sin que vuelvan a aparecer al recargar (Ctrl + F5).
              </p>
            </div>
          </div>
        </div>

        {items.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowEmptyConfirm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
              title="Eliminar permanentemente todos los elementos de la papelera"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Vaciar Papelera ({items.length})</span>
            </button>
          </div>
        )}
      </div>

      {/* TABS & SEARCH BAR */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-6 theme-bg-surface theme-border flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 font-sans">
          <button
            type="button"
            onClick={() => setFilterType('todos')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'todos'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            Todos ({counts.todos})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('parcial')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'parcial'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Milestone className="w-3.5 h-3.5" />
            <span>Parciales ({counts.parcial})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('estudiante')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'estudiante'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Estudiantes ({counts.estudiante})</span>
          </button>
          <button
            type="button"
            onClick={() => setFilterType('examen')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              filterType === 'examen'
                ? 'bg-cyan-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Exámenes ({counts.examen})</span>
          </button>
          {counts.otros > 0 && (
            <button
              type="button"
              onClick={() => setFilterType('otros')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                filterType === 'otros'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80'
              }`}
            >
              Otros ({counts.otros})
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Buscar en papelera..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-700 focus:outline-indigo-500 font-medium"
          />
        </div>
      </div>

      {/* ITEMS LIST */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center shadow-xs theme-bg-surface theme-border flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
            <Trash2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1" style={{ color: 'var(--gray-900)' }}>
            La papelera está vacía
          </h3>
          <p className="text-xs text-slate-400 max-w-md font-sans">
            {items.length === 0 
              ? 'No tienes registros ni parciales eliminados en este momento. Cuando elimines parciales o estudiantes, se enviarán aquí para que decidas su destino final.' 
              : 'No hay elementos que coincidan con el filtro o término de búsqueda seleccionado.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map(item => {
            const isDeleting = confirmDeleteId === item.id;

            return (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between theme-bg-surface theme-border space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${getItemBadgeStyle(item.tipo)}`}>
                      {getItemIcon(item.tipo)}
                      <span className="capitalize">{item.tipo}</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {fmtDate(item.fechaEliminacion)}
                    </span>
                  </div>

                  <h4 className="font-bold text-sm text-slate-900 leading-snug break-words" style={{ color: 'var(--gray-900)' }}>
                    {item.titulo}
                  </h4>

                  {item.subtitulo && (
                    <p className="text-xs font-medium text-slate-500 mt-1 line-clamp-2">
                      {item.subtitulo}
                    </p>
                  )}

                  {item.detalles && (
                    <div className="mt-2 text-[10px] bg-slate-50 border border-slate-100 p-2 rounded-xl text-slate-600 font-sans break-words">
                      {item.detalles}
                    </div>
                  )}
                </div>

                {/* Card Action Buttons */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onRestore(item);
                      toast(`"${item.titulo}" restaurado exitosamente al sistema`, 'success');
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
                    title="Restaurar de regreso al módulo correspondiente"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restaurar</span>
                  </button>

                  {isDeleting ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onPermanentDelete(item.id, item.originalId, item.tipo);
                          setConfirmDeleteId(null);
                          toast(`"${item.titulo}" eliminado definitivamente de la base de datos`, 'warning');
                        }}
                        className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                        title="Confirmar eliminación permanente"
                      >
                        Confirmar
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-semibold cursor-pointer"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(item.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
                      title="Eliminar permanentemente"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar definitivo</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL CONFIRMAR VACIAR PAPELERA */}
      {showEmptyConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-[250] p-4 animate-fade-in">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl mx-auto flex items-center justify-center">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">¿Vaciar papelera completamente?</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Se destruirán definitivamente <b>{items.length}</b> elementos reciclados. Esta acción no se puede deshacer y los registros no volverán a aparecer al recargar la página.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowEmptyConfirm(false)}
                className="flex-1 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  onEmptyTrash();
                  setShowEmptyConfirm(false);
                  toast('Papelera vaciada por completo', 'success');
                }}
                className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md cursor-pointer"
              >
                Sí, vaciar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
