/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  BookOpen, CheckSquare, Users, Award, 
  HelpCircle, XCircle, TrendingUp, Sparkles, FileSpreadsheet,
  Compass, Leaf, Star, GraduationCap, CheckCircle,
  Calendar, Layers, Clock, ShieldCheck, DollarSign,
  ChevronDown, ChevronUp, Eye, EyeOff, LayoutGrid,
  School, QrCode, ArrowRight, Activity, Cloud, Settings,
  BarChart3, FileText, CheckCircle2, SlidersHorizontal
} from 'lucide-react';
import { User, Exam, Submission, Subject, Semester } from '../types';
import { avatarColor, avatarLetter, fmtDate, cleanExamTitle, formatGrade5, getStudentAssignedSubjects, resolveStudentSemester } from '../lib/db';

interface DashboardProps {
  currentUser: User;
  users: User[];
  exams: Exam[];
  submissions: Submission[];
  subjects?: Subject[];
  semesters?: Semester[];
  onNavigate: (pageId: string) => void;
  onTakeExam?: (examId: string) => void;
  theme?: string;
}

const natureQuotes = [
  { quote: "Somos polvo de estrellas con la sagrada misión de contemplar y comprender el universo.", author: "Carl Sagan" },
  { quote: "Hay un libro sublime que está siempre abierto para todos los ojos: la gran naturaleza.", author: "Jean-Jacques Rousseau" },
  { quote: "El fluir del agua no tiene prisa; con paciencia infinita sabe bien que llegará al inmenso océano.", author: "Lao Tse" },
  { quote: "En cada suave caminata con la naturaleza silvestre uno recibe mucho más de lo que activamente busca.", author: "John Muir" },
  { quote: "La inteligencia de la galaxia palpita en el reverdecer de cada pequeña hoja de nuestro bosque.", author: "Conexión Vital" },
  { quote: "El universo no está fuera de ti. Mira muy adentro; todo aquello que buscas con anhelo, ya lo eres.", author: "Rumi" },
  { quote: "Estudia la naturaleza profunda, ámala con ternura, quédate cerca de ella. Jamás te decepcionará.", author: "Frank Lloyd Wright" },
  { quote: "Cada respuesta correcta en tu camino es una nueva semilla que florece con luz en tu bosque del intelecto.", author: "Synapsis" },
  { quote: "La noble calma de los árboles nos enseña que para tocar el cielo, debemos estar sanamente enraizados.", author: "Zen" },
  { quote: "Admira la constelación lejana y aprende su lección: iluminar la inmensa noche con humilde silencio activo.", author: "Sabiduría del Cosmos" }
];

