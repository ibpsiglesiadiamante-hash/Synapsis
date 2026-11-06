/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, CheckSquare, Users, Award, 
  HelpCircle, XCircle, TrendingUp, Sparkles, FileSpreadsheet,
  Compass, Leaf, Star, GraduationCap, CheckCircle,
  Calendar, Layers, Clock, ShieldCheck, DollarSign,
  ChevronDown, ChevronUp, Eye, EyeOff, LayoutGrid,
  School, QrCode, ArrowRight, Activity, Cloud, Settings,
  BarChart3, FileText, CheckCircle2, SlidersHorizontal,
  Milestone, BookMarked, Library, Megaphone, ClipboardList,
  Scroll, Trash2, Bell, BellRing, AlertTriangle, Check, ExternalLink,
  Flame, Inbox
} from 'lucide-react';
import { User, Exam, Submission, Subject, Semester, Assignment, AssignmentSubmission, Parcial } from '../types';
import { avatarColor, avatarLetter, fmtDate, cleanExamTitle, formatGrade5, getStudentAssignedSubjects, resolveStudentSemester } from '../lib/db';

export interface AcademicNotification {
  id: string;
  type: 'exam' | 'assignment';
  title: string;
  subtitle: string;
  subjectName: string;
  dueDate?: string;
  dueLabel?: string;
  urgency: 'urgent' | 'upcoming' | 'normal';
  badgeText: string;
  iconType: 'exam' | 'assignment';
  actionLabel: string;
  onAction: () => void;
  rawDate?: string;
  timeLimit?: number;
  attemptsLeft?: number;
}

