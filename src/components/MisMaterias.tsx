/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  GraduationCap, BookOpen, User as UserIcon, Calendar, 
  FileText, CheckCircle, Search, ArrowRight, ShieldCheck, Sparkles 
} from 'lucide-react';
import { User, Subject, Semester, Exam } from '../types';
import { getStudentAssignedSubjects, resolveStudentSemester, avatarColor, avatarLetter } from '../lib/db';

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

  const studentSemObj = resolveStudentSemester(currentUser.semestre, semesters);
  const studentSemName = studentSemObj?.nombre || currentUser.semestre || 'Semestre Actual';

  const assignedSubjects = getStudentAssignedSubjects(currentUser, subjects, semesters);

  const filteredSubjects = assignedSubjects.filter(s => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return s.nombre.toLowerCase().includes(q) || (s.codigo || '').toLowerCase().includes(q) || (s.nivel || '').toLowerCase().includes(q);
  });

  return (
    <div className="page-misMaterias animate-fade-in pb-12 font-sans text-left">
      {/* Header */}
      <div className="page-header mb-6">
        <h2 className="page-title text-2xl font-black tracking-tight text-slate-900" style={{ color: 'var(--gray-900)' }}>
          Mis Asignaturas Matriculadas
        </h2>
        <p className="page-sub text-sm font-medium mt-1 text-slate-500">
          Consulta las asignaturas oficiales vinculadas a tu matrícula institucional y accede a sus evaluaciones.
        </p>
      </div>

      {/* Student Banner */}
      <div className="mb-6 p-5 md:p-6 bg-gradient-to-r from-indigo-700 via-indigo-800 to-indigo-900 rounded-3xl text-white shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center pointer-events-none pr-6">
          <GraduationCap className="w-56 h-56 text-white" />
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
                <span className="text-xs uppercase tracking-wider font-extrabold text-indigo-200 bg-white/10 px-2.5 py-0.5 rounded-full backdrop-blur-xs">
                  Estudiante Oficial
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
                {studentSemName} {studentSemObj?.nivel ? `· ${studentSemObj.nivel}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-3.5 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 text-center min-w-[110px]">
              <span className="block text-2xl font-black text-white">{assignedSubjects.length}</span>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-indigo-200">
                {assignedSubjects.length === 1 ? 'Materia' : 'Materias'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="Buscar por nombre, código o nivel..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full text-xs sm:text-sm p-3 pl-9 rounded-2xl border border-slate-200 bg-white shadow-xs focus:outline-indigo-600 focus:bg-white transition"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
        </div>
        <div className="text-xs text-slate-500 font-semibold">
          Mostrando <strong className="text-slate-800">{filteredSubjects.length}</strong> de {assignedSubjects.length} asignaturas
        </div>
      </div>

      {/* Subjects Grid */}
      {assignedSubjects.length === 0 ? (
        <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-base font-bold text-slate-800">No tienes materias asignadas actualmente</h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
            Comunícate con la coordinación académica o el docente encargado para que te asigne tus asignaturas correspondientes a tu ciclo de formación.
          </p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <div className="p-8 bg-slate-50 rounded-2xl text-center text-xs text-slate-500">
          No se encontraron asignaturas que coincidan con &ldquo;{query}&rdquo;.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredSubjects.map(sub => {
            const docenteObj = users.find(u => u.id === sub.docenteId);
            const activeSubExams = exams.filter(e => {
              if (e.estado !== 'activo') return false;
              return e.materia === sub.id || (e.materia || '').toLowerCase().trim() === sub.nombre.toLowerCase().trim();
            });

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
                      <CheckCircle className="w-3 h-3" /> Activa
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
                    {docenteObj && (
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
                    )}
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{activeSubExams.length} {activeSubExams.length === 1 ? 'examen activo' : 'exámenes activos'}</span>
                  </span>
                  <button
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
