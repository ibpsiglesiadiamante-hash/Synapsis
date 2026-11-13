/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  GraduationCap, BookOpen, Calendar, 
  FileText, CheckCircle, Search, ArrowRight, ShieldCheck, BarChart3, Layers
} from 'lucide-react';
import { User, Subject, Semester, Exam } from '../types';
import { 
  getUserAssignedSubjects, 
  getAllMatchingUserIds, 
  resolveStudentSemester, 
  normalizeString,
  avatarColor, 
  avatarLetter 
} from '../lib/db';

interface MisMateriasProps {
  currentUser: User;
  subjects: Subject[];
  semesters: Semester[];
  users: User[];
  exams: Exam[];
  onNavigate: (tab: string) => void;
  onTakeExam?: (examId: string) => void;
}

export default function MisMaterias({
  currentUser,
  subjects = [],
  semesters = [],
  users = [],
  exams = [],
  onNavigate,
  onTakeExam,
}: MisMateriasProps) {
  const [query, setQuery] = useState('');
  const isAdmin = currentUser.rol === 'admin';
  const isDocente = currentUser.rol === 'docente';
  const isStaff = isAdmin || isDocente;

  const [adminScope, setAdminScope] = useState<'asignadas' | 'todas'>('asignadas');

  const studentSemObj = resolveStudentSemester(currentUser.semestre, semesters);
  const studentSemName = studentSemObj?.nombre || currentUser.semestre || 'Semestre Actual';

  const matchingUserIds = new Set(getAllMatchingUserIds(currentUser, users));
  const assignedSubjects = getUserAssignedSubjects(currentUser, subjects, semesters, users);

  const displayedBaseSubjects = (isAdmin && adminScope === 'todas')
    ? subjects
    : assignedSubjects;

  const filteredSubjects = displayedBaseSubjects.filter(s => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    const doc = users.find(u => u.id === s.docenteId);
    return (
      (s.nombre || '').toLowerCase().includes(q) ||
      (s.codigo || '').toLowerCase().includes(q) ||
      (s.nivel || '').toLowerCase().includes(q) ||
      (s.semestre || '').toLowerCase().includes(q) ||
      (doc?.nombre || '').toLowerCase().includes(q)
    );
  });

  const roleBadgeLabel = isAdmin
    ? 'Administrador Institucional'
    : isDocente
      ? 'Docente Titular'
      : 'Estudiante Oficial';

  const headerTitle = isStaff
    ? (isAdmin && adminScope === 'todas' ? 'Catálogo Completo de Asignaturas' : 'Mis Asignaturas Asignadas')
    : 'Mis Asignaturas Matriculadas';

  const headerSubtitle = isAdmin
    ? 'Visualiza las asignaturas asignadas a tu carga académica o consulta todo el plan de estudios.'
    : isDocente
      ? 'Consulta las asignaturas vinculadas a tu perfil docente, revisa sus exámenes y calificaciones.'
      : 'Consulta las asignaturas oficiales vinculadas a tu matrícula institucional y accede a sus evaluaciones.';

  const bannerSubtitle = isAdmin
    ? `Gestión Académica y Carga Docente · ${assignedSubjects.length} ${assignedSubjects.length === 1 ? 'asignatura asignada' : 'asignaturas asignadas'}`
    : isDocente
      ? `Cuerpo Docente Titular · ${assignedSubjects.length} ${assignedSubjects.length === 1 ? 'asignatura a cargo' : 'asignaturas a cargo'}`
      : `${studentSemName}${studentSemObj?.nivel ? ` · ${studentSemObj.nivel}` : ''}`;

  return (
    <div className="page-misMaterias animate-fade-in pb-12 font-sans text-left">
      {/* Header */}
      <div className="page-header mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="page-title text-2xl font-black tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
            {headerTitle}
          </h2>
          <p className="page-sub text-sm font-medium mt-1 text-slate-500">
            {headerSubtitle}
          </p>
        </div>

        {isStaff && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('asignaturas')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold cursor-pointer transition"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Asignar en Plan de Estudios</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => onNavigate('miHistorial')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition shadow-xs"
            >
              <BarChart3 className="w-3.5 h-3.5 text-cyan-300" />
              <span>Ir a Mi Historial</span>
            </button>
          </div>
        )}
      </div>

      {/* Role Banner */}
      <div className="mb-6 p-5 md:p-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pointer-events-none pr-6">
          {isStaff ? <ShieldCheck className="w-56 h-56 text-white" /> : <GraduationCap className="w-56 h-56 text-white" />}
        </div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-md border-2 border-white/20 shrink-0"
              style={{ backgroundColor: avatarColor(currentUser.nombre) }}
            >
              {avatarLetter(currentUser.nombre)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-100 bg-white/15 px-2.5 py-0.5 rounded-full backdrop-blur-xs border border-white/10">
                  {roleBadgeLabel}
                </span>
                {currentUser.codigo && (
                  <span className="text-xs font-mono font-bold text-amber-300 bg-amber-950/40 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                    Cód: {currentUser.codigo}
                  </span>
                )}
              </div>
              <h3 className="text-xl md:text-2xl font-black mt-1 tracking-tight text-white">
                {currentUser.nombre}
              </h3>
              <p className="text-xs md:text-sm text-indigo-200 font-medium mt-0.5">
                {bannerSubtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3.5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 text-center min-w-[115px]">
              <span className="block text-2xl font-black text-white">{displayedBaseSubjects.length}</span>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-200">
                {displayedBaseSubjects.length === 1 ? 'Materia' : 'Materias'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Scope Switcher */}
      {isAdmin && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button
            type="button"
            onClick={() => setAdminScope('asignadas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              adminScope === 'asignadas'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Mis Materias Asignadas ({assignedSubjects.length})
          </button>
          <button
            type="button"
            onClick={() => setAdminScope('todas')}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${
              adminScope === 'todas'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            Todas las Materias del Pensum ({subjects.length})
          </button>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar por nombre, código, semestre o docente..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full text-xs sm:text-sm p-3 pl-9 rounded-2xl border border-slate-200 bg-white shadow-xs focus:outline-indigo-600 focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
        </div>
        <div className="text-xs text-slate-500 font-semibold">
          Mostrando <strong className="text-slate-800">{filteredSubjects.length}</strong> de {displayedBaseSubjects.length} asignaturas
        </div>
      </div>

      {/* Subjects Grid */}
      {displayedBaseSubjects.length === 0 ? (
        <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">
            {isStaff
              ? 'No tienes asignaturas asignadas directamente aún'
              : 'No tienes materias asignadas actualmente'}
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            {isAdmin
              ? 'Asigna un docente o administrador desde el módulo "Asignaturas" o "Usuarios", o consulta todo el catálogo institucional.'
              : isDocente
                ? 'Solicita a la coordinación administrativa que seleccione tu nombre como docente encargado en el módulo de Asignaturas o Usuarios.'
                : 'Comunícate con la coordinación académica o el docente encargado para que te asigne tus asignaturas correspondientes a tu ciclo de formación.'}
          </p>
          {isAdmin && (
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <button
                type="button"
                onClick={() => setAdminScope('todas')}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold cursor-pointer transition shadow-xs"
              >
                Ver todas las {subjects.length} materias del pensum
              </button>
              <button
                type="button"
                onClick={() => onNavigate('asignaturas')}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition"
              >
                Ir a Asignar Materias
              </button>
            </div>
          )}
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="p-8 bg-slate-50 rounded-2xl text-center text-xs text-slate-500">
          No se encontraron asignaturas que coincidan con &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubjects.map(sub => {
            const docenteObj = users.find(u => u.id === sub.docenteId);
            const isAssignedToMe = Boolean(
              (sub.docenteId && matchingUserIds.has(sub.docenteId)) ||
              assignedSubjects.some(asg => asg.id === sub.id)
            );
            const subNameNorm = normalizeString(sub.nombre);
            const subExams = exams.filter(e =>
              e.materia === sub.id || normalizeString(e.materia) === subNameNorm
            );
            const activeSubExams = subExams.filter(e => e.estado === 'activo');

            return (
              <div 
                key={sub.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-150 uppercase tracking-wider">
                      {sub.codigo || 'ASG'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <CheckCircle className="w-3 h-3" /> {isStaff && isAssignedToMe ? 'Asignada' : 'Activa'}
                    </span>
                  </div>

                  <h3 className="text-base font-extrabold text-slate-900 group-hover:text-indigo-600 transition-colors leading-snug">
                    {sub.nombre}
                  </h3>

                  <div className="mt-2 space-y-1 text-xs text-slate-500 font-medium">
                    {sub.semestre && (
                      <p className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{sub.semestre}</span>
                      </p>
                    )}
                    {sub.nivel && (
                      <p className="text-[11px] text-slate-400 line-clamp-1">
                        {sub.nivel}
                      </p>
                    )}
                    {docenteObj ? (
                      <div className="flex items-center gap-2 pt-2 mt-2 border-t border-slate-100">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                          style={{ backgroundColor: avatarColor(docenteObj.nombre) }}
                        >
                          {avatarLetter(docenteObj.nombre)}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 truncate">
                          Prof. {docenteObj.nombre}
                        </span>
                      </div>
                    ) : isStaff && isAssignedToMe ? (
                      <div className="flex items-center gap-2 pt-2 mt-2 border-t border-slate-100">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white shrink-0"
                          style={{ backgroundColor: avatarColor(currentUser.nombre) }}
                        >
                          {avatarLetter(currentUser.nombre)}
                        </div>
                        <span className="text-xs font-semibold text-indigo-700 truncate">
                          Asignada a {currentUser.nombre}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>
                      {isStaff
                        ? `${subExams.length} ${subExams.length === 1 ? 'examen' : 'exámenes'} (${activeSubExams.length} act.)`
                        : `${activeSubExams.length} ${activeSubExams.length === 1 ? 'examen activo' : 'exámenes activos'}`}
                    </span>
                  </span>

                  {isStaff ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onNavigate('resultados')}
                        className="text-[11px] font-bold text-slate-600 hover:text-indigo-700 px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 cursor-pointer transition"
                      >
                        Resultados
                      </button>
                      <button
                        type="button"
                        onClick={() => onNavigate('misExamenes')}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer group-hover:translate-x-0.5 transition"
                      >
                        <span>Exámenes</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (activeSubExams.length > 0 && onTakeExam) {
                          onTakeExam(activeSubExams[0].id);
                        } else {
                          onNavigate('misExamenesTake');
                        }
                      }}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer group-hover:translate-x-0.5 transition"
                    >
                      <span>{activeSubExams.length > 0 ? 'Presentar' : 'Ver exámenes'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