interface DashboardProps {
  currentUser: User;
  users: User[];
  exams: Exam[];
  submissions: Submission[];
  subjects?: Subject[];
  semesters?: Semester[];
  assignments?: Assignment[];
  assignmentSubmissions?: AssignmentSubmission[];
  parciales?: Parcial[];
  onNavigate: (pageId: string) => void;
  onTakeExam?: (examId: string) => void;
  theme?: string;
  initialCategory?: string;
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

export default function Dashboard({ 
  currentUser, 
  users, 
  exams, 
  submissions, 
  subjects = [], 
  semesters = [], 
  assignments = [],
  assignmentSubmissions = [],
  parciales = [],
  onNavigate, 
  onTakeExam, 
  theme,
  initialCategory = 'todas'
}: DashboardProps) {
  const rol = currentUser.rol;
  const allMyUserIds = users 
    ? users.filter(u => u.nombre === currentUser.nombre || u.email.toLowerCase() === currentUser.email.toLowerCase()).map(u => u.id)
    : [currentUser.id];
  const [quoteIndex, setQuoteIndex] = useState(() => Math.floor(Math.random() * natureQuotes.length));
  const [subsPage, setSubsPage] = useState(1);
  const [examsPage, setExamsPage] = useState(1);

  // Todas las categorías deben verse normales con sus tarjetas desplegadas por defecto
  const ALL_EXPANDED_CATEGORIES: Record<string, boolean> = {
    gestion: false,
    recursos: false,
    docente: false,
    estudiante: false,
    admin: false
  };

  const [selectedCategory, setSelectedCategory] = useState<string>('todas');
  const [showMetrics, setShowMetrics] = useState<boolean>(false);
  const [cardSize, setCardSize] = useState<'mini' | 'mediana'>('mini');
  // Por requerimiento expreso del usuario, el menú muestra normalmente todas sus tarjetas
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(ALL_EXPANDED_CATEGORIES);

  // Estados para el Centro de Notificaciones Académicas (Exámenes y Tareas)
  const [notifFilter, setNotifFilter] = useState<'todas' | 'exams' | 'tasks'>('todas');
  const [isNotifCollapsed, setIsNotifCollapsed] = useState<boolean>(false);
  const [showReadNotifs, setShowReadNotifs] = useState<boolean>(false);
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`synapsis_read_notifs_${currentUser.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sync with initialCategory when navigating back from a module
  useEffect(() => {
    if (initialCategory && initialCategory !== 'todas' && initialCategory !== 'recogido') {
      setSelectedCategory(initialCategory);
      setCollapsedSections({
        gestion: false,
        recursos: false,
        docente: false,
        estudiante: false,
        admin: false
      });
    } else {
      setSelectedCategory('todas');
      // Al volver a menú o seleccionar todas las categorías, siempre se ven normales con sus tarjetas
      setCollapsedSections(ALL_EXPANDED_CATEGORIES);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [initialCategory]);

  const handleNextQuote = () => {
    setQuoteIndex((prev) => (prev + 1) % natureQuotes.length);
  };

  const toggleSection = (id: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const isCurrentViewCollapsed = selectedCategory === 'todas'
    ? ['gestion', 'recursos', 'docente', 'estudiante', 'admin'].every(key => !!collapsedSections[key])
    : !!collapsedSections[selectedCategory];

  const toggleAllSections = () => {
    if (selectedCategory === 'todas') {
      if (isCurrentViewCollapsed) {
        // Desplegar todos los módulos
        setCollapsedSections({});
      } else {
        // Plegar todo el menú
        setCollapsedSections({
          gestion: true,
          recursos: true,
          docente: true,
          estudiante: true,
          admin: true
        });
      }
    } else {
      // Plegar o desplegar la categoría actual seleccionada
      setCollapsedSections(prev => ({
        ...prev,
        [selectedCategory]: !prev[selectedCategory]
      }));
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

  // =========================================================================
  // MOTOR DE NOTIFICACIONES ACADÉMICAS (Alertas de Exámenes y Tareas)
  // =========================================================================
  const myAssignedSubjects = getStudentAssignedSubjects(currentUser, subjects, semesters);
  const assignedIds = new Set(myAssignedSubjects.map(s => s.id));
  const assignedNames = new Set(myAssignedSubjects.map(s => (s.nombre || '').toLowerCase().trim()));
  const studentSubsList = (submissions || []).filter(s => s.estudianteId === currentUser?.id);

  // 1. Notificaciones de Exámenes Próximos / Activos
  const examNotifications: AcademicNotification[] = (exams || [])
    .filter(e => {
      if (e.estado !== 'activo') return false;
      if (rol === 'estudiante') {
        if (myAssignedSubjects.length > 0) {
          if (e.materia && assignedIds.has(e.materia)) return true;
          const eMat = (e.materia || '').toLowerCase().trim();
          if (assignedNames.has(eMat)) return true;
          const matchingSubj = (subjects || []).find(s => s.id === e.materia || s.nombre.toLowerCase().trim() === eMat);
          if (matchingSubj && (assignedIds.has(matchingSubj.id) || assignedNames.has(matchingSubj.nombre.toLowerCase().trim()))) return true;
          return false;
        }
        return true;
      }
      return true;
    })
    .map(exam => {
      const matchingSubj = (subjects || []).find(s => s.id === exam.materia || s.nombre.toLowerCase().trim() === (exam.materia || '').toLowerCase().trim());
      const subjName = matchingSubj?.nombre || exam.materia || 'Asignatura';
      const parc = (parciales || []).find(p => p.id === exam.parcialId);
      
      const myAttempts = studentSubsList.filter(s => s.examenId === exam.id).length;
      const hasRemaining = exam.intentos === 0 || myAttempts < exam.intentos;
      if (rol === 'estudiante' && !hasRemaining) return null;

      // Check if new (created within 7 days)
      const isNew = exam.creado ? (Date.now() - new Date(exam.creado).getTime() < 7 * 24 * 60 * 60 * 1000) : false;
      const urgency: 'urgent' | 'upcoming' | 'normal' = isNew ? 'urgent' : 'upcoming';
      const badgeText = isNew ? '¡Nuevo Examen!' : (exam.intentos > 0 ? `${exam.intentos - myAttempts} intento(s) disp.` : 'Examen Disponible');

      const subtitle = parc ? `Corte / Parcial: ${parc.nombre}` : (exam.descripcion ? exam.descripcion : 'Evaluación activa en la plataforma');

      return {
        id: `notif-exam-${exam.id}`,
        type: 'exam' as const,
        title: cleanExamTitle(exam.titulo),
        subtitle,
        subjectName: subjName,
        dueLabel: exam.tiempo > 0 ? `Límite: ${exam.tiempo} Minutos` : 'Sin límite de tiempo',
        urgency,
        badgeText,
        iconType: 'exam' as const,
        actionLabel: rol === 'estudiante' ? 'Presentar Examen' : 'Gestionar Examen',
        onAction: () => {
          if (rol === 'estudiante' && onTakeExam) {
            onTakeExam(exam.id);
          } else {
            onNavigate(rol === 'estudiante' ? 'misExamenesTake' : 'misExamenes');
          }
        },
        timeLimit: exam.tiempo,
        attemptsLeft: exam.intentos > 0 ? (exam.intentos - myAttempts) : undefined,
        rawDate: exam.creado
      };
    })
    .filter(Boolean) as AcademicNotification[];

  // 2. Notificaciones de Tareas Nuevas o Pendientes
  const taskNotifications: AcademicNotification[] = (assignments || [])
    .filter(task => {
      if (rol === 'estudiante') {
        if (myAssignedSubjects.length > 0) {
          if (task.asignatura && assignedIds.has(task.asignatura)) return true;
          const tAsig = (task.asignatura || '').toLowerCase().trim();
          if (assignedNames.has(tAsig)) return true;
          const matchingSubj = (subjects || []).find(s => s.id === task.asignatura || s.nombre.toLowerCase().trim() === tAsig);
          if (matchingSubj && (assignedIds.has(matchingSubj.id) || assignedNames.has(matchingSubj.nombre.toLowerCase().trim()))) return true;
          if (task.semestre && currentUser.semestre && task.semestre.toLowerCase().trim() === currentUser.semestre.toLowerCase().trim()) return true;
          return false;
        }
        return true;
      }
      return true;
    })
    .map(task => {
      const matchingSubj = (subjects || []).find(s => s.id === task.asignatura || s.nombre.toLowerCase().trim() === (task.asignatura || '').toLowerCase().trim());
      const subjName = matchingSubj?.nombre || task.asignatura || 'Asignatura';
      
      // Check if student already submitted
      const isSubmitted = (assignmentSubmissions || []).some(
        sub => (sub.assignmentId === task.id || sub.trabajoId === task.id) && sub.estudianteId === currentUser.id
      );
      if (rol === 'estudiante' && isSubmitted) return null;

      // Evaluate due date urgency
      let urgency: 'urgent' | 'upcoming' | 'normal' = 'normal';
      let dueLabel = 'Sin fecha límite fija';
      if (task.fechaEntrega) {
        const due = new Date(task.fechaEntrega);
        const today = new Date();
        today.setHours(0,0,0,0);
        const dueDay = new Date(due);
        dueDay.setHours(0,0,0,0);
        const diffTime = dueDay.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          urgency = 'urgent';
          dueLabel = `Fecha límite vencida (${fmtDate(task.fechaEntrega)})`;
        } else if (diffDays === 0) {
          urgency = 'urgent';
          dueLabel = '¡Vence Hoy!';
        } else if (diffDays === 1) {
          urgency = 'urgent';
          dueLabel = '¡Vence Mañana!';
        } else if (diffDays <= 3) {
          urgency = 'upcoming';
          dueLabel = `Vence en ${diffDays} días (${fmtDate(task.fechaEntrega)})`;
        } else {
          urgency = 'normal';
          dueLabel = `Entrega: ${fmtDate(task.fechaEntrega)}`;
        }
      }

      const isNew = task.creado ? (Date.now() - new Date(task.creado).getTime() < 7 * 24 * 60 * 60 * 1000) : false;
      const badgeText = isNew ? '¡Nueva Tarea Publicada!' : (urgency === 'urgent' ? '¡Entrega Urgente!' : 'Tarea Pendiente');

      return {
        id: `notif-task-${task.id}`,
        type: 'assignment' as const,
        title: task.titulo,
        subtitle: task.descripcion || 'Tarea académica asignada para tu curso',
        subjectName: subjName,
        dueDate: task.fechaEntrega,
        dueLabel,
        urgency: isNew && urgency === 'normal' ? 'upcoming' : urgency,
        badgeText,
        iconType: 'assignment' as const,
        actionLabel: 'Ver Tarea y Entregar',
        onAction: () => {
          onNavigate('trabajos');
        },
        rawDate: task.fechaEntrega || task.creado
      };
    })
    .filter(Boolean) as AcademicNotification[];

  const allNotifications: AcademicNotification[] = [...examNotifications, ...taskNotifications].sort((a, b) => {
    const urgencyScore = { urgent: 3, upcoming: 2, normal: 1 };
    return (urgencyScore[b.urgency] || 1) - (urgencyScore[a.urgency] || 1);
  });

  const pendingNotifications = allNotifications.filter(n => !readNotifIds.includes(n.id));
  const unreadCount = pendingNotifications.length;
  const examsPendingCount = pendingNotifications.filter(n => n.type === 'exam').length;
  const tasksPendingCount = pendingNotifications.filter(n => n.type === 'assignment').length;

  const displayedNotifications = (showReadNotifs ? allNotifications : pendingNotifications).filter(n => {
    if (notifFilter === 'exams') return n.type === 'exam';
    if (notifFilter === 'tasks') return n.type === 'assignment';
    return true;
  });

  const handleMarkAsRead = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReadNotifIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try {
        localStorage.setItem(`synapsis_read_notifs_${currentUser.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleMarkAllAsRead = () => {
    const allIds = allNotifications.map(n => n.id);
    setReadNotifIds(allIds);
    try {
      localStorage.setItem(`synapsis_read_notifs_${currentUser.id}`, JSON.stringify(allIds));
    } catch {}
  };

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

  // DEFINICIÓN EXACTA DE CATEGORÍAS Y MÓDULOS DEL MENÚ (Identical to image_d35f7ea1.png)
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
      id: 'gestion',
      name: 'Gestión Escolar',
      badgeCount: 5,
      accentDot: 'bg-teal-400',
      modules: [
        {
          id: 'asistencia',
          title: 'Asistencia',
          desc: 'Control de asistencia diario por fecha y clase',
          icon: <CheckSquare className="w-4 h-4" />,
          pageId: 'asistencia',
          color: 'text-teal-400'
        },
        {
          id: 'boletines',
          title: 'Boletines Acad.',
          desc: 'Generación de actas y boletines oficiales',
          icon: <Award className="w-4 h-4" />,
          pageId: 'boletines',
          color: 'text-amber-400'
        },
        {
          id: 'agenda',
          title: 'Agenda Escolar',
          desc: 'Calendario escolar y eventos del campus',
          icon: <Calendar className="w-4 h-4" />,
          pageId: 'agenda',
          color: 'text-cyan-400'
        },
        {
          id: 'tablon',
          title: 'Tablón de Anunc.',
          desc: 'Comunicados y avisos institucionales',
          icon: <Megaphone className="w-4 h-4" />,
          pageId: 'tablon',
          color: 'text-sky-300'
        },
        {
          id: 'finanzas',
          title: 'Finanzas / Pagos',
          desc: 'Control de pensiones, matrículas y cartera',
          icon: <DollarSign className="w-4 h-4" />,
          pageId: 'finanzas',
          color: 'text-emerald-400'
        }
      ]
    },
    {
      id: 'recursos',
      name: 'Recursos y Comunidad',
      badgeCount: 2,
      accentDot: 'bg-emerald-400',
      modules: [
        {
          id: 'educativo',
          title: 'Biblioteca de Conocimiento',
          desc: 'Recursos educativos y material pedagógico',
          icon: <Library className="w-4 h-4" />,
          pageId: 'educativo',
          color: 'text-indigo-400'
        },
        {
          id: 'biblia',
          title: 'La Sagrada Biblia',
          desc: 'Lectura bíblica, libros, capítulos y versículos',
          icon: <BookMarked className="w-4 h-4" />,
          pageId: 'biblia',
          color: 'text-amber-500'
        }
      ]
    },
    {
      id: 'docente',
      name: 'Docente',
      badgeCount: 3,
      accentDot: 'bg-cyan-400',
      modules: [
        {
          id: 'misExamenes',
          title: 'Mis exámenes',
          desc: 'Banco de evaluaciones, diseño y editor IA',
          icon: <FileText className="w-4 h-4" />,
          pageId: 'misExamenes',
          color: 'text-cyan-400'
        },
        {
          id: 'parciales',
          title: 'Mis parciales',
          desc: 'Configuración de fechas, cortes y semestres',
          icon: <Milestone className="w-4 h-4" />,
          pageId: 'parciales',
          color: 'text-teal-300'
        },
        {
          id: 'resultados',
          title: 'Resultados',
          desc: 'Calificación de exámenes y retroalimentación',
          icon: <BarChart3 className="w-4 h-4" />,
          pageId: 'resultados',
          color: 'text-emerald-300'
        }
      ]
    },
    {
      id: 'estudiante',
      name: 'Estudiante',
      badgeCount: 3,
      accentDot: 'bg-purple-400',
      modules: [
        {
          id: 'misMaterias',
          title: 'Mis Asignaturas',
          desc: 'Materias inscritas y docentes titulares',
          icon: <BookOpen className="w-4 h-4" />,
          pageId: 'misMaterias',
          color: 'text-purple-400'
        },
        {
          id: 'misExamenesTake',
          title: 'Exámenes disp.',
          desc: 'Presentar exámenes y evaluaciones activas',
          icon: <GraduationCap className="w-4 h-4" />,
          pageId: 'misExamenesTake',
          color: 'text-cyan-300'
        },
        {
          id: 'miHistorial',
          title: 'Mi historial',
          desc: 'Histórico de notas, intentos y resultados',
          icon: <Clock className="w-4 h-4" />,
          pageId: 'miHistorial',
          color: 'text-amber-300'
        }
      ]
    },
    {
      id: 'admin',
      name: 'Administrador',
      badgeCount: 9,
      accentDot: 'bg-blue-400',
      modules: [
        {
          id: 'usuarios',
          title: 'Usuarios',
          desc: 'Gestión de credenciales, roles y accesos',
          icon: <Users className="w-4 h-4" />,
          pageId: 'usuarios',
          color: 'text-blue-400'
        },
        {
          id: 'instituciones',
          title: 'Institutos',
          desc: 'Configuración de sedes e institución',
          icon: <School className="w-4 h-4" />,
          pageId: 'instituciones',
          color: 'text-teal-300'
        },
        {
          id: 'asignaturas',
          title: 'Asignaturas',
          desc: 'Malla de materias, códigos y créditos',
          icon: <BookOpen className="w-4 h-4" />,
          pageId: 'asignaturas',
          color: 'text-cyan-400'
        },
        {
          id: 'semestres',
          title: 'Semestres',
          desc: 'Semestres académicos (I al IX oficiales)',
          icon: <Layers className="w-4 h-4" />,
          pageId: 'semestres',
          color: 'text-emerald-300'
        },
        {
          id: 'registroNotas',
          title: 'Reg. de Notas',
          desc: 'Libro oficial de calificaciones',
          icon: <Award className="w-4 h-4" />,
          pageId: 'registroNotas',
          color: 'text-amber-400'
        },
        {
          id: 'trabajos',
          title: 'Trabajos Acad.',
          desc: 'Asignaciones y recepción de tareas',
          icon: <ClipboardList className="w-4 h-4" />,
          pageId: 'trabajos',
          color: 'text-purple-300'
        },
        {
          id: 'historialAcademico',
          title: 'Historial Acad.',
          desc: 'Kárdex global de calificaciones',
          icon: <Scroll className="w-4 h-4" />,
          pageId: 'historialAcademico',
          color: 'text-sky-300'
        },
        {
          id: 'estudiantes',
          title: 'Estudiantes',
          desc: 'Directorio estudiantil, cédulas y carnet',
          icon: <Users className="w-4 h-4" />,
          pageId: 'estudiantes',
          color: 'text-emerald-400'
        },
        {
          id: 'papelera',
          title: 'Papelera',
          desc: 'Recuperar o purgar registros eliminados',
          icon: <Trash2 className="w-4 h-4" />,
          pageId: 'papelera',
          color: 'text-rose-400'
        }
      ]
    }
  ];

