/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Check, 
  CheckSquare, CircleDot, HelpCircle, Eye, EyeOff, LayoutGrid 
} from 'lucide-react';
import { Exam, Question, Parcial, Subject, Semester } from '../types';
import { uid } from '../lib/db';

interface ExamBuilderProps {
  examId: string;
  exams: Exam[];
  parciales: Parcial[];
  onBack: () => void;
  onUpdateExams: (updated: Exam[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export default function ExamBuilder({ 
  examId, exams, parciales, onBack, onUpdateExams, toast 
}: ExamBuilderProps) {

  const exam = exams.find(e => e.id === examId);
  if (!exam) {
    return (
      <div className="p-8 text-center bg-white border rounded shadow">
        <p className="text-red-500">Examen no encontrado</p>
        <button onClick={onBack} className="btn btn-secondary mt-3">Volver</button>
      </div>
    );
  }

  // Local Form States (initialized from active exam)
  const [title, setTitle] = useState(exam.titulo);
  const [materia, setMateria] = useState(exam.materia);
  const [parcialId, setParcialId] = useState(exam.parcialId || '');
  const [description, setDescription] = useState(exam.descripcion || '');
  const [tiempo, setTiempo] = useState(exam.tiempo);
  const [intentos, setIntentos] = useState(exam.intentos);
  const [aprobacion, setAprobacion] = useState(exam.aprobacion);
  const [aleatorio, setAleatorio] = useState(exam.aleatorio);
  const [mostrarNota, setMostrarNota] = useState(exam.mostrarNota);
  const [questions, setQuestions] = useState<Question[]>(() => JSON.parse(JSON.stringify(exam.preguntas || [])));

  // View States
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [previewShowCorrect, setPreviewShowCorrect] = useState(false);

  // Sync state if examId changes
  useEffect(() => {
    setTitle(exam.titulo);
    setMateria(exam.materia);
    setParcialId(exam.parcialId || '');
    setDescription(exam.descripcion || '');
    setTiempo(exam.tiempo);
    setIntentos(exam.intentos);
    setAprobacion(exam.aprobacion);
    setAleatorio(exam.aleatorio);
    setMostrarNota(exam.mostrarNota);
    setQuestions(JSON.parse(JSON.stringify(exam.preguntas || [])));
  }, [examId, exam]);

  const handleAddField = () => {
    const newQ: Question = {
      id: uid(),
      texto: '',
      tipo: 'multiple',
      puntos: 10,
      opciones: ['Opción A', 'Opción B'],
      correctas: [],
    };
    setQuestions([...questions, newQ]);
  };

  const handleUpdateQText = (id: string, text: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, texto: text } : q));
  };

