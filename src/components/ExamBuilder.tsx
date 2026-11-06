/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Check, 
  CheckSquare, CircleDot, HelpCircle, Eye, EyeOff, LayoutGrid 
} from 'lucide-react';
import { Exam, Question, Parcial, Subject, Semester } from '../types';
import { uid } from '../lib/db';
import { saveDocToFirestore } from '../lib/firebase';
import AutoExpandingTextarea from './AutoExpandingTextarea';

interface ExamBuilderProps {
  examId: string;
  exams: Exam[];
  parciales: Parcial[];
  onBack: () => void;
  onUpdateExams: (updated: Exam[]) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning') => void;
}

export const PRESET_BANNERS = [
  {
    id: 'teologia',
    name: 'Teología y Libros (Clásico)',
    url: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'workspace',
    name: 'Escritorio de Estudio',
    url: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'chalkboard',
    name: 'Pizarra y Aula',
    url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'gradient',
    name: 'Gradiente Cósmico',
    url: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=1200&q=80',
  },
  {
    id: 'library',
    name: 'Luz de Biblioteca',
    url: 'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=1200&q=80',
  }
];

function ensureValidQuestions(rawQuestions: any[]): Question[] {
  if (!Array.isArray(rawQuestions)) return [];
  const seenIds = new Set<string>();
  return rawQuestions.map((q, idx) => {
    let id = typeof q?.id === 'string' && q.id.trim() ? q.id : `q_${uid()}_${idx}`;
    if (seenIds.has(id)) {
      id = `${id}_${uid()}_${idx}`;
    }
    seenIds.add(id);

    const tipo: Question['tipo'] = q?.tipo || 'multiple';
    let opciones: string[] = Array.isArray(q?.opciones) ? [...q.opciones] : [];
    if (opciones.length === 0) {
      if (tipo === 'tf') opciones = ['Verdadero', 'Falso'];
      else if (tipo === 'matching') opciones = ['Papiro', 'Talmud', 'Masoretas'];
      else if (tipo === 'table') opciones = ['UNGIDO', 'ORGULLO', 'EL EDÉN', 'REBELIÓN'];
      else opciones = ['Opción A', 'Opción B'];
    }

    let enunciados: string[] | undefined = undefined;
    let matchCorrectos: number[] | undefined = undefined;
    if (tipo === 'matching') {
      enunciados = Array.isArray(q?.enunciados) && q.enunciados.length > 0
        ? [...q.enunciados]
        : ['Pregunta 1'];
      const maxOpt = opciones.length > 0 ? opciones.length - 1 : 999;
      const rawMatches = Array.isArray(q?.matchCorrectos) ? q.matchCorrectos : [];
      matchCorrectos = enunciados.map((_, i) => {
        const val = rawMatches[i];
        if (val === undefined || val === null || val === '') return 0;
        const parsed = Number(val);
        if (isNaN(parsed) || parsed < 0) return 0;
        return maxOpt > 0 ? Math.min(parsed, maxOpt) : parsed;
      });
    }

    const opcionIds: string[] = Array.isArray(q?.opcionIds) && q.opcionIds.length === opciones.length
      ? [...q.opcionIds]
      : opciones.map((_, i) => `opt_${id}_${i}`);

    let enunciadoIds: string[] | undefined = undefined;
    if (tipo === 'matching' && enunciados) {
      enunciadoIds = Array.isArray(q?.enunciadoIds) && q.enunciadoIds.length === enunciados.length
        ? [...q.enunciadoIds]
        : enunciados.map((_, i) => `enun_${id}_${i}`);
    }

    const resolvedTexto = typeof q?.texto === 'string' && q.texto.trim()
      ? q.texto
      : (typeof q?.enunciado === 'string' && q.enunciado.trim() ? q.enunciado : (q?.texto || ''));

    let resolvedCorrectas: number[] = [];
    if (Array.isArray(q?.correctas) && q.correctas.length > 0) {
      resolvedCorrectas = [...q.correctas];
    } else if (q?.correcta !== undefined && q?.correcta !== null && !isNaN(Number(q.correcta))) {
      resolvedCorrectas = [Number(q.correcta)];
    }

    return {
      ...q,
      id,
      tipo,
      texto: resolvedTexto,
      puntos: typeof q?.puntos === 'number' && !isNaN(q.puntos) ? q.puntos : 10,
      opciones,
      opcionIds,
      correctas: resolvedCorrectas,
      enunciados,
      enunciadoIds,
      matchCorrectos,
    };
  });
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
  const [subtitulo, setSubtitulo] = useState(exam.subtitulo || '');
  const [materia, setMateria] = useState(exam.materia);
  const [parcialId, setParcialId] = useState(exam.parcialId || '');
  const [description, setDescription] = useState(exam.descripcion || '');
  const [tiempo, setTiempo] = useState(exam.tiempo);
  const [intentos, setIntentos] = useState(exam.intentos);
  const [aprobacion, setAprobacion] = useState(exam.aprobacion);
  const [aleatorio, setAleatorio] = useState(exam.aleatorio);
  const [mostrarNota, setMostrarNota] = useState(exam.mostrarNota);
  const [questions, setQuestions] = useState<Question[]>(() => ensureValidQuestions(exam.preguntas || []));
  const [bannerUrl, setBannerUrl] = useState(exam.bannerUrl || PRESET_BANNERS[0].url);

  // View States
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [previewShowCorrect, setPreviewShowCorrect] = useState(false);

  // Auto-save states
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('saved');

  // Table Classification Wizard states
  const [tableWizardQId, setTableWizardQId] = useState<string | null>(null);
  const [wizardTitle, setWizardTitle] = useState('Organice los siguientes grupos en las clasificaciones de corrientes y no corrientes:');
  const [wizardCol1Name, setWizardCol1Name] = useState('CORRIENTES');
  const [wizardCol1Items, setWizardCol1Items] = useState('Disponible, Inversiones, Cuentas por cobrar a corto plazo, Inventario');
  const [wizardCol2Name, setWizardCol2Name] = useState('NO CORRIENTES');
  const [wizardCol2Items, setWizardCol2Items] = useState('Propiedades, planta y equipo, Intangibles, Valorización, Cuentas por cobrar a largo plazo');
  const isFirstRender = useRef(true);
  const isDirtyRef = useRef(false);
  const lastExamIdRef = useRef(examId);
  const examsRef = useRef(exams);

  // Helper para generar una huella canónica de los campos editables del examen.
  // Permite verificar si existió una edición real del docente y previene autoguardados
  // accidentales o modificaciones de 'actualizado' al solo abrir, inspeccionar o cerrar el editor.
  const computeExamContentFingerprint = (data: {
    title: string;
    subtitulo: string;
    materia: string;
    parcialId: string;
    description: string;
    tiempo: number;
    intentos: number;
    aprobacion: number;
    aleatorio: boolean;
    mostrarNota: boolean;
    bannerUrl: string;
    questions: Question[];
  }) => {
    return JSON.stringify({
      t: (data.title || '').trim(),
      s: (data.subtitulo || '').trim(),
      m: (data.materia || '').trim(),
      p: data.parcialId || '',
      d: (data.description || '').trim(),
      ti: data.tiempo,
      i: data.intentos,
      a: data.aprobacion,
      al: data.aleatorio,
      mn: data.mostrarNota,
      b: data.bannerUrl,
      q: (data.questions || []).map(q => ({
        id: q.id,
        tipo: q.tipo,
        texto: (q.texto || '').trim(),
        puntos: q.puntos,
        opciones: (q.opciones || []).map(o => o.trim()),
        correctas: [...(q.correctas || [])].sort((a, b) => a - b),
        enunciados: (q.enunciados || []).map(e => e.trim()),
        matchCorrectos: q.matchCorrectos || [],
        tableColumns: q.tableColumns || [],
        tableOptions: q.tableOptions || [],
        tableRows: q.tableRows || [],
      }))
    });
  };

  const initialContentHashRef = useRef<string>(
    computeExamContentFingerprint({
      title: exam.titulo,
      subtitulo: exam.subtitulo || '',
      materia: exam.materia,
      parcialId: exam.parcialId || '',
      description: exam.descripcion || '',
      tiempo: exam.tiempo,
      intentos: exam.intentos,
      aprobacion: exam.aprobacion,
      aleatorio: exam.aleatorio,
      mostrarNota: exam.mostrarNota,
      bannerUrl: exam.bannerUrl || PRESET_BANNERS[0].url,
      questions: ensureValidQuestions(exam.preguntas || [])
    })
  );

  // Synchronous ref to current exam form state to avoid stale closures in effects and handlers
  const latestDataRef = useRef({
    examId,
    title,
    subtitulo,
    materia,
    parcialId,
    description,
    tiempo,
    intentos,
    aprobacion,
    aleatorio,
    mostrarNota,
    questions,
    bannerUrl,
    estado: exam.estado || 'borrador',
    docenteId: exam.docenteId,
    creado: exam.creado,
    actualizado: exam.actualizado,
  });

  // Always update latestDataRef synchronously on every render
  latestDataRef.current = {
    examId,
    title,
    subtitulo,
    materia,
    parcialId,
    description,
    tiempo,
    intentos,
    aprobacion,
    aleatorio,
    mostrarNota,
    questions,
    bannerUrl,
    estado: exam.estado || 'borrador',
    docenteId: exam.docenteId,
    creado: exam.creado,
    actualizado: exam.actualizado,
  };

  // Keep examsRef synced with latest exams prop
  useEffect(() => {
    examsRef.current = exams;
  }, [exams]);

  // Sync state ONLY if user switches to a completely different exam (examId changes)
  useEffect(() => {
    if (lastExamIdRef.current !== examId) {
      lastExamIdRef.current = examId;
      isFirstRender.current = true;
      isDirtyRef.current = false;

      const currentExam = examsRef.current.find(e => e.id === examId);
      if (currentExam) {
        setTitle(currentExam.titulo);
        setSubtitulo(currentExam.subtitulo || '');
        setMateria(currentExam.materia);
        setParcialId(currentExam.parcialId || '');
        setDescription(currentExam.descripcion || '');
        setTiempo(currentExam.tiempo);
        setIntentos(currentExam.intentos);
        setAprobacion(currentExam.aprobacion);
        setAleatorio(currentExam.aleatorio);
        setMostrarNota(currentExam.mostrarNota);
        const normQs = ensureValidQuestions(currentExam.preguntas || []);
        setQuestions(normQs);
        setBannerUrl(currentExam.bannerUrl || PRESET_BANNERS[0].url);
        initialContentHashRef.current = computeExamContentFingerprint({
          title: currentExam.titulo,
          subtitulo: currentExam.subtitulo || '',
          materia: currentExam.materia,
          parcialId: currentExam.parcialId || '',
          description: currentExam.descripcion || '',
          tiempo: currentExam.tiempo,
          intentos: currentExam.intentos,
          aprobacion: currentExam.aprobacion,
          aleatorio: currentExam.aleatorio,
          mostrarNota: currentExam.mostrarNota,
          bannerUrl: currentExam.bannerUrl || PRESET_BANNERS[0].url,
          questions: normQs
        });
      }
    }
  }, [examId]);

  const saveCurrentExamImmediate = async (overrideEstado?: 'borrador' | 'activo'): Promise<Exam> => {
    const cur = latestDataRef.current;
    const currentBase = examsRef.current.find(e => e.id === cur.examId) || exam;
    const nowIso = new Date().toISOString();

    const updatedExam: Exam = {
      ...currentBase,
      id: cur.examId,
      titulo: cur.title.trim() || 'Examen sin título',
      subtitulo: cur.subtitulo.trim(),
      materia: cur.materia.trim() || 'Matemáticas',
      parcialId: cur.parcialId || null,
      descripcion: cur.description.trim(),
      docenteId: cur.docenteId || currentBase.docenteId || 'u_admin',
      tiempo: cur.tiempo,
      intentos: cur.intentos,
      aprobacion: cur.aprobacion,
      aleatorio: cur.aleatorio,
      mostrarNota: cur.mostrarNota,
      estado: overrideEstado || cur.estado || currentBase.estado || 'borrador',
      preguntas: cur.questions,
      bannerUrl: cur.bannerUrl,
      creado: cur.creado || currentBase.creado || nowIso,
      actualizado: nowIso,
    };

    const nextExams = examsRef.current.map(e => e.id === cur.examId ? updatedExam : e);
    if (!nextExams.some(e => e.id === cur.examId)) {
      nextExams.push(updatedExam);
    }
    examsRef.current = nextExams;
    isDirtyRef.current = false;
    onUpdateExams(nextExams);

    // 1. Immediate local storage persistence
    try {
      const rawLocal = localStorage.getItem('ep_exams');
      const localExams: Exam[] = rawLocal ? JSON.parse(rawLocal) : [];
      const updatedLocal = localExams.map(e => e.id === cur.examId ? updatedExam : e);
      if (!updatedLocal.some(e => e.id === cur.examId)) {
        updatedLocal.push(updatedExam);
      }
      localStorage.setItem('ep_exams', JSON.stringify(updatedLocal));
    } catch (e) {
      console.warn('Error backing up exam to localStorage:', e);
    }

    // 2. Direct Cloud Firestore persistence
    try {
      await saveDocToFirestore('exams', updatedExam);
    } catch (err) {
      console.error('Error direct saving to Firestore:', err);
    }

    return updatedExam;
  };

  // Debounced auto-save effect: triggers reliably whenever any field changes without stealing input focus
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    const currentHash = computeExamContentFingerprint({
      title,
      subtitulo,
      materia,
      parcialId,
      description,
      tiempo,
      intentos,
      aprobacion,
      aleatorio,
      mostrarNota,
      bannerUrl,
      questions
    });

    if (currentHash === initialContentHashRef.current) {
      // Ningún campo ha sido modificado respecto al estado cargado:
      // no marcar sucio y no persistir para evitar falsos incrementos de 'actualizado'
      isDirtyRef.current = false;
      return;
    }

    isDirtyRef.current = true;
    setSaveStatus('saving');

    const updateTimer = setTimeout(async () => {
      try {
        await saveCurrentExamImmediate();
        setSaveStatus('saved');
        initialContentHashRef.current = currentHash;
      } catch (err) {
        console.error('Auto-save error:', err);
      }
    }, 700);

    return () => clearTimeout(updateTimer);
  }, [
    title,
    subtitulo,
    materia,
    parcialId,
    description,
    tiempo,
    intentos,
    aprobacion,
    aleatorio,
    mostrarNota,
    questions,
    bannerUrl,
    examId
  ]);

  // Flush latest state immediately on beforeunload or unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isDirtyRef.current) {
        saveCurrentExamImmediate();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (isDirtyRef.current) {
        saveCurrentExamImmediate();
      }
    };
  }, []);

  const handleAddField = () => {
    notifyUserEdit();
    const qId = uid();
    const newQ: Question = {
      id: qId,
      texto: '',
      tipo: 'multiple',
      puntos: 10,
      opciones: ['Opción A', 'Opción B'],
      opcionIds: [`opt_${qId}_0_${uid()}`, `opt_${qId}_1_${uid()}`],
      correctas: [],
    };
    setQuestions(prev => {
      const safePrev = prev.map(q => ({
        ...q,
        opciones: Array.isArray(q.opciones) ? [...q.opciones] : [],
        opcionIds: Array.isArray(q.opcionIds) && q.opcionIds.length === (q.opciones || []).length
          ? [...q.opcionIds]
          : (q.opciones || []).map((_, i) => q.opcionIds?.[i] || `opt_${q.id}_${i}_${uid()}`)
      }));
      const next = [...safePrev, newQ];
      latestDataRef.current = { ...latestDataRef.current, questions: next };
      return next;
    });
  };

  const handleUpdateQText = (id: string, text: string) => {
    notifyUserEdit();
    setQuestions(prev => {
      const next = prev.map(q => q.id === id ? { ...q, texto: text, enunciado: text } : q);
      latestDataRef.current = { ...latestDataRef.current, questions: next };
      return next;
    });
  };

  const handleUpdateQPts = (id: string, pts: number) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, puntos: pts } : q));
  };

  const handleChangeQType = (id: string, type: Question['tipo']) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === id) {
        if (q.tipo === type) return q;

        let options = Array.isArray(q.opciones) && q.opciones.length > 0 ? [...q.opciones] : [];
        let enunciados = Array.isArray(q.enunciados) && q.enunciados.length > 0 ? [...q.enunciados] : undefined;
        let matchCorrectos = Array.isArray(q.matchCorrectos) ? [...q.matchCorrectos] : undefined;
        let columnas = Array.isArray(q.columnas) && q.columnas.length > 0 ? [...q.columnas] : undefined;
        let tableRows = Array.isArray(q.tableRows) && q.tableRows.length > 0 ? [...q.tableRows] : undefined;
        let incisos = Array.isArray(q.incisos) && q.incisos.length > 0 ? [...q.incisos] : undefined;

        if (type === 'multiple' || type === 'checkbox' || type === 'dropdown') {
          if (options.length === 0 || (options.length === 2 && options[0] === 'Verdadero')) {
            options = ['Opción A', 'Opción B'];
          }
        } else if (type === 'tf') {
          options = ['Verdadero', 'Falso'];
        } else if (type === 'incisos') {
          options = [];
          if (!incisos || incisos.length === 0) {
            incisos = [
              { texto: 'Según las NIIF existen por lo menos 5 estados financieros establecidos, de los cuales los 2 más importantes son: 1- _______ 2- _______', respuestaEsperada: 'Estado de situación financiera, Estado de resultados' },
              { texto: 'El estado de situación financiera es uno de los estados financieros principales. Muestra los saldos de las cuentas reales de la empresa en una fecha dada.', respuestaEsperada: 'situación, principales, saldos, empresa' },
              { texto: 'El estado de resultados integral o de rendimiento, es una de las herramientas financieras más importantes para evaluar la gestión económica de una organización.', respuestaEsperada: 'rendimiento, evaluar, económica' }
            ];
          }
        } else if (type === 'matching') {
          if (options.length === 0 || (options.length === 2 && options[0] === 'Verdadero')) {
            options = ['Papiro', 'Talmud', 'Masoretas'];
          }
          if (!enunciados || enunciados.length === 0) {
            enunciados = ['Pregunta 1'];
            matchCorrectos = [0];
          } else {
            const maxOpt = Math.max(0, options.length - 1);
            matchCorrectos = enunciados.map((_, idx) => {
              const prevMatch = matchCorrectos && matchCorrectos[idx] !== undefined ? matchCorrectos[idx] : 0;
              return Math.min(Math.max(0, prevMatch), maxOpt);
            });
          }
        } else if (type === 'table') {
          if (options.length === 0) {
            options = ['UNGIDO', 'ORGULLO', 'EL EDÉN', 'REBELIÓN'];
          }
          if (!columnas || columnas.length === 0) {
            columnas = ['Privilegios y Corrupción', 'Singular Pecado y destino', 'El momento de la caída'];
          }
          if (!tableRows || tableRows.length === 0) {
            tableRows = [
              {
                cells: [
                  { tipo: 'blank', valor: '', correctOptionIdx: 0 },
                  { tipo: 'blank', valor: '', correctOptionIdx: 1 },
                  { tipo: 'blank', valor: '', correctOptionIdx: 2 }
                ]
              }
            ];
          }
        } else {
          options = [];
        }

        const opcionIds = options.map((_, i) => `opt_${id}_${i}_${uid()}`);
        const enunciadoIds = (type === 'matching' && enunciados)
          ? enunciados.map((_, i) => `enun_${id}_${i}_${uid()}`)
          : undefined;

        return {
          ...q,
          tipo: type,
          correctas: [],
          maxRespuestas: type === 'checkbox' ? (q.maxRespuestas || 3) : undefined,
          opciones: options,
          opcionIds,
          enunciados: type === 'matching' ? enunciados : undefined,
          enunciadoIds,
          matchCorrectos: type === 'matching' ? matchCorrectos : undefined,
          columnas: type === 'table' ? columnas : undefined,
          tableRows: type === 'table' ? tableRows : undefined,
          modoIncisos: type === 'incisos' ? (q.modoIncisos || 'vf') : undefined,
          incisos: type === 'incisos' ? incisos : undefined,
        };
      }
      return q;
    }));
  };

  const handleToggleModoIncisos = (qid: string, modo: 'texto' | 'vf') => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextIncisos = (q.incisos || []).map(inc => ({
          ...inc,
          tipo: modo,
          respuestaVF: inc.respuestaVF || 'V'
        }));
        return {
          ...q,
          modoIncisos: modo,
          incisos: nextIncisos
        };
      }
      return q;
    }));
  };

  const handleAddInciso = (qid: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextIncisos = [...(q.incisos || [])];
        const nextLetter = String.fromCharCode(97 + nextIncisos.length);
        const modo = q.modoIncisos || 'vf';
        nextIncisos.push({ 
          texto: `Afirmación del literal ${nextLetter}...`, 
          tipo: modo,
          respuestaVF: 'V',
          respuestaEsperada: '' 
        });
        return { ...q, incisos: nextIncisos };
      }
      return q;
    }));
  };

  const handleUpdateIncisoText = (qid: string, idx: number, val: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextIncisos = [...(q.incisos || [])];
        if (nextIncisos[idx]) {
          nextIncisos[idx] = { ...nextIncisos[idx], texto: val };
        }
        return { ...q, incisos: nextIncisos };
      }
      return q;
    }));
  };

  const handleUpdateIncisoVF = (qid: string, idx: number, val: 'V' | 'F') => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextIncisos = [...(q.incisos || [])];
        if (nextIncisos[idx]) {
          nextIncisos[idx] = { ...nextIncisos[idx], respuestaVF: val, tipo: 'vf' };
        }
        return { ...q, incisos: nextIncisos };
      }
      return q;
    }));
  };

  const handleUpdateIncisoExpected = (qid: string, idx: number, val: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextIncisos = [...(q.incisos || [])];
        if (nextIncisos[idx]) {
          nextIncisos[idx] = { ...nextIncisos[idx], respuestaEsperada: val };
        }
        return { ...q, incisos: nextIncisos };
      }
      return q;
    }));
  };

  const handleRemoveInciso = (qid: string, idx: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextIncisos = (q.incisos || []).filter((_, i) => i !== idx);
        return { ...q, incisos: nextIncisos };
      }
      return q;
    }));
  };

  const applyIncisosVFPreset = (qid: string) => {
    setQuestions(prev => prev.map(item => {
      if (item.id === qid) {
        return {
          ...item,
          tipo: 'incisos' as const,
          modoIncisos: 'vf' as const,
          texto: 'Indique si cada una de las siguientes afirmaciones es Verdadera (V) o Falsa (F):',
          opciones: [],
          incisos: [
            {
              texto: 'Según las NIIF, el Estado de Situación Financiera presenta los activos, pasivos y patrimonio en una fecha determinada.',
              tipo: 'vf' as const,
              respuestaVF: 'V' as const
            },
            {
              texto: 'Los activos no corrientes son aquellos que se espera realizar o vender en el ciclo operativo normal (menos de 1 año).',
              tipo: 'vf' as const,
              respuestaVF: 'F' as const
            },
            {
              texto: 'El Estado de Resultados Integral refleja los ingresos, gastos y el resultado económico (utilidad o pérdida) del ejercicio.',
              tipo: 'vf' as const,
              respuestaVF: 'V' as const
            },
            {
              texto: 'Las obligaciones laborales e impuestos por pagar a corto plazo forman parte del Pasivo Corriente.',
              tipo: 'vf' as const,
              respuestaVF: 'V' as const
            },
            {
              texto: 'El patrimonio neto aumenta cuando la organización incurre en pérdidas acumuladas durante el ejercicio contable.',
              tipo: 'vf' as const,
              respuestaVF: 'F' as const
            }
          ]
        };
      }
      return item;
    }));
    toast('¡Plantilla de afirmaciones Verdadero / Falso (V / F) cargada con éxito!', 'success');
  };

  const applyIncisosAccountingPreset = (qid: string) => {
    setQuestions(prev => prev.map(item => {
      if (item.id === qid) {
        return {
          ...item,
          tipo: 'incisos' as const,
          modoIncisos: 'texto' as const,
          texto: 'Complete cada afirmación con la palabra o término que corresponde:',
          opciones: [],
          incisos: [
            {
              texto: 'Según las NIIF (Normas Internacionales de Información Financiera) existen por lo menos 5 estados establecidos, de los cuales los 2 más importantes son: 1- ____________________  2- ____________________.',
              tipo: 'texto' as const,
              respuestaEsperada: 'Estado de situación financiera, Estado de resultados'
            },
            {
              texto: 'El estado de situación financiera es uno de los estados financieros principales. Muestra los saldos de las cuentas reales de la empresa en una fecha dada.',
              tipo: 'texto' as const,
              respuestaEsperada: 'situación, principales, saldos, empresa'
            },
            {
              texto: 'El estado de resultados integral o de rendimiento, es una de las herramientas financieras más importantes para evaluar la gestión económica de una organización, así como una importante guía en el proceso de toma de decisiones gerenciales.',
              tipo: 'texto' as const,
              respuestaEsperada: 'rendimiento, evaluar, económica, toma de decisiones'
            },
            {
              texto: 'Las empresas generalmente funcionan con una combinación de recursos propios y préstamos en dinero o bienes.',
              tipo: 'texto' as const,
              respuestaEsperada: 'empresas, recursos propios, préstamos'
            },
            {
              texto: 'Las tres formas de financiación estudiadas en el material son: 1- recursos propios  2- préstamos  3- inversiones.',
              tipo: 'texto' as const,
              respuestaEsperada: 'recursos propios, préstamos, inversiones'
            }
          ]
        };
      }
      return item;
    }));
    toast('¡Plantilla de incisos a, b, c, d, e (NIIF y Estados Financieros) cargada con éxito!', 'success');
  };

  const handleAddTableColumn = (qid: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextCols = [...(q.columnas || ['Columna 1'])];
        nextCols.push(`Columna ${nextCols.length + 1}`);
        const nextRows = (q.tableRows || []).map(row => ({
          cells: [...row.cells, { tipo: 'blank' as const, valor: '', correctOptionIdx: 0 }]
        }));
        return {
          ...q,
          columnas: nextCols,
          tableRows: nextRows
        };
      }
      return q;
    }));
  };

  const handleUpdateTableColumn = (qid: string, colIdx: number, val: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid && q.columnas) {
        const nextCols = [...q.columnas];
        nextCols[colIdx] = val;
        return { ...q, columnas: nextCols };
      }
      return q;
    }));
  };

  const handleRemoveTableColumn = (qid: string, colIdx: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid && q.columnas && q.tableRows) {
        if (q.columnas.length <= 1) {
          toast('La tabla debe tener al menos una columna', 'warning');
          return q;
        }
        const nextCols = q.columnas.filter((_, idx) => idx !== colIdx);
        const nextRows = q.tableRows.map(row => ({
          cells: row.cells.filter((_, idx) => idx !== colIdx)
        }));
        return { ...q, columnas: nextCols, tableRows: nextRows };
      }
      return q;
    }));
  };

  const handleAddTableRow = (qid: string) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const colsCount = q.columnas ? q.columnas.length : 1;
        const newCells = Array.from({ length: colsCount }, () => ({
          tipo: 'blank' as const,
          valor: '',
          correctOptionIdx: 0
        }));
        const nextRows = [...(q.tableRows || [])];
        nextRows.push({ cells: newCells });
        return { ...q, tableRows: nextRows };
      }
      return q;
    }));
  };

  const handleUpdateTableCell = (qid: string, rIdx: number, cIdx: number, fields: any) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid && q.tableRows) {
        const nextRows = q.tableRows.map((row, rowIdx) => {
          if (rowIdx === rIdx) {
            const nextCells = row.cells.map((cell, colIdx) => {
              if (colIdx === cIdx) {
                return { ...cell, ...fields };
              }
              return cell;
            });
            return { cells: nextCells };
          }
          return row;
        });
        return { ...q, tableRows: nextRows };
      }
      return q;
    }));
  };

  const handleRemoveTableRow = (qid: string, rIdx: number) => {
    setQuestions(prev => prev.map(q => {
      if (q.id === qid && q.tableRows) {
        if (q.tableRows.length <= 1) {
          toast('La tabla debe tener al menos una fila', 'warning');
          return q;
        }
        const nextRows = q.tableRows.filter((_, idx) => idx !== rIdx);
        return { ...q, tableRows: nextRows };
      }
      return q;
    }));
  };

  const applyAccountingActivosPreset = (qid: string) => {
    notifyUserEdit();
    const opts = [
      'Disponible',
      'Inversiones',
      'Cuentas por cobrar a corto plazo',
      'Inventario',
      'Propiedades, planta y equipo',
      'Intangibles',
      'Valorización',
      'Cuentas por cobrar a largo plazo'
    ];
    setQuestions(prev => prev.map(item => {
      if (item.id === qid) {
        return {
          ...item,
          texto: 'Organice los siguientes grupos de ACTIVOS en las clasificaciones de corrientes y no corrientes:\n\nACTIVOS: Disponible – Inversiones – Cuentas por cobrar a corto plazo – Propiedades, planta y equipo – Intangibles – Valorización – Inventario – Cuentas por cobrar a largo plazo.',
          opciones: opts,
          opcionIds: opts.map((_, i) => `opt_${item.id}_${i}_${uid()}`),
          columnas: ['CORRIENTES', 'NO CORRIENTES'],
          tableRows: [
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 0 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 4 }
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 1 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 5 }
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 2 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 6 }
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 3 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 7 }
              ]
            }
          ]
        };
      }
      return item;
    }));
    toast('¡Plantilla de Activos (Corrientes vs No Corrientes) cargada!', 'success');
  };

  const applyAccountingPasivosPreset = (qid: string) => {
    notifyUserEdit();
    const opts = [
      'Obligaciones financieras',
      'Proveedores',
      'Cuentas por pagar',
      'Impuestos gravámenes y tasas',
      'Obligaciones laborales',
      'Capital social',
      'Reservas',
      'Resultado del ejercicio'
    ];
    setQuestions(prev => prev.map(item => {
      if (item.id === qid) {
        return {
          ...item,
          texto: 'Organice los siguientes grupos de PASIVOS en las clasificaciones de corrientes y no corrientes:\n\nPASIVOS: Obligaciones financieras – Capital social – Cuentas por pagar – Reservas – Proveedores – Resultado del ejercicio – Obligaciones laborales – Impuestos gravámenes y tasas.',
          opciones: opts,
          opcionIds: opts.map((_, i) => `opt_${item.id}_${i}_${uid()}`),
          columnas: ['CORRIENTES', 'NO CORRIENTES / PATRIMONIO'],
          tableRows: [
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 0 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 5 }
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 1 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 6 }
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 2 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 7 }
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 3 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 4 }
              ]
            }
          ]
        };
      }
      return item;
    }));
    toast('¡Plantilla de Pasivos (Corrientes vs No Corrientes) cargada!', 'success');
  };

  const applyAccountingCombinedPreset = (qid: string) => {
    notifyUserEdit();
    const opts = [
      'Disponible',
      'Inversiones',
      'Cuentas por cobrar a corto plazo',
      'Inventario',
      'Propiedades, planta y equipo',
      'Intangibles',
      'Valorización',
      'Cuentas por cobrar a largo plazo',
      'Obligaciones financieras',
      'Proveedores',
      'Cuentas por pagar',
      'Impuestos gravámenes y tasas',
      'Obligaciones laborales',
      'Capital social',
      'Reservas',
      'Resultado del ejercicio'
    ];
    setQuestions(prev => prev.map(item => {
      if (item.id === qid) {
        return {
          ...item,
          texto: 'Organice los grupos de ACTIVOS y PASIVOS en sus respectivas clasificaciones de corrientes y no corrientes utilizando el banco de palabras:',
          opciones: opts,
          opcionIds: opts.map((_, i) => `opt_${item.id}_${i}_${uid()}`),
          columnas: ['ACTIVOS CORRIENTES', 'ACTIVOS NO CORRIENTES', 'PASIVOS CORRIENTES', 'PASIVOS NO CORRIENTES / PATRIMONIO'],
          tableRows: [
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 0 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 4 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 8 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 12 },
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 1 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 5 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 9 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 13 },
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 2 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 6 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 10 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 14 },
              ]
            },
            {
              cells: [
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 3 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 7 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 11 },
                { tipo: 'blank' as const, valor: '', correctOptionIdx: 15 },
              ]
            }
          ]
        };
      }
      return item;
    }));
    toast('¡Plantilla integral de Activos y Pasivos (4 columnas) cargada!', 'success');
  };

  const generateTwoColumnClassification = (
    qid: string,
    titleText: string,
    c1Name: string,
    c1Raw: string,
    c2Name: string,
    c2Raw: string
  ) => {
    notifyUserEdit();
    const parseItems = (raw: string) => 
      raw
        .split(/[\n,–-]+/)
        .map(s => s.trim())
        .filter(s => s.length > 0);

    const items1 = parseItems(c1Raw);
    const items2 = parseItems(c2Raw);

    if (items1.length === 0 || items2.length === 0) {
      toast('Debes ingresar al menos 1 elemento para cada columna', 'warning');
      return;
    }

    const combinedOpts = [...items1, ...items2];
    const maxRows = Math.max(items1.length, items2.length);

    const rows = [];
    for (let r = 0; r < maxRows; r++) {
      const cells = [];
      if (r < items1.length) {
        cells.push({ tipo: 'blank' as const, valor: '', correctOptionIdx: r });
      } else {
        cells.push({ tipo: 'texto' as const, valor: '—', correctOptionIdx: undefined });
      }

      if (r < items2.length) {
        cells.push({ tipo: 'blank' as const, valor: '', correctOptionIdx: items1.length + r });
      } else {
        cells.push({ tipo: 'texto' as const, valor: '—', correctOptionIdx: undefined });
      }

      rows.push({ cells });
    }

    setQuestions(prev => prev.map(item => {
      if (item.id === qid) {
        return {
          ...item,
          texto: titleText.trim() || item.texto,
          opciones: combinedOpts,
          opcionIds: combinedOpts.map((_, i) => `opt_${item.id}_${i}_${uid()}`),
          columnas: [c1Name.trim() || 'Columna 1', c2Name.trim() || 'Columna 2'],
          tableRows: rows
        };
      }
      return item;
    }));

    setTableWizardQId(null);
    toast(`¡Tabla de clasificación creada (${combinedOpts.length} palabras, ${rows.length} filas)!`, 'success');
  };

  const notifyUserEdit = () => {
    isDirtyRef.current = true;
  };

  const handleAddEnunciado = (qid: string) => {
    notifyUserEdit();
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextEnun = Array.isArray(q.enunciados) ? [...q.enunciados] : [];
        const currentEnunIds = Array.isArray(q.enunciadoIds)
          ? [...q.enunciadoIds]
          : nextEnun.map((_, i) => `enun_${q.id}_${i}_${uid()}`);
        const nextMatches = Array.isArray(q.matchCorrectos) ? [...q.matchCorrectos] : [];
        return {
          ...q,
          enunciados: [...nextEnun, `Enunciado ${nextEnun.length + 1}`],
          enunciadoIds: [...currentEnunIds, `enun_${q.id}_${nextEnun.length}_${uid()}`],
          matchCorrectos: [...nextMatches, 0],
        };
      }
      return q;
    }));
  };

  const handleUpdateEnunciadoText = (qid: string, eIdx: number, val: string) => {
    notifyUserEdit();
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const nextEnun = [...(q.enunciados || [])];
        nextEnun[eIdx] = val;
        return { ...q, enunciados: nextEnun };
      }
      return q;
    }));
  };

  const handleUpdateEnunciadoCorrectValue = (qid: string, eIdx: number, termIdx: number) => {
    notifyUserEdit();
    const validIdx = typeof termIdx === 'number' && !isNaN(termIdx) && termIdx >= 0 ? termIdx : 0;
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const count = (q.enunciados || []).length;
        const currentMatches = Array.isArray(q.matchCorrectos) ? [...q.matchCorrectos] : Array(count).fill(0);
        while (currentMatches.length < count) {
          currentMatches.push(0);
        }
        currentMatches[eIdx] = validIdx;
        return { ...q, matchCorrectos: currentMatches };
      }
      return q;
    }));
  };

  const handleRemoveEnunciado = (qid: string, eIdx: number) => {
    notifyUserEdit();
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        const currentEnuns = Array.isArray(q.enunciados) ? q.enunciados : [];
        if (currentEnuns.length <= 1) {
          toast('Mínimo debes registrar 1 enunciado para relacionar', 'warning');
          return q;
        }
        const nextEnun = currentEnuns.filter((_, i) => i !== eIdx);
        const nextEnunIds = Array.isArray(q.enunciadoIds) ? q.enunciadoIds.filter((_, i) => i !== eIdx) : undefined;
        const currentMatches = Array.isArray(q.matchCorrectos) 
          ? q.matchCorrectos 
          : currentEnuns.map(() => 0);
        const nextMatches = currentMatches.filter((_, i) => i !== eIdx);
        return { ...q, enunciados: nextEnun, enunciadoIds: nextEnunIds, matchCorrectos: nextMatches };
      }
      return q;
    }));
  };

  const handleUpdateOptionText = (qid: string, oIdx: number, val: string) => {
    notifyUserEdit();
    setQuestions(prev => {
      const next = prev.map(q => {
        if (q.id === qid) {
          const nextOpts = [...(q.opciones || [])];
          nextOpts[oIdx] = val;
          const nextOptIds = Array.isArray(q.opcionIds) && q.opcionIds.length === nextOpts.length
            ? [...q.opcionIds]
            : nextOpts.map((_, i) => q.opcionIds?.[i] || `opt_${q.id}_${i}_${uid()}`);
          return { ...q, opciones: nextOpts, opcionIds: nextOptIds };
        }
        return q;
      });
      latestDataRef.current = { ...latestDataRef.current, questions: next };
      return next;
    });
  };

  const handleToggleCorrect = (qid: string, oIdx: number) => {
    notifyUserEdit();
    setQuestions(prev => {
      const next = prev.map(q => {
        if (q.id === qid) {
          let nextCorrect: number[] = [];
          if (q.tipo === 'multiple' || (q.tipo as string) === 'opcion_multiple' || q.tipo === 'dropdown' || q.tipo === 'tf') {
            nextCorrect = [oIdx];
          } else {
            // Checkbox allowing multiple correct selectors
            if (q.correctas.includes(oIdx)) {
              nextCorrect = q.correctas.filter(c => c !== oIdx);
            } else {
              const maxAllowed = q.maxRespuestas && q.maxRespuestas > 0 ? q.maxRespuestas : 99;
              if (q.correctas.length >= maxAllowed) {
                toast(`Solo puedes marcar hasta ${maxAllowed} respuesta${maxAllowed > 1 ? 's' : ''} correcta${maxAllowed > 1 ? 's' : ''}`, 'warning');
                return q;
              }
              nextCorrect = [...q.correctas, oIdx];
            }
          }
          return { ...q, correctas: nextCorrect };
        }
        return q;
      });
      latestDataRef.current = { ...latestDataRef.current, questions: next };
      return next;
    });
  };

  const handleUpdateMaxRespuestas = (qid: string, maxVal?: number) => {
    notifyUserEdit();
    setQuestions(prev => {
      const next = prev.map(q => {
        if (q.id === qid) {
          let nextCorrect = q.correctas || [];
          if (maxVal && maxVal > 0 && nextCorrect.length > maxVal) {
            nextCorrect = nextCorrect.slice(0, maxVal);
          }
          return { ...q, maxRespuestas: maxVal, correctas: nextCorrect };
        }
        return q;
      });
      latestDataRef.current = { ...latestDataRef.current, questions: next };
      return next;
    });
  };

  const getNextOptionLabel = (count: number) => {
    if (count < 26) {
      return `Opción ${String.fromCharCode(65 + count)}`;
    }
    const firstChar = String.fromCharCode(65 + Math.floor(count / 26) - 1);
    const secondChar = String.fromCharCode(65 + (count % 26));
    return `Opción ${firstChar}${secondChar}`;
  };

  const handleAddOption = (qid: string) => {
    notifyUserEdit();
    setQuestions(prev => {
      const next = prev.map(q => {
        if (q.id === qid) {
          const currentOpts = Array.isArray(q.opciones) ? [...q.opciones] : [];
          const currentOptIds = currentOpts.map((_, i) => q.opcionIds?.[i] || `opt_${q.id}_${i}_${uid()}`);
          const newLabel = q.tipo === 'matching' || q.tipo === 'table'
            ? `Término ${currentOpts.length + 1}`
            : getNextOptionLabel(currentOpts.length);
          const newOptId = `opt_${q.id}_${currentOpts.length}_${uid()}`;
          return {
            ...q,
            opciones: [...currentOpts, newLabel],
            opcionIds: [...currentOptIds, newOptId],
          };
        }
        return q;
      });
      latestDataRef.current = { ...latestDataRef.current, questions: next };
      return next;
    });
  };

  const handleRemoveOption = (qid: string, oIdx: number) => {
    notifyUserEdit();
    setQuestions(prev => prev.map(q => {
      if (q.id === qid) {
        if (q.opciones.length <= 2 && q.tipo !== 'matching' && q.tipo !== 'table') {
          toast('Mínimo debes registrar 2 opciones de respuesta', 'warning');
          return q;
        }
        if ((q.tipo === 'matching' || q.tipo === 'table') && q.opciones.length <= 1) {
          toast('Mínimo debes registrar 1 palabra en la caja de vocabulario', 'warning');
          return q;
        }
        const nextOpts = q.opciones.filter((_, i) => i !== oIdx);
        const nextOptIds = Array.isArray(q.opcionIds) ? q.opcionIds.filter((_, i) => i !== oIdx) : undefined;
        const maxValidIdx = Math.max(0, nextOpts.length - 1);

        // adjust correct list
        const nextCorrect = (q.correctas || [])
          .filter(c => c !== oIdx)
          .map(c => c > oIdx ? c - 1 : c)
          .map(c => Math.min(Math.max(0, c), maxValidIdx));

        // For matching, safely adjust matchCorrectos indices
        let nextMatches = q.matchCorrectos;
        if (q.tipo === 'matching') {
          const currentMatches = Array.isArray(q.matchCorrectos) 
            ? q.matchCorrectos 
            : (q.enunciados || []).map(() => 0);
          nextMatches = currentMatches.map(matchIdx => {
            if (matchIdx === oIdx) return 0;
            if (matchIdx > oIdx) return Math.min(Math.max(0, matchIdx - 1), maxValidIdx);
            return Math.min(Math.max(0, matchIdx), maxValidIdx);
          });
        }

        // For table, safely adjust correctOptionIdx in tableRows
        let nextRows = q.tableRows;
        if (q.tipo === 'table' && Array.isArray(q.tableRows)) {
          nextRows = q.tableRows.map(row => ({
            ...row,
            cells: (row.cells || []).map(cell => {
              if (cell.tipo === 'blank') {
                const cIdx = cell.correctOptionIdx ?? 0;
                let nextC = cIdx;
                if (cIdx === oIdx) nextC = 0;
                else if (cIdx > oIdx) nextC = nextC - 1;
                return { ...cell, correctOptionIdx: Math.min(Math.max(0, nextC), maxValidIdx) };
              }
              return cell;
            })
          }));
        }

        return { 
          ...q, 
          opciones: nextOpts, 
          opcionIds: nextOptIds,
          correctas: nextCorrect, 
          matchCorrectos: nextMatches,
          tableRows: nextRows 
        };
      }
      return q;
    }));
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const handleMoveQuestion = (index: number, dir: -1 | 1) => {
    setQuestions(prev => {
      const targetIdx = index + dir;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const nextQList = [...prev];
      const triggerQ = nextQList[index];
      nextQList[index] = nextQList[targetIdx];
      nextQList[targetIdx] = triggerQ;
      return nextQList;
    });
  };

  const handleSave = async (estado: 'borrador' | 'activo') => {
    setSaveStatus('saving');
    await saveCurrentExamImmediate(estado);
    setSaveStatus('saved');
    toast(
      estado === 'activo' 
        ? 'Examen publicado exitosamente ✓. Puedes continuar editando o volver cuando lo desees.' 
        : 'Progreso guardado exitosamente en la nube ✓', 
      'success'
    );
  };

  const handleBack = async () => {
    if (isDirtyRef.current) {
      setSaveStatus('saving');
      await saveCurrentExamImmediate();
    }
    onBack();
  };

  return (
    <div className="page-builder animate-fade-in pb-12">
      {/* Editor top action bar */}
      <div className="page-header flex items-center justify-between gap-3 mb-6 border-b border-slate-200 pb-3">
        <button 
          onClick={handleBack}
          className="btn btn-secondary flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-250 bg-white hover:bg-slate-50 text-slate-800 font-bold text-xs cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-4 h-4 text-teal-600" />
          <span>Volver a Docente</span>
        </button>
        <div className="flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-[11px] text-amber-600 bg-amber-50/85 border border-amber-200 px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 animate-pulse select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              <span>Guardando cambio...</span>
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[11px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-lg font-semibold flex items-center gap-1.5 select-none">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              <span>✓ Auto-guardado</span>
            </span>
          )}
          <button 
            onClick={() => handleSave('borrador')}
            className="btn btn-secondary px-4 py-1.5 rounded-lg text-indigo-700 bg-indigo-50/80 border border-indigo-200 hover:bg-indigo-100 transition cursor-pointer text-xs font-bold flex items-center gap-1"
            title="Guardar todos los cambios en Firebase"
          >
            💾 Guardar cambios
          </button>
          <button 
            onClick={() => handleSave('activo')}
            className="btn btn-primary px-4 py-1.5 rounded-lg text-white font-bold hover:opacity-90 transition cursor-pointer text-xs"
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
          <div className="rounded-2xl border border-slate-200 overflow-hidden shadow-sm bg-white theme-bg-surface">
            {/* Visual Cover Banner mimicking Google Forms */}
            <div className="relative w-full h-44 group bg-slate-100 border-b border-slate-200 overflow-hidden">
              <img
                src={bannerUrl}
                alt="Cabecera del Examen"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent flex items-end p-4">
                <div className="text-white text-left">
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-indigo-600 px-2 py-0.5 rounded shadow-sm">Boceto de Cabecera</span>
                  <h4 className="text-xs font-bold mt-1 text-slate-100 opacity-90">Personalizar diseño del formulario</h4>
                </div>
              </div>
            </div>

            {/* Banner selector row */}
            <div className="bg-slate-50/50 p-4 border-b border-slate-100 flex flex-col gap-3.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10.5px] font-extrabold text-slate-700 block tracking-wider uppercase font-mono">🎨 Imagen de Cabecera (Estilo Google Forms)</span>
                  <p className="text-[10.5px] text-slate-500 font-medium">Predeterminada o personalizada. Elige de la galería o ingresa un enlace.</p>
                </div>
                {/* Custom URL input */}
                <div className="flex items-center gap-1.5 self-start sm:self-center">
                  <input
                    type="text"
                    value={bannerUrl}
                    onChange={e => setBannerUrl(e.target.value)}
                    placeholder="Pega un enlace de imagen personalizado..."
                    className="p-1 px-2.5 border border-slate-200 rounded-lg text-xs bg-white outline-none w-52 focus:border-indigo-500 font-medium text-slate-600"
                    title="URL de cabecera personalizada"
                  />
                </div>
              </div>

              {/* Grid of presets */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PRESET_BANNERS.map((preset) => {
                  const isSelected = bannerUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      onClick={() => setBannerUrl(preset.url)}
                      className={`relative rounded-xl overflow-hidden h-12 border-2 text-left group transition-all cursor-pointer ${
                        isSelected ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title={preset.name}
                    >
                      <img
                        src={preset.url}
                        alt={preset.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-slate-900/40 flex items-center justify-center p-1">
                        <span className="text-[9px] font-extrabold text-white leading-tight text-center truncate w-full drop-shadow-md">
                          {preset.name}
                        </span>
                      </div>
                      {isSelected && (
                        <div className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full p-0.5 shadow-sm">
                          <Check className="w-2.5 h-2.5 font-bold" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-6 text-center border-b border-slate-100 flex flex-col items-center">
              {/* Badge */}
              <div className="mb-2.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-indigo-50 text-indigo-700 select-none">
                ⚙ CONFIGURACIÓN DE CABECERA (VISTA REALISTA)
              </div>
              
              {/* Main Title text area centered */}
              <AutoExpandingTextarea 
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="INSTITUTO BÍBLICO PATRICIO SYMES - MATERIA..."
                rows={1}
                className="w-full text-center text-md md:text-lg font-bold text-slate-800 bg-transparent border border-dashed border-slate-200 rounded-lg py-3 px-3 outline-none placeholder-slate-400 focus:border-indigo-500 tracking-wide leading-normal"
                style={{ lineHeight: '1.5' }}
              />
              <p className="text-[10px] text-slate-400 mt-1.5 select-none">
                💡 Consejo: Usa un guion para separar, o presiona Enter para forzar líneas separadas como en el documento real.
              </p>

              {/* Subtitle / Bible Verse */}
              <div className="w-full mt-4 flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-500 mb-1">Subtítulo / Mensaje / Cita Bíblica</span>
                <AutoExpandingTextarea 
                  value={subtitulo}
                  onChange={e => setSubtitulo(e.target.value)}
                  placeholder='Ej: "Toda la Escritura está inspirada por Dios y es provechosa para enseñar..." 2 Tim 3:16'
                  rows={1}
                  className="w-full max-w-xl text-center text-xs text-slate-600 bg-amber-50/20 border border-slate-200 focus:border-indigo-500 rounded-lg p-2 outline-none placeholder-slate-400/60 italic"
                />
              </div>

              {/* General Description / Instructions */}
              <div className="w-full mt-4 flex flex-col items-center">
                <span className="text-xs font-semibold text-slate-500 mb-1">Instrucciones Generales</span>
                <AutoExpandingTextarea 
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Instrucciones o descripción opcional para el estudiante..."
                  rows={1}
                  className="w-full max-w-xl text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-lg p-2 outline-none placeholder-slate-300"
                />
              </div>
            </div>
            
            {/* Inline controls */}
            <div className="bg-white p-5 border-t border-slate-100 theme-bg-surface theme-border">
              <div className="grid grid-cols-12 gap-4">
                <div className="col-span-12 md:col-span-6">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Materia</label>
                  <input 
                    type="text" 
                    value={materia} 
                    onChange={e => setMateria(e.target.value)}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                    placeholder="Nombre completo de la asignatura/materia"
                  />
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Tiempo límite</label>
                  <select 
                    value={tiempo} 
                    onChange={e => setTiempo(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value={0}>Sin límite</option>
                    <option value={15}>15 mins</option>
                    <option value={30}>30 mins</option>
                    <option value={45}>45 mins</option>
                    <option value={60}>60 mins</option>
                    <option value={90}>90 mins</option>
                    <option value={120}>2 horas</option>
                  </select>
                </div>
                <div className="col-span-6 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Intentos</label>
                  <select 
                    value={intentos} 
                    onChange={e => setIntentos(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-lg text-sm bg-white"
                  >
                    <option value={1}>1 Intento</option>
                    <option value={2}>2 Intentos</option>
                    <option value={0}>Ilimitados</option>
                  </select>
                </div>
                <div className="col-span-12 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-600 block mb-1">Nota aprobatoria</label>
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
                const isMatching = q.tipo === 'matching';
                const isTable = q.tipo === 'table';
                const isIncisos = q.tipo === 'incisos';
                const isDropdown = q.tipo === 'dropdown';
                const showOpts = q.tipo === 'multiple' || (q.tipo as string) === 'opcion_multiple' || q.tipo === 'checkbox' || q.tipo === 'dropdown' || q.tipo === 'tf';

                return (
                  <div 
                    key={q.id} 
                    className="question-card bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 transition shadow-sm relative theme-bg-surface theme-border"
                  >
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                        Pregunta {qIndex + 1}
                      </div>
                      <span className="text-[10.5px] font-extrabold px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        {q.tipo === 'multiple' && '🔘 Opción única'}
                        {q.tipo === 'checkbox' && '☑️ Casillas de verificación'}
                        {q.tipo === 'dropdown' && '🔽 Menú Desplegable'}
                        {q.tipo === 'tf' && '⚖️ Verdadero / Falso'}
                        {q.tipo === 'abierta' && '✍️ Respuesta libre'}
                        {q.tipo === 'incisos' && '📝 Incisos (a, b, c...)'}
                        {q.tipo === 'matching' && '🔗 Pareo con Caja'}
                        {q.tipo === 'table' && '📊 Tabla con Caja'}
                        {q.tipo === 'escala' && '⭐ Escala 1 a 5'}
                      </span>
                    </div>

                    <AutoExpandingTextarea 
                      value={q.texto || (q as any).enunciado || ''}
                      onChange={e => handleUpdateQText(q.id, e.target.value)}
                      placeholder="Escribe el enunciado de la pregunta aquí..."
                      className="w-full text-xs sm:text-[14px] leading-relaxed font-semibold text-slate-900 dark:text-white border-b border-slate-300 dark:border-slate-700 py-1.5 focus:border-indigo-500 outline-none placeholder-slate-400 dark:placeholder-slate-400 mb-3 bg-transparent whitespace-pre-wrap font-sans block"
                      rows={1}
                    />

                    {/* Options list if visible for type */}
                    {showOpts && (
                      <div className="flex flex-col gap-2 mb-4">
                        {isTF ? (
                          <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-205 dark:border-slate-700 theme-bg-surface">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-3">
                              ¿Cuál es la respuesta correcta predeterminada para esta afirmación?
                            </span>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => handleToggleCorrect(q.id, 0)}
                                className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                  q.correctas.includes(0)
                                    ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center ${q.correctas.includes(0) ? 'border-emerald-600' : 'border-slate-300'}`}>
                                  {q.correctas.includes(0) && <div className="w-2.5 h-2.5 rounded-full bg-emerald-600" />}
                                </div>
                                <span>Verdadero</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleCorrect(q.id, 1)}
                                className={`flex-1 py-3 px-4 rounded-xl font-extrabold text-sm border-2 transition-all flex items-center justify-center gap-2 cursor-pointer ${
                                  q.correctas.includes(1)
                                    ? 'bg-rose-50 border-rose-500 text-rose-700 shadow-sm'
                                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                                }`}
                              >
                                <div className={`w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center ${q.correctas.includes(1) ? 'border-rose-600' : 'border-slate-300'}`}>
                                  {q.correctas.includes(1) && <div className="w-2.5 h-2.5 rounded-full bg-rose-600" />}
                                </div>
                                <span>Falso</span>
                              </button>
                            </div>
                            {q.correctas.length === 0 && (
                              <p className="text-[11px] text-amber-600 font-semibold mt-2.5 flex items-center gap-1 bg-amber-50 p-2 rounded-lg border border-amber-200">
                                ⚠️ Selecciona una de estas dos opciones para configurar la clave de autocalificación de esta pregunta.
                              </p>
                            )}
                          </div>
                        ) : (
                          q.opciones.map((opt, oIdx) => {
                            const isCorrect = q.correctas.includes(oIdx) || (q as any).correcta === oIdx;
                            const optKey = q.opcionIds?.[oIdx] || `${q.id}-opt-${oIdx}`;
                            return (
                              <div key={optKey} className="flex items-start gap-2.5 py-1">
                                {isCheck ? (
                                  <div className="w-[18px] h-[18px] border-2 border-slate-300 rounded shrink-0 bg-slate-50 mt-1" />
                                ) : isDropdown ? (
                                  <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded border border-slate-300 dark:border-slate-600 shrink-0 mt-1">
                                    🔽 {oIdx + 1}
                                  </span>
                                ) : (
                                  <div className="w-[18px] h-[18px] border-2 border-slate-300 rounded-full shrink-0 bg-slate-50 mt-1" />
                                )}
                                <AutoExpandingTextarea 
                                  value={opt}
                                  onChange={e => handleUpdateOptionText(q.id, oIdx, e.target.value)}
                                  placeholder={`Opción ${oIdx + 1}`}
                                  className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-700 text-[12px] sm:text-[13px] py-1 font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:border-indigo-400 outline-none whitespace-pre-wrap font-sans block"
                                  rows={1}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.stopPropagation();
                                    }
                                  }}
                                />
                                <button 
                                  type="button" 
                                  onClick={() => handleToggleCorrect(q.id, oIdx)}
                                  className={`text-xs w-6 h-6 rounded flex items-center justify-center font-bold border transition shrink-0 mt-0.5 ${
                                    isCorrect 
                                      ? 'bg-emerald-50 border-emerald-300 text-emerald-600' 
                                      : 'text-slate-300 border-slate-200 bg-white hover:text-slate-500 hover:border-slate-300'
                                  }`}
                                  title="Marcar como alternativa correcta"
                                >
                                  {isCorrect ? <Check className="w-3.5 h-3.5" /> : '✓'}
                                </button>
                                <button 
                                  type="button" 
                                  onClick={() => handleRemoveOption(q.id, oIdx)}
                                  className="text-slate-300 hover:text-red-500 p-1.5 border border-transparent hover:border-slate-100 rounded transition shrink-0 mt-0.5"
                                  title="Eliminar opción"
                                >
                                  ✕
                                </button>
                              </div>
                            );
                          })
                        )}
                        {!isTF && (
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-1 border-t border-dashed border-slate-150">
                            <button 
                              type="button" 
                              onClick={() => handleAddOption(q.id)}
                              className="text-indigo-600 hover:text-indigo-800 text-xs font-bold text-left flex items-center gap-1 cursor-pointer"
                            >
                              + Agregar opción de respuesta
                            </button>

                            {isCheck && (
                              <div className="flex items-center gap-2 text-xs bg-indigo-50/60 text-indigo-900 px-2.5 py-1 rounded-lg border border-indigo-100">
                                <span className="font-semibold text-[11px] text-slate-600">Máx. respuestas seleccionables:</span>
                                <select
                                  value={q.maxRespuestas !== undefined ? q.maxRespuestas : 3}
                                  onChange={e => {
                                    const val = e.target.value === 'all' ? undefined : Number(e.target.value);
                                    handleUpdateMaxRespuestas(q.id, val);
                                  }}
                                  className="bg-white border border-indigo-200 rounded px-1.5 py-0.5 font-bold text-xs text-indigo-700 cursor-pointer focus:outline-none"
                                >
                                  <option value={2}>Hasta 2 respuestas</option>
                                  <option value={3}>Hasta 3 respuestas (Predeterminado)</option>
                                  <option value={4}>Hasta 4 respuestas</option>
                                  <option value={5}>Hasta 5 respuestas</option>
                                  <option value="all">Sin límite (Cualquiera)</option>
                                </select>
                                {q.maxRespuestas !== undefined && (
                                  <span className="text-[10px] font-bold text-indigo-600">
                                    ({q.correctas.length}/{q.maxRespuestas} marcadas como correctas)
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Live dropdown preview for teacher */}
                        {isDropdown && (
                          <div className="mt-3 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-left space-y-2">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                                🔽 Menú Desplegable (Vista Previa en vivo):
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                                Haz clic para probar cómo se desplegará para el estudiante
                              </span>
                            </div>
                            <select 
                              className="w-full max-w-sm p-2.5 text-xs font-bold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 cursor-pointer shadow-xs focus:ring-2 focus:ring-slate-400"
                              defaultValue=""
                            >
                              <option value="">-- Seleccionar una opción --</option>
                              {q.opciones.map((opt, idx) => (
                                <option key={idx} value={idx}>
                                  {opt || `(Opción ${idx + 1})`} {q.correctas.includes(idx) ? '✓ [Marcada como Correcta]' : ''}
                                </option>
                              ))}
                            </select>
                            <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                              💡 <strong>Cómo funciona:</strong> Agrega o edita las opciones arriba y marca la alternativa correcta con el botón verde <strong>✓</strong>. Al tomar la prueba, el estudiante desplegará este menú y seleccionará su respuesta.
                            </p>
                          </div>
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

                    {isMatching && (
                      <div className="space-y-4 mb-4">
                        {/* Word bank manager */}
                        <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-left">
                          <label className="text-xs font-semibold text-indigo-800 block mb-1">
                            📦 Caja de Palabras / Banco de Vocabulario (Listado de Palabras)
                          </label>
                          <p className="text-[11px] text-slate-500 mb-3 block">
                            Estas palabras serán mostradas para que el estudiante las relacione frente a cada definición.
                          </p>

                          {/* PRESETS BUTTONS FOR EASY MULTI-TF AND MULTI-ABC */}
                          <div className="flex flex-wrap gap-2 mb-4 bg-white/85 p-2.5 rounded-xl border border-indigo-100 select-none">
                            <span className="text-[10px] font-black text-indigo-800 block w-full mb-1">✨ CONFIGURACIÓN RÁPIDA DE PLANTILLA:</span>
                            <button
                              type="button"
                              onClick={() => {
                                setQuestions(prev => prev.map(item => {
                                  if (item.id === q.id) {
                                    const opts = ['Verdadero', 'Falso'];
                                    return {
                                      ...item,
                                      opciones: opts,
                                      opcionIds: opts.map((_, i) => `opt_${item.id}_${i}_${uid()}`),
                                      matchCorrectos: (item.enunciados || []).map((_, idx) => (item.matchCorrectos ? item.matchCorrectos[idx] ?? 0 : 0))
                                    };
                                  }
                                  return item;
                                }));
                              }}
                              className="text-[10px] uppercase font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded px-2.5 py-1.5 transition cursor-pointer font-sans"
                            >
                              Falso / Verdadero Múltiple
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setQuestions(prev => prev.map(item => {
                                  if (item.id === q.id) {
                                    const opts = ['A', 'B', 'C', 'D'];
                                    return {
                                      ...item,
                                      opciones: opts,
                                      opcionIds: opts.map((_, i) => `opt_${item.id}_${i}_${uid()}`),
                                      matchCorrectos: (item.enunciados || []).map((_, idx) => (item.matchCorrectos ? item.matchCorrectos[idx] ?? 0 : 0))
                                    };
                                  }
                                  return item;
                                }));
                              }}
                              className="text-[10px] uppercase font-bold bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded px-2.5 py-1.5 transition cursor-pointer font-sans"
                            >
                              Opciones A, B, C, D Múltiples
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setQuestions(prev => prev.map(item => {
                                  if (item.id === q.id) {
                                    const opts = [
                                      'Dios eterno.',
                                      'Dios todopoderoso.',
                                      'El Señor de los ejércitos.',
                                      'El Señor tu santificador.',
                                      'Dios Altísimo.',
                                      'Jehová está allí.',
                                      'Jehová mi Sanador.',
                                      'Jehová es mi paz.',
                                      'Señor, amo.',
                                      'Creador.',
                                      'Jehová',
                                      'Jehová mi estandarte.',
                                      'Jehová Justicia nuestra',
                                      'Jehová proveerá.',
                                      'Jehová es mi pastor.'
                                    ];
                                    const enuns = [
                                      'a. Elohim',
                                      'b. Adonai',
                                      'c. Yahveh',
                                      'd. Rafa',
                                      'e. Nisi',
                                      'f. Salom',
                                      'g. Ra`ah',
                                      'h. Tsidkenu',
                                      'i. Jireh',
                                      'j. Sama',
                                      'k. Babbaot',
                                      'l. Macadeshcem',
                                      'm. Shaddai',
                                      'n. Elyon',
                                      'o. Olam'
                                    ];
                                    return {
                                      ...item,
                                      texto: 'Relacione los nombres de Dios con su respectivo significado escribiendo o indicando la opción correcta en cada espacio:',
                                      opciones: opts,
                                      opcionIds: opts.map((_, i) => `opt_${item.id}_${i}_${uid()}`),
                                      enunciados: enuns,
                                      enunciadoIds: enuns.map((_, i) => `enun_${item.id}_${i}_${uid()}`),
                                      matchCorrectos: [9, 8, 10, 6, 11, 7, 14, 12, 13, 5, 2, 3, 1, 4, 0]
                                    };
                                  }
                                  return item;
                                }));
                              }}
                              className="text-[10px] uppercase font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-850 border border-indigo-200 rounded px-2.5 py-1.5 transition cursor-pointer font-sans"
                            >
                              📘 Cargar: Nombres de Dios (screenshot 1)
                            </button>
                          </div>

                          <div className="flex flex-wrap gap-2 mb-3">
                            {q.opciones.map((opt, oIdx) => {
                              const optKey = q.opcionIds?.[oIdx] || `${q.id}-matchopt-${oIdx}`;
                              return (
                                <div key={optKey} className="flex items-center gap-1.5 bg-white border border-indigo-200 rounded-lg pl-2.5 pr-1 py-1 text-sm shadow-sm transition hover:border-indigo-400">
                                  <input
                                    type="text"
                                    value={opt}
                                    onChange={e => handleUpdateOptionText(q.id, oIdx, e.target.value)}
                                    className="bg-transparent text-xs font-semibold text-slate-800 min-w-[5.5rem] max-w-[16rem] focus:outline-none border-none outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(q.id, oIdx)}
                                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 font-bold shrink-0 text-xs px-1.5 py-0.5 rounded cursor-pointer transition"
                                    title="Eliminar palabra"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddOption(q.id)}
                            className="bg-indigo-650 hover:bg-indigo-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer transition shadow-sm border border-transparent"
                            style={{ backgroundColor: 'var(--primary, #673ab7)' }}
                          >
                            + Agregar Palabra a la Caja
                          </button>
                        </div>

                        {/* Enunciados manager */}
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-left">
                          <label className="text-xs font-semibold text-slate-700 block mb-2">
                            📑 Enunciados y Definiciones Correctas
                          </label>
                          <p className="text-[11px] text-slate-400 mb-3 block">
                            Añade tus definiciones. Selecciona la palabra de la caja que le corresponde a cada enunciado.
                          </p>

                          <div className="space-y-2">
                            {(q.enunciados || []).map((enun, eIdx) => {
                              const enunKey = q.enunciadoIds?.[eIdx] || `${q.id}-enun-${eIdx}`;
                              const matchCorrectIdx = Array.isArray(q.matchCorrectos) && q.matchCorrectos[eIdx] !== undefined 
                                ? q.matchCorrectos[eIdx] 
                                : 0;
                              return (
                                <div key={enunKey} className="flex flex-col sm:flex-row sm:items-start gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm transition hover:border-slate-300">
                                  <span className="text-xs font-extrabold text-slate-400 shrink-0 w-6 pt-1.5 select-none">
                                    {eIdx + 1}.
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <AutoExpandingTextarea
                                      value={enun}
                                      onChange={e => handleUpdateEnunciadoText(q.id, eIdx, e.target.value)}
                                      placeholder={`Definición / Enunciado ${eIdx + 1}`}
                                      className="w-full text-xs sm:text-sm bg-transparent border-b border-slate-200 font-medium py-1.5 focus:border-indigo-500 outline-none whitespace-pre-wrap font-sans block leading-relaxed"
                                      rows={1}
                                      minHeight={38}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          e.stopPropagation();
                                        }
                                      }}
                                    />
                                  </div>
                                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                                    <span className="text-xs font-bold text-slate-400 block shrink-0">Respuesta:</span>
                                    <select
                                      value={matchCorrectIdx}
                                      onChange={e => handleUpdateEnunciadoCorrectValue(q.id, eIdx, Number(e.target.value))}
                                      className="text-xs p-1.5 font-bold border rounded-lg bg-slate-50 text-emerald-700 border-emerald-200 cursor-pointer focus:outline-none"
                                    >
                                      {q.opciones.map((opt, oIdx) => (
                                        <option key={oIdx} value={oIdx}>{opt}</option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveEnunciado(q.id, eIdx)}
                                      className="text-slate-400 hover:text-red-600 font-bold p-1.5 hover:bg-red-50 rounded cursor-pointer transition"
                                      title="Eliminar enunciado"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddEnunciado(q.id)}
                            className="text-indigo-600 hover:text-indigo-800 text-xs font-bold text-left self-start mt-3 flex items-center gap-1 cursor-pointer"
                          >
                            + Agregar Enunciado / Definición
                          </button>
                        </div>
                      </div>
                    )}

                    {isTable && (
                      <div className="space-y-4 mb-4">
                        {/* Word bank manager */}
                        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl text-left dark:bg-slate-900/40 dark:border-slate-800">
                          <label className="text-xs font-bold text-slate-800 block mb-1 dark:text-slate-200">
                            📦 Caja de Palabras / Banco de Vocabulario (Listado de Palabras)
                          </label>
                          <p className="text-xs text-slate-500 mb-3 block dark:text-slate-400">
                            Estas palabras serán mostradas en la caja para que el estudiante las elija e introduzca en las celdas vacías de la tabla.
                          </p>

                          {/* PRESETS BUTTONS AND ASSISTANT FOR EASY TABLE SETUP */}
                          <div className="flex flex-wrap gap-2 mb-4 bg-slate-100/90 p-3 rounded-xl border border-slate-200 select-none dark:bg-slate-800/60 dark:border-slate-700 shadow-xs">
                            <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5 pb-1.5 border-b border-slate-200 dark:border-slate-700">
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                                ✨ PLANTILLAS RÁPIDAS Y ASISTENTE GENERADOR:
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setTableWizardQId(tableWizardQId === q.id ? null : q.id);
                                }}
                                className="text-[11px] font-bold bg-slate-700 hover:bg-slate-800 text-white dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1 rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
                              >
                                <span>🪄 {tableWizardQId === q.id ? 'Cerrar Asistente' : 'Asistente Rápido: Crear Tabla en 2 Columnas'}</span>
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => applyAccountingActivosPreset(q.id)}
                              className="text-[10.5px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg px-2.5 py-1.5 transition cursor-pointer font-sans dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-600 flex items-center gap-1 shadow-xs"
                              title="Organice los siguientes grupos de activos: Corrientes vs No Corrientes"
                            >
                              <span>📊</span>
                              <span>Cargar: Activos (Corrientes vs No Corrientes)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => applyAccountingPasivosPreset(q.id)}
                              className="text-[10.5px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg px-2.5 py-1.5 transition cursor-pointer font-sans dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-600 flex items-center gap-1 shadow-xs"
                              title="Organice los siguientes grupos de pasivos: Corrientes vs No Corrientes"
                            >
                              <span>📊</span>
                              <span>Cargar: Pasivos (Corrientes vs No Corrientes)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => applyAccountingCombinedPreset(q.id)}
                              className="text-[10.5px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg px-2.5 py-1.5 transition cursor-pointer font-sans dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-600 flex items-center gap-1 shadow-xs"
                              title="Organice Activos y Pasivos en tabla de 4 columnas"
                            >
                              <span>📑</span>
                              <span>Cargar: Activos y Pasivos (4 Columnas)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setQuestions(prev => prev.map(item => {
                                  if (item.id === q.id) {
                                    const opts = [
                                      'Dios es personal',
                                      'Dios es inmutable',
                                      'Dios es amor',
                                      'Dios es omnipotente',
                                      'Dios es omnipresente',
                                      'Dios es misericordioso.',
                                      'Dios es infinito',
                                      'Dios es omnisciente',
                                      'Dios es santo',
                                      'Dios es espíritu',
                                      'Dios es absoluto e independiente',
                                      'Dios es justo',
                                      'Dios es Fiel',
                                      'Dios es bueno'
                                    ];
                                    return {
                                      ...item,
                                      texto: 'Ubique los Atributos de Dios presentes en la caja de palabras en la columna de la tabla que les corresponde (Naturales o Morales):',
                                      opciones: opts,
                                      opcionIds: opts.map((_, i) => `opt_${item.id}_${i}_${uid()}`),
                                      columnas: ['ATRIBUTOS NATURALES', 'ATRIBUTOS MORALES'],
                                      tableRows: [
                                        {
                                          cells: [
                                            { tipo: 'blank', valor: '', correctOptionIdx: 1 },
                                            { tipo: 'blank', valor: '', correctOptionIdx: 0 }
                                          ]
                                        },
                                        {
                                          cells: [
                                            { tipo: 'blank', valor: '', correctOptionIdx: 4 },
                                            { tipo: 'blank', valor: '', correctOptionIdx: 2 }
                                          ]
                                        },
                                        {
                                          cells: [
                                            { tipo: 'blank', valor: '', correctOptionIdx: 3 },
                                            { tipo: 'blank', valor: '', correctOptionIdx: 5 }
                                          ]
                                        },
                                        {
                                          cells: [
                                            { tipo: 'blank', valor: '', correctOptionIdx: 7 },
                                            { tipo: 'blank', valor: '', correctOptionIdx: 8 }
                                          ]
                                        },
                                        {
                                          cells: [
                                            { tipo: 'blank', valor: '', correctOptionIdx: 6 },
                                            { tipo: 'blank', valor: '', correctOptionIdx: 11 }
                                          ]
                                        },
                                        {
                                          cells: [
                                            { tipo: 'blank', valor: '', correctOptionIdx: 9 },
                                            { tipo: 'blank', valor: '', correctOptionIdx: 12 }
                                          ]
                                        },
                                        {
                                          cells: [
                                            { tipo: 'blank', valor: '', correctOptionIdx: 10 },
                                            { tipo: 'blank', valor: '', correctOptionIdx: 13 }
                                          ]
                                        }
                                      ]
                                    };
                                  }
                                  return item;
                                }));
                                toast('¡Plantilla de Atributos de Dios cargada!', 'success');
                              }}
                              className="text-[10.5px] font-bold bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg px-2.5 py-1.5 transition cursor-pointer font-sans dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 dark:border-slate-600 flex items-center gap-1 shadow-xs"
                            >
                              <span>📘</span>
                              <span>Cargar: Atributos de Dios</span>
                            </button>
                          </div>

                          {/* ASISTENTE INTERACTIVO DE CLASIFICACIÓN EN 2 COLUMNAS (Estilo Gris Neutro) */}
                          {tableWizardQId === q.id && (
                            <div className="mb-4 p-4 bg-slate-100/95 dark:bg-slate-800/90 rounded-2xl border border-slate-300 dark:border-slate-700 shadow-sm text-left animate-fade-in">
                              <div className="flex items-center justify-between mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                                <div className="flex items-center gap-2">
                                  <span className="p-1.5 bg-slate-700 text-white rounded-lg text-xs font-bold">🪄</span>
                                  <div>
                                    <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                                      Generador Rápido de Tabla Clasificatoria en 2 Columnas
                                    </h4>
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                      Escribe o pega los términos de cada categoría. El sistema arma la tabla, la caja de palabras y enlaza las respuestas automáticamente.
                                    </p>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setTableWizardQId(null)}
                                  className="text-slate-400 hover:text-red-500 text-xs font-bold p-1 rounded cursor-pointer"
                                  title="Cerrar asistente"
                                >
                                  ✕
                                </button>
                              </div>

                              <div className="space-y-3">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-700 uppercase block mb-1 dark:text-slate-300">
                                    Enunciado / Pregunta:
                                  </label>
                                  <input 
                                    type="text"
                                    value={wizardTitle}
                                    onChange={e => setWizardTitle(e.target.value)}
                                    placeholder="ej: Organice los siguientes grupos en las clasificaciones de corrientes y no corrientes:"
                                    className="w-full text-xs p-2 rounded-lg border border-slate-300 bg-white font-medium focus:outline-slate-500 dark:bg-slate-900 dark:border-slate-700 dark:text-white"
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {/* Columna 1 */}
                                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-700 space-y-2">
                                    <label className="text-[10px] font-extrabold text-slate-700 uppercase block dark:text-slate-300">
                                      Título Columna 1:
                                    </label>
                                    <input 
                                      type="text"
                                      value={wizardCol1Name}
                                      onChange={e => setWizardCol1Name(e.target.value)}
                                      placeholder="ej: CORRIENTES"
                                      className="w-full text-xs font-bold p-1.5 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:text-white"
                                    />
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block dark:text-slate-400">
                                      Elementos de Columna 1 (separados por coma o Enter):
                                    </label>
                                    <textarea 
                                      rows={4}
                                      value={wizardCol1Items}
                                      onChange={e => setWizardCol1Items(e.target.value)}
                                      placeholder="Disponible, Inversiones, Cuentas por cobrar a corto plazo, Inventario..."
                                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:text-white font-sans"
                                    />
                                  </div>

                                  {/* Columna 2 */}
                                  <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-xs dark:bg-slate-900 dark:border-slate-700 space-y-2">
                                    <label className="text-[10px] font-extrabold text-slate-700 uppercase block dark:text-slate-300">
                                      Título Columna 2:
                                    </label>
                                    <input 
                                      type="text"
                                      value={wizardCol2Name}
                                      onChange={e => setWizardCol2Name(e.target.value)}
                                      placeholder="ej: NO CORRIENTES"
                                      className="w-full text-xs font-bold p-1.5 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:text-white"
                                    />
                                    <label className="text-[10px] font-bold text-slate-600 uppercase block dark:text-slate-400">
                                      Elementos de Columna 2 (separados por coma o Enter):
                                    </label>
                                    <textarea 
                                      rows={4}
                                      value={wizardCol2Items}
                                      onChange={e => setWizardCol2Items(e.target.value)}
                                      placeholder="Propiedades, planta y equipo, Intangibles, Valorización, Cuentas por cobrar a largo plazo..."
                                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:text-white font-sans"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2">
                                  <button
                                    type="button"
                                    onClick={() => setTableWizardQId(null)}
                                    className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700 font-bold cursor-pointer"
                                  >
                                    Cancelar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => generateTwoColumnClassification(q.id, wizardTitle, wizardCol1Name, wizardCol1Items, wizardCol2Name, wizardCol2Items)}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer dark:bg-slate-700 dark:hover:bg-slate-600"
                                  >
                                    <span>🪄 Generar Tabla y Caja de Palabras</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex flex-wrap gap-2 mb-3">
                            {q.opciones.map((opt, oIdx) => {
                              const optKey = q.opcionIds?.[oIdx] || `${q.id}-tblopt-${oIdx}`;
                              return (
                                <div key={optKey} className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs shadow-xs hover:border-slate-400 transition-all">
                                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                    #{oIdx + 1}
                                  </span>
                                  <input
                                    type="text"
                                    value={opt}
                                    placeholder="Término o palabra..."
                                    onChange={e => handleUpdateOptionText(q.id, oIdx, e.target.value)}
                                    className="bg-transparent text-xs font-semibold text-slate-800 dark:text-slate-100 min-w-[130px] sm:min-w-[180px] focus:outline-none border-none outline-none"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveOption(q.id, oIdx)}
                                    className="text-slate-400 hover:text-red-500 font-bold shrink-0 text-xs p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition cursor-pointer"
                                    title="Eliminar palabra"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddOption(q.id)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 cursor-pointer transition shadow-xs"
                          >
                            + Agregar Palabra a la Caja
                          </button>
                        </div>

                        {/* Column and Row Grid Settings */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left shadow-xs">
                          <label className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide block mb-1">
                            📋 Columnas de la Tabla (Encabezados)
                          </label>
                          <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mb-2 block leading-relaxed">
                            Define los títulos de cada columna para organizar la tabla. El estudiante verá estos encabezados al responder.
                          </p>
                          <div className="mb-3.5 p-2.5 bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 text-xs font-medium flex items-center gap-2">
                            <span className="text-base shrink-0">💡</span>
                            <span>
                              <strong>Calificación Automática y Flexible:</strong> No importa en cuál fila coloque el estudiante la palabra. Mientras la ubique en la columna correspondiente (por ejemplo en <em>CORRIENTES</em>), el sistema se la calificará automáticamente como correcta.
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3 mb-2">
                            {(q.columnas || []).map((col, cIdx) => (
                              <div 
                                key={cIdx} 
                                className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 shadow-xs hover:border-slate-400 dark:hover:border-slate-600 transition-all flex-1 min-w-[260px] sm:min-w-[320px] max-w-full"
                              >
                                <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700/80 border border-slate-300 dark:border-slate-600 px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                  C{cIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={col}
                                  placeholder={`Título columna ${cIdx + 1}...`}
                                  onChange={e => handleUpdateTableColumn(q.id, cIdx, e.target.value)}
                                  className="flex-1 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs sm:text-sm font-semibold px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-500 transition placeholder-slate-400"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTableColumn(q.id, cIdx)}
                                  className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 font-bold shrink-0 text-xs p-1.5 rounded-lg transition cursor-pointer"
                                  title="Eliminar columna"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => handleAddTableColumn(q.id)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold px-4 py-2.5 rounded-xl inline-flex items-center gap-1.5 cursor-pointer transition shadow-xs shrink-0 self-center"
                            >
                              + Nueva Columna
                            </button>
                          </div>
                        </div>

                        {/* Filas de la Tabla */}
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 text-left space-y-3">
                          <div className="flex justify-between items-center">
                            <div>
                              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide block">
                                📊 Filas y Configuración de Celdas
                              </label>
                              <span className="text-xs text-slate-600 dark:text-slate-400 block">
                                Escribe textos de referencia fijos o define qué espacios deben ser completados por el estudiante.
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddTableRow(q.id)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 transition shadow-xs cursor-pointer"
                            >
                              + Agregar Fila
                            </button>
                          </div>

                          <div className="grid grid-cols-1 gap-4">
                            {(q.tableRows || []).map((row, rIdx) => (
                              <div key={rIdx} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs relative">
                                <div className="flex justify-between items-center mb-3 pb-2 border-b border-dashed border-slate-200 dark:border-slate-700">
                                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Fila {rIdx + 1}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTableRow(q.id, rIdx)}
                                    className="text-red-500 hover:text-red-700 dark:text-red-400 font-medium text-xs flex items-center gap-1 py-1 px-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition cursor-pointer"
                                  >
                                    ✕ Eliminar Fila
                                  </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                  {row.cells.map((cell, cIdx) => {
                                    const colName = (q.columnas || [])[cIdx] || `Columna ${cIdx + 1}`;
                                    return (
                                      <div key={cIdx} className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                                        <div className="font-bold text-slate-700 dark:text-slate-300 truncate mb-1">
                                          Columna: <span className="text-slate-900 dark:text-slate-100">{colName}</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          <select
                                            value={cell.tipo}
                                            onChange={e => handleUpdateTableCell(q.id, rIdx, cIdx, { tipo: e.target.value })}
                                            className="p-1.5 text-xs font-bold border rounded-lg bg-white text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 cursor-pointer focus:ring-1 focus:ring-slate-400"
                                          >
                                            <option value="texto">Texto Fijo / Etiqueta</option>
                                            <option value="blank">Espacio por Llenar</option>
                                          </select>
                                        </div>

                                        {cell.tipo === 'texto' ? (
                                          <input
                                            type="text"
                                            value={cell.valor}
                                            placeholder="Introduce texto o etiqueta..."
                                            onChange={e => handleUpdateTableCell(q.id, rIdx, cIdx, { valor: e.target.value })}
                                            className="w-full bg-white border border-slate-300 dark:border-slate-700 p-2 rounded-lg text-xs font-medium text-slate-900 dark:text-slate-100 dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:focus:ring-slate-600"
                                          />
                                        ) : (
                                          <div className="space-y-1">
                                            <label className="text-[10px] text-slate-600 dark:text-slate-400 block font-semibold">Respuesta correcta de la caja:</label>
                                            <select
                                              value={cell.correctOptionIdx ?? 0}
                                              onChange={e => handleUpdateTableCell(q.id, rIdx, cIdx, { correctOptionIdx: Number(e.target.value) })}
                                              className="w-full text-xs p-2 font-bold border rounded-lg bg-white text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-200 dark:border-slate-700 cursor-pointer focus:ring-1 focus:ring-slate-400"
                                            >
                                              {q.opciones.map((opt, oIdx) => (
                                                <option key={oIdx} value={oIdx}>{opt}</option>
                                              ))}
                                            </select>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Incisos question type editor */}
                    {isIncisos && (
                      <div className="space-y-3 mb-4 text-left">
                        <div className="bg-slate-50 dark:bg-slate-900/40 p-4.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
                          {/* Header and Mode Selector */}
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <label className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">
                                  📝 Sub-preguntas con Incisos (a, b, c, d...)
                                </label>
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                  {(q.modoIncisos || 'vf') === 'vf' ? '⚖️ Modo V / F' : '✍️ Modo Texto Libre'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                {(q.modoIncisos || 'vf') === 'vf' 
                                  ? 'Cada afirmación tendrá botones limpios de Verdadero (V) y Falso (F). El sistema calificará automáticamente cada acierto.' 
                                  : 'Cada inciso tendrá su propio enunciado y espacio de respuesta abierta para el estudiante (sin necesidad de cajas).'}
                              </p>
                            </div>

                            {/* Clean Mode Switcher */}
                            <div className="flex items-center gap-1.5 p-1 bg-slate-200/80 dark:bg-slate-800/80 rounded-xl shrink-0 self-start md:self-auto border border-slate-300 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => handleToggleModoIncisos(q.id, 'vf')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                  (q.modoIncisos || 'vf') === 'vf'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                              >
                                <span>⚖️</span>
                                <span>Verdadero / Falso (V/F)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleToggleModoIncisos(q.id, 'texto')}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                  q.modoIncisos === 'texto'
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                                }`}
                              >
                                <span>✍️</span>
                                <span>Texto Libre</span>
                              </button>
                            </div>
                          </div>

                          {/* Action presets and buttons */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                            <span className="text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                              Lista de Afirmaciones ({q.incisos?.length || 0}):
                            </span>
                            <div className="flex flex-wrap items-center gap-2">
                              {(q.modoIncisos || 'vf') === 'vf' ? (
                                <button
                                  type="button"
                                  onClick={() => applyIncisosVFPreset(q.id)}
                                  className="text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                                  title="Cargar ejemplo de afirmaciones contables de Verdadero o Falso"
                                >
                                  <span>⚖️</span>
                                  <span>Cargar Ejemplo V / F</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => applyIncisosAccountingPreset(q.id)}
                                  className="text-[11px] font-bold bg-white hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                                  title="Cargar ejemplo de Afirmaciones Contables (NIIF / Estados Financieros)"
                                >
                                  <span>📋</span>
                                  <span>Cargar Ejemplo NIIF</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleAddInciso(q.id)}
                                className="text-[11px] font-bold bg-slate-800 hover:bg-slate-900 text-white dark:bg-slate-700 dark:hover:bg-slate-600 px-3 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer"
                              >
                                <span>+ Agregar Inciso ({String.fromCharCode(97 + (q.incisos?.length || 0))}.)</span>
                              </button>
                            </div>
                          </div>

                          {/* List of Incisos */}
                          <div className="space-y-3 pt-1">
                            {(q.incisos || []).map((inc, iIdx) => {
                              const letter = String.fromCharCode(97 + iIdx); // a, b, c, d, e...
                              const isVF = (q.modoIncisos || 'vf') === 'vf';
                              const currentVF = inc.respuestaVF || 'V';

                              return (
                                <div 
                                  key={iIdx} 
                                  className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs space-y-2 hover:border-slate-300 transition"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-black text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2.5 py-0.5 rounded-md border border-slate-300 dark:border-slate-600 uppercase">
                                        Literal {letter}.
                                      </span>
                                      {isVF && (
                                        <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                                          (Afirmación para calificar V o F)
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInciso(q.id, iIdx)}
                                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-955 p-1 rounded-md text-xs font-bold transition cursor-pointer"
                                      title="Eliminar este inciso"
                                    >
                                      ✕ Eliminar
                                    </button>
                                  </div>

                                  <div>
                                    <AutoExpandingTextarea
                                      value={inc.texto}
                                      onChange={e => handleUpdateIncisoText(q.id, iIdx, e.target.value)}
                                      placeholder={isVF ? `Escribe la afirmación del literal ${letter} para evaluar como Verdadera o Falsa...` : `Enunciado del literal ${letter}...`}
                                      className="w-full text-xs sm:text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 p-2.5 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 leading-relaxed font-sans block"
                                      rows={2}
                                    />
                                  </div>

                                  {/* Clean V/F Pill Selection */}
                                  {isVF ? (
                                    <div className="flex items-center justify-between pt-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                          Respuesta correcta de la afirmación:
                                        </span>
                                        <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700">
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateIncisoVF(q.id, iIdx, 'V')}
                                            className={`px-3 py-1 rounded-md text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                              currentVF === 'V'
                                                ? 'bg-emerald-600 text-white shadow-xs'
                                                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                          >
                                            <span>✓ V</span>
                                            <span className="text-[10px] font-medium opacity-90">(Verdadero)</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleUpdateIncisoVF(q.id, iIdx, 'F')}
                                            className={`px-3 py-1 rounded-md text-xs font-black transition cursor-pointer flex items-center gap-1 ${
                                              currentVF === 'F'
                                                ? 'bg-rose-600 text-white shadow-xs'
                                                : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                                            }`}
                                          >
                                            <span>✕ F</span>
                                            <span className="text-[10px] font-medium opacity-90">(Falso)</span>
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                                        Respuesta esperada o clave de referencia (Opcional, para guía del docente):
                                      </label>
                                      <input
                                        type="text"
                                        value={inc.respuestaEsperada || ''}
                                        onChange={e => handleUpdateIncisoExpected(q.id, iIdx, e.target.value)}
                                        placeholder="ej: Estado de situación financiera y Estado de resultados integrales..."
                                        className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 px-2.5 py-1.5 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400 font-sans"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>

                          <div className="mt-3 pt-2">
                            <button
                              type="button"
                              onClick={() => handleAddInciso(q.id)}
                              className="text-xs font-bold text-slate-700 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 px-3.5 py-1.5 rounded-lg transition inline-flex items-center gap-1.5 cursor-pointer border border-slate-300 dark:border-slate-700 shadow-xs"
                            >
                              <span>+ Agregar otro literal ({String.fromCharCode(97 + (q.incisos?.length || 0))}.)</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Question Actions footer */}
                    <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100">
                      <select 
                        value={q.tipo}
                        onChange={e => handleChangeQType(q.id, e.target.value as Question['tipo'])}
                        className="text-xs p-1.5 font-bold border rounded-lg bg-slate-50 text-slate-600 cursor-pointer"
                      >
                        <option value="multiple">Opción única (Una sola respuesta)</option>
                        <option value="checkbox">Opción múltiple / Casillas (Múltiples respuestas: hasta 3)</option>
                        <option value="dropdown">Menú desplegable</option>
                        <option value="tf">Verdadero/Falso</option>
                        <option value="abierta">Respuesta libre/Texto</option>
                        <option value="incisos">📝 Pregunta con Incisos (a, b, c, d... Texto Libre)</option>
                        <option value="escala">Escala (1 al 5)</option>
                        <option value="matching">Pareo / Relacionar con Caja de Palabras</option>
                        <option value="table">📊 Clasificación en Tabla con Banco de Palabras</option>
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
        <aside className="sticky top-[80px] h-fit md:max-h-[calc(100vh-140px)] flex flex-col z-35 transition-all duration-300">
          {previewCollapsed ? (
            <button
              type="button"
              onClick={() => setPreviewCollapsed(false)}
              className="flex flex-col items-center justify-center gap-3.5 py-7 px-1.5 bg-[#673ab7] hover:bg-[#5e31ac] text-white border border-[#4a2391] rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
              title="Expandir vista previa"
              style={{ minHeight: '280px', width: '54px' }}
            >
              <Eye className="w-5 h-5 text-white group-hover:scale-125 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-widest text-white/95 text-center mt-2.5" style={{ writingMode: 'vertical-lr', textOrientation: 'mixed', letterSpacing: '0.12em' }}>
                MOSTRAR VISTA PREVIA
              </span>
            </button>
          ) : (
            <div className="card bg-white rounded-2xl border border-slate-200 shadow-sm theme-bg-surface theme-border flex flex-col h-full overflow-hidden p-3 md:p-4">
              
              {/* Preview Controls header */}
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 gap-1">
                <span className="font-bold text-xs uppercase tracking-wider text-slate-700">Vista previa</span>
                
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewCollapsed(true)}
                    className="btn border rounded-lg p-1.5 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition"
                    title="Colapsar vista previa"
                  >
                    <EyeOff className="w-4 h-4" />
                  </button>
                  
                  <label className="flex items-center gap-1.5 cursor-pointer text-[10px] sm:text-xs font-bold text-slate-500 select-none">
                    <input 
                      type="checkbox" 
                      checked={previewShowCorrect}
                      onChange={e => setPreviewShowCorrect(e.target.checked)}
                      className="accent-indigo-600"
                    />
                    <span>Ver correctas</span>
                  </label>
                </div>
              </div>

              {/* Actual scrollable mock preview */}
              <div className="flex-1 overflow-y-auto mt-4 px-1 flex flex-col gap-4 text-left max-h-[400px] md:max-h-[600px]">
                <div className="border-b border-slate-100 pb-3 text-center">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    {(() => {
                      const t = title.trim() || 'Cuestionario sin título';
                      let lines = [t];
                      if (t.includes('\n')) {
                        lines = t.split('\n');
                      } else {
                        const separators = [' - ', ' – ', ' — '];
                        for (const sep of separators) {
                          if (t.includes(sep)) {
                            lines = t.split(sep);
                            break;
                          }
                        }
                      }
                      
                      return lines.map((line, idx) => (
                        <div 
                          key={idx} 
                          className={`text-center leading-relaxed tracking-wider text-slate-800 ${
                            idx === 0 
                              ? 'font-bold text-xs text-slate-900' 
                              : 'font-semibold text-[10px] text-slate-500 mt-0.5'
                          }`}
                        >
                          {line.trim()}
                        </div>
                      ));
                    })()}
                  </div>

                  {materia.trim() && (
                    <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-slate-100 text-[8px] uppercase font-bold text-slate-500">
                      {materia}
                    </span>
                  )}

                  {subtitulo.trim() && (
                    <p className="text-[10px] text-slate-600 font-serif italic leading-relaxed mt-2.5 max-w-xs mx-auto border-t border-b border-slate-100 py-1.5 px-2">
                      “{subtitulo}”
                    </p>
                  )}

                  {description.trim() && (
                    <p className="text-[10px] text-slate-400 mt-2 leading-normal">
                      {description}
                    </p>
                  )}
                </div>

                {questions.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-300">Vacío. Diseña preguntas en la izquierda para verlas ilustradas aquí.</div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {questions.map((q, i) => (
                      <div key={q.id} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-xs text-slate-700">
                        <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">P{i+1} · {q.puntos} Pts</div>
                        <p className="font-semibold text-slate-800 mb-2 whitespace-pre-wrap">{q.texto || (q as any).enunciado || 'Pregunta sin texto definitorio'}</p>

                        {(q.tipo === 'multiple' || (q.tipo as string) === 'opcion_multiple' || q.tipo === 'checkbox' || q.tipo === 'dropdown' || q.tipo === 'tf') && (
                          <div className="flex flex-col gap-1.5">
                            {q.opciones.map((opt, oIdx) => {
                              const isSol = q.correctas.includes(oIdx) || (q as any).correcta === oIdx;
                              const typeChar = q.tipo === 'checkbox' ? '☐' : '◯';
                              return (
                                <div key={oIdx} className="flex items-center gap-1.5 p-1.5 bg-white rounded border border-slate-150">
                                  <span className="text-[10px] text-slate-300 font-bold">{typeChar}</span>
                                  <span className="flex-1 font-medium text-[11px] whitespace-pre-wrap">{opt}</span>
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

                        {q.tipo === 'matching' && (
                          <div className="space-y-2 mt-2 text-left">
                            {/* Caja de palabras */}
                            <div className="bg-indigo-55 border border-indigo-110 p-2 rounded text-[10px] text-indigo-700 font-mono leading-normal">
                              <strong>Caja de palabras:</strong> {q.opciones.join(' – ')}
                            </div>
                            {/* Enunciados list with dropdowns */}
                            <div className="space-y-1.5">
                              {(q.enunciados || []).map((enun, eIdx) => {
                                const matchCorrectIdx = q.matchCorrectos ? q.matchCorrectos[eIdx] : 0;
                                return (
                                  <div key={eIdx} className="flex items-center justify-between gap-2 p-1.5 bg-white rounded border border-slate-150 text-[11px] leading-relaxed">
                                    <span className="font-semibold text-slate-400 shrink-0">{eIdx + 1}.</span>
                                    <span className="flex-1 whitespace-pre-wrap">{enun}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded border font-sans select-none">
                                        [Elegir]
                                      </span>
                                      {previewShowCorrect && (
                                        <span className="text-emerald-600 font-bold text-[10px]" title="Respuesta correcta">
                                          ({q.opciones[matchCorrectIdx] || 'n/a'})
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {q.tipo === 'table' && (
                          <div className="space-y-3 mt-2 text-left">
                            {/* Caja de palabras */}
                            <div className="bg-indigo-55 border border-indigo-110 p-2 rounded text-[10px] text-indigo-700 font-mono leading-normal dark:bg-slate-900/40 dark:border-slate-800 dark:text-cyan-400">
                              <strong>Caja de palabras:</strong> {q.opciones.join(' – ')}
                            </div>
                            
                            {/* Table Layout Mockup */}
                            <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                              <table className="w-full text-[10px] md:text-[11px] border-collapse">
                                <thead>
                                  <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
                                    {(q.columnas || []).map((col, colIdx) => (
                                      <th key={colIdx} className="p-1.5 font-bold text-slate-600 dark:text-slate-300 text-left border-r border-slate-150 dark:border-slate-800 last:border-0">
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(q.tableRows || []).map((row, rIdx) => (
                                    <tr key={rIdx} className="border-b border-slate-150 dark:border-slate-800 last:border-0">
                                      {row.cells.map((cell, cIdx) => (
                                        <td key={cIdx} className="p-1.5 text-slate-700 dark:text-slate-305 border-r border-slate-150 dark:border-slate-800 last:border-0 font-medium whitespace-normal">
                                          {cell.tipo === 'texto' ? (
                                            <span>{cell.valor || <span className="text-slate-300 italic">Vacío</span>}</span>
                                          ) : (
                                            <div className="flex flex-col gap-0.5">
                                              <span className="text-slate-450 font-mono text-[9px] bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border dark:border-slate-750 w-fit">
                                                [Elegir]
                                              </span>
                                              {previewShowCorrect && (
                                                <span className="text-emerald-600 dark:text-emerald-405 font-bold text-[9px] mt-0.5">
                                                  ✓ {q.opciones[cell.correctOptionIdx ?? 0]}
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