  // Filter categories and modules strictly based on user role and permitted categories
  const userRole = currentUser?.rol || 'estudiante';
  const defaultAllowedCats = userRole === 'admin'
    ? ['gestion', 'recursos', 'docente', 'estudiante', 'admin']
    : userRole === 'docente'
      ? ['docente', 'recursos', 'gestion']
      : ['estudiante', 'recursos']; // By default, students ONLY have access to Estudiante & Recursos!

  const allowedCatIds: string[] = (currentUser?.permisosCategorias && currentUser.permisosCategorias.length > 0)
    ? currentUser.permisosCategorias
    : defaultAllowedCats;

  const availableCategories = categories.filter(c => allowedCatIds.includes(c.id));
  const totalModulesCount = availableCategories.reduce((acc, c) => acc + c.modules.length, 0);

  const activeSelectedCategory = (selectedCategory === 'todas' || allowedCatIds.includes(selectedCategory))
    ? selectedCategory
    : 'todas';

  const filteredCategories = activeSelectedCategory === 'todas'
    ? availableCategories
    : availableCategories.filter(c => c.id === activeSelectedCategory);

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
              {userRole === 'estudiante' ? 'PORTAL DEL ESTUDIANTE · BIENVENIDO A' : 'BIENVENIDO A'}
            </span>
            
