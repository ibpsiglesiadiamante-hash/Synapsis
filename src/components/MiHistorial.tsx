/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Award, BookOpen, Clock, CheckCircle, XCircle } from 'lucide-react';
import { User, Exam, Submission } from '../types';
import { fmtDate, fmtTime } from '../lib/db';

interface MiHistorialProps {
  currentUser: User;
  exams: Exam[];
  submissions: Submission[];
}

export default function MiHistorial({ currentUser, exams, submissions }: MiHistorialProps) {
  const mySubs = submissions
    .filter(s => s.estudianteId === currentUser.id)
    .sort((a,b) => b.fecha.localeCompare(a.fecha));

  return (
    <div className="page-miHistorial animate-fade-in pb-12">
      <div className="page-header mb-6">
        <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
          Mi historial académico
        </h2>
        <div className="page-sub text-sm font-medium mt-1 text-slate-500">
          Revisa las notas, retroalimentaciones e historial de exámenes que has presentado
        </div>
      </div>

      <div className="card bg-white rounded-2xl border border-slate-202 shadow-sm overflow-hidden theme-bg-surface theme-border">
        {mySubs.length === 0 ? (
          <div className="empty-state py-12 text-center text-slate-500 flex flex-col items-center">
            <BookOpen className="w-12 h-12 text-slate-350 mb-3" />
            <h4 className="empty-title text-base font-bold text-slate-700">Sin historial registrado</h4>
            <p className="empty-sub text-xs text-slate-400 mt-1">Aún no has participado en ninguna evaluación del instituto</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm text-slate-605">
              <thead>
                <tr className="bg-slate-50 text-slate-400 font-medium text-xs uppercase tracking-wider theme-bg-surface border-b border-slate-200">
                  <th className="py-3 px-4">Examen</th>
                  <th className="py-3 px-4">Materia</th>
                  <th className="py-3 px-4 text-center">Puntaje</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4">Aciertos / Desaciertos</th>
                  <th className="py-3 px-4">Duración</th>
                  <th className="py-3 px-4">Fecha</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {mySubs.map(s => {
                  const exam = exams.find(e => e.id === s.examenId);
                  const isPending = s.estado === 'pendiente';

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/50">
                      <td className="py-3.5 px-4 font-bold text-slate-900" style={{ color: 'var(--gray-900)' }}>
                        {exam?.titulo || 'Examen eliminado'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="badge inline-flex px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-100">
                          {exam?.materia || '—'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className="text-lg font-extrabold text-slate-805" style={{ color: s.aprobado ? 'var(--success)' : 'var(--danger)' }}>
                          {s.puntaje}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {isPending ? (
                          <span className="badge inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-amber-50 border border-amber-100 text-amber-700 font-bold">
                            Pendiente Calificación
                          </span>
                        ) : s.aprobado ? (
                          <span className="badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-50 border border-emerald-100 text-emerald-700 font-bold">
                            <CheckCircle className="w-3 h-3" />
                            <span>Aprobado</span>
                          </span>
                        ) : (
                          <span className="badge inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-50 border border-rose-100 text-rose-700 font-bold">
                            <XCircle className="w-3 h-3" />
                            <span>Reprobado</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-505">
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
          </div>
        )}
      </div>
    </div>
  );
}
