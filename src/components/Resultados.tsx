/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BarChart3, Users, Award, Percent, Calendar, 
  ChevronRight, CalendarDays, Clock, Check, X, AlertCircle, RefreshCw 
} from 'lucide-react';
import { User, Exam, Submission } from '../types';
import { avatarColor, avatarLetter, fmtDate, fmtTime, now } from '../lib/db';

interface ResultadosProps {
  currentUser: User;
  users: User[];
  exams: Exam[];
  submissions: Submission[];
  onUpdateSubmissions: (updated: Submission[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function Resultados({ 
  currentUser, users, exams, submissions, onUpdateSubmissions, toast 
}: ResultadosProps) {

  const [activeSubId, setActiveSubId] = useState<string | null>(null);
  
  // Local grading scores & comment forms
  const [manualScores, setManualScores] = useState<Record<string, number>>({});
  const [manualComments, setManualComments] = useState<Record<string, string>>({});

  const myExams = exams.filter(e => e.docenteId === currentUser.id || currentUser.rol === 'admin');
  
  const handleOpenGradingModal = (subId: string) => {
    const sub = submissions.find(s => s.id === subId);
    if (!sub) return;
    setActiveSubId(subId);
    setManualScores(sub.manualScores || {});
    setManualComments(sub.manualComments || {});
  };

  const handleManualScoreChange = (qid: string, val: number, max: number) => {
    const clamped = Math.max(0, Math.min(max, val));
    setManualScores(prev => ({ ...prev, [qid]: clamped }));
  };

  const handleManualCommentChange = (qid: string, val: string) => {
    setManualComments(prev => ({ ...prev, [qid]: val }));
  };

  const handleSaveGrading = () => {
    if (!activeSubId) return;
    const sub = submissions.find(s => s.id === activeSubId);
    const exam = exams.find(e => e.id === sub?.examenId);
    if (!sub || !exam) return;

    let manualSum = 0;
    let autoSum = 0;
    let totalMax = 0;
    let correctCount = 0;
    let incorrectCount = 0;

    exam.preguntas.forEach(q => {
      totalMax += q.puntos;
      const ans = sub.respuestas[q.id];

      if (q.tipo === 'abierta' || q.tipo === 'escala') {
        const score = manualScores[q.id] !== undefined ? Number(manualScores[q.id]) : 0;
        manualSum += score;
        if (score >= q.puntos * 0.6) {
          correctCount++;
        } else {
          incorrectCount++;
        }
      } else if (q.tipo === 'multiple' || q.tipo === 'tf' || q.tipo === 'dropdown') {
        if (q.correctas.includes(Number(ans))) {
          autoSum += q.puntos;
          correctCount++;
        } else {
          incorrectCount++;
        }
      } else if (q.tipo === 'checkbox') {
        const answersList = ans || [];
        const correctList = q.correctas || [];
        const isMatched = JSON.stringify([...answersList].sort()) === JSON.stringify([...correctList].sort());
        if (isMatched) {
          autoSum += q.puntos;
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    });

    const finalScore = totalMax > 0 ? Math.round(((autoSum + manualSum) / totalMax) * 100) : 0;
    const isApproved = finalScore >= (exam.aprobacion || 60);

    const updatedSubs = submissions.map(s => {
      if (s.id === activeSubId) {
        return {
          ...s,
          puntaje: finalScore,
          aprobado: isApproved,
          correctas: correctCount,
          incorrectas: incorrectCount,
          manualScores,
          manualComments,
          estado: 'calificado' as const,
          gradedBy: currentUser.id,
          gradedAt: now(),
        };
      }
      return s;
    });

    onUpdateSubmissions(updatedSubs);
    setActiveSubId(null);
    toast('Calificaciones actualizadas con éxito', 'success');
  };

  const activeSub = submissions.find(s => s.id === activeSubId);
  const activeExam = exams.find(e => e.id === activeSub?.examenId);
  const grName = activeSub ? (users.find(u => u.id === activeSub.estudianteId)?.nombre || activeSub.estudianteNombre) : '';

  return (
    <div className="page-resultados animate-fade-in pb-12">
      <div className="page-header mb-6">
        <h2 className="page-title text-2xl font-bold tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
          Resultados de evaluaciones
        </h2>
        <div className="page-sub text-sm font-medium mt-1 text-slate-500">
          Revisa estadísticas, entregas de estudiantes y califica manualmente respuestas abiertas
        </div>
      </div>

      {myExams.length === 0 ? (
        <div className="card bg-white p-8 border rounded-2xl text-center flex flex-col items-center">
          <BarChart3 className="w-12 h-12 text-slate-350 mb-3" />
          <h4 className="font-bold text-slate-700">Sin estadísticas disponibles</h4>
          <p className="text-xs text-slate-400 mt-1">Cuando tengas exámenes creados con entregas aparecerán aquí</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {myExams.map(exam => {
            const examSubs = submissions.filter(s => s.examenId === exam.id);
            const totalScore = examSubs.reduce((acc, current) => acc + current.puntaje, 0);
            const avgScore = examSubs.length ? Math.round(totalScore / examSubs.length) : 0;
            const passCount = examSubs.filter(s => s.aprobado).length;

            return (
              <div key={exam.id} className="card bg-white p-5 rounded-2xl border border-slate-200 shadow-sm theme-bg-surface theme-border">
                {/* Header info */}
                <div className="flex justify-between items-start gap-4 mb-4 border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800" style={{ color: 'var(--gray-900)' }}>{exam.titulo}</h3>
                    <div className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider select-none">
                      {exam.materia} · {exam.preguntas.length} preguntas · {examSubs.length} entregas
                    </div>
                  </div>
                  <span className={`inline-flex px-2 py-0.5 text-xs font-bold border rounded-full ${
                    exam.estado === 'activo' 
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-100' 
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}>
                    {exam.estado}
                  </span>
                </div>

                {/* Score Stats boxes */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center theme-bg-surface">
                    <span className="block text-2xl font-bold text-slate-800" style={{ color: 'var(--gray-900)' }}>{examSubs.length}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Entregas</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center theme-bg-surface">
                    <span className="block text-2xl font-bold text-indigo-700">{avgScore}%</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Promedio</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-center theme-bg-surface">
                    <span className="block text-2xl font-bold text-emerald-600">{passCount}</span>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Aprobados</span>
                  </div>
                </div>

                {/* Submissions list */}
                {examSubs.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">Ningún estudiante ha tomado este examen todavía</p>
                ) : (
                  <div className="table-wrap overflow-hidden border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead>
                        <tr className="bg-slate-50 text-slate-400 font-medium text-xs uppercase tracking-wider theme-bg-surface border-b border-slate-200">
                          <th className="py-2.5 px-4">Estudiante</th>
                          <th className="py-2.5 px-4">Nota</th>
                          <th className="py-2.5 px-4">Estado</th>
                          <th className="py-2.5 px-4">Tiempo</th>
                          <th className="py-2.5 px-4">Fecha</th>
                          <th className="py-2.5 px-4 text-right">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-105 font-medium">
                        {examSubs.map(s => {
                          const student = users.find(u => u.id === s.estudianteId);
                          const stName = student?.nombre || s.estudianteNombre;
                          const isPending = s.estado === 'pendiente';

                          return (
                            <tr key={s.id} className="hover:bg-slate-50/50">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm shrink-0"
                                    style={{ backgroundColor: avatarColor(stName) }}
                                  >
                                    {avatarLetter(stName)}
                                  </div>
                                  <span className="text-slate-800 font-semibold">{stName}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-bold border rounded-full ${
                                  s.aprobado 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                    : 'bg-rose-50 text-rose-700 border-rose-105'
                                }`}>
                                  {s.puntaje}%
                                </span>
                              </td>
                              <td className="py-3 px-4">
                                {isPending ? (
                                  <span className="text-amber-600 inline-flex items-center gap-1 text-xs">
                                    <AlertCircle className="w-3.5 h-3.5 animate-pulse" />
                                    <span>Pendiente grading</span>
                                  </span>
                                ) : s.aprobado ? (
                                  <span className="text-emerald-600 text-xs font-bold">Aprobado</span>
                                ) : (
                                  <span className="text-rose-600 text-xs font-bold">Reprobado</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-xs text-slate-400">{s.tiempoUsado || '—'}</td>
                              <td className="py-3 px-4 text-xs text-slate-400">
                                {fmtDate(s.fecha)} {fmtTime(s.fecha)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <button 
                                  onClick={() => handleOpenGradingModal(s.id)}
                                  className="btn btn-secondary text-xs px-2.5 py-1 rounded border hover:bg-slate-50"
                                >
                                  Ver respuestas
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ACTIVE SUBMISSION GRADING MODAL */}
      {activeSubId && activeSub && activeExam && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4">
          <div className="modal bg-white rounded-2xl shadow-xl w-full max-w-3xl overflow-y-auto max-h-[90vh] theme-bg-surface flex flex-col">
            <div className="modal-header border-b border-slate-100 p-4.5 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="modal-title font-bold text-slate-900 border-none">Detalles del Examen</h3>
              <button 
                onClick={() => setActiveSubId(null)} 
                className="modal-close hover:bg-slate-100 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 transition"
              >
                ✕
              </button>
            </div>

            <div className="modal-body p-5 space-y-5 overflow-y-auto flex-1 text-left">
              
              {/* Score circle layout */}
              <div className="text-center py-4 flex flex-col items-center">
                <div className={`w-[96px] h-[96px] rounded-full flex flex-col items-center justify-center border-4 ${
                  activeSub.aprobado 
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                    : 'border-rose-500 bg-rose-50 text-rose-700'
                }`}>
                  <span className="text-2xl font-extrabold">{activeSub.puntaje}%</span>
                  <span className="text-[10px] font-bold uppercase tracking-wide mt-0.5">
                    {activeSub.aprobado ? 'Aprobado' : 'Reprobado'}
                  </span>
                </div>
                <h4 className="text-base font-bold text-slate-800 mt-2.5">{grName}</h4>
                <p className="text-xs text-slate-400">{activeExam.titulo}</p>

                {/* Details banner */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-sm mt-4">
                  <div className="bg-slate-50 border p-2 rounded-lg text-center">
                    <span className="block text-sm font-semibold text-slate-700">{activeSub.correctas}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-400">Correctas</span>
                  </div>
                  <div className="bg-slate-50 border p-2 rounded-lg text-center">
                    <span className="block text-sm font-semibold text-slate-700">{activeSub.incorrectas}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-400">Incorrectas</span>
                  </div>
                  <div className="bg-slate-50 border p-2 rounded-lg text-center">
                    <span className="block text-sm font-semibold text-slate-700">{activeSub.tiempoUsado}</span>
                    <span className="text-[9px] uppercase font-bold text-slate-400">Tiempo</span>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Questions Renderers for verification */}
              <div className="space-y-4">
                <h5 className="font-bold text-sm text-slate-800 mb-3">Respuestas enviadas:</h5>
                {activeExam.preguntas.map((q, index) => {
                  const studentAns = activeSub.respuestas[q.id];
                  let isCorrect: boolean | null = null;
                  let readableAnsText = '';

                  if (q.tipo === 'abierta') {
                    readableAnsText = studentAns || 'Sin respuesta';
                  } else if (q.tipo === 'multiple' || q.tipo === 'tf' || q.tipo === 'dropdown') {
                    const idx = Number(studentAns);
                    isCorrect = q.correctas.includes(idx);
                    readableAnsText = q.opciones[idx] || 'Sin respuesta';
                  } else if (q.tipo === 'checkbox') {
                    const selected = studentAns || [];
                    isCorrect = JSON.stringify([...selected].sort()) === JSON.stringify([...q.correctas].sort());
                    readableAnsText = selected.map((s: number) => q.opciones[s]).join(', ') || 'Sin respuesta';
                  } else if (q.tipo === 'escala') {
                    readableAnsText = studentAns ? `Puntaje: ${studentAns}` : 'Sin responder';
                  }

                  const isTextGraded = q.tipo === 'abierta' || q.tipo === 'escala';
                  const earnedPoints = isTextGraded 
                    ? (manualScores[q.id] !== undefined ? manualScores[q.id] : 0) 
                    : (isCorrect ? q.puntos : 0);

                  const bannerBg = isTextGraded 
                    ? 'bg-slate-50 border-slate-205'
                    : isCorrect 
                      ? 'bg-emerald-50/55 border-emerald-100 text-slate-800' 
                      : 'bg-rose-50/55 border-rose-100 text-slate-800';

                  const canGrade = currentUser.rol === 'admin' || activeExam.docenteId === currentUser.id;

                  return (
                    <div key={q.id} className={`p-4 rounded-xl border ${bannerBg} text-slate-700 text-xs`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-slate-400 font-semibold uppercase text-[9px] tracking-wider">
                          Pregunta {index + 1} · {q.puntos} pts
                        </span>
                        <span className="font-bold text-indigo-700">Puntos: {earnedPoints} / {q.puntos}</span>
                      </div>
                      
                      <p className="font-bold text-slate-900 leading-snug mb-2.5">{q.texto}</p>
                      
                      <div className="flex items-start gap-1 p-2 bg-white rounded border border-slate-100 mt-2 font-medium">
                        {isTextGraded ? (
                          <span className="text-slate-400 font-bold mr-1">📝</span>
                        ) : isCorrect ? (
                          <span className="text-emerald-600 font-bold mr-1">✅</span>
                        ) : (
                          <span className="text-rose-600 font-bold mr-1">❌</span>
                        )}
                        <span className="flex-1 italic">{readableAnsText}</span>
                      </div>

                      {/* Expected correct options if wrong */}
                      {!isTextGraded && isCorrect === false && (
                        <div className="mt-2 text-[10px] text-emerald-600 font-bold">
                          ✓ Correcta: {q.correctas.map(idx => q.opciones[idx]).join(' + ')}
                        </div>
                      )}

                      {/* Manual grading form for open text answers */}
                      {isTextGraded && canGrade && (
                        <div className="mt-3 p-3 bg-white rounded-lg border border-slate-220 flex flex-col sm:flex-row gap-3 items-center">
                          <label className="text-[11px] font-bold text-slate-600 select-none block shrink-0">Calificar puntos:</label>
                          <input 
                            type="number" 
                            min={0}
                            max={q.puntos}
                            value={manualScores[q.id] !== undefined ? manualScores[q.id] : ''}
                            onChange={e => handleManualScoreChange(q.id, Number(e.target.value), q.puntos)}
                            className="bg-slate-50 w-20 p-1.5 border rounded text-center text-xs font-bold"
                            placeholder="Score"
                          />
                          <input 
                            type="text" 
                            value={manualComments[q.id] || ''}
                            onChange={e => handleManualCommentChange(q.id, e.target.value)}
                            placeholder="Escribe comentarios u observaciones opcionales..."
                            className="bg-slate-50 p-1.5 border rounded text-xs flex-1 text-slate-700 outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

            </div>

            <div className="modal-footer border-t border-slate-100 p-4 shrink-0 flex justify-end gap-2.5 bg-slate-50 rounded-b-2xl">
              <button 
                onClick={() => setActiveSubId(null)}
                className="btn btn-secondary px-4 py-2 border rounded-xl hover:bg-slate-100 cursor-pointer text-slate-700 bg-white"
              >
                Cerrar
              </button>
              {(currentUser.rol === 'admin' || activeExam.docenteId === currentUser.id) && (
                <button 
                  onClick={handleSaveGrading}
                  className="btn btn-primary px-4.5 py-2 text-white font-semibold rounded-xl flex items-center gap-1.5"
                  style={{ backgroundColor: 'var(--primary)' }}
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar evaluación</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