            {/* Title in High-Relief 3D Effect as requested by user */}
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-none text-relief-3d mb-2.5">
              Synapsis ERP
            </h1>

            <p className="text-xs sm:text-sm text-teal-100/80 font-normal leading-relaxed max-w-xl">
              {userRole === 'estudiante'
                ? `Hola, ${currentUser.nombre}. Accede a tus asignaturas inscritas, evaluaciones disponibles, notas oficiales y recursos de estudio.`
                : 'Control total de tu institución, en un solo lugar. Módulos de gestión organizados por categorías académicas, evaluativas y administrativas.'}
            </p>

            {/* Quick Alert Indicator Pill */}
            {allNotifications.length > 0 && (
              <div 
                onClick={() => {
                  const el = document.getElementById('centro-notificaciones');
                  el?.scrollIntoView({ behavior: 'smooth' });
                  setIsNotifCollapsed(false);
                }}
                className="inline-flex items-center gap-2.5 mt-3.5 px-3.5 py-1.5 rounded-full bg-cyan-950/90 border border-cyan-400/60 text-cyan-200 text-xs font-bold cursor-pointer hover:bg-cyan-900 transition-all shadow-[0_0_20px_rgba(6,182,212,0.35)] select-none group"
              >
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-400"></span>
                </span>
                <span className="group-hover:text-white transition-colors">
                  {unreadCount > 0 
                    ? `🔔 ${unreadCount} ${unreadCount === 1 ? 'alerta académica pendiente' : 'alertas académicas pendientes'} (${examsPendingCount} ${examsPendingCount === 1 ? 'examen' : 'exámenes'} · ${tasksPendingCount} ${tasksPendingCount === 1 ? 'tarea' : 'tareas'})`
                    : '🔔 Todas las alertas académicas al día'}
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-cyan-300 group-hover:translate-x-1 transition-transform" />
              </div>
            )}
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
      {/* CENTRO DE NOTIFICACIONES Y ALERTAS ACADÉMICAS             */}
      {/* Alertas sobre exámenes próximos y nuevas tareas           */}
      {/* ========================================================= */}
      <div 
        id="centro-notificaciones" 
        className="rounded-3xl bg-gradient-to-br from-[#062c34] via-[#07323c] to-[#083a46] border border-[#125868] p-4 sm:p-6 shadow-[0_12px_32px_rgba(0,0,0,0.5)] transition-all scroll-mt-24"
      >
        {/* Top Header of the Notification Center */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#0f4652]">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
              <BellRing className={`w-5 h-5 ${unreadCount > 0 ? 'text-cyan-300 animate-bounce' : 'text-teal-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-black tracking-wide uppercase text-white text-relief-header">
                  Centro de Notificaciones Académicas
                </h2>
                {unreadCount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-rose-500 text-white shadow-[0_0_10px_rgba(244,63,94,0.4)] animate-pulse">
                    {unreadCount} {unreadCount === 1 ? 'pendiente' : 'pendientes'}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                    ✓ Al día
                  </span>
                )}
              </div>
              <p className="text-[11px] sm:text-xs text-teal-200/70 mt-0.5 leading-relaxed">
                {userRole === 'estudiante'
                  ? 'Alertas en tiempo real sobre exámenes programados por presentar y nuevas tareas académicas publicadas.'
                  : 'Panel de avisos institucionales sobre evaluaciones vigentes y asignaciones de cursos.'}
              </p>
            </div>
          </div>

          {/* Controls: Filter Pills & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
            {/* Filter Pills */}
            <div className="inline-flex rounded-xl p-1 bg-[#041d22] border border-[#0f4450]">
              <button
                type="button"
                onClick={() => setNotifFilter('todas')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  notifFilter === 'todas'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-teal-200/70 hover:text-white'
                }`}
              >
                Todas ({showReadNotifs ? allNotifications.length : pendingNotifications.length})
              </button>
              <button
                type="button"
                onClick={() => setNotifFilter('exams')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  notifFilter === 'exams'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-teal-200/70 hover:text-white'
                }`}
              >
                <span>📝 Exámenes</span>
                <span>({(showReadNotifs ? allNotifications : pendingNotifications).filter(n => n.type === 'exam').length})</span>
              </button>
              <button
                type="button"
                onClick={() => setNotifFilter('tasks')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  notifFilter === 'tasks'
                    ? 'bg-cyan-500 text-slate-950 shadow-xs'
                    : 'text-teal-200/70 hover:text-white'
                }`}
              >
                <span>📋 Tareas</span>
                <span>({(showReadNotifs ? allNotifications : pendingNotifications).filter(n => n.type === 'assignment').length})</span>
              </button>
            </div>