  const handleUpdateQPts = (id: string, pts: number) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, puntos: pts } : q));
  };

  const handleChangeQType = (id: string, type: Question['tipo']) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        let options = q.opciones;
        if (type === 'multiple' || type === 'checkbox' || type === 'dropdown') {
          if (!options || options.length === 0) options = ['Opción A', 'Opción B'];
        } else if (type === 'tf') {
          options = ['Verdadero', 'Falso'];
        } else {
          options = [];
        }
        return {
          ...q,
          tipo: type,
          correctas: [],
          opciones: options,
        };
      }
      return q;
    }));
  };

  const handleUpdateOptionText = (qid: string, oIdx: number, val: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextOpts = [...q.opciones];
        nextOpts[oIdx] = val;
        return { ...q, opciones: nextOpts };
      }
      return q;
    }));
  };

  const handleToggleCorrect = (qid: string, oIdx: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        let nextCorrect: number[] = [];
        if (q.tipo === 'multiple' || q.tipo === 'dropdown' || q.tipo === 'tf') {
          nextCorrect = [oIdx];
        } else {
          // Checkbox allowing multiple correct selectors
          if (q.correctas.includes(oIdx)) {
            nextCorrect = q.correctas.filter(c => c !== oIdx);
          } else {
            nextCorrect = [...q.correctas, oIdx];
          }
        }
        return { ...q, correctas: nextCorrect };
      }
      return q;
    }));
  };

  const handleAddOption = (qid: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        return {
          ...q,
          opciones: [...q.opciones, `Opción ${String.fromCharCode(65 + q.opciones.length)}`],
        };
      }
      return q;
    }));
  };

  const handleRemoveOption = (qid: string, oIdx: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        if (q.opciones.length <= 2) {
          toast('Mínimo debes registrar 2 opciones de respuesta', 'warning');
          return q;
        }
        const nextOpts = q.opciones.filter((_, i) => i !== oIdx);
        // adjust correct list
        const nextCorrect = q.correctas
          .filter(c => c !== oIdx)
          .map(c => c > oIdx ? c - 1 : c);
        return { ...q, opciones: nextOpts, correctas: nextCorrect };
      }
      return q;
    }));
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleMoveQuestion = (index: number, dir: -1 | 1) => {
    const targetIdx = index + dir;
    if (targetIdx < 0 || targetIdx >= questions.length) return;
    const nextQList = [...questions];
    const triggerQ = nextQList[index];
    nextQList[index] = nextQList[targetIdx];
    nextQList[targetIdx] = triggerQ;
    setQuestions(nextQList);
  };

  const handleSave = (estado: 'borrador' | 'activo') => {
    const updatedExams = exams.map(e => {
      if (e.id === examId) {
        return {
          ...e,
          titulo: title.trim() || 'Examen sin título',
          materia: materia.trim() || 'Matemáticas',
          parcialId: parcialId || null,
          descripcion: description.trim(),
          tiempo,
          intentos,
          aprobacion,
          aleatorio,
          mostrarNota,
          estado,
          preguntas: questions,
        };
      }
      return e;
    });

    onUpdateExams(updatedExams);
    toast(
      estado === 'activo' 
        ? 'Examen publicado exitosamente ✓' 
        : 'Progreso guardado como borrador', 
      'success'
    );
    if (estado === 'activo') {
      onBack();
    }
  };

  return (
    <div className="page-builder animate-fade-in pb-12">
      {/* Editor top action bar */}
      <div className="page-header flex items-center justify-between gap-3 mb-6 border-b border-slate-200 pb-3">
        <button 
          onClick={onBack}
          className="btn btn-secondary flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-250 hover:bg-slate-50 text-slate-700 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver</span>
        </button>
        <div className="flex gap-2">
          <button 
            onClick={() => handleSave('borrador')}
            className="btn btn-secondary px-4 py-2 rounded-xl text-slate-700 bg-white border"
          >
            Guardar borrador
          </button>
          <button 
            onClick={() => handleSave('activo')}
            className="btn btn-primary px-4 py-2 rounded-xl text-white font-bold"
            style={{ backgroundColor: 'var(--primary)' }}
          >
            Publicar examen
          </button>
        </div>
      </div>

      {/* Main Grid: Left editor input panels, Right live preview panel */}
      <div className={`grid gap-6 transition-all duration-305 ${previewCollapsed ? 'grid-cols-1 lg:grid-cols-[1fr_60px]' : 'grid-cols-1 lg:grid-cols-[1fr_340px]'}`}>
        
        {/* LEFT COLUMN: EDITOR */}
        <div className="flex flex-col gap-4">
          
          {/* Header Card properties */}
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-5 text-white" style={{ backgroundColor: 'var(--primary)' }}>
              <input 
                type="text" 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Título del examen o evaluación"
                className="w-full text-xl font-bold bg-transparent border-none outline-none placeholder-white/50 text-white"
              />
              <textarea 
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Instrucciones o descripción relativas para el estudiante (opcional)"
                rows={2}
                className="w-full text-sm mt-3 bg-transparent border-none outline-none placeholder-white/35 resize-none text-white/90"
              />
            </div>
            
            {/* Inline controls */}
            <div className="bg-white p-5 border-t border-slate-100 theme-bg-surface theme-border">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Materia</label>
                  <input 
                    type="text" 
                    value={materia} 
                    onChange={e => setMateria(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Tiempo límite</label>
                  <select 
                    value={tiempo} 
                    onChange={e => setTiempo(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value={0}>Sin límite de tiempo</option>
                    <option value={15}>15 minutos</option>
                    <option value={30}>30 minutos</option>
                    <option value={45}>45 minutos</option>
                    <option value={60}>60 minutos</option>
                    <option value={90}>90 minutos</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Intentos</label>
                  <select 
                    value={intentos} 
                    onChange={e => setIntentos(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value={1}>1 Intento único</option>
                    <option value={2}>2 Intentos permitidos</option>
                    <option value={0}>Ilimitados</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Nota aprobatoria</label>
                  <input 
                    type="number" 
                    min={1} 
                    max={100}
                    value={aprobacion} 
                    onChange={e => setAprobacion(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  />
                </div>
              </div>

              {/* Switches configurations */}
              <div className="flex gap-4.5 mt-4 pt-3 border-t border-slate-50 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                  <input 
                    type="checkbox" 
                    checked={aleatorio} 
                    onChange={e => setAleatorio(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span>Preguntas aleatorias</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-600">
                  <input 
                    type="checkbox" 
                    checked={mostrarNota} 
                    onChange={e => setMostrarNota(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <span>Mostrar calificaciones finales</span>
                </label>
              </div>
            </div>
          </div>

          {/* QUESTIONS LIST CONTAINER */}
          <div className="flex flex-col gap-4">
            {questions.length === 0 ? (
              <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center theme-bg-surface theme-border">
                <HelpCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-700">Sin preguntas asignadas</h4>
                <p className="text-xs text-slate-400 mt-1">Utiliza el botón inferior para agregar la primera pregunta</p>
              </div>
            ) : (
              questions.map((q, qIndex) => {
                const isCheck = q.tipo === 'checkbox';
                const isTF = q.tipo === 'tf';
                const isText = q.tipo === 'abierta';
                const isScale = q.tipo === 'escala';
                const showOpts = q.tipo === 'multiple' || q.tipo === 'checkbox' || q.tipo === 'dropdown' || q.tipo === 'tf';

                return (
                  <div 
                    key={q.id} 
                    className="question-card bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition shadow-sm relative theme-bg-surface theme-border"
                  >
                    <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest mb-2.5">
                      Pregunta {qIndex + 1}
                    </div>

                    <input 
                      type="text" 
                      value={q.texto}
                      onChange={e => handleUpdateQText(q.id, e.target.value)}
                      placeholder="Escribe la elipsis o enunciado de la pregunta aquí..."
                      className="w-full text-base font-medium border-b border-slate-200 py-1.5 focus:border-indigo-500 outline-none placeholder-slate-400 mb-4 bg-transparent"
                    />

                    {/* Options list if visible for type */}
                    {showOpts && (
                      <div className="flex flex-col gap-2 mb-4">
                        {q.opciones.map((opt, oIdx) => {
                          const isCorrect = q.correctas.includes(oIdx);
                          return (
                            <div key={oIdx} className="flex items-center gap-2">
                              {isCheck ? (
                                <div className="w-[18px] h-[18px] border-2 border-slate-300 rounded shrink-0 bg-slate-50" />
                              ) : (
                                <div className="w-[18px] h-[18px] border-2 border-slate-300 rounded-full shrink-0 bg-slate-50" />
                              )}
                              <input 
                                type="text"
                                value={opt}
                                onChange={e => handleUpdateOptionText(q.id, oIdx, e.target.value)}
                                placeholder={`Opción ${oIdx + 1}`}
                                className="flex-1 bg-transparent border-b border-slate-100 text-sm py-1 font-medium focus:border-indigo-400 outline-none"
                              />
                              <button 
                                type="button"
                                onClick={() => handleToggleCorrect(q.id, oIdx)}
                                className={`text-xs w-6 h-6 rounded flex items-center justify-center font-bold border transition ${
                                  isCorrect 
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-600' 
                                    : 'text-slate-300 border-slate-200 bg-white hover:text-slate-500 hover:border-slate-300'
                                }`}
                                title="Marcar como alternativa correcta"
                              >
                                {isCorrect ? <Check className="w-3.5 h-3.5" /> : '✓'}
                              </button>
                              {!isTF && (
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveOption(q.id, oIdx)}
                                  className="text-slate-300 hover:text-red-500 p-1.5 border border-transparent hover:border-slate-100 rounded transition"
                                  title="Eliminar opción"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {!isTF && (
                          <button 
                            type="button" 
                            onClick={() => handleAddOption(q.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold text-left self-start mt-1.5 flex items-center gap-1 cursor-pointer"
                          >
                            + Agregar opción de respuesta
                          </button>
                        )}
                      </div>
                    )}

                    {isText && (
                      <div className="mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100 text-xs font-semibold text-slate-400">
                        El estudiante completará un cuadro de texto libre con su respuesta.
                      </div>
                    )}

                    {isScale && (
                      <div className="flex gap-2 mb-4 shrink-0 mt-3">
                        {[1, 2, 3, 4, 5].map(n => (
                          <div key={n} className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-xs text-slate-400 font-bold bg-slate-50">
                            {n}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Question Actions footer */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
                      <select 
                        value={q.tipo}
                        onChange={e => handleChangeQType(q.id, e.target.value as Question['tipo'])}
                        className="text-xs p-1.5 font-bold border rounded-lg bg-slate-50 text-slate-600 cursor-pointer"
                      >
                        <option value="multiple">Opción múltiple</option>
                        <option value="checkbox">Opción de Casillas</option>
                        <option value="dropdown">Menú desplegable</option>
                        <option value="tf">Verdadero/Falso</option>
                        <option value="abierta">Respuesta libre/Texto</option>
                        <option value="escala">Escala (1 al 5)</option>
                      </select>

                      <div className="flex-1" />

                      {/* Points counter */}
                      <div className="flex items-center gap-1 text-xs font-bold text-slate-500">
                        <span>Puntos:</span>
                        <input 
                          type="number" 
                          min={1} 
                          value={q.puntos}
                          onChange={e => handleUpdateQPts(q.id, Number(e.target.value) || 10)}
                          className="w-12 p-1 text-center border border-slate-200 rounded bg-white font-bold"
                        />
                      </div>

                      {/* Reorder keys */}
                      <div className="flex gap-1">
                        <button 
                          type="button" 
                          onClick={() => handleMoveQuestion(qIndex, -1)}
                          disabled={qIndex === 0}
                          className="btn-icon p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ArrowUp className="w-4 h-4" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleMoveQuestion(qIndex, 1)}
                          disabled={qIndex === questions.length - 1}
                          className="btn-icon p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                        >
                          <ArrowDown className="w-4 h-4" />
                        </button>
                        <button 
                          type="button" 
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="btn-icon p-1 rounded hover:bg-rose-50 text-slate-400 hover:text-rose-600 font-bold border border-transparent hover:border-rose-100"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* ADD QUESTIONS DASH */}
            <button 
              type="button" 
              onClick={handleAddField}
              className="add-question-bar bg-white flex items-center justify-center gap-2 p-5 border-2 border-dashed border-slate-300 rounded-2xl cursor-pointer hover:border-indigo-500 hover:bg-slate-50 hover:text-indigo-600 transition text-slate-400 text-sm font-semibold select-none"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir pregunta</span>
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: PREVIEW PANEL */}
        <aside className="sticky top-[80px] h-fit md:max-h-[calc(100vh-140px)] flex flex-col z-30">
          <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm theme-bg-surface theme-border flex flex-col h-full overflow-hidden p-3 md:p-4">
            
            {/* Preview Controls header */}
            <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 gap-1">
              <span className="font-bold text-xs uppercase tracking-wider text-slate-700 hidden lg:inline">Vista previa</span>
              
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setPreviewCollapsed(!previewCollapsed)}
                  className="btn border rounded-lg p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition"
                  title={previewCollapsed ? "Expandir vista previa" : "Colapsar vista previa"}
                >
                  {previewCollapsed ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                
                {!previewCollapsed && (
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] sm:text-xs font-bold text-slate-500 select-none">
                    <input 
                      type="checkbox" 
                      checked={previewShowCorrect}
                      onChange={e => setPreviewShowCorrect(e.target.checked)}
                      className="accent-indigo-600"
                    />
                    <span>Ver correctas</span>
                  </label>
                )}
              </div>
            </div>

            {/* Actual scrollable mock preview */}
            {!previewCollapsed && (
              <div className="flex-1 overflow-y-auto mt-4 px-1 flex flex-col gap-4 text-left max-h-[400px] md:max-h-[600px]">
                <div className="border-b border-slate-100 pb-2">
                  <h4 className="font-extrabold text-sm text-slate-900 leading-snug">{title.trim() || 'Cuestionario sin título'}</h4>
                  {materia.trim() && <span className="inline-block mt-1.5 text-[10px] uppercase font-bold text-indigo-500">{materia}</span>}
                  {description.trim() && <p className="text-[11px] text-slate-400 mt-2 italic leading-relaxed">{description}</p>}
                </div>

                {questions.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-300">Vacío. Diseña preguntas en la izquierda para verlas ilustradas aquí.</div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {questions.map((q, i) => (
                      <div key={q.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">P{i+1} · {q.puntos} Pts</div>
                        <p className="font-semibold text-slate-800 mb-2">{q.texto || 'Pregunta sin texto definitorio'}</p>

                        {(q.tipo === 'multiple' || q.tipo === 'checkbox' || q.tipo === 'dropdown' || q.tipo === 'tf') && (
                          <div className="flex flex-col gap-1.5">
                            {q.opciones.map((opt, oIdx) => {
                              const isSol = q.correctas.includes(oIdx);
                              const typeChar = q.tipo === 'checkbox' ? '☐' : '◯';
                              return (
                                <div key={oIdx} className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-slate-150">
                                  <span className="text-[10px] text-slate-300 font-bold">{typeChar}</span>
                                  <span className="flex-1 font-medium text-[11px] truncate">{opt}</span>
                                  {previewShowCorrect && isSol && (
                                    <span className="text-emerald-600 font-bold text-xs" title="Respuesta marcada como válida">✓</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {q.tipo === 'abierta' && (
                          <textarea 
                            disabled 
                            rows={1}
                            placeholder="Entrada de texto del estudiante..." 
                            className="w-full bg-white p-2 border border-slate-150 rounded text-[11px]" 
                          />
                        )}

                        {q.tipo === 'escala' && (
                          <div className="flex gap-1">
                            {[1,2,3,4,5].map(n => (
                              <div key={n} className="w-6 h-6 rounded-full border border-slate-200 flex items-center justify-center font-bold text-[9px] bg-white text-slate-400">
                                {n}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
