/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  HelpCircle, 
  User as UserIcon, 
  Lock, 
  LogOut, 
  Menu, 
  Sparkles,
  School
} from 'lucide-react';

import { 
  User, 
  Exam, 
  Submission, 
  Institution, 
  Subject, 
  Semester, 
  Parcial, 
  GradeRecord, 
  Assignment 
} from './types';

import { 
  getInitialState, 
  saveState, 
  avatarColor, 
  avatarLetter 
} from './lib/db';
import { bioCosmicSynth } from './lib/audioEngine';
import { 
  fetchFullStateFromFirestore, 
  seedFirestore, 
  syncToFirestore, 
  initializeSyncCache 
} from './lib/firebase';

import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import MisExamenes from './components/MisExamenes';
import ExamBuilder from './components/ExamBuilder';
import Resultados from './components/Resultados';
import MisExamenesTake from './components/MisExamenesTake';
import ExamTakeScreen from './components/ExamTakeScreen';
import MiHistorial from './components/MiHistorial';
import Usuarios from './components/Usuarios';
import Instituciones from './components/Instituciones';
import Asignaturas from './components/Asignaturas';
import Semestres from './components/Semestres';
import Parciales from './components/Parciales';
import RegistroNotas from './components/RegistroNotas';
import Trabajos from './components/Trabajos';
import HistorialAcademico from './components/HistorialAcademico';
import Estudiantes from './components/Estudiantes';
import Asistencia from './components/Asistencia';
import Boletines from './components/Boletines';
import Agenda from './components/Agenda';
import Tablon from './components/Tablon';
import Finanzas from './components/Finanzas';

