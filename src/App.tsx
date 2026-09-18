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
  School,
  ChevronRight,
  QrCode,
  Eye,
  EyeOff,
  ShieldCheck,
  ArrowRight,
  BookOpen,
  Globe,
  UserPlus,
  CheckCircle2,
  Phone,
  CreditCard
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
  Assignment,
  AssignmentSubmission
} from './types';

import { 
  getInitialState, 
  saveState, 
  avatarColor, 
  avatarLetter,
  mergeStates,
  restoreBackupState,
  exportFullBackupState,
  validateAndParseBackup,
  uid,
  now,
  generateStudentCode
} from './lib/db';
import { bioCosmicSynth } from './lib/audioEngine';
import { 
  fetchFullStateFromFirestore, 
  seedFirestore, 
  syncToFirestore, 
  initializeSyncCache,
  fullBidirectionalSync,
  registerDeletedId,
  uploadTheologicalSubjectsToFirestore,
  uploadAllStudentsToFirestore,
  saveDocToFirestore
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
import Educativo from './components/Educativo';
import Biblia from './components/Biblia';
import ShareAppModal from './components/ShareAppModal';

export default function App() {
  // Database States
  const [db, setDb] = useState(() => getInitialState());
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);

  // Download entire Synapsis Portal database on mount in background
  useEffect(() => {
    async function loadFirestoreData() {
      try {
        console.log('Loading Synapsis portal database from Firestore...');
        const remoteDb = await fetchFullStateFromFirestore();
        if (remoteDb) {
          console.log('Successfully loaded state from Cloud Firestore.');
          const localDb = getInitialState();
          const mergedDb = mergeStates(localDb, remoteDb);
          setDb(mergedDb);
          saveState(mergedDb);
          initializeSyncCache(remoteDb);
          // Sync any newly restored or merged documents to Firestore
          syncToFirestore(mergedDb).catch(e => console.warn('Background sync error:', e));
          // Explicitly guarantee all 36 biblical subjects and all 53 students are saved to Firestore
          uploadTheologicalSubjectsToFirestore(mergedDb.subjects).catch(e => console.warn('Background subjects sync error:', e));
          uploadAllStudentsToFirestore(mergedDb.users).catch(e => console.warn('Background students sync error:', e));
        } else {
          // No remote database found, let's seed with current default list
          console.log('Firestore dataset is empty. Writing initial educational seed in background...');
          const localSeed = getInitialState();
          seedFirestore(localSeed).catch(e => console.warn('Background seed error:', e));
          uploadTheologicalSubjectsToFirestore(localSeed.subjects).catch(e => console.warn('Background subjects seed error:', e));
          uploadAllStudentsToFirestore(localSeed.users).catch(e => console.warn('Background students seed error:', e));
          setDb(localSeed);
          saveState(localSeed);
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
    try {
      const saved = localStorage.getItem('instituto_currentUser');
      if (saved) {
        const u = JSON.parse(saved);
        if (u && typeof u === 'object' && u.id && u.rol) {
          return u;
        }
      }
    } catch (e) {
      console.warn('Could not parse currentUser session:', e);
    }
    return null;
  });

  // UI States
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('synapsis_activeTab') || 'dashboard';
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('synapsis_sidebarOpen');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('synapsis_sidebarOpen', String(sidebarOpen));
  }, [sidebarOpen]);

  const [theme, setTheme] = useState<'theme-academia' | 'theme-cyber'>(() => {
    const saved = localStorage.getItem('synapsis-theme');
    if (saved === 'theme-cyber' || saved === 'theme-cosmos' || saved === 'theme-cosmos-contraste') {
      return 'theme-cyber';
    }
    return 'theme-academia';
  });

  // Automatically manage ambient soundtrack when theme changes
  useEffect(() => {
    if (theme !== 'theme-cyber') {
      bioCosmicSynth.togglePlay(false);
    }
  }, [theme]);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [activeTakeExamId, setActiveTakeExamId] = useState<string | null>(() => {
    return localStorage.getItem('synapsis_activeTakeExamId');
  });
  const [activeEditExamId, setActiveEditExamId] = useState<string | null>(() => {
    return localStorage.getItem('synapsis_activeEditExamId');
  });

  // Login & Registration form states
  const [loginTab, setLoginTab] = useState<'login' | 'register'>('login');
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // Student registration states
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regCelular, setRegCelular] = useState('');
  const [regSemestre, setRegSemestre] = useState('SEMESTRE I');
  const [regPass, setRegPass] = useState('');
  const [regShowPass, setRegShowPass] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // Persist current active tab and active exam actions
  useEffect(() => {
    localStorage.setItem('synapsis_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (activeTakeExamId) {
      localStorage.setItem('synapsis_activeTakeExamId', activeTakeExamId);
    } else {
      localStorage.removeItem('synapsis_activeTakeExamId');
    }
  }, [activeTakeExamId]);

  useEffect(() => {
    if (activeEditExamId) {
      localStorage.setItem('synapsis_activeEditExamId', activeEditExamId);
    } else {
      localStorage.removeItem('synapsis_activeEditExamId');
    }
  }, [activeEditExamId]);

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
    document.documentElement.className = theme;
  }, [theme]);

  // Quick helper toast
  const showToast = (msg: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast(null);
    }, 4200);
  };

  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  const handleManualSync = async () => {
    setIsSyncingFirebase(true);
    try {
      showToast('Sincronizando datos con Cloud Firestore...', 'info');
      const remoteDb = await fetchFullStateFromFirestore();
      if (remoteDb) {
        setDb(remoteDb);
        saveState(remoteDb);
        initializeSyncCache(remoteDb);
        showToast('¡Datos actualizados exitosamente desde Cloud Firestore! ✓', 'success');
        return;
      }
      const result = await fullBidirectionalSync(db);
      if (result && result.success) {
        setDb(result.mergedState);
        showToast(`¡Sincronización exitosa! ${result.pushedCount} registros sincronizados con Firebase.`, 'success');
        return result;
      } else {
        showToast('Aviso de sincronización: los datos continúan seguros localmente.', 'warning');
        return result;
      }
    } catch (err) {
      console.error('Manual sync failed', err);
      showToast('Error en la sincronización con Firebase.', 'error');
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      setIsSyncingFirebase(true);
      showToast('Restaurando copia de seguridad y sincronizando con Firebase...', 'info');
      const restored = restoreBackupState();
      setDb(restored);
      saveState(restored);
      initializeSyncCache(restored);
      await syncToFirestore(restored);
      showToast('¡Copia de seguridad restaurada y sincronizada en Firebase exitosamente!', 'success');
    } catch (err) {
      console.error('Failed to restore backup and sync to Firebase', err);
      showToast('Error al restaurar copia de seguridad en Firebase', 'error');
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleExportBackup = () => {
    try {
      exportFullBackupState(db);
      showToast('Copia de seguridad completa descargada con éxito', 'success');
    } catch (err) {
      console.error('Failed to export backup:', err);
      showToast('Error al descargar la copia de seguridad', 'error');
    }
  };

  const handleImportBackup = async (jsonString: string) => {
    try {
      setIsSyncingFirebase(true);
      showToast('Restaurando copia de seguridad...', 'info');
      const imported = validateAndParseBackup(jsonString);
      setDb(imported);
      saveState(imported);
      initializeSyncCache(imported);
      await syncToFirestore(imported);
      showToast(`¡Respaldo importado y sincronizado! (${imported.subjects?.length || 0} materias, ${imported.semesters?.length || 0} semestres, ${imported.users?.length || 0} usuarios)`, 'success');
    } catch (err) {
      console.error('Failed to import backup:', err);
      showToast('El archivo JSON de respaldo no tiene un formato válido', 'error');
      throw err;
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginEmail.trim().toLowerCase();
    const cleanPass = loginPass.trim();

    let matchedUser = db.users.find(u => {
      const userEmail = (u.email || '').trim().toLowerCase();
      const userCode = (u.codigo || '').trim().toLowerCase();
      const userCedula = (u.cedula || '').trim().toLowerCase();
      const userId = (u.id || '').trim().toLowerCase();
      const userIdShort = userId.substring(0, 4);

      const idMatch = userEmail === cleanId || 
                      userCode === cleanId || 
                      userCedula === cleanId || 
                      userId === cleanId ||
                      userIdShort === cleanId;

      const passMatch = u.pass === cleanPass || 
                        (u.pass || '').toLowerCase() === cleanPass.toLowerCase() || 
                        userCode === cleanPass.toLowerCase() ||
                        userCedula === cleanPass.toLowerCase();
      return idMatch && passMatch;
    });

    if (!matchedUser) {
      // Fallback self-healing system for demonstration/seed users
      const defaultUsers: User[] = [
        { id: 'admin-fallback-id', nombre: 'Administrador Synapsis', email: 'admin@synapsis.edu', pass: 'admin123', rol: 'admin', creado: new Date().toISOString() },
        { id: 'docente-fallback-id', nombre: 'Prof. de Jesús María García', email: 'juan.docente@synapsis.edu', pass: 'docente123', rol: 'docente', creado: new Date().toISOString() },
        { id: 'estudiante1-fallback-id', nombre: 'Carlos Andrés Pérez', email: 'maria.estudiante@synapsis.edu', pass: 'estudiante123', rol: 'estudiante', creado: new Date().toISOString() },
        { id: 'estudiante2-fallback-id', nombre: 'Ana Isabel Rodríguez', email: 'ana.estudiante@synapsis.edu', pass: 'estudiante123', rol: 'estudiante', creado: new Date().toISOString() },
      ];
      const fallbackUser = defaultUsers.find(u => {
        const userEmail = (u.email || '').trim().toLowerCase();
        const userCode = u.id.substring(0, 4).trim().toLowerCase();
        const passMatch = u.pass === cleanPass || 
                          (u.pass || '').toLowerCase() === cleanPass.toLowerCase() || 
                          userCode === cleanPass.toLowerCase();
        return (userEmail === cleanId || userCode === cleanId) && passMatch;
      });
      if (fallbackUser) {
        matchedUser = fallbackUser;
        updateUsers([...db.users, fallbackUser]);
      }
    }

    if (!matchedUser) {
      showToast('Credenciales incorrectas. Verifica tu correo, cédula o código y tu contraseña.', 'error');
      return;
    }

    setCurrentUser(matchedUser);
    localStorage.setItem('instituto_currentUser', JSON.stringify(matchedUser));
    
    // Set landing tab based on role
    setActiveTab('dashboard');
    showToast(`¡Bienvenido al sistema, ${matchedUser.nombre}!`, 'success');
  };

  const handleRegisterStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNombre.trim()) {
      showToast('Por favor escribe tu nombre completo', 'warning');
      return;
    }
    if (!regEmail.trim()) {
      showToast('Por favor escribe tu correo electrónico', 'warning');
      return;
    }
    if (!regPass.trim()) {
      showToast('Por favor define una contraseña de acceso', 'warning');
      return;
    }

    // Check if user already exists with this email or cedula
    const existing = db.users.find(u => {
      const eMatch = u.email && u.email.trim().toLowerCase() === regEmail.trim().toLowerCase();
      const cMatch = regCedula.trim() && u.cedula && u.cedula.trim() === regCedula.trim();
      return eMatch || cMatch;
    });

    if (existing) {
      showToast('Ya existe un estudiante registrado con este correo o documento. Inicia sesión directamente.', 'error');
      setLoginEmail(existing.email || regEmail);
      setLoginTab('login');
      return;
    }

    setIsRegistering(true);
    try {
      const newStudentCode = generateStudentCode();
      const newStudent: User = {
        id: uid(),
        nombre: regNombre.trim().toUpperCase(),
        email: regEmail.trim().toLowerCase(),
        pass: regPass.trim(),
        rol: 'estudiante',
        codigo: newStudentCode,
        cedula: regCedula.trim() || undefined,
        celular: regCelular.trim() || undefined,
        semestre: regSemestre || 'SEMESTRE I',
        creado: now(),
        actualizado: now()
      };

      const updatedUsers = [newStudent, ...db.users];
      updateUsers(updatedUsers);
      await saveDocToFirestore('users', newStudent).catch(err => {
        console.warn('Could not save registered student directly to Firestore:', err);
      });

      // Clear register form
      setRegNombre('');
      setRegEmail('');
      setRegCedula('');
      setRegCelular('');
      setRegPass('');

      // Automatically log in newly registered student
      setCurrentUser(newStudent);
      localStorage.setItem('instituto_currentUser', JSON.stringify(newStudent));
      setActiveTab('dashboard');
      showToast(`¡Matrícula confirmada con éxito! Tu código es ${newStudentCode}. ¡Bienvenido/a!`, 'success');
    } catch (err) {
      console.error('Error in student registration:', err);
      showToast('Ocurrió un error al procesar la matrícula. Inténtalo de nuevo.', 'error');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleQuickLogin = (email: string, pass: string) => {
    setLoginEmail(email);
    setLoginPass(pass);
    setTimeout(() => {
      const targetEmail = (email || '').toLowerCase();
      let matchedUser = db.users.find(u => {
        const uEmail = (u.email || '').toLowerCase();
        return (uEmail === targetEmail || 
          (targetEmail === 'admin@synapsis.edu' && uEmail === 'ibpsiglesiadiamante@gmail.com') || 
          (targetEmail === 'juan.docente@synapsis.edu' && uEmail === 'quinoneswash70@gmail.com') || 
          (targetEmail === 'maria.estudiante@synapsis.edu' && uEmail === 'nelsonquinte1994@gmail.com'));
      });
      if (!matchedUser) {
        matchedUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.pass === pass);
      }

      if (matchedUser) {
        setCurrentUser(matchedUser);
        localStorage.setItem('instituto_currentUser', JSON.stringify(matchedUser));
        setActiveTab('dashboard');
        showToast(`¡Sesión rápida iniciada: ${matchedUser.nombre}!`, 'success');
      } else {
        showToast('Credenciales incorrectas.', 'error');
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

  // State Updates proxies to keep master DB and Firestore in sync, permanently registering any deletions
  const syncDeletions = <T extends { id: string }>(collName: string, previousList: T[] = [], newList: T[] = []) => {
    const newIds = new Set(newList.map(item => item.id));
    previousList.forEach(item => {
      if (item && item.id && !newIds.has(item.id)) {
        registerDeletedId(item.id, collName);
      }
    });
  };

  const updateUsers = (next: User[]) => setDb(prev => {
    syncDeletions('users', prev.users, next);
    const updated = { ...prev, users: next };
    saveState(updated);
    return updated;
  });
  const updateInstitutions = (next: Institution[]) => setDb(prev => {
    syncDeletions('institutions', prev.institutions, next);
    const updated = { ...prev, institutions: next };
    saveState(updated);
    return updated;
  });
  const updateSubjects = (next: Subject[]) => setDb(prev => {
    syncDeletions('subjects', prev.subjects, next);
    const updated = { ...prev, subjects: next };
    saveState(updated);
    return updated;
  });
  const updateSemesters = (next: Semester[]) => setDb(prev => {
    syncDeletions('semesters', prev.semesters, next);
    const updated = { ...prev, semesters: next };
    saveState(updated);
    return updated;
  });
  const updateParciales = (next: Parcial[]) => setDb(prev => {
    syncDeletions('parciales', prev.parciales, next);
    const updated = { ...prev, parciales: next };
    saveState(updated);
    return updated;
  });
  const updateExams = (next: Exam[]) => setDb(prev => {
    syncDeletions('exams', prev.exams, next);
    const updated = { ...prev, exams: next };
    saveState(updated);
    return updated;
  });
  const updateSubmissions = (next: Submission[]) => setDb(prev => {
    syncDeletions('submissions', prev.submissions, next);
    const updated = { ...prev, submissions: next };
    saveState(updated);
    return updated;
  });
  const updateGradeRecords = (next: GradeRecord[]) => setDb(prev => {
    syncDeletions('gradeRecords', prev.gradeRecords, next);
    const updated = { ...prev, gradeRecords: next };
    saveState(updated);
    return updated;
  });
  const updateAssignments = (next: Assignment[]) => setDb(prev => {
    syncDeletions('assignments', prev.assignments, next);
    const updated = { ...prev, assignments: next };
    saveState(updated);
    return updated;
  });
  const updateAssignmentSubmissions = (next: AssignmentSubmission[]) => setDb(prev => {
    syncDeletions('assignmentSubmissions', prev.assignmentSubmissions, next);
    const updated = { ...prev, assignmentSubmissions: next };
    saveState(updated);
    return updated;
  });

  // Dynamic panel mapper
  const renderActivePanel = () => {
    if (!currentUser) return null;

    if (activeEditExamId) {
      if (isFirebaseLoading) {
        return (
          <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
            <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
              Sincronizando con Firebase...
            </p>
          </div>
        );
      }
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
            users={db.users}
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
            subjects={db.subjects}
            semesters={db.semesters}
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
            semesters={db.semesters}
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
            currentUser={currentUser}
            users={db.users}
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
            currentUser={currentUser}
          />
        );
      case 'trabajos':
        return (
          <Trabajos
            currentUser={currentUser}
            assignments={db.assignments}
            parciales={db.parciales}
            subjects={db.subjects}
            assignmentSubmissions={db.assignmentSubmissions || []}
            onUpdateAssignments={updateAssignments}
            onUpdateAssignmentSubmissions={updateAssignmentSubmissions}
            toast={showToast}
            users={db.users}
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
            subjects={db.subjects}
            semesters={db.semesters}
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
      case 'educativo':
        return (
          <Educativo
            currentUser={currentUser}
            subjects={db.subjects}
            toast={showToast}
          />
        );
      case 'biblia':
        return (
          <Biblia />
        );
      default:
        return <div className="p-6">Página aún no implementada: {activeTab}</div>;
    }
  };

  // RENDER APP
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
                ? 'bg-rose-50 text-rose-800 border-rose-200 font-bold' 
                : toast.type === 'info'
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-200 shadow-indigo-100'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
          }`}>
            <span>{toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : toast.type === 'info' ? 'ℹ' : '⚠'}</span>
            <span>{toast.msg}</span>
          </div>
        </div>
      )}

      {/* RENDER LOGIN IF NO SESSION */}
      {!currentUser ? (
        <div id="loginPage" className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 bg-[#090d16] relative overflow-x-hidden flex-col select-none">
          {/* Subtle modern ambient background lighting */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-gradient-to-b from-indigo-500/15 via-blue-600/5 to-transparent blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-emerald-500/5 blur-3xl pointer-events-none" />
          
          {/* Subtle engineering grid backdrop */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}
          />

          {/* Institutional Status Pill */}
          <div className="mb-5 flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-slate-800 backdrop-blur-md text-slate-300 text-xs shadow-sm flex-wrap justify-center">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-medium text-[11px] text-slate-300">Campus Virtual Conectado</span>
            <span className="text-slate-600">·</span>
            <span className="font-medium text-[11px] text-slate-300">Cloud Firestore Sincronizado</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-[10px] text-indigo-400 font-semibold">synapsis-edu.web.app</span>
          </div>

          {/* Main Split Card Container */}
          <div className="w-full max-w-5xl bg-[#0d121f]/95 backdrop-blur-2xl rounded-3xl shadow-2xl border border-slate-800/90 flex flex-col lg:flex-row overflow-hidden relative z-10 before:absolute before:inset-x-0 before:top-0 before:h-[2px] before:bg-gradient-to-r before:from-indigo-500 before:via-purple-500 before:to-emerald-400">
            
            {/* LEFT PANEL: Branding, Features & Quick Access */}
            <div className="w-full lg:w-[44%] p-6 sm:p-8 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-slate-800/80 bg-slate-950/40">
              <div>
                {/* Brand Header */}
                <div className="flex items-center gap-3.5 mb-3">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30 ring-1 ring-white/20 shrink-0">
                    <GraduationCap className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-2xl font-black text-white tracking-tight leading-none">
                        Synapsis
                      </h1>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 uppercase tracking-wider">
                        OFICIAL
                      </span>
                    </div>
                    <p className="text-[11px] font-extrabold text-indigo-400 tracking-wider uppercase mt-1 font-sans">
                      CAMPUS VIRTUAL UNIVERSITARIO
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-400 font-normal leading-relaxed mb-6">
                  Plataforma integral para evaluaciones digitales, registro de calificaciones, asistencia y seguimiento académico.
                </p>

                {/* 3 Feature items */}
                <div className="space-y-3 mb-6">
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <div className="w-8 h-8 rounded-lg bg-indigo-950/80 border border-indigo-700/50 flex items-center justify-center text-indigo-400 shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">Acceso Cifrado Institucional</div>
                      <div className="text-[11px] text-slate-400">Conexión con autenticación segura por rol.</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-700/50 flex items-center justify-center text-purple-400 shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">Exámenes con Temporizador</div>
                      <div className="text-[11px] text-slate-400">Control de tiempo, navegación e intentos.</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80">
                    <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-700/50 flex items-center justify-center text-emerald-400 shrink-0">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-200">Calificaciones en Tiempo Real</div>
                      <div className="text-[11px] text-slate-400">Boletines y cálculo automático de notas.</div>
                    </div>
                  </div>
                </div>

                {/* Acceso Rápido por Perfil */}
                <div className="pt-4 border-t border-slate-800/80">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      ACCESO RÁPIDO POR PERFIL
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">1 clic</span>
                  </div>

                  <div className="space-y-2">
                    <button 
                      type="button"
                      onClick={() => handleQuickLogin('admin@synapsis.edu', 'admin123')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-indigo-950/40 hover:border-indigo-600/60 transition-all cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200">Administrador</div>
                          <div className="text-[10px] text-slate-500 font-mono">admin@synapsis.edu</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-slate-300 bg-slate-800/80 px-2 py-1 rounded-md border border-slate-700/50">
                        Control Total
                      </span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => handleQuickLogin('juan.docente@synapsis.edu', 'docente123')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-emerald-950/40 hover:border-emerald-600/60 transition-all cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform">
                          <GraduationCap className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200">Docente Titular</div>
                          <div className="text-[10px] text-slate-500 font-mono">juan.docente@synapsis.edu</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-300 bg-emerald-950/60 px-2 py-1 rounded-md border border-emerald-800/40">
                        Evaluador
                      </span>
                    </button>

                    <button 
                      type="button"
                      onClick={() => handleQuickLogin('maria.estudiante@synapsis.edu', 'estudiante123')}
                      className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-900/80 hover:bg-blue-950/40 hover:border-blue-600/60 transition-all cursor-pointer group text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-200">Estudiante Activo</div>
                          <div className="text-[10px] text-slate-500 font-mono">maria.estudiante@synapsis.edu</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-blue-300 bg-blue-950/60 px-2 py-1 rounded-md border border-blue-800/40">
                        Exámenes
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Footer on Left Panel */}
              <div className="mt-6 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-1.5 font-mono text-[11px] text-indigo-300">
                  <Globe className="w-3.5 h-3.5 text-indigo-400" />
                  <span>synapsis-edu.web.app</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsShareModalOpen(true)}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Ver QR</span>
                </button>
              </div>
            </div>

            {/* RIGHT PANEL: Auth Tabs & Forms */}
            <div className="w-full lg:w-[56%] p-6 sm:p-8 flex flex-col justify-between bg-[#0d121f]">
              <div>
                <span className="text-xs font-black tracking-wider text-indigo-400 uppercase font-sans">
                  PORTAL DE ACCESO INSTITUCIONAL
                </span>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-1">
                  Identificación de Usuario
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 mt-1 mb-5">
                  Selecciona tu tipo de acceso o ingresa con tus datos académicos:
                </p>

                {/* TABS SWITCHER: Iniciar Sesión / Nuevo Estudiante */}
                <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-slate-950/80 border border-slate-800/90 mb-6 gap-2">
                  <button
                    type="button"
                    onClick={() => setLoginTab('login')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      loginTab === 'login'
                        ? 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-900/50'
                    }`}
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>Iniciar Sesión</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLoginTab('register')}
                    className={`py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 cursor-pointer transition-all ${
                      loginTab === 'register'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/30'
                        : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30'
                    }`}
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Nuevo Estudiante</span>
                  </button>
                </div>

                {/* VIEW 1: INICIAR SESIÓN */}
                {loginTab === 'login' ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300 font-sans">
                          Usuario, Correo o Cédula
                        </label>
                        <span className="text-[10px] text-slate-500 font-medium">
                          Cualquiera de los 3 es válido
                        </span>
                      </div>
                      <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/80 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                        <UserIcon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input 
                          type="text" 
                          name="email"
                          id="email"
                          required
                          value={loginEmail}
                          onChange={e => setLoginEmail(e.target.value)}
                          placeholder="ej: usuario@synapsis.edu, EST-001 o Cédula"
                          className="w-full pl-10 pr-3.5 py-2.5 bg-transparent text-white text-sm outline-none placeholder:text-slate-500 font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-300 font-sans">
                          Contraseña
                        </label>
                        <button
                          type="button"
                          onClick={() => showToast('Para recuperar o restablecer tu contraseña, ingresa con tu cédula o contacta a la secretaría académica.', 'info')}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer transition-colors"
                        >
                          ¿Olvidaste tu contraseña?
                        </button>
                      </div>
                      <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/80 transition-all focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20">
                        <Lock className="absolute left-3.5 top-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input 
                          type={showPassword ? "text" : "password"}
                          required
                          value={loginPass}
                          onChange={e => setLoginPass(e.target.value)}
                          placeholder="Digita tu contraseña institucional"
                          className="w-full pl-10 pr-10 py-2.5 bg-transparent text-white text-sm outline-none placeholder:text-slate-500 font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded cursor-pointer"
                          title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      className="w-full mt-3 py-3 px-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer group"
                    >
                      <span>Acceder al Portal Académico</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </form>
                ) : (
                  /* VIEW 2: REGISTRO DE NUEVO ESTUDIANTE */
                  <form onSubmit={handleRegisterStudent} className="space-y-3.5 animate-fade-in">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Nombre Completo y Apellidos <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/80 transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                        <UserIcon className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input 
                          type="text" 
                          required
                          value={regNombre}
                          onChange={e => setRegNombre(e.target.value)}
                          placeholder="ej: Carlos Alberto Mendoza"
                          className="w-full pl-10 pr-3.5 py-2 bg-transparent text-white text-xs sm:text-sm outline-none placeholder:text-slate-500 font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Correo Electrónico <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/80 transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                          <CreditCard className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none opacity-0" />
                          <input 
                            type="email" 
                            required
                            value={regEmail}
                            onChange={e => setRegEmail(e.target.value)}
                            placeholder="correo@ejemplo.com"
                            className="w-full px-3.5 py-2 bg-transparent text-white text-xs sm:text-sm outline-none placeholder:text-slate-500 font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Documento / Cédula <span className="text-rose-400">*</span>
                        </label>
                        <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/80 transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                          <input 
                            type="text" 
                            required
                            value={regCedula}
                            onChange={e => setRegCedula(e.target.value)}
                            placeholder="ej: 1107065653"
                            className="w-full px-3.5 py-2 bg-transparent text-white text-xs sm:text-sm outline-none placeholder:text-slate-500 font-medium"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Celular / WhatsApp (Opcional)
                        </label>
                        <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/80 transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                          <input 
                            type="text" 
                            value={regCelular}
                            onChange={e => setRegCelular(e.target.value)}
                            placeholder="ej: 0987654321"
                            className="w-full px-3.5 py-2 bg-transparent text-white text-xs sm:text-sm outline-none placeholder:text-slate-500 font-medium"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Semestre Académico
                        </label>
                        <select 
                          value={regSemestre}
                          onChange={e => setRegSemestre(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-950 border border-slate-700/80 rounded-xl text-white text-xs sm:text-sm outline-none focus:border-emerald-500 cursor-pointer"
                        >
                          <option value="SEMESTRE I">SEMESTRE I</option>
                          <option value="SEMESTRE II">SEMESTRE II</option>
                          <option value="SEMESTRE III">SEMESTRE III</option>
                          <option value="SEMESTRE IV">SEMESTRE IV</option>
                          <option value="SEMESTRE V">SEMESTRE V</option>
                          <option value="SEMESTRE VI">SEMESTRE VI</option>
                          <option value="SEMESTRE VII">SEMESTRE VII</option>
                          <option value="SEMESTRE VIII">SEMESTRE VIII</option>
                          <option value="SEMESTRE IX">SEMESTRE IX</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Crea una Contraseña de Acceso <span className="text-rose-400">*</span>
                      </label>
                      <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/80 transition-all focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
                        <Lock className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input 
                          type={regShowPass ? "text" : "password"}
                          required
                          value={regPass}
                          onChange={e => setRegPass(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full pl-10 pr-10 py-2 bg-transparent text-white text-xs sm:text-sm outline-none placeholder:text-slate-500 font-medium"
                        />
                        <button
                          type="button"
                          onClick={() => setRegShowPass(!regShowPass)}
                          className="absolute right-3 top-2 text-slate-400 hover:text-slate-200 p-0.5 rounded cursor-pointer"
                        >
                          {regShowPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <button 
                      type="submit" 
                      disabled={isRegistering}
                      className="w-full mt-2 py-3 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      <span>{isRegistering ? 'Procesando matrícula...' : 'Completar Matrícula y Acceder'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}
              </div>

              {/* Bottom footer toggle link exactly as shown in screenshot */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-2">
                {loginTab === 'login' ? (
                  <>
                    <span className="text-xs text-slate-400 font-medium">
                      ¿Eres alumno nuevo y aún no tienes matrícula?
                    </span>
                    <button
                      type="button"
                      onClick={() => setLoginTab('register')}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>Registrarme como estudiante →</span>
                    </button>
                  </>
                ) : (
                  <>
                    <span className="text-xs text-slate-400 font-medium">
                      ¿Ya cuentas con usuario o código institucional?
                    </span>
                    <button
                      type="button"
                      onClick={() => setLoginTab('login')}
                      className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Iniciar sesión aquí →</span>
                    </button>
                  </>
                )}
              </div>
            </div>

          </div>

          {/* Institutional copyright note */}
          <p className="mt-6 text-[11px] text-slate-500 font-medium text-center">
            Synapsis Educational OS · Conexión Segura SSL · Firebase Firestore
          </p>
        </div>
      ) : (
        /* ENTIRE APPLICATION DASHBOARD VIEWPORT LAYOUT */
        <div className="min-h-screen flex flex-col">
          
          {/* HEADER ROW */}
          <Header 
            currentUser={currentUser} 
            theme={theme}
            onThemeChange={(newTheme) => setTheme(newTheme as 'theme-academia' | 'theme-cyber')}
            onLogout={handleLogout}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(prev => !prev)}
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onSyncFirebase={handleManualSync}
            isSyncing={isSyncingFirebase}
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
              onOpenShareModal={() => setIsShareModalOpen(true)}
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

          {/* FLOATING ACTION BUTTON TO SHOW COLLAPSED SIDEBAR */}
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="fixed bottom-6 left-6 z-50 bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl p-4 rounded-full cursor-pointer transition-all duration-300 flex items-center justify-center hover:scale-110 active:scale-95 border-2 border-white focus:outline-none"
              title="Mostrar menú de navegación"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          )}

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

      {/* SHARE APP & QR CODE MODAL */}
      <ShareAppModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        onSyncFirebase={handleManualSync}
        onRestoreBackup={handleRestoreBackup}
        onExportBackup={handleExportBackup}
        onImportBackup={handleImportBackup}
        isSyncing={isSyncingFirebase}
        stats={{
          subjects: db.subjects.length,
          semesters: db.semesters.length,
          parciales: db.parciales.length,
          users: db.users.length,
          exams: db.exams.length,
          grades: db.gradeRecords.length
        }}
      />

    </div>
  );
}