export default function Dashboard({ currentUser, users, exams, submissions, subjects = [], semesters = [], onNavigate, onTakeExam, theme }: DashboardProps) {
  const rol = currentUser.rol;
  const allMyUserIds = users 
    ? users.filter(u => u.nombre === currentUser.nombre || u.email.toLowerCase() === currentUser.email.toLowerCase()).map(u => u.id)
    : [currentUser.id];
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * natureQuotes.length));
  const [subsPage, setSubsPage] = useState(1);
  const [examsPage, setExamsPage] = useState(1);

  // Layout & Category States matching image_6cff5dfb.png
  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [showMetrics, setShowMetrics] = useState<boolean>(false);
  const [cardSize, setCardSize] = useState<'mini' | 'mediana'>('mini');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const handleNextQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % natureQuotes.length);
  };

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleAllSections = () => {
    const areSomeCollapsed = Object.values(collapsedSections).some(v => v);
    if (areSomeCollapsed) {
      setCollapsedSections({});
    } else {
      setCollapsedSections({
        academico: true,
        evaluaciones: true,
        estudiantes: true,
        finanzas: true,
        comunidad: true
      });
    }
  };

  // Define unified sorted lists
  let sortedSubs: Submission[] = [];
  let sortedExams: Exam[] = [];

  if (rol === 'admin') {
    sortedSubs = [...(submissions || [])].sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
    sortedExams = [...(exams || [])];
  } else if (rol === 'docente') {
    const userAsignaturas = currentUser.asignaturas || [];
    const docExams = (exams || []).filter(e => {
      if (e.docenteId && allMyUserIds.includes(e.docenteId)) return true;
      if (e.docenteId === currentUser.id) return true;
      const subj = (subjects || []).find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === (e.materia || '').toLowerCase().trim());
      if (subj && (userAsignaturas.includes(subj.id) || (subj.docenteId && allMyUserIds.includes(subj.docenteId)))) return true;
      if (e.materia && userAsignaturas.includes(e.materia)) return true;
      return false;
    });
    const examIds = docExams.map(e => e.id);
    const mySubsList = (submissions || []).filter(s => examIds.includes(s.examenId));
    sortedSubs = [...mySubsList].sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
    sortedExams = docExams;
  } else {
    const studentSubs = (submissions || []).filter(s => s.estudianteId === currentUser?.id);
    sortedSubs = [...studentSubs].sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));
    
    const myAssignedSubjects = getStudentAssignedSubjects(currentUser, subjects, semesters);
    const assignedIds = new Set(myAssignedSubjects.map(s => s.id));
    const assignedNames = new Set(myAssignedSubjects.map(s => (s.nombre || '').toLowerCase().trim()));

    const availableExams = (exams || []).filter(e => {
      if (e.estado !== 'activo') return false;
      if (myAssignedSubjects.length > 0) {
        if (e.materia && assignedIds.has(e.materia)) return true;
        const eMat = (e.materia || '').toLowerCase().trim();
        if (assignedNames.has(eMat)) return true;
        const matchingSubj = (subjects || []).find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === eMat);
        if (matchingSubj && (assignedIds.has(matchingSubj.id) || assignedNames.has(matchingSubj.nombre.toLowerCase().trim()))) return true;
        return false;
      }
      return true;
    });
    sortedExams = availableExams.filter(e => {
      if (e.intentos === 0) return true;
      const myCount = studentSubs.filter(s => s.examenId === e.id).length;
      return myCount < e.intentos;
    });
  }

  const totalSubsPages = Math.ceil(sortedSubs.length / 8) || 1;
  const currentSubsPage = Math.min(subsPage, totalSubsPages);
  const paginatedSubs = sortedSubs.slice((currentSubsPage - 1) * 8, currentSubsPage * 8);

  const totalExamsPages = Math.ceil(sortedExams.length / 4) || 1;
  const currentExamsPage = Math.min(examsPage, totalExamsPages);
  const paginatedExams = sortedExams.slice((currentExamsPage - 1) * 4, currentExamsPage * 4);

  // Compute stats
  const totalExams = exams.length;
  const activeExams = exams.filter(e => e.estado === 'activo').length;
  const totalTeachers = users.filter(u => u.rol === 'docente').length;
  const totalStudents = users.filter(u => u.rol === 'estudiante').length;

  const stats = [
    { label: 'Exámenes Totales', value: totalExams, icon: <BookOpen className="w-5 h-5" />, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
    { label: 'Exámenes Activos', value: activeExams, icon: <CheckSquare className="w-5 h-5" />, color: '#2dd4bf', bg: 'rgba(45, 212, 191, 0.15)' },
    { label: 'Docentes Titulares', value: totalTeachers, icon: <GraduationCap className="w-5 h-5" />, color: '#fbbf24', bg: 'rgba(251, 191, 36, 0.15)' },
    { label: 'Estudiantes Activos', value: totalStudents, icon: <Users className="w-5 h-5" />, color: '#a78bfa', bg: 'rgba(167, 139, 250, 0.15)' },
  ];

  // Definition of ERP Modules Categorized (16 modules total)
  interface ModuleItem {
    id: string;
    title: string;
    desc: string;
    icon: React.ReactNode;
    pageId: string;
    color: string;
  }

  interface CategoryGroup {
    id: string;
    name: string;
    badgeCount: number;
    accentDot: string;
    modules: ModuleItem[];
  }

  const categories: CategoryGroup[] = [
    {
      id: 'academico',
      name: 'Académico & Programas',
      badgeCount: 4,
      accentDot: 'bg-cyan-400',
      modules: [
        {
          id: 'asignaturas',
          title: 'Asignaturas & Malla',
          desc: 'Gestión de materias y docentes',
          icon: <BookOpen className="w-4 h-4" />,
          pageId: 'asignaturas',
          color: 'text-cyan-400'
        },
        {
          id: 'semestres',
          title: 'Semestres & Períodos',
          desc: 'Niveles académicos activos',
          icon: <Layers className="w-4 h-4" />,
          pageId: 'semestres',
          color: 'text-teal-300'
        },
        {
          id: 'horarios',
          title: 'Horarios & Aulas',
          desc: 'Distribución horaria y salones',
          icon: <Clock className="w-4 h-4" />,
          pageId: 'asignaturas',
          color: 'text-sky-300'
        },
        {
          id: 'mallaCurricular',
          title: 'Plan de Estudios PEI',
          desc: 'Registro y créditos por ciclo',
          icon: <School className="w-4 h-4" />,
          pageId: 'semestres',
          color: 'text-emerald-300'
        }
      ]
    },
    {
      id: 'evaluaciones',
      name: 'Evaluaciones & Parciales',
      badgeCount: 4,
      accentDot: 'bg-teal-400',
      modules: [
        {
          id: 'examenes',
          title: 'Banco de Exámenes',
          desc: 'Creación y edición de parciales',
          icon: <FileText className="w-4 h-4" />,
          pageId: 'examenes',
          color: 'text-teal-400'
        },
        {
          id: 'builder',
          title: 'Constructor con IA',
          desc: 'Generador asistido de preguntas',
          icon: <Sparkles className="w-4 h-4" />,
          pageId: 'builder',
          color: 'text-amber-300'
        },
        {
          id: 'calificaciones',
          title: 'Boletines & Notas',
          desc: 'Consolidado de actas y notas',
          icon: <Award className="w-4 h-4" />,
          pageId: 'resultados',
          color: 'text-emerald-400'
        },
        {
          id: 'presentar',
          title: 'Presentar Parcial',
          desc: 'Portal de pruebas en línea',
          icon: <CheckSquare className="w-4 h-4" />,
          pageId: 'misExamenesTake',
          color: 'text-cyan-300'
        }
      ]
    },
    {
      id: 'estudiantes',
      name: 'Estudiantes & Matrículas',
      badgeCount: 3,
      accentDot: 'bg-purple-400',
      modules: [
        {
          id: 'directorio',
          title: 'Directorio Estudiantil',
          desc: 'Fichas, cédulas y carnetización',
          icon: <Users className="w-4 h-4" />,
          pageId: 'estudiantes',
          color: 'text-purple-400'
        },
        {
          id: 'matriculas',
          title: 'Matrículas & Semestres',
          desc: 'Inscripción y asignación de materias',
          icon: <CheckCircle2 className="w-4 h-4" />,
          pageId: 'matriculas',
          color: 'text-teal-300'
        },
        {
          id: 'asistencia',
          title: 'Control de Asistencia',
          desc: 'Registro por fecha y clase',
          icon: <Calendar className="w-4 h-4" />,
          pageId: 'asistencia',
          color: 'text-sky-400'
        }
      ]
    },
    {
      id: 'finanzas',
      name: 'Finanzas & Tesorería',
      badgeCount: 2,
      accentDot: 'bg-emerald-400',
      modules: [
        {
          id: 'pensiones',
          title: 'Control de Pensiones',
          desc: 'Pagos, matrículas y cartera',
          icon: <DollarSign className="w-4 h-4" />,
          pageId: 'finanzas',
          color: 'text-emerald-400'
        },
        {
          id: 'pazysalvo',
          title: 'Paz y Salvos & Facturación',
          desc: 'Certificados y comprobantes',
          icon: <FileSpreadsheet className="w-4 h-4" />,
          pageId: 'finanzas',
          color: 'text-cyan-300'
        }
      ]
    },
    {
      id: 'comunidad',
      name: 'Comunidad & Respaldo Cloud',
      badgeCount: 3,
      accentDot: 'bg-sky-400',
      modules: [
        {
          id: 'docentes',
          title: 'Directorio Docente',
          desc: 'Cuerpo profesoral y asignaciones',
          icon: <GraduationCap className="w-4 h-4" />,
          pageId: 'docentes',
          color: 'text-sky-300'
        },
        {
          id: 'auditoria',
          title: 'Auditoría Cloud & Backups',
          desc: 'Sincronización Supabase & Firebase',
          icon: <Cloud className="w-4 h-4" />,
          pageId: 'auditoria',
          color: 'text-teal-400'
        },
        {
          id: 'cosmos',
          title: 'Portal Bio-Cósmico',
          desc: 'Sintonía, sabiduría y reflexión',
          icon: <Leaf className="w-4 h-4" />,
          pageId: 'dashboard',
          color: 'text-emerald-300'
        }
      ]
    }
  ];

  const filteredCategories = selectedCategory === 'todas'
    ? categories
    : categories.filter(c => c.id === selectedCategory);

  return (
    <div className="page-dashboard animate-fade-in text-white space-y-5">
      
      {/* ========================================================= */}
      {/* TOP HERO BANNER (Identical layout to image_6cff5dfb.png)   */}
      {/* Style: Azul Verdoso Petrol Teal (#072d35) with 3D Relief  */}
      {/* ========================================================= */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#05242a] via-[#072f38] to-[#093944] border border-[#11505e] p-6 sm:p-8 shadow-[0_15px_35px_rgba(0,0,0,0.45)] overflow-hidden">
        {/* Soft atmospheric ambient glow */}
        <div className="absolute -top-24 -left-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 right-1/4 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          
          {/* Left Hero Content */}
          <div className="flex-1 max-w-2xl">
            <span className="text-[11px] font-black uppercase tracking-[0.28em] text-[#22d3ee] font-mono block mb-1">
              BIENVENIDO A
            </span>
            
            {/* Title in High-Relief 3D Effect as requested by user */}
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none text-relief-3d mb-2.5">
              Synapsis ERP
            </h1>

            <p className="text-xs sm:text-sm text-teal-100/80 font-normal leading-relaxed max-w-xl">
              Control total de tu institución, en un solo lugar. Módulos de gestión organizados por categorías académicas, evaluativas y administrativas.
            </p>
          </div>

          {/* Right Live Mini-Widget Card ("SYNAPSIS LIVE") */}
          <div className="w-full sm:w-64 bg-[#041c21]/90 rounded-2xl border border-[#115463] p-3.5 shadow-xl shrink-0 backdrop-blur-md">
            <div className="flex items-center justify-between border-b border-[#0f4450] pb-2 mb-2.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" />
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-300 tracking-wider">
                SYNAPSIS LIVE
              </span>
            </div>

            {/* Dynamic Equalizer / Metric Bars */}
            <div className="h-16 flex items-end justify-between gap-2 px-2 py-1 bg-[#021316]/60 rounded-xl border border-[#0d3b45]">
              <div className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t h-[45%] transition-all" />
              <div className="w-full bg-gradient-to-t from-teal-600 to-teal-400 rounded-t h-[75%] transition-all" />
              <div className="w-full bg-gradient-to-t from-indigo-600 to-indigo-400 rounded-t h-[55%] transition-all" />
              <div className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t h-[85%] transition-all" />
              <div className="w-full bg-gradient-to-t from-cyan-500 to-blue-400 rounded-t h-[95%] transition-all" />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mt-2.5 pt-1">
              <span className="font-semibold text-slate-300">CAMPUS 2026</span>
              <span className="flex items-center gap-1 text-emerald-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Sistema Activo
              </span>
            </div>
          </div>
        </div>

        {/* Bottom Sub-Bar: Privacy Mode & Reveal Metrics Button */}
        <div className="mt-6 pt-4 border-t border-[#0e4854] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#041c21]/40 -mx-6 sm:-mx-8 -mb-6 sm:-mb-8 px-6 sm:px-8 py-3.5">
          <div className="flex items-center gap-2.5 text-xs text-teal-100/90">
            <span className="p-1 rounded-lg bg-[#073038] text-cyan-300 border border-[#104d5b]">
              <EyeOff className="w-3.5 h-3.5" />
            </span>
            <span className="font-bold text-white text-xs">Tarjetas Institucionales Protegidas</span>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 uppercase">
              MODO PRIVADO
            </span>
            <span className="text-teal-300/50 hidden sm:inline">—</span>
            <span className="text-[11px] text-teal-200/70 hidden sm:inline">Cifras confidenciales ocultas a terceros</span>
          </div>

          <button
            type="button"
            onClick={() => setShowMetrics(prev => !prev)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-slate-950 font-bold text-xs tracking-wide shadow-md shadow-cyan-500/20 cursor-pointer transition-all active:scale-95"
          >
            {showMetrics ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span>{showMetrics ? 'Ocultar tarjetas de métricas' : 'Revelar tarjetas de métricas'}</span>
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* METRIC CARDS (Revealed when clicking "Revelar tarjetas")   */}
      {/* ========================================================= */}
      {showMetrics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 animate-fade-in">
          {stats.map((stat, i) => (
            <div 
              key={i} 
              className="bg-[#072d35] border border-[#115463] p-4 rounded-2xl shadow-sm flex flex-col transition-all hover:border-cyan-400/50"
            >
              <div 
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5"
                style={{ backgroundColor: stat.bg, color: stat.color }}
              >
                {stat.icon}
              </div>
              <div className="text-2xl font-black text-white text-relief-3d">
                {stat.value}
              </div>
              <div className="text-xs font-semibold text-teal-200/75 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================= */}
      {/* CATEGORY FILTER PILLS BAR (Identical to image_6cff5dfb)    */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
        
        {/* Left: Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('todas')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              selectedCategory === 'todas'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842] hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Todas (16)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('academico')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              selectedCategory === 'academico'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842] hover:text-white'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Académico (4)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('evaluaciones')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              selectedCategory === 'evaluaciones'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842] hover:text-white'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Evaluaciones (4)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('estudiantes')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              selectedCategory === 'estudiantes'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842] hover:text-white'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Estudiantes (3)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('finanzas')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              selectedCategory === 'finanzas'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842] hover:text-white'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5" />
            <span>Finanzas (2)</span>
          </button>

          <button
            type="button"
            onClick={() => setSelectedCategory('comunidad')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              selectedCategory === 'comunidad'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842] hover:text-white'
            }`}
          >
            <Cloud className="w-3.5 h-3.5" />
            <span>Comunidad (3)</span>
          </button>
        </div>

        {/* Right Controls: Desplegar Todos & Tamaño Mini / Mediana */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={toggleAllSections}
            className="px-3 py-1.5 rounded-xl bg-[#072d35] border border-[#104b58] hover:border-cyan-400/50 text-teal-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ChevronDown className="w-3.5 h-3.5 text-cyan-400" />
            <span>Desplegar Todos</span>
          </button>

          <div className="flex items-center bg-[#072d35] border border-[#104b58] rounded-xl p-1 gap-1 text-xs">
            <span className="text-[11px] font-semibold text-teal-200/70 px-1.5">Tamaño:</span>
            <button
              type="button"
              onClick={() => setCardSize('mini')}
              className={`px-2 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                cardSize === 'mini' 
                  ? 'bg-cyan-500 text-slate-950 shadow' 
                  : 'text-teal-200 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Mini</span>
            </button>
            <button
              type="button"
              onClick={() => setCardSize('mediana')}
              className={`px-2 py-1 rounded-lg font-bold text-xs flex items-center gap-1 transition-all cursor-pointer ${
                cardSize === 'mediana' 
                  ? 'bg-cyan-500 text-slate-950 shadow' 
                  : 'text-teal-200 hover:text-white'
              }`}
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Mediana</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* CATEGORY SECTIONS WITH HORIZONTAL MODULE CARDS            */}
      {/* ========================================================= */}
      <div className="space-y-6 pt-1">
        {filteredCategories.map(cat => {
          const isCollapsed = !!collapsedSections[cat.id];

          return (
            <div key={cat.id} className="space-y-3">
              {/* Category Header with 3D Relief and glowing dot */}
              <div 
                onClick={() => toggleSection(cat.id)}
                className="flex items-center justify-between cursor-pointer group select-none py-1"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${cat.accentDot} shadow-[0_0_10px_currentColor]`} />
                  <h2 className="text-xs sm:text-sm font-black tracking-widest uppercase text-white text-relief-header">
                    {cat.name}
                  </h2>
                </div>

                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#072d35] border border-[#11505e] group-hover:border-cyan-400/60 transition-colors">
                  <span className="text-[10px] font-bold text-teal-200">
                    {cat.badgeCount} módulos
                  </span>
                  {isCollapsed ? (
                    <ChevronDown className="w-3 h-3 text-cyan-400" />
                  ) : (
                    <ChevronUp className="w-3 h-3 text-cyan-400" />
                  )}
                </div>
              </div>

              {/* Module Cards Grid */}
              {!isCollapsed && (
                <div className={`grid gap-3 ${
                  cardSize === 'mini' 
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}>
                  {cat.modules.map(mod => (
                    <div
                      key={mod.id}
                      onClick={() => onNavigate(mod.pageId)}
                      className={`bg-gradient-to-br from-[#072d35] to-[#093740] hover:from-[#0a3842] hover:to-[#0d4552] border border-[#115260] hover:border-cyan-400/80 rounded-2xl p-3.5 shadow-md flex items-center gap-3 cursor-pointer group transition-all duration-200 active:scale-[0.98] ${
                        cardSize === 'mediana' ? 'py-4' : ''
                      }`}
                    >
                      {/* Left icon box */}
                      <div className="w-11 h-11 rounded-xl bg-[#052127] border border-[#125868] flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-cyan-400/60 transition-transform">
                        <span className={mod.color}>
                          {mod.icon}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors truncate">
                          {mod.title}
                        </div>
                        <div className="text-[11px] text-teal-200/70 truncate mt-0.5">
                          {mod.desc}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ========================================================= */}
      {/* BOTTOM STATUS ROW (Exact match to image_6cff5dfb)         */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-4">
        
        {/* Chip 1: Cumplimiento Institucional */}
        <div className="bg-[#072d35] border border-[#115260] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/80 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                Cumple con el Estándar PEI
              </div>
              <div className="text-[10px] text-teal-200/70 truncate">
                Registro calificado vigente 2026
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('asignaturas')}
            className="px-2.5 py-1 rounded-lg bg-[#093d47] hover:bg-[#0c4a57] border border-[#135d6e] text-cyan-300 text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
          >
            Configurar →
          </button>
        </div>

        {/* Chip 2: Institución en Crecimiento */}
        <div className="bg-[#072d35] border border-[#115260] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-cyan-950/80 border border-cyan-700/60 flex items-center justify-center text-cyan-400 shrink-0">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                Institución en Crecimiento
              </div>
              <div className="text-[10px] text-teal-200/70 truncate">
                Información académica al instante
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('resultados')}
            className="px-2.5 py-1 rounded-lg bg-[#093d47] hover:bg-[#0c4a57] border border-[#135d6e] text-cyan-300 text-[11px] font-bold shrink-0 transition-colors cursor-pointer"
          >
            Ver Reportes →
          </button>
        </div>

        {/* Chip 3: Respaldo en la Nube */}
        <div className="bg-[#072d35] border border-[#115260] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-md">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-blue-950/80 border border-blue-700/60 flex items-center justify-center text-blue-400 shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                Respaldo en la Nube
              </div>
              <div className="text-[10px] text-teal-200/70 truncate">
                Supabase & Render sincronizados
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
              ● En línea
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-700/60 text-cyan-300">
              🛡 Respaldos
            </span>
          </div>
        </div>

      </div>

      {/* ========================================================= */}
      {/* DETAILED RECENT DATA SECTION (Always available below)     */}
      {/* ========================================================= */}
      <div className="pt-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          
          {/* Entregas y Evaluaciones Recientes */}
          <div className="bg-[#072d35] border border-[#115260] rounded-2xl p-5 shadow-md flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="border-b border-[#0f4652] pb-3 mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Entregas de Parciales Recientes</span>
                </h3>
                <button 
                  onClick={() => onNavigate('resultados')} 
                  className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                >
                  Ver todas →
                </button>
              </div>

              {paginatedSubs.length === 0 ? (
                <div className="py-10 text-center text-xs text-teal-200/50">
                  Sin entregas recientes registradas
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-teal-100">
                    <thead>
                      <tr className="text-teal-300/70 border-b border-[#0f4652] text-[10px] uppercase tracking-wider">
                        <th className="py-2 px-2.5">Estudiante</th>
                        <th className="py-2 px-2.5">Examen</th>
                        <th className="py-2 px-2.5">Nota</th>
                        <th className="py-2 px-2.5">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#0c3e4a]">
                      {paginatedSubs.map(sub => {
                        const student = users.find(u => u.id === sub.estudianteId);
                        const exam = exams.find(e => e.id === sub.examenId);
                        return (
                          <tr key={sub.id} className="hover:bg-[#0a3842]/50 transition-colors">
                            <td className="py-2 px-2.5 font-bold text-white truncate max-w-[140px]">
                              {student?.nombre || 'Estudiante'}
                            </td>
                            <td className="py-2 px-2.5 text-teal-200/80 truncate max-w-[180px]">
                              {cleanExamTitle(exam?.titulo || 'Evaluación')}
                            </td>
                            <td className="py-2 px-2.5 font-black text-cyan-300">
                              {formatGrade5(sub.puntaje)}
                            </td>
                            <td className="py-2 px-2.5 text-[11px] text-teal-300/60 whitespace-nowrap">
                              {fmtDate(sub.fecha)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {sortedSubs.length > 8 && (
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#0f4652] text-[11px] text-teal-200/70">
                <span>Pág. {currentSubsPage} de {totalSubsPages}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={currentSubsPage === 1}
                    onClick={() => setSubsPage(p => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded bg-[#05242a] border border-[#11505e] hover:bg-[#0a3842] disabled:opacity-40 cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={currentSubsPage === totalSubsPages}
                    onClick={() => setSubsPage(p => Math.min(totalSubsPages, p + 1))}
                    className="px-2 py-1 rounded bg-[#05242a] border border-[#11505e] hover:bg-[#0a3842] disabled:opacity-40 cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Exámenes Disponibles / Activos */}
          <div className="bg-[#072d35] border border-[#115260] rounded-2xl p-5 shadow-md flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="border-b border-[#0f4652] pb-3 mb-3 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400 animate-pulse" />
                  <span>Exámenes y Parciales en Curso</span>
                </h3>
                <button 
                  onClick={() => onNavigate(rol === 'estudiante' ? 'misExamenesTake' : 'examenes')} 
                  className="text-xs font-bold text-cyan-400 hover:underline cursor-pointer"
                >
                  Gestionar →
                </button>
              </div>

              {paginatedExams.length === 0 ? (
                <div className="py-10 text-center text-xs text-teal-200/50">
                  No hay exámenes disponibles en este momento
                </div>
              ) : (
                <div className="space-y-2.5">
                  {paginatedExams.map(exam => {
                    const subjectObj = subjects.find(s => s.id === exam.materia || s.nombre.toLowerCase().trim() === (exam.materia || '').toLowerCase().trim());
                    return (
                      <div 
                        key={exam.id}
                        className="p-3 rounded-xl bg-[#05242a] border border-[#0f4652] flex items-center justify-between gap-3 hover:border-cyan-400/50 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate" title={exam.titulo}>
                            {cleanExamTitle(exam.titulo)}
                          </div>
                          <div className="text-[10px] text-teal-200/70 truncate mt-0.5">
                            {subjectObj?.nombre || exam.materia || 'Asignatura'} · {exam.tiempo ? `${exam.tiempo} Minutos` : 'Sin límite'}
                          </div>
                        </div>

                        {onTakeExam && rol === 'estudiante' ? (
                          <button
                            type="button"
                            onClick={() => onTakeExam(exam.id)}
                            className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold text-xs shrink-0 cursor-pointer shadow"
                          >
                            Presentar
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onNavigate('examenes')}
                            className="px-2.5 py-1 rounded-lg bg-[#073038] hover:bg-[#0c4450] text-cyan-300 text-xs font-semibold shrink-0 cursor-pointer border border-[#11505e]"
                          >
                            Ver Detalles
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {sortedExams.length > 4 && (
              <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-[#0f4652] text-[11px] text-teal-200/70">
                <span>Pág. {currentExamsPage} de {totalExamsPages}</span>
                <div className="flex gap-1.5">
                  <button
                    disabled={currentExamsPage === 1}
                    onClick={() => setExamsPage(p => Math.max(1, p - 1))}
                    className="px-2 py-1 rounded bg-[#05242a] border border-[#11505e] hover:bg-[#0a3842] disabled:opacity-40 cursor-pointer"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={currentExamsPage === totalExamsPages}
                    onClick={() => setExamsPage(p => Math.min(totalExamsPages, p + 1))}
                    className="px-2 py-1 rounded bg-[#05242a] border border-[#11505e] hover:bg-[#0a3842] disabled:opacity-40 cursor-pointer"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

    </div>
  );
}