export default function App() {
  // Database States
  const [db, setDb] = useState(() => getInitialState());
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(true);

  // Download entire Synapsis Portal database on mount
  useEffect(() => {
    async function loadFirestoreData() {
      try {
        console.log('Loading Synapsis portal database from Firestore...');
        const remoteDb = await fetchFullStateFromFirestore();
        if (remoteDb) {
          console.log('Successfully loaded state from Cloud Firestore.');
          setDb(remoteDb);
          initializeSyncCache(remoteDb);
        } else {
          // No remote database found, let's seed with current default list
          console.log('Firestore dataset is empty. Writing initial educational seed...');
          const localSeed = getInitialState();
          await seedFirestore(localSeed);
          setDb(localSeed);
          initializeSyncCache(localSeed);
        }
      } catch (err) {
        console.error('Error synchronizing with Cloud Firestore, running standalone.', err);
      } finally {
        setIsFirebaseLoading(false);
      }
    }
    loadFirestoreData();
  }, []);

  // App Session States
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('instituto_currentUser');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });

  // UI States
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<'theme-default' | 'theme-gray' | 'theme-blue' | 'theme-cosmos'>(() => {
    const saved = localStorage.getItem('synapsis-theme');
    return (saved as 'theme-default' | 'theme-gray' | 'theme-blue' | 'theme-cosmos') || 'theme-default';
  });

  // Automatically start bio-cosmic soundtrack when theme is theme-cosmos under interaction bounds, or mute otherwise
  useEffect(() => {
    if (theme === 'theme-cosmos') {
      bioCosmicSynth.togglePlay(true);
    } else {
      bioCosmicSynth.togglePlay(false);
    }
  }, [theme]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' } | null>(null);
  const [activeTakeExamId, setActiveTakeExamId] = useState<string | null>(null);
  const [activeEditExamId, setActiveEditExamId] = useState<string | null>(null);

  // Login form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // Persist DB state changes to local storage & Cloud Firestore
  useEffect(() => {
    saveState(db);
    if (!isFirebaseLoading) {
      syncToFirestore(db);
    }
  }, [db, isFirebaseLoading]);

  // Persist current theme
  useEffect(() => {
    localStorage.setItem('synapsis-theme', theme);
  }, [theme]);

  // Adjust theme class on html/body element
  useEffect(() => {
    document.body.className = `${theme} font-sans min-h-screen transition-all duration-200`;
  }, [theme]);

  // Quick helper toast
  const showToast = (msg: string, type: 'success' | 'error' | 'warning') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 3800);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = loginEmail.trim().toLowerCase();
    const cleanPass = loginPass.trim();

    const matchedUser = db.users.find(u => u.email.toLowerCase() === cleanEmail && u.pass === cleanPass);
    if (!matchedUser) {
      showToast('Credenciales incorrectas. Verifica el correo y la contraseña.', 'error');
      return;
    }

    setCurrentUser(matchedUser);
    localStorage.setItem('instituto_currentUser', JSON.stringify(matchedUser));
    
    // Set landing tab based on role
    if (matchedUser.rol === 'admin' || matchedUser.rol === 'docente') {
      setActiveTab('dashboard');
    } else {
      setActiveTab('dashboard');
    }

    showToast(`¡Bienvenido al sistema, ${matchedUser.nombre}!`, 'success');
  };

  const handleQuickLogin = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPass(pass);
    setTimeout(() => {
      const matchedUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.pass === pass);
      if (matchedUser) {
        setCurrentUser(matchedUser);
        localStorage.setItem('instituto_currentUser', JSON.stringify(matchedUser));
        setActiveTab('dashboard');
        showToast(`¡Sesión rápida iniciada: ${matchedUser.nombre}!`, 'success');
      }
    }, 100);
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('instituto_currentUser');
    setActiveTakeExamId(null);
    setActiveEditExamId(null);
    showToast('Sesión cerrada correctamente', 'success');
  };

  // State Updates proxies to keep master DB in sync
  const updateUsers = (next: User[]) => setDb(prev => ({ ...prev, users: next }));
  const updateInstitutions = (next: Institution[]) => setDb(prev => ({ ...prev, institutions: next }));
  const updateSubjects = (next: Subject[]) => setDb(prev => ({ ...prev, subjects: next }));
  const updateSemesters = (next: Semester[]) => setDb(prev => ({ ...prev, semesters: next }));
  const updateParciales = (next: Parcial[]) => setDb(prev => ({ ...prev, parciales: next }));
  const updateExams = (next: Exam[]) => setDb(prev => ({ ...prev, exams: next }));
  const updateSubmissions = (next: Submission[]) => setDb(prev => ({ ...prev, submissions: next }));
  const updateGradeRecords = (next: GradeRecord[]) => setDb(prev => ({ ...prev, gradeRecords: next }));
  const updateAssignments = (next: Assignment[]) => setDb(prev => ({ ...prev, assignments: next }));

  // Dynamic panel mapper
  const renderActivePanel = () => {
    if (!currentUser) return null;

    if (activeEditExamId) {
      return (
        <ExamBuilder
          examId={activeEditExamId}
          exams={db.exams}
          parciales={db.parciales}
          onBack={() => setActiveEditExamId(null)}
          onUpdateExams={updateExams}
          toast={showToast}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard 
            currentUser={currentUser}
            users={db.users}
            exams={db.exams}
            submissions={db.submissions}
            theme={theme}
            onNavigate={(page) => {
              setActiveTab(page);
              setActiveEditExamId(null);
            }}
            onTakeExam={(examId) => setActiveTakeExamId(examId)}
          />
        );
      case 'misExamenes':
        return (
          <MisExamenes
            currentUser={currentUser}
            exams={db.exams}
            parciales={db.parciales}
            subjects={db.subjects}
            semesters={db.semesters}
            submissions={db.submissions}
            onOpenBuilder={(id) => setActiveEditExamId(id)}
            onUpdateExams={updateExams}
            toast={showToast}
          />
        );
      case 'resultados':
        return (
          <Resultados
            currentUser={currentUser}
            users={db.users}
            exams={db.exams}
            submissions={db.submissions}
            onUpdateSubmissions={updateSubmissions}
            toast={showToast}
          />
        );
      case 'misExamenesTake':
        return (
          <MisExamenesTake
            currentUser={currentUser}
            exams={db.exams}
            submissions={db.submissions}
            onTakeExam={(id) => setActiveTakeExamId(id)}
          />
        );
      case 'miHistorial':
        return (
          <MiHistorial
            currentUser={currentUser}
            exams={db.exams}
            submissions={db.submissions}
          />
        );
      case 'usuarios':
        return (
          <Usuarios
            currentUser={currentUser}
            users={db.users}
            onUpdateUsers={updateUsers}
            toast={showToast}
          />
        );
      case 'instituciones':
        return (
          <Instituciones
            instituciones={db.institutions}
            onUpdateInstituciones={updateInstitutions}
            toast={showToast}
          />
        );
      case 'asignaturas':
        return (
          <Asignaturas
            subjects={db.subjects}
            users={db.users}
            onUpdateSubjects={updateSubjects}
            toast={showToast}
          />
        );
      case 'semestres':
        return (
          <Semestres
            semesters={db.semesters}
            onUpdateSemesters={updateSemesters}
            toast={showToast}
          />
        );
      case 'parciales':
        return (
          <Parciales
            parciales={db.parciales}
            semesters={db.semesters}
            subjects={db.subjects}
            onUpdateParciales={updateParciales}
            toast={showToast}
          />
        );
      case 'registroNotas':
        return (
          <RegistroNotas
            gradeRecords={db.gradeRecords}
            users={db.users}
            subjects={db.subjects}
            parciales={db.parciales}
            onUpdateGradeRecords={updateGradeRecords}
            toast={showToast}
          />
        );
      case 'trabajos':
        return (
          <Trabajos
            currentUser={currentUser}
            assignments={db.assignments}
            parciales={db.parciales}
            subjects={db.subjects}
            onUpdateAssignments={updateAssignments}
            toast={showToast}
          />
        );
      case 'historialAcademico':
        return (
          <HistorialAcademico
            users={db.users}
            exams={db.exams}
            submissions={db.submissions}
            gradeRecords={db.gradeRecords}
            subjects={db.subjects}
            parciales={db.parciales}
          />
        );
      case 'estudiantes':
        return (
          <Estudiantes
            users={db.users}
            onUpdateUsers={updateUsers}
            onNavigateToHistory={(stId) => {
              // Quick linkage
              setActiveTab('historialAcademico');
              // Let the browser context know
              showToast('Mostrando ficha del estudiante seleccionado', 'success');
            }}
            toast={showToast}
          />
        );
      case 'asistencia':
        return (
          <Asistencia
            currentUser={currentUser}
            users={db.users}
            subjects={db.subjects}
            semesters={db.semesters}
            toast={showToast}
          />
        );
      case 'boletines':
        return (
          <Boletines
            gradeRecords={db.gradeRecords}
            users={db.users}
            subjects={db.subjects}
            semesters={db.semesters}
            parciales={db.parciales}
            toast={showToast}
            currentUser={currentUser}
          />
        );
      case 'agenda':
        return (
          <Agenda
            currentUser={currentUser}
            users={db.users}
            subjects={db.subjects}
            semesters={db.semesters}
            toast={showToast}
          />
        );
      case 'tablon':
        return (
          <Tablon
            currentUser={currentUser}
            users={db.users}
            toast={showToast}
          />
        );
      case 'finanzas':
        return (
          <Finanzas
            currentUser={currentUser}
            users={db.users}
            toast={showToast}
          />
        );
      default:
        return <div className="p-6">Página aún no implementada: {activeTab}</div>;
    }
  };

  // RENDER APP
  if (isFirebaseLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative overflow-hidden text-center p-6 select-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(6,182,212,0.15),transparent_60%)] pointer-events-none" />
        {/* Repeating star background simulation */}
        <div className="stars-overlay !opacity-55" />
        
        <div className="w-14 h-14 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mb-6 shadow-[0_0_20px_rgba(6,182,212,0.4)]" />
        
        <h1 className="text-2xl font-extrabold text-white tracking-wide font-sans">Portal Synapsis</h1>
        <p className="text-cyan-400 font-mono text-[10px] tracking-widest uppercase mt-2">Sincronizando con Cloud Firestore...</p>
        <p className="text-slate-500 text-xs mt-4 leading-relaxed max-w-xs font-medium">Estableciendo canal intelectual bio-cósmico seguro con el servidor de la nube.</p>
      </div>
    );
  }

  return (
    <div className="app-root relative font-sans antialiased text-slate-800">
      
      {/* Stars Background Overlay for Cosmos Theme */}
      <div className="stars-overlay" />
      
      {/* GLOBAL TOAST ALERTS */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[300] animate-bounce">
          <div className={`px-5 py-3 rounded-2xl shadow-xl flex items-center gap-2 border text-sm font-semibold select-none ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
              : toast.type === 'error' 
                ? 'bg-rose-50 text-rose-800 border-rose-220 font-bold' 
                : 'bg-amber-50 text-amber-800 border-amber-250'
          }`}>
            <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : '⚠'}</span>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* RENDER LOGIN IF NO SESSION */}
      {!currentUser ? (
        <div id="loginPage" className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-950 relative overflow-hidden flex-col">
          {/* Nebula dust effects on Login container */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(6,182,212,0.15),transparent_50%)] pointer-events-none" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(16,185,129,0.12),transparent_50%)] pointer-events-none" />
          <div className="stars-overlay !opacity-50" />

          <div className="w-full max-w-sm bg-slate-900/75 backdrop-blur-md rounded-3xl shadow-2xl border border-slate-800/80 p-6 sm:p-8 flex flex-col text-center animate-fade-in relative overflow-hidden">
            
            {/* Header Brand */}
            <div className="mx-auto w-12 h-12 bg-gradient-to-tr from-cyan-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-4 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)] animate-pulse">
              <School className="w-6 h-6 text-white" />
            </div>

            <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight font-sans">
              Synapsis
            </h1>
            <p className="text-[11px] text-cyan-400 font-bold mt-1 tracking-widest uppercase font-mono">
              Portal Bio-Cósmico
            </p>
            <p className="text-xs text-slate-400 font-medium mt-2 max-w-[240px] mx-auto leading-relaxed">
              Descubre, aprende y evalúa en conexión con el universo y el conocimiento
            </p>

            <form onSubmit={handleLogin} className="mt-6 space-y-4 text-left">
              <div className="form-group">
                <label className="text-[10px] font-bold text-slate-405 uppercase tracking-wider block mb-1 font-sans">Correo institucional</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-501" />
                  <input 
                    type="email" 
                    required
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="ej: admin@synapsis.edu"
                    className="w-full pl-9 p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/60 text-white text-sm outline-none focus:border-cyan-500 placeholder-slate-500"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="text-[10px] font-bold text-slate-405 uppercase tracking-wider block mb-1 font-sans">Contraseña única</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-551" />
                  <input 
                    type="password" 
                    required
                    value={loginPass}
                    onChange={e => setLoginPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 p-2.5 rounded-xl border border-slate-800/80 bg-slate-950/60 text-white text-sm outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button 
                type="submit" 
                className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 p-3 text-white rounded-xl font-bold tracking-wide mt-3 text-sm shadow-[0_0_15px_rgba(6,182,212,0.15)] transform active:scale-95 transition-all duration-200 cursor-pointer"
              >
                Iniciar sesión portal
              </button>
            </form>

            {/* Quick credentials options to facilitate evaluations */}
            <div className="mt-6 pt-5 border-t border-slate-800/80 text-left">
              <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest block mb-2.5 text-center font-mono">Simuladores de Acceso</span>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <button 
                  onClick={() => handleQuickLogin('admin@synapsis.edu', 'admin123')}
                  className="p-1 px-1.5 rounded-lg border border-slate-800 bg-slate-950 text-cyan-400 hover:text-cyan-300 hover:border-cyan-800/80 tracking-tight text-[10px] font-bold transition-all cursor-pointer"
                >
                  Admin
                </button>
                <button 
                  onClick={() => handleQuickLogin('juan.docente@synapsis.edu', 'docente123')}
                  className="p-1 px-1.5 rounded-lg border border-slate-800 bg-slate-950 text-emerald-400 hover:text-emerald-300 hover:border-emerald-800/80 tracking-tight text-[10px] font-bold transition-all cursor-pointer"
                >
                  Docente
                </button>
                <button 
                  onClick={() => handleQuickLogin('maria.estudiante@synapsis.edu', 'estudiante123')}
                  className="p-1 px-1.5 rounded-lg border border-slate-800 bg-slate-950 text-purple-400 hover:text-purple-300 hover:border-purple-800/80 tracking-tight text-[10px] font-bold transition-all cursor-pointer"
                >
                  Estudiante
                </button>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* ENTIRE APPLICATION DASHBOARD VIEWPORT LAYOUT */
        <div className="min-h-screen flex flex-col">
          
          {/* HEADER ROW */}
          <Header 
            currentUser={currentUser} 
            theme={theme}
            onThemeChange={setTheme}
            onLogout={handleLogout}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(prev => !prev)}
          />

          <div className="flex-1 flex relative pt-[60px]">
            
            {/* BACKDROP FOR MOBILE SCREEN OVERLAY */}
            {sidebarOpen && (
              <div 
                className="fixed inset-0 bg-black/35 z-30 md:hidden backdrop-blur-[1.5px] transition-opacity duration-300 pointer-events-auto"
                onClick={() => setSidebarOpen(false)}
              />
            )}

            {/* SIDEBAR NAVIGATION COLUMN */}
            <Sidebar 
              currentUser={currentUser}
              activePage={activeTab}
              isOpen={sidebarOpen}
              onClose={() => setSidebarOpen(false)}
              onPageChange={(tab) => {
                setActiveTab(tab);
                setActiveEditExamId(null); // clear builder state on page navigate
                if (window.innerWidth < 768) {
                  setSidebarOpen(false);
                }
              }}
            />

            {/* MAIN CONTENT WORKSPACE */}
            <main className={`flex-1 p-4 md:p-6.5 bg-slate-50 max-w-full overflow-x-hidden relative transition-all duration-300 ease-in-out ${
              sidebarOpen ? 'md:pl-[266px]' : ''
            }`}>
              {renderActivePanel()}
            </main>
          </div>

          {/* ACTIVE TEST OVERLAY TAKING PORTAL PANEL */}
          {activeTakeExamId && (
            <ExamTakeScreen
              examId={activeTakeExamId}
              exams={db.exams}
              institutions={db.institutions}
              parciales={db.parciales}
              subjects={db.subjects}
              semesters={db.semesters}
              currentUser={currentUser}
              onExit={() => setActiveTakeExamId(null)}
              onSubmit={(sub) => {
                // Prepend new submittal
                const nextSubs = [sub, ...db.submissions];
                updateSubmissions(nextSubs);
                showToast('Examen enviado y guardado correctamente en la base de datos', 'success');
              }}
              toast={showToast}
            />
          )}

        </div>
      )}

    </div>
  );
}
