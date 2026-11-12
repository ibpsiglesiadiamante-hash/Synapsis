import React, { useState, useMemo } from 'react';
import { 
  Bell, 
  BellRing, 
  Check, 
  CheckCheck, 
  Clock, 
  Calendar, 
  BookOpen, 
  ArrowRight, 
  ArrowLeft, 
  Flame, 
  Filter, 
  Layers
} from 'lucide-react';
import { User, Exam, Assignment, AssignmentSubmission, Submission, Subject, Parcial } from '../types';
import { sortExamsBySubjectAndSequence } from '../lib/db';

interface CentroNotificacionesProps {
  currentUser: User;
  exams: Exam[];
  assignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  submissions: Submission[];
  subjects: Subject[];
  parciales?: Parcial[];
  onNavigate: (tab: string) => void;
  onTakeExam?: (examId: string) => void;
  toast: (msg: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

interface AcademicNotification {
  id: string;
  type: 'exam' | 'assignment';
  title: string;
  subtitle?: string;
  subjectName: string;
  dueDate?: string;
  dueLabel: string;
  urgency: 'urgent' | 'upcoming' | 'normal';
  badgeText: string;
  iconType: 'exam' | 'assignment';
  actionLabel: string;
  onAction: () => void;
  timeLimit?: number;
  attemptsLeft?: number;
  rawDate?: string;
}

export default function CentroNotificaciones({
  currentUser,
  exams = [],
  assignments = [],
  assignmentSubmissions = [],
  submissions = [],
  subjects = [],
  parciales = [],
  onNavigate,
  onTakeExam,
  toast
}: CentroNotificacionesProps) {
  const [filterType, setFilterType] = useState<'all' | 'exams' | 'tasks'>('all');
  const [showRead, setShowRead] = useState<boolean>(false);

  // Read notification IDs stored in localStorage
  const [readNotifIds, setReadNotifIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(`synapsis_read_notifs_${currentUser.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const rol = currentUser.rol || 'estudiante';

  // Helper date formatter
  const fmtDate = (d?: string) => {
    if (!d) return '';
    try {
      const date = new Date(d);
      return date.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return d;
    }
  };

  const cleanExamTitle = (title: string) => {
    return title.replace(/^(evaluaci[oó]n|examen|parcial)\s*i*\s*[-–—:]\s*/i, '').trim() || title;
  };

  // Student assigned subjects calculation
  const myAssignedSubjects = useMemo(() => {
    if (rol === 'estudiante') {
      const direct = currentUser.asignaturas || [];
      if (direct.length > 0) return direct;
      if (currentUser.semestre) {
        return (subjects || [])
          .filter(s => s.semestre && s.semestre.toLowerCase().trim() === (currentUser.semestre || '').toLowerCase().trim())
          .map(s => s.id);
      }
    }
    return [];
  }, [currentUser, rol, subjects]);

  const assignedIds = useMemo(() => new Set(myAssignedSubjects), [myAssignedSubjects]);
  const assignedNames = useMemo(() => {
    const names = new Set<string>();
    myAssignedSubjects.forEach(id => {
      const s = (subjects || []).find(sub => sub.id === id);
      if (s) names.add(s.nombre.toLowerCase().trim());
    });
    return names;
  }, [myAssignedSubjects, subjects]);

  const studentSubsList = useMemo(() => {
    return (submissions || []).filter(s => s.estudianteId === currentUser.id);
  }, [submissions, currentUser.id]);

  // 1. Exam notifications
  const examNotifications: AcademicNotification[] = useMemo(() => {
    return sortExamsBySubjectAndSequence(exams || [], subjects, parciales)
      .filter(e => e.estado === 'activo')
      .filter(exam => {
        if (rol === 'estudiante') {
          if (myAssignedSubjects.length > 0) {
            if (exam.materia && assignedIds.has(exam.materia)) return true;
            const eMat = (exam.materia || '').toLowerCase().trim();
            if (assignedNames.has(eMat)) return true;
            const matchingSubj = (subjects || []).find(s => s.id === exam.materia || s.nombre.toLowerCase().trim() === eMat);
            if (matchingSubj && (assignedIds.has(matchingSubj.id) || assignedNames.has(matchingSubj.nombre.toLowerCase().trim()))) return true;
            if (exam.semestre && currentUser.semestre && exam.semestre.toLowerCase().trim() === currentUser.semestre.toLowerCase().trim()) return true;
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
  }, [exams, rol, myAssignedSubjects, assignedIds, assignedNames, subjects, currentUser.semestre, parciales, studentSubsList, onTakeExam, onNavigate]);

  // 2. Task notifications
  const taskNotifications: AcademicNotification[] = useMemo(() => {
    return (assignments || [])
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
        
        const isSubmitted = (assignmentSubmissions || []).some(
          sub => (sub.assignmentId === task.id || sub.trabajoId === task.id) && sub.estudianteId === currentUser.id
        );
        if (rol === 'estudiante' && isSubmitted) return null;

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
  }, [assignments, rol, myAssignedSubjects, assignedIds, assignedNames, subjects, currentUser.semestre, currentUser.id, assignmentSubmissions, onNavigate]);

  const allNotifications: AcademicNotification[] = useMemo(() => {
    return [...examNotifications, ...taskNotifications].sort((a, b) => {
      const urgencyScore = { urgent: 3, upcoming: 2, normal: 1 };
      return (urgencyScore[b.urgency] || 1) - (urgencyScore[a.urgency] || 1);
    });
  }, [examNotifications, taskNotifications]);

  const pendingNotifications = useMemo(() => {
    return allNotifications.filter(n => !readNotifIds.includes(n.id));
  }, [allNotifications, readNotifIds]);

  const unreadCount = pendingNotifications.length;

  const displayedList = useMemo(() => {
    const base = showRead ? allNotifications : pendingNotifications;
    if (filterType === 'exams') return base.filter(n => n.type === 'exam');
    if (filterType === 'tasks') return base.filter(n => n.type === 'assignment');
    return base;
  }, [showRead, allNotifications, pendingNotifications, filterType]);

  const handleToggleRead = (id: string) => {
    setReadNotifIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      try {
        localStorage.setItem(`synapsis_read_notifs_${currentUser.id}`, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleMarkAllRead = () => {
    const allIds = allNotifications.map(n => n.id);
    setReadNotifIds(allIds);
    try {
      localStorage.setItem(`synapsis_read_notifs_${currentUser.id}`, JSON.stringify(allIds));
    } catch {}
    toast('Todas las notificaciones han sido marcadas como leídas', 'success');
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fade-in text-white pb-12">
      {/* Top Banner Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#05242a] via-[#072f38] to-[#093944] border border-[#11505e] p-6 sm:p-8 shadow-[0_15px_35px_rgba(0,0,0,0.45)] overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-teal-500/20 border border-cyan-400/40 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
              <BellRing className={`w-6 h-6 ${unreadCount > 0 ? 'text-cyan-300 animate-bounce' : 'text-teal-400'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#22d3ee] font-mono">
                  MÓDULO DE ALERTAS INSTITUCIONALES
                </span>
                {unreadCount > 0 ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black font-mono bg-rose-500 text-white shadow-xs animate-pulse">
                    {unreadCount} {unreadCount === 1 ? 'pendiente' : 'pendientes'}
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono bg-emerald-950/80 border border-emerald-700/60 text-emerald-300">
                    ✓ Al día
                  </span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1 text-relief-3d">
                Centro de Notificaciones Académicas
              </h1>
              <p className="text-xs sm:text-sm text-teal-100/80 mt-1 max-w-2xl leading-relaxed">
                {rol === 'estudiante'
                  ? 'Entérate al instante de evaluaciones próximas a vencer, cuestionarios asignados y nuevas tareas publicadas por tus docentes.'
                  : 'Supervisa los avisos académicos del período lectivo, tareas activas y evaluaciones de cursos.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#073038] hover:bg-[#0a3d47] border border-[#104d5b] text-teal-200 hover:text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <CheckCheck className="w-3.5 h-3.5 text-cyan-400" />
                <span>Marcar todas como leídas</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-md"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Menú</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter and View Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#062c34] border border-[#115260] p-3 rounded-2xl shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              filterType === 'all'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842]'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            <span>Todas ({showRead ? allNotifications.length : pendingNotifications.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('exams')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              filterType === 'exams'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Exámenes ({examNotifications.filter(e => showRead || !readNotifIds.includes(e.id)).length})</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterType('tasks')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ${
              filterType === 'tasks'
                ? 'bg-cyan-500 border-cyan-400 text-slate-950 shadow'
                : 'bg-[#072d35] border-[#104b58] text-teal-100 hover:bg-[#0a3842]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tareas ({taskNotifications.filter(t => showRead || !readNotifIds.includes(t.id)).length})</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowRead(prev => !prev)}
          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer self-start sm:self-auto border ${
            showRead
              ? 'bg-teal-500/20 border-teal-400 text-teal-200'
              : 'bg-[#072d35] border-[#104b58] text-teal-200/80 hover:text-white'
          }`}
        >
          {showRead ? 'Ocultar notificaciones leídas' : `Ver historial de leídas (${readNotifIds.length})`}
        </button>
      </div>

      {/* Notifications List */}
      {displayedList.length === 0 ? (
        <div className="py-16 px-6 text-center rounded-3xl bg-[#062c34]/50 border border-[#11505e] flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-full bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-center text-emerald-400 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Check className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {showRead
              ? 'No hay notificaciones en el historial seleccionado'
              : '¡Estás totalmente al día! No tienes notificaciones pendientes'}
          </h3>
          <p className="text-xs text-teal-200/70 max-w-md leading-relaxed mb-4">
            {showRead
              ? 'Las notificaciones marcadas como leídas aparecerán en este panel.'
              : 'Cuando tus docentes publiquen un nuevo examen o tarea para tu semestre, la alerta aparecerá inmediatamente aquí.'}
          </p>
          {!showRead && readNotifIds.length > 0 && (
            <button
              type="button"
              onClick={() => setShowRead(true)}
              className="text-xs font-bold text-cyan-300 hover:underline cursor-pointer"
            >
              Revisar historial de {readNotifIds.length} alertas leídas →
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedList.map(item => {
            const isRead = readNotifIds.includes(item.id);
            const isExam = item.type === 'exam';

            return (
              <div
                key={item.id}
                className={`rounded-2xl border transition-all duration-200 p-4.5 flex flex-col justify-between shadow-md relative group ${
                  isRead
                    ? 'bg-[#05242a]/70 border-[#0d3f4a] opacity-75'
                    : item.urgency === 'urgent'
                      ? 'bg-gradient-to-br from-[#072d35] via-[#09353e] to-[#0e3a44] border-rose-500/50 hover:border-rose-400'
                      : 'bg-gradient-to-br from-[#072d35] to-[#093740] border-[#115260] hover:border-cyan-400/80'
                }`}
              >
                <div>
                  {/* Card Header: Subject & Urgency Badge */}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-[#041c21] text-cyan-300 border border-[#0f4652] truncate max-w-[170px]">
                      {item.subjectName}
                    </span>

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
                  <h3 className="text-sm font-bold text-white group-hover:text-cyan-200 transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h3>

                  {/* Subtitle */}
                  {item.subtitle && (
                    <p className="text-xs text-teal-200/70 mt-1 line-clamp-2 leading-relaxed">
                      {item.subtitle}
                    </p>
                  )}
                </div>

                {/* Footer with date / limit and CTA */}
                <div className="pt-3.5 border-t border-[#0e4450] flex items-center justify-between gap-2 mt-4">
                  <div className="text-[11px] text-teal-200/80 font-medium truncate">
                    {isExam ? (
                      <span className="flex items-center gap-1 text-cyan-300">
                        <Clock className="w-3 h-3 text-cyan-400" />
                        <span>{item.dueLabel}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-400" />
                        <span className={item.urgency === 'urgent' ? 'text-rose-300 font-bold' : 'text-teal-200/90'}>
                          {item.dueLabel}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRead(item.id)}
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
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white'
                          : 'bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950'
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
  );
}
