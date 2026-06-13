/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, Clock, RefreshCw, Award, CheckCircle, HelpCircle } from 'lucide-react';
import { User, Exam, Submission } from '../types';

interface MisExamenesTakeProps {
  currentUser: User;
  exams: Exam[];
  submissions: Submission[];
  onTakeExam: (examId: string) => void;
}

export default function MisExamenesTake({ currentUser, exams, submissions, onTakeExam }: MisExamenesTakeProps) {
  const activeExams = exams.filter(e => e.estado === 'activo');
  const mySubs = submissions.filter(s => s.estudianteId === currentUser.id);

  return (
    <div className="page-misExamenesTake animate-fade-in pb-12">
      <div className="page-header mb-6">
        <h2 className="page-title text-2xl font-bold tracking-tight text-slate-905" style={{ color: 'var(--gray-900)' }}>
          Exámenes disponibles
        </h2>
        <div className="page-sub text-sm font-medium mt-1 text-slate-500 font-sans">
          Selecciona una evaluación disponible para responder. Lee las instrucciones de los docentes detenidamente.
        </div>
      </div>

      {activeExams.length === 0 ? (
        <div className="card bg-white p-12 border border-slate-200 rounded-2xl text-center flex flex-col items-center theme-bg-surface theme-border">
          <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-600">No hay exámenes habilitados</h4>
          <p className="text-xs text-slate-400 mt-1">Los docentes aún no han configurado ni activado exámenes para este corte</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeExams.map(e => {
            const myAttempts = mySubs.filter(s => s.examenId === e.id);
            const canTake = e.intentos === 0 || myAttempts.length < e.intentos;
            const lastAttempt = myAttempts[myAttempts.length - 1];

            return (
              <div 
                key={e.id} 
                className="card bg-white p-5 rounded-2xl border border-slate-205 flex flex-col justify-between shadow-sm relative hover:border-slate-350 transition-colors theme-bg-surface theme-border"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <div>
                      <h4 className="font-bold text-base text-slate-800 leading-snug" style={{ color: 'var(--gray-900)' }}>{e.titulo}</h4>
                      <span className="badge mt-2 inline-flex px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-indigo-50 border border-indigo-100 text-indigo-700 rounded">
                        {e.materia}
                      </span>
                    </div>

                    {lastAttempt && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold shrink-0 ${
                        lastAttempt.aprobado 
                          ? 'bg-emerald-50 border border-emerald-100 text-emerald-700' 
                          : 'bg-rose-50 border border-rose-100 text-rose-700'
                      }`}>
                        {lastAttempt.puntaje}%
                      </span>
                    )}
                  </div>

                  {/* Metadata labels */}
                  <div className="flex flex-col gap-1.5 mt-3 my-4 text-xs font-semibold text-slate-500 font-sans">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-slate-450" />
                      <span>{e.tiempo > 0 ? `${e.tiempo} minutos de límite` : 'Sin límite de tiempo'}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-450" />
                      <span>{(e.preguntas || []).length} preguntas totales</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5 text-slate-450" />
                      <span>Intentos: {myAttempts.length} / {e.intentos === 0 ? 'ilimitados' : e.intentos}</span>
                    </div>
                  </div>

                  {e.descripcion && (
                    <div className="p-3 mb-4 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-400 italic font-medium leading-relaxed">
                      {e.descripcion}
                    </div>
                  )}
                </div>

                {/* Submit / Take Button triggers */}
                {canTake ? (
                  <button 
                    onClick={() => onTakeExam(e.id)}
                    className="btn btn-primary w-full p-2.5 rounded-xl text-white font-bold tracking-wide mt-2 block shadow-sm hover:scale-[1.01] transition-transform cursor-pointer"
                    style={{ backgroundColor: 'var(--primary)' }}
                  >
                    Presentar examen →
                  </button>
                ) : (
                  <button 
                    disabled
                    className="w-full p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-bold block text-sm select-none cursor-not-allowed mt-2"
                  >
                    Intentos agotados
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