            {/* Quick Actions */}
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="px-2.5 py-1.5 rounded-xl bg-[#05242a] hover:bg-[#09363e] border border-[#104c5a] text-cyan-300 text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1 select-none"
                title="Marcar todas las alertas como leídas"
              >
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Marcar leídas</span>
              </button>
            )}

            {readNotifIds.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReadNotifs(prev => !prev)}
                className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-colors cursor-pointer select-none ${
                  showReadNotifs 
                    ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300' 
                    : 'bg-[#05242a] border-[#104c5a] text-teal-200/70 hover:text-white'
                }`}
              >
                {showReadNotifs ? 'Ocultar leídas' : `Ver leídas (${readNotifIds.length})`}
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsNotifCollapsed(prev => !prev)}
              className="p-1.5 rounded-xl bg-[#05242a] border border-[#104c5a] hover:border-cyan-400 text-cyan-300 cursor-pointer transition-colors"
              title={isNotifCollapsed ? 'Expandir panel de notificaciones' : 'Plegar panel de notificaciones'}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${!isNotifCollapsed ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Notification Body */}
        {!isNotifCollapsed ? (
          <div className="pt-4">
            {displayedNotifications.length === 0 ? (
              <div className="py-8 px-4 rounded-2xl bg-[#041f25]/60 border border-[#0d3f4a] text-center space-y-2">
                <div className="w-12 h-12 rounded-full bg-emerald-950/80 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white">
                  {readNotifIds.length > 0 && !showReadNotifs
                    ? 'Todas las notificaciones pendientes han sido atendidas o marcadas como leídas'
                    : '¡Estás al día! No hay exámenes pendientes ni tareas pendientes de entrega'}
                </h3>
                <p className="text-xs text-teal-200/70 max-w-md mx-auto">
                  {readNotifIds.length > 0 && !showReadNotifs
                    ? 'Puedes activar "Ver leídas" para revisar el historial de alertas académicas.'
                    : 'Cualquier nueva evaluación o trabajo que publique tu docente aparecerá automáticamente en este panel.'}
                </p>
                {readNotifIds.length > 0 && !showReadNotifs && (
                  <button
                    type="button"
                    onClick={() => setShowReadNotifs(true)}
                    className="mt-2 text-xs font-bold text-cyan-300 hover:underline inline-block cursor-pointer"
                  >
                    Mostrar {readNotifIds.length} alertas leídas →
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {displayedNotifications.map(item => {
                  const isRead = readNotifIds.includes(item.id);
                  const isExam = item.type === 'exam';

                  return (
                    <div
                      key={item.id}
                      className={`relative rounded-2xl border p-4 transition-all duration-200 flex flex-col justify-between gap-3 group ${
                        isRead
                          ? 'bg-[#041c21]/60 border-[#0e434f] opacity-80'
                          : item.urgency === 'urgent'
                            ? 'bg-gradient-to-br from-[#072d35] via-[#093842] to-[#0c4350] border-rose-500/50 shadow-[0_4px_20px_rgba(244,63,94,0.15)] ring-1 ring-rose-500/30'
                            : 'bg-gradient-to-br from-[#072d35] to-[#093740] border-[#125868] hover:border-cyan-400/80 shadow-md'
                      }`}
                    >
                      <div>
                        {/* Tags Header Row */}
                        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Type Badge */}
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 ${
                              isExam 
                                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300' 
                                : 'bg-purple-950/80 border-purple-500/50 text-purple-300'
                            }`}>
                              {isExam ? <GraduationCap className="w-3 h-3" /> : <ClipboardList className="w-3 h-3" />}
                              <span>{isExam ? 'Examen Evaluativo' : 'Tarea Académica'}</span>
                            </span>

                            {/* Subject Badge */}
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#041c21] border border-[#11505e] text-teal-200/90 truncate max-w-[170px]" title={item.subjectName}>
                              📚 {item.subjectName}
                            </span>
                          </div>

                          {/* Urgency Badge */}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shrink-0 border flex items-center gap-1 ${
                            item.urgency === 'urgent'
                              ? 'bg-rose-950/90 border-rose-500/60 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.3)] animate-pulse'
                              : item.urgency === 'upcoming'
                                ? 'bg-amber-950/90 border-amber-500/60 text-amber-300'
                                : 'bg-emerald-950/90 border-emerald-500/60 text-emerald-300'
                          }`}>
                            {item.urgency === 'urgent' && <Flame className="w-3 h-3 text-rose-400" />}
                            <span>{item.badgeText}</span>
                          </span>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-200 transition-colors line-clamp-2 leading-snug">
                          {item.title}
                        </h4>

                        {/* Subtitle / Description */}
                        {item.subtitle && (
                          <p className="text-[11px] text-teal-200/70 mt-1 line-clamp-2 leading-relaxed">
                            {item.subtitle}
                          </p>
                        )}
                      </div>

                      {/* Bottom Info & Action CTA */}
                      <div className="pt-3 border-t border-[#0e4450] flex items-center justify-between gap-3 mt-1">
                        <div className="flex items-center gap-2 text-[11px] text-teal-200/80 font-medium truncate">
                          {isExam ? (
                            <>
                              <span className="flex items-center gap-1 text-cyan-300">
                                <Clock className="w-3 h-3 text-cyan-400" />
                                <span>{item.dueLabel}</span>
                              </span>
                              {item.attemptsLeft !== undefined && (
                                <span className="hidden sm:inline text-teal-400/60">· {item.attemptsLeft} disp.</span>
                              )}
                            </>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3 text-amber-400" />
                              <span className={item.urgency === 'urgent' ? 'text-rose-300 font-bold' : 'text-teal-200/90'}>
                                {item.dueLabel}
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Buttons */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleMarkAsRead(item.id, e)}
                            className="p-1.5 rounded-lg bg-[#041c21] hover:bg-[#07323b] border border-[#104b58] text-teal-300 hover:text-white transition-colors cursor-pointer"
                            title={isRead ? 'Marcar como pendiente' : 'Marcar como leída'}
                          >
                            <Check className={`w-3.5 h-3.5 ${isRead ? 'text-cyan-400' : 'opacity-60'}`} />
                          </button>

                          <button
                            type="button"
                            onClick={item.onAction}
                            className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95 ${
                              isExam 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white shadow-emerald-500/20'
                                : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 shadow-cyan-500/20'
                            }`}
                          >
                            <span>{item.actionLabel}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="pt-2 flex items-center justify-between text-xs text-teal-200/80">
            <span>
              🔔 Tienes <strong>{unreadCount}</strong> alertas académicas activas ({examsPendingCount} exámenes · {tasksPendingCount} tareas).
            </span>
            <button
              type="button"
              onClick={() => setIsNotifCollapsed(false)}
              className="text-xs font-bold text-cyan-300 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Ver todas las alertas</span>
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
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
      {/* CATEGORY FILTER PILLS BAR                                 */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
        
        {/* Left: Filter Pills matching only permitted categories for the current user */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('todas');
              // Mostrar normal con todas sus tarjetas desplegadas y visibles
              setCollapsedSections(ALL_EXPANDED_CATEGORIES);
            }}
            className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
              activeSelectedCategory === 'todas'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842] hover:text-white'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Todas ({totalModulesCount})</span>
          </button>

          {availableCategories.map(cat => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setSelectedCategory(cat.id);
                setCollapsedSections(prev => ({ ...prev, [cat.id]: false }));
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 border ${
                activeSelectedCategory === cat.id
                  ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842] hover:text-white'
              }`}
            >
              {cat.id === 'gestion' && <CheckSquare className="w-3.5 h-3.5" />}
              {cat.id === 'recursos' && <BookMarked className="w-3.5 h-3.5" />}
              {cat.id === 'docente' && <FileText className="w-3.5 h-3.5" />}
              {cat.id === 'estudiante' && <Users className="w-3.5 h-3.5" />}
              {cat.id === 'admin' && <ShieldCheck className="w-3.5 h-3.5" />}
              <span>{cat.name} ({cat.modules.length})</span>
            </button>
          ))}
        </div>

        {/* Right Controls: Desplegar Todos & Tamaño Mini / Mediana */}
        <div className="flex items-center gap-2.5 shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={toggleAllSections}
            className="px-3 py-1.5 rounded-xl bg-[#072d35] border border-[#104b58] hover:border-cyan-400/50 text-teal-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer select-none"
          >
            <ChevronDown className={`w-3.5 h-3.5 text-cyan-400 transition-transform duration-200 ${!isCurrentViewCollapsed ? 'rotate-180' : ''}`} />
            <span>{isCurrentViewCollapsed ? 'Desplegar Todos' : 'Plegar Todos'}</span>
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
      {/* CATEGORY SECTIONS WITH REAL MODULE CARDS                  */}
      {/* ========================================================= */}
      <div className="space-y-6 pt-1">
        {filteredCategories.map(cat => {
          const isCollapsed = !!collapsedSections[cat.id];

          return (
            <div 
              key={cat.id} 
              id={`category-${cat.id}`} 
              className={`space-y-3 scroll-mt-24 transition-all rounded-3xl p-3 sm:p-4 border ${
                selectedCategory === cat.id 
                  ? 'bg-[#062c34]/70 border-cyan-500/60 shadow-[0_0_25px_rgba(6,182,212,0.15)] ring-1 ring-cyan-400/40' 
                  : 'bg-transparent border-transparent'
              }`}
            >
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
                  {selectedCategory === cat.id && (
                    <span className="text-[9.5px] font-mono text-cyan-300 bg-cyan-950/90 px-2 py-0.5 rounded-full border border-cyan-600/60 font-semibold shadow-xs hidden sm:inline">
                      Categoría seleccionada
                    </span>
                  )}
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
      {/* BOTTOM STATUS ROW (Cumplimiento, Crecimiento, Respaldo)   */}
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
                  onClick={() => onNavigate(rol === 'estudiante' ? 'misExamenesTake' : 'misExamenes')} 
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
                            onClick={() => onNavigate('misExamenes')}
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
