/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Check, AlertTriangle, 
  Clock, GraduationCap, School, Milestone 
} from 'lucide-react';
import { Exam, Question, Submission, Institution, Parcial, Subject, Semester } from '../types';
import { uid, now } from '../lib/db';

interface ExamTakeScreenProps {
  examId: string;
  exams: Exam[];
  institutions: Institution[];
  parciales: Parcial[];
  subjects: Subject[];
  semesters: Semester[];
  currentUser: any;
  onExit: () => void;
  onSubmit: (sub: Submission) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function ExamTakeScreen({ 
  examId, exams, institutions, parciales, subjects, semesters, 
  currentUser, onExit, onSubmit, toast 
}: ExamTakeScreenProps) {

  const exam = exams.find(e => e.id === examId);
  if (!exam) return null;

  // Question lists (supports shuffling)
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  
  // Timers
  const [timeLeft, setTimeLeft] = useState(0); // in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Modals state triggers
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultsState, setResultsState] = useState<Submission | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // On mount: set up questions list and start timer
  useEffect(() => {
    let qList = [...(exam.preguntas || [])];
    if (exam.aleatorio) {
      qList.sort(() => Math.random() - 0.5);
    }
    setQuestions(qList);
    setAnswers({});
    setCurrentQIdx(0);

    if (exam.tiempo > 0) {
      setTimeLeft(exam.tiempo * 60);
    } else {
      setTimeLeft(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [examId, exam]);

  // Timers tick
  useEffect(() => {
    if (exam.tiempo === 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [exam]);

  const handleAutoSubmit = () => {
    toast('Tiempo agotado. El examen se enviará de manera automática.', 'warning');
    processSubmitPayload();
  };

  const handleSetAnswer = (qid: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [qid]: value,
    }));
  };

  const handleToggleCheckbox = (qid: string, valIdx: number) => {
    const list: number[] = answers[qid] || [];
    let nextList: number[] = [];
    if (list.includes(valIdx)) {
      nextList = list.filter(item => item !== valIdx);
    } else {
      nextList = [...list, valIdx];
    }
    handleSetAnswer(qid, nextList);
  };

  const calculateAnswersPercentage = () => {
    if (questions.length === 0) return 0;
    const answeredCount = Object.keys(answers).filter(k => answers[k] !== undefined && answers[k] !== '').length;
    return Math.round((answeredCount / questions.length) * 100);
  };

  const confirmExit = () => {
    setShowExitConfirm(true);
  };

  const triggerConfirmModal = () => {
    setShowConfirmModal(true);
  };

  const processSubmitPayload = () => {
    let autoEarnedSum = 0;
    let maxPtsSum = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let pendingGrading = false;

    questions.forEach(q => {
      maxPtsSum += q.puntos;
      const ans = answers[q.id];

      if (q.tipo === 'abierta' || q.tipo === 'escala') {
        pendingGrading = true;
      } else if (q.tipo === 'multiple' || q.tipo === 'tf' || q.tipo === 'dropdown') {
        const selected = Number(ans);
        if (q.correctas.includes(selected)) {
          autoEarnedSum += q.puntos;
          correctCount++;
        } else {
          incorrectCount++;
        }
      } else if (q.tipo === 'checkbox') {
        const selectedList = ans || [];
        const correctList = q.correctas || [];
        const isMatched = JSON.stringify([...selectedList].sort()) === JSON.stringify([...correctList].sort());
        if (isMatched) {
          autoEarnedSum += q.puntos;
          correctCount++;
        } else {
          incorrectCount++;
        }
      }
    });

    const percent = maxPtsSum > 0 ? Math.round((autoEarnedSum / maxPtsSum) * 100) : 0;
    const isApproved = percent >= (exam.aprobacion || 60);

    const formatElapsedTime = () => {
      if (exam.tiempo === 0) return '—';
      const elapsed = exam.tiempo * 60 - timeLeft;
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      return `${mins}m ${secs}s`;
    };

    const submission: Submission = {
      id: uid(),
      examenId: exam.id,
      estudianteId: currentUser.id,
      estudianteNombre: currentUser.nombre,
      respuestas: answers,
      puntaje: percent,
      aprobado: isApproved,
      correctas: correctCount,
      incorrectas: incorrectCount,
      tiempoUsado: formatElapsedTime(),
      fecha: now(),
      estado: pendingGrading ? 'pendiente' : 'calificado',
      manualScores: {},
      manualComments: {},
      autoPuntaje: percent,
    };

    setResultsState(submission);
    setShowConfirmModal(false);

    if (exam.mostrarNota) {
      setShowResultModal(true);
    } else {
      onSubmit(submission);
      toast('Examen enviado exitosamente ✓', 'success');
      onExit();
    }
  };

  const handleCloseResultsModal = () => {
    if (resultsState) {
      onSubmit(resultsState);
    }
    setShowResultModal(false);
    onExit();
  };

  const formatTimer = () => {
    if (exam.tiempo === 0) return 'Sin límite';
    const m = Math.floor(timeLeft / 60);
    const s = timeLeft % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const scrollToQuestion = (idx: number) => {
    setCurrentQIdx(idx);
    const element = document.getElementById(`question-card-${idx}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const totalQuestions = questions.length;

  // Find Institutional mapping
  const inst = institutions[0] || { nombre: 'Instituto Synapsis' };
  const parcial = exam.parcialId ? parciales.find(p => p.id === exam.parcialId) : null;
  const subject = parcial ? subjects.find(s => s.id === parcial.asignatura) : null;

  return (
    <div id="examTakeScreen" className="fixed inset-0 bg-[#f0ebf8] z-[100] overflow-y-auto block text-slate-800 pb-20">
      
      {/* STICKY HEADER */}
      <div className="exam-take-header bg-white border-b border-[#dadce0] text-slate-800 p-4 flex items-center justify-between sticky top-0 z-[110] shadow-sm">
        <button 
          onClick={confirmExit}
          className="btn border border-[#dadce0] bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800 text-xs py-1.5 px-3.5 rounded-md shadow-sm font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer focus:outline-none"
        >
          <ChevronLeft className="w-4 h-4 text-slate-500" />
          <span>Volver al menú</span>
        </button>

        <h3 className="exam-take-title text-sm md:text-base font-bold text-slate-800 truncate max-w-sm hidden sm:block">
          {exam.titulo}
        </h3>

        <div className={`timer-box font-mono font-bold text-sm tracking-wide px-3.5 py-1.5 border rounded-md flex items-center gap-1.5 transition-colors ${
          timeLeft <= 300 && exam.tiempo > 0 
            ? 'bg-rose-50 border-rose-300 text-rose-705 animate-pulse' 
            : 'bg-indigo-50/70 border-indigo-200 text-[#673ab7]'
        }`}>
          <Clock className="w-4 h-4 text-[#673ab7]" />
          <span>{formatTimer()}</span>
        </div>
      </div>

      {/* STICKY PROGRESS BAR ACCENT */}
      <div className="sticky top-[53px] z-[109] h-1.5 w-full bg-slate-200 bg-opacity-80">
        <div 
          className="h-full bg-[#673ab7] transition-all duration-300"
          style={{ width: `${calculateAnswersPercentage()}%` }}
        />
      </div>

      {/* CORE WRAPPER */}
      <div className="exam-take-body max-w-2xl mx-auto px-4 py-8 font-sans">
        
        {/* GOOGLE FORMS HOODED HEADER CARD */}
        <div className="bg-white rounded-lg border border-[#dadce0] shadow-sm mb-4 overflow-hidden relative theme-bg-surface text-left">
          {/* Accent top belt */}
          <div className="h-2.5 w-full bg-[#673ab7]" />
          
          <div className="p-6 md:p-8">
            <h1 className="text-3xl md:text-[34px] text-[#202124] tracking-tight font-normal mb-4.5">
              {exam.titulo}
            </h1>
            
            <div className="text-sm text-slate-600 space-y-2.5 mb-6 border-b border-slate-100 pb-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="font-semibold text-slate-800 w-28 shrink-0">🏫 Instituto:</span>
                <span className="text-slate-700 font-medium">{inst.nombre}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="font-semibold text-slate-800 w-28 shrink-0">📚 Materia:</span>
                <span className="text-slate-700 font-medium">{subject ? subject.nombre : exam.materia}</span>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                <span className="font-semibold text-slate-800 w-28 shrink-0">📝 Parcial:</span>
                <span className="text-slate-700 font-medium">{parcial ? parcial.nombre : 'Evaluación Parcial'}</span>
              </div>
              
              {exam.tiempo > 0 && (
                <div className="flex items-center gap-2 mt-4.5 py-1.5 px-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 w-fit text-xs font-semibold">
                  ⏱ Límite de tiempo: {exam.tiempo} minutos
                </div>
              )}
            </div>

            {/* Email registered account notice mimicking Google Forms */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-700 flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
                  Sesión activa
                </span>
                <span className="text-[10px] bg-slate-200 px-2 py-0.5 rounded text-slate-500 font-semibold font-mono">
                  ESTUDIANTE
                </span>
              </div>
              <div className="mt-1 leading-relaxed">
                El examen se registrará bajo el nombre de <strong className="text-slate-900">{currentUser.nombre}</strong> ({currentUser.correo || 'estudiante.instituto@educacion.com'}).
              </div>
              <div className="text-rose-600 text-[11px] font-bold mt-1">
                * Indica que la pregunta es obligatoria
              </div>
            </div>
          </div>
        </div>

        {/* BUBBLE FAST NAVIGATOR DIRECTORY */}
        <div className="question-map flex items-center flex-wrap gap-2 mb-5 bg-white p-3.5 rounded-lg border border-[#dadce0] shadow-sm text-left">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest block mr-1 sm:inline shrink-0">Ir a pregunta:</span>
          <div className="flex flex-wrap gap-1.5">
            {questions.map((item, idx) => {
              const isCurrent = idx === currentQIdx;
              const isAnswered = answers[item.id] !== undefined && answers[item.id] !== '';

              return (
                <button
                  key={item.id}
                  onClick={() => scrollToQuestion(idx)}
                  className={`w-7.5 h-7.5 rounded-full flex items-center justify-center text-xs font-bold border transition-all cursor-pointer ${
                    isCurrent 
                      ? 'bg-[#673ab7] border-[#673ab7] text-white' 
                      : isAnswered 
                        ? 'bg-[#673ab7]/10 border-[#673ab7]/30 text-[#673ab7]' 
                        : 'bg-white border-[#dadce0] text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* QUESTIONS LIST MULTI-CARD */}
        <div className="space-y-4">
          {questions.map((qItem, idx) => {
            const isCurrent = idx === currentQIdx;

            return (
              <div 
                key={qItem.id}
                id={`question-card-${idx}`}
                onClick={() => setCurrentQIdx(idx)}
                className={`bg-white rounded-lg border transition-all duration-200 p-6 md:p-8 text-left relative cursor-pointer ${
                  isCurrent 
                    ? 'border-transparent shadow-md focus-within:shadow-md ring-1 ring-[#673ab7]/15 border-l-6 border-l-[#673ab7]' 
                    : 'border-[#dadce0] shadow-sm border-l-1 hover:shadow-md'
                }`}
              >
                <div className="flex justify-between items-start gap-4 mb-4">
                  <div className="flex items-start">
                    <span className="text-[#202124] text-[16px] font-normal leading-relaxed">
                      <span className="font-semibold mr-1">{idx + 1}.</span> {qItem.texto}
                    </span>
                    <span className="text-rose-600 font-bold ml-1" title="Pregunta obligatoria">*</span>
                  </div>
                  
                  <span className="text-xs text-slate-400 font-semibold shrink-0 bg-slate-50 px-2.5 py-1 rounded-md font-mono select-none">
                    {qItem.puntos} {qItem.puntos === 1 ? 'punto' : 'puntos'}
                  </span>
                </div>

                <div className="space-y-3 mt-2">
                  
                  {/* Radio Multiple Choice & True/False */}
                  {(qItem.tipo === 'multiple' || qItem.tipo === 'tf') && (
                    qItem.opciones.map((opt, oIdx) => {
                      const isChecked = answers[qItem.id] === oIdx;
                      return (
                        <div 
                          key={oIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetAnswer(qItem.id, oIdx);
                          }}
                          className="flex items-center gap-3 py-2 px-1 hover:bg-slate-50 rounded-md transition duration-150 cursor-pointer group"
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                            isChecked 
                              ? 'border-[#673ab7]' 
                              : 'border-[#5f6368] group-hover:border-[#202124]'
                          }`}>
                            {isChecked && (
                              <div className="w-2.5 h-2.5 rounded-full bg-[#673ab7]" />
                            )}
                          </div>
                          <span className="text-[#202124] text-sm leading-relaxed font-normal">{opt}</span>
                        </div>
                      );
                    })
                  )}

                  {/* Checkboxes items list */}
                  {qItem.tipo === 'checkbox' && (
                    qItem.opciones.map((opt, oIdx) => {
                      const answersList: number[] = answers[qItem.id] || [];
                      const isChecked = answersList.includes(oIdx);
                      return (
                        <div 
                          key={oIdx}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleCheckbox(qItem.id, oIdx);
                          }}
                          className="flex items-center gap-3 py-2 px-1 hover:bg-slate-50 rounded-md transition duration-150 cursor-pointer group"
                        >
                          <div className={`w-[18px] h-[18px] rounded border-2 flex items-center justify-center transition-all shrink-0 ${
                            isChecked 
                              ? 'border-[#673ab7] bg-[#673ab7] text-white' 
                              : 'border-[#5f6368] bg-transparent group-hover:border-[#202124]'
                          }`}>
                            {isChecked && (
                              <Check className="w-3.5 h-3.5 stroke-[3px]" />
                            )}
                          </div>
                          <span className="text-[#202124] text-sm leading-relaxed font-normal">{opt}</span>
                        </div>
                      );
                    })
                  )}

                  {/* Dropdown menu */}
                  {qItem.tipo === 'dropdown' && (
                    <div className="max-w-xs mt-1 relative">
                      <select
                        value={answers[qItem.id] !== undefined ? answers[qItem.id] : ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={e => handleSetAnswer(qItem.id, e.target.value !== '' ? Number(e.target.value) : '')}
                        className="w-full p-2.5 border border-[#dadce0] rounded-md bg-white text-sm text-[#202124] focus:outline-none focus:border-[#673ab7] focus:ring-1 focus:ring-[#673ab7]/30 transition-all cursor-pointer"
                      >
                        <option value="">Elegir</option>
                        {qItem.opciones.map((opt, oIdx) => (
                          <option key={oIdx} value={oIdx}>{opt}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Open written responses with high fidelity underline style */}
                  {qItem.tipo === 'abierta' && (
                    <div className="relative mt-2 max-w-xl">
                      <textarea 
                        value={answers[qItem.id] || ''}
                        onClick={(e) => e.stopPropagation()}
                        onChange={e => handleSetAnswer(qItem.id, e.target.value)}
                        placeholder="Tu respuesta"
                        rows={1}
                        className="w-full bg-transparent border-b border-dashed border-[#dadce0] focus:border-b-2 focus:border-[#673ab7] focus:border-[#673ab7] focus:border-b-solid outline-none py-2 text-sm text-[#202124] placeholder-slate-400 resize-none transition-all duration-200"
                        style={{ minHeight: '38px' }}
                      />
                    </div>
                  )}

                  {/* Linear scale range */}
                  {qItem.tipo === 'escala' && (
                    <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-xl bg-slate-50/50 p-4 rounded-lg border border-[#dadce0]">
                      <span className="text-xs font-bold text-[#5f6368] self-center">Bajo / Poco</span>
                      <div className="flex gap-4 justification-center items-center">
                        {[1, 2, 3, 4, 5].map(n => {
                          const isSelected = answers[qItem.id] === n;
                          return (
                            <div 
                              key={n}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSetAnswer(qItem.id, n);
                              }}
                              className="flex flex-col items-center gap-1.5 cursor-pointer select-none"
                            >
                              <span className="text-xs text-slate-500 font-bold">{n}</span>
                              <div className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
                                isSelected 
                                  ? 'bg-[#673ab7] border-[#673ab7] text-white scale-[1.05] shadow-sm' 
                                  : 'bg-white border-[#dadce0] hover:border-slate-400 text-[#5f6368]'
                              }`}>
                                {isSelected ? <Check className="w-4 h-4 stroke-[3px]" /> : <span className="text-xs font-semibold">{n}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <span className="text-xs font-bold text-[#5f6368] self-center">Alto / Excelente</span>
                    </div>
                  )}

                </div>
              </div>
            );
          })}
        </div>

        {/* BOTTOM FORM SUBMISSION ACTIONS */}
        <div className="mt-8 pt-4 flex items-center justify-between">
          <button
            onClick={confirmExit}
            className="text-[#673ab7] hover:bg-[#673ab7]/5 px-4 py-2 rounded font-semibold text-sm transition-colors cursor-pointer"
          >
            Borrar formulario
          </button>

          <button 
            onClick={triggerConfirmModal}
            className="bg-[#673ab7] hover:bg-[#58319d] text-white font-bold py-2 px-6 rounded shadow transition-all duration-200 transform active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <Check className="w-4 h-4 animate-bounce" />
            <span>Enviar respuestas</span>
          </button>
        </div>

      </div>

      {/* CONFIRMATION SUBMISSION MODAL */}
      {showConfirmModal && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-lg shadow-xl w-full max-w-sm p-6 theme-bg-surface">
            <h4 className="font-semibold text-lg text-slate-900 mb-2 flex items-center gap-1.5 border-none">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>Confirmar envío</span>
            </h4>
            
            {/* Warning if unanswered exits */}
            {(() => {
              const unansweredCount = questions.filter(item => answers[item.id] === undefined || answers[item.id] === '').length;
              return unansweredCount > 0 ? (
                <div className="space-y-2 mt-2">
                  <p className="text-sm font-medium text-slate-700 leading-relaxed">
                    Tienes <strong className="text-rose-600">{unansweredCount} pregunta{unansweredCount > 1 ? 's' : ''} sin contestar</strong>.
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Si envías el examen ahora, esas preguntas se considerarán nulas o en blanco. ¿Aceptar envío?
                  </p>
                </div>
              ) : (
                <p className="text-sm text-slate-600 leading-relaxed mt-2 animate-none">
                  Has completado todas las preguntas registradas en la evaluación. ¿Deseas enviar tus respuestas definitivamente?
                </p>
              );
            })()}

            <div className="flex gap-2.5 mt-6 justify-end border-t border-slate-100 pt-4">
              <button 
                onClick={() => setShowConfirmModal(false)}
                className="text-slate-500 hover:bg-slate-100 px-4 py-1.5 rounded text-xs font-semibold cursor-pointer"
              >
                Revisar
              </button>
              <button 
                onClick={processSubmitPayload}
                className="bg-[#673ab7] hover:bg-[#58319d] text-white text-xs px-4.5 py-2 rounded font-bold shadow-sm cursor-pointer"
              >
                Enviar ahora
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONGRATULATIONS RESULT MODAL FEEDBACK */}
      {showResultModal && resultsState && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-lg shadow-xl w-full max-w-md p-6 theme-bg-surface text-center flex flex-col items-center border-t-8 border-t-[#673ab7]">
            
            <div className={`w-[100px] h-[100px] rounded-full border-4 flex flex-col items-center justify-center font-bold mb-4 ${
              resultsState.aprobado 
                ? 'bg-emerald-50 border-emerald-500 text-emerald-700' 
                : 'bg-rose-50 border-rose-500 text-rose-750'
            }`}>
              <span className="text-3xl font-extrabold">{resultsState.puntaje}%</span>
              <span className="text-[10px] font-bold uppercase tracking-wide mt-0.5">
                {resultsState.aprobado ? 'Aprobado' : 'Reprobado'}
              </span>
            </div>

            <h3 className="text-xl font-bold text-slate-900 leading-snug border-none">{exam.titulo}</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full font-semibold mt-2">{exam.materia}</span>
            
            <p className="text-xs text-slate-500 mt-3 leading-relaxed max-w-sm">
              Tu examen ha sido guardado exitosamente. Nota mínima requerida para aprobar: {exam.aprobacion}%
            </p>

            {/* Score Grid details */}
            <div className="grid grid-cols-3 gap-2.5 w-full mt-5 bg-slate-50 p-3.5 rounded-lg border border-slate-150 text-left">
              <div className="text-center">
                <span className="block text-md font-bold text-emerald-600">{resultsState.correctas}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Correctas</span>
              </div>
              <div className="text-center">
                <span className="block text-md font-bold text-rose-500">{resultsState.incorrectas}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Incorrectas</span>
              </div>
              <div className="text-center">
                <span className="block text-md font-bold text-slate-600">{resultsState.tiempoUsado}</span>
                <span className="text-[9px] uppercase font-bold text-slate-400">Tiempo</span>
              </div>
            </div>

            <button 
              onClick={handleCloseResultsModal}
              className="w-full bg-[#673ab7] hover:bg-[#58319d] text-white p-2.5 rounded shadow font-bold tracking-wide mt-6 block cursor-pointer transition-colors"
            >
              Cerrar y ver resultados
            </button>
          </div>
         </div>
      )}

      {/* EXIT DEVIATION DIALOG COUPLING GOOGLE STYLE */}
      {showExitConfirm && (
        <div className="modal-overlay fixed inset-0 bg-black/45 flex items-center justify-center z-[200] p-4 text-left">
          <div className="modal bg-white rounded-lg shadow-xl w-full max-w-sm p-6 theme-bg-surface">
            <h4 className="font-semibold text-lg text-slate-900 mb-2 flex items-center gap-1.5 border-none">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>¿Salir de la evaluación?</span>
            </h4>
            <p className="text-sm text-slate-600 leading-relaxed mt-2 font-sans">
              Tu progreso activo en el parcial se perderá de forma definitiva. ¿Estás seguro que deseas salir?
            </p>
            <div className="flex gap-2.5 mt-6 justify-end border-t border-slate-100 pt-4">
              <button 
                onClick={() => setShowExitConfirm(false)}
                className="text-slate-500 hover:bg-slate-100 px-4 py-1.5 rounded text-xs font-semibold cursor-pointer"
              >
                Continuar examen
              </button>
              <button 
                onClick={onExit}
                className="bg-rose-600 hover:bg-rose-700 text-white text-xs px-4.5 py-2 rounded font-bold shadow-sm cursor-pointer"
              >
                Sí, salir
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
