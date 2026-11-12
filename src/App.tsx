/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
  ShieldAlert,
  ArrowRight,
  BookOpen,
  Globe,
  UserPlus,
  CheckCircle2,
  Phone,
  CreditCard,
  Camera,
  ArrowLeft,
  LayoutGrid,
  Trash2,
  RefreshCw
} from 'lucide-react';

import { 
  AppState,
  User, 
  Exam, 
  Submission, 
  Institution, 
  Subject, 
  Semester, 
  Parcial, 
  GradeRecord, 
  Assignment,
  AssignmentSubmission,
  RecycleItem
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
  generateStudentCode,
  deduplicateSemesters,
  deduplicateSubjects,
  deduplicateParciales,
  deduplicateStudents,
  getRecycleBin,
  saveRecycleBin,
  markAsDeleted,
  unmarkAsDeleted,
  getPendingSubmissionIds,
  addPendingSubmissionId,
  removePendingSubmissionId
} from './lib/db';
import { bioCosmicSynth } from './lib/audioEngine';
import { 
  fetchFullStateFromFirestore, 
  seedFirestore, 
  syncToFirestore, 
  initializeSyncCache,
  fullBidirectionalSync,
  registerDeletedId,
  unRegisterDeletedId,
  saveRecycleItemToFirestore,
  deleteRecycleItemFromFirestore,
  uploadTheologicalSubjectsToFirestore,
  uploadAllStudentsToFirestore,
  uploadAllExamsToFirestore,
  uploadAllParcialesToFirestore,
  saveDocToFirestore,
  deleteDocFromFirestore,
  fetchUserByCredentials
} from './lib/firebase';
import {
  fetchFullStateFromSupabase,
  pushAllStateToSupabase,
  testSupabaseConnection,
  saveDocToSupabase,
  deleteDocFromSupabase
} from './lib/supabase';

import Header from './components/Header';
import Dashboard from './components/Dashboard';
import MisExamenes from './components/MisExamenes';
import ExamBuilder from './components/ExamBuilder';
import Resultados from './components/Resultados';
import MisExamenesTake from './components/MisExamenesTake';
import MisMaterias from './components/MisMaterias';
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
import Papelera from './components/Papelera';
import CentroNotificaciones from './components/CentroNotificaciones';
import ShareAppModal from './components/ShareAppModal';
import RecuperarPasswordModal from './components/RecuperarPasswordModal';

export default function App() {
  // Database States
  const [db, setDb] = useState(() => getInitialState());
  const currentDbRef = useRef<AppState>(db);
  const [isFirebaseLoading, setIsFirebaseLoading] = useState(false);
  const hasCompletedInitialLoadRef = useRef(false);
  const lastRemoteRefreshRef = useRef<number>(0);

  useEffect(() => {
    currentDbRef.current = db;
  }, [db]);

  const flushPendingSubmissions = async (subsList: Submission[]) => {
    const pendingIds = getPendingSubmissionIds();
    if (pendingIds.length === 0) return;
    for (const pId of pendingIds) {
      const targetSub = subsList.find(s => s.id === pId);
      if (!targetSub) {
        removePendingSubmissionId(pId);
        continue;
      }
      const res = await saveDocToSupabase('submissions', targetSub);
      if (res.success) {
        removePendingSubmissionId(pId);
      }
    }
  };

  const refreshRemoteData = async (showFeedback = false) => {
    try {
      // Push any locally pending submissions first so they are preserved on remote
      await flushPendingSubmissions(currentDbRef.current.submissions || []);

      const remoteSupabase = await fetchFullStateFromSupabase().catch(e => {
        console.warn('Supabase refresh notice:', e);
        return null;
      });

      if (remoteSupabase) {
        const mergedDb = mergeStates(currentDbRef.current, remoteSupabase as any);
        currentDbRef.current = mergedDb;
        setDb(mergedDb);
        saveState(mergedDb);
        initializeSyncCache(mergedDb);

        // If local had submissions missing in remote, push them immediately
        const remoteSubIds = new Set((remoteSupabase.submissions || []).map(s => s.id));
        const missingRemoteSubs = (mergedDb.submissions || []).filter(s => !remoteSubIds.has(s.id));
        for (const sub of missingRemoteSubs) {
          const res = await saveDocToSupabase('submissions', sub);
          if (res.success) removePendingSubmissionId(sub.id);
        }

        if (showFeedback) {
          showToast(`Entregas actualizadas desde la nube (${mergedDb.submissions.length} registros) ✓`, 'success');
        }
      } else if (showFeedback) {
        showToast('No se pudo contactar la nube en este momento. Se muestran datos locales.', 'warning');
      }
    } catch (err) {
      console.warn('refreshRemoteData warning:', err);
      if (showFeedback) {
        showToast('Error al consultar actualizaciones en la nube.', 'error');
      }
    }
  };

  // Download entire Synapsis Portal database on mount in background from Supabase (PostgreSQL)
  useEffect(() => {
    async function loadInitialDatabase() {
      try {
        console.log('Loading Synapsis portal database from Supabase (PostgreSQL)...');
        const localDb = getInitialState();
        await flushPendingSubmissions(localDb.submissions || []);

        const remoteSupabase = await fetchFullStateFromSupabase().catch(e => {
          console.warn('Supabase fetch notice:', e);
          return null;
        });

        let mergedDb = localDb;
        if (remoteSupabase) {
          mergedDb = mergeStates(mergedDb, remoteSupabase as any);
        }

        currentDbRef.current = mergedDb;
        setDb(mergedDb);
        saveState(mergedDb);
        initializeSyncCache(mergedDb);
        lastRemoteRefreshRef.current = Date.now();

        // Mantener Supabase sincronizado (incluyendo cualquier entrega que hubiera quedado local)
        await pushAllStateToSupabase(mergedDb).catch(e => console.warn('Background Supabase sync:', e));
      } catch (err) {
        console.error('Error synchronizing database, running standalone with Supabase.', err);
      } finally {
        hasCompletedInitialLoadRef.current = true;
        setIsFirebaseLoading(false);
      }
    }
    loadInitialDatabase();
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

  // Keep currentUser in sync with db.users updates (e.g., when assigned subjects change)
  useEffect(() => {
    if (currentUser) {
      const refreshed = db.users.find(u => u.id === currentUser.id);
      if (refreshed && (
        JSON.stringify(refreshed.asignaturas || []) !== JSON.stringify(currentUser.asignaturas || []) ||
        refreshed.semestre !== currentUser.semestre ||
        refreshed.nombre !== currentUser.nombre ||
        refreshed.codigo !== currentUser.codigo
      )) {
        const merged = { ...currentUser, ...refreshed };
        setCurrentUser(merged);
        try {
          localStorage.setItem('instituto_currentUser', JSON.stringify(merged));
        } catch (e) {}
      }
    }
  }, [db.users, currentUser]);

  // UI States
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem('synapsis_activeTab') || 'dashboard';
  });
  const [dashboardCategory, setDashboardCategory] = useState<string>(() => {
    const saved = localStorage.getItem('synapsis_dash_cat');
    if (saved && saved !== 'todas' && saved !== 'recogido') return saved;
    return 'admin';
  });

  useEffect(() => {
    localStorage.setItem('synapsis_dash_cat', dashboardCategory);
  }, [dashboardCategory]);

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
  const [isRecuperarModalOpen, setIsRecuperarModalOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Student registration states
  const [regNombre, setRegNombre] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regCedula, setRegCedula] = useState('');
  const [regCelular, setRegCelular] = useState('');
  const [regSemestre, setRegSemestre] = useState('SEMESTRE I');
  const [regPass, setRegPass] = useState('');
  const [regFoto, setRegFoto] = useState('');
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

  // Persist DB state changes to local storage & debounced background Supabase sync
  useEffect(() => {
    saveState(db);
    if (!hasCompletedInitialLoadRef.current || isFirebaseLoading) return;
    const timer = setTimeout(() => {
      syncToFirestore(db);
    }, 1500);
    return () => clearTimeout(timer);
  }, [db, isFirebaseLoading]);

  // Auto-refresh submissions & flush pending local writes when opening key views or returning online
  useEffect(() => {
    const triggerThrottledRefresh = () => {
      if (!hasCompletedInitialLoadRef.current) return;
      const elapsed = Date.now() - lastRemoteRefreshRef.current;
      if (elapsed < 15000) return;
      lastRemoteRefreshRef.current = Date.now();
      refreshRemoteData(false);
    };

    if (
      activeTab === 'resultados' ||
      activeTab === 'historialAcademico' ||
      activeTab === 'registroNotas' ||
      activeTab === 'misExamenesTake' ||
      activeTab === 'miHistorial' ||
      activeTab === 'dashboard'
    ) {
      triggerThrottledRefresh();
    }

    const handleOnline = () => {
      flushPendingSubmissions(currentDbRef.current.submissions || []);
      triggerThrottledRefresh();
    };
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        triggerThrottledRefresh();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleVisibilityOrFocus);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [activeTab]);

  // Persist current theme
  useEffect(() => {
    localStorage.setItem('synapsis-theme', theme);
  }, [theme]);

  // Adjust theme class on html/body element
  useEffect(() => {
    const isDark = theme === 'theme-cyber' || (theme as string) === 'theme-cosmos' || (theme as string) === 'theme-cosmos-contraste';
    document.body.className = `${theme} ${isDark ? 'dark' : ''} font-sans min-h-screen transition-all duration-200`;
    document.documentElement.className = `${theme} ${isDark ? 'dark' : ''}`;
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
      showToast('Sincronizando datos con Supabase (PostgreSQL)...', 'info');
      const remoteSupabase = await fetchFullStateFromSupabase().catch(e => {
        console.warn('Supabase fetch notice:', e);
        return null;
      });

      let mergedDb = db;
      if (remoteSupabase) {
        mergedDb = mergeStates(mergedDb, remoteSupabase as any);
      }

      setDb(mergedDb);
      saveState(mergedDb);
      initializeSyncCache(mergedDb);

      const pushedSupabase = await pushAllStateToSupabase(mergedDb).catch(() => 0);

      showToast(`¡Datos sincronizados y respaldados en Supabase! ✓ (${pushedSupabase || 'OK'} registros)`, 'success');
      return { success: true, pushedCount: pushedSupabase };
    } catch (err) {
      console.error('Manual sync failed', err);
      showToast('Error en la sincronización con Supabase.', 'error');
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleRestoreBackup = async () => {
    try {
      setIsSyncingFirebase(true);
      showToast('Restaurando copia de seguridad y sincronizando con Supabase...', 'info');
      const restored = restoreBackupState();
      setDb(restored);
      saveState(restored);
      initializeSyncCache(restored);
      await pushAllStateToSupabase(restored).catch(() => {});
      showToast('¡Copia de seguridad restaurada y sincronizada en Supabase exitosamente!', 'success');
    } catch (err) {
      console.error('Failed to restore backup and sync', err);
      showToast('Error al restaurar copia de seguridad', 'error');
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
      await pushAllStateToSupabase(imported).catch(() => {});
      showToast(`¡Respaldo importado y sincronizado en Supabase! (${imported.subjects?.length || 0} materias, ${imported.semesters?.length || 0} semestres, ${imported.users?.length || 0} usuarios)`, 'success');
    } catch (err) {
      console.error('Failed to import backup:', err);
      showToast('El archivo JSON de respaldo no tiene un formato válido', 'error');
      throw err;
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = loginEmail.trim().toLowerCase();
    const cleanPass = loginPass.trim();

    if (!cleanId || !cleanPass) {
      showToast('Por favor escribe tu identificador y contraseña de acceso.', 'warning');
      return;
    }

    // Direct Access for Washington Quiñones (quinoneswash70@gmail.com / ibpsiglesiadiamante@gmail.com)
    const isSpecialAdminEmail = cleanId === 'quinoneswash70@gmail.com' || cleanId === 'ibpsiglesiadiamante@gmail.com';
    const isSpecialPassword = cleanPass === '1234' || cleanPass === '053507' || cleanPass === 'admin123';

    if (isSpecialAdminEmail) {
      if (!isSpecialPassword) {
        showToast('Contraseña incorrecta para esta cuenta.', 'error');
        return;
      }
      let targetAdmin = db.users.find(u => (u.email || '').toLowerCase() === cleanId) ||
                        db.users.find(u => (u.email || '').toLowerCase() === 'quinoneswash70@gmail.com') ||
                        db.users.find(u => (u.email || '').toLowerCase() === 'ibpsiglesiadiamante@gmail.com') ||
                        db.users.find(u => u.rol === 'admin');
      if (!targetAdmin) {
        targetAdmin = {
          id: 'admin-fallback-id',
          nombre: 'WASHINGTON QUIÑONES',
          email: 'quinoneswash70@gmail.com',
          pass: cleanPass,
          rol: 'admin',
          creado: new Date().toISOString(),
          actualizado: new Date().toISOString()
        };
        updateUsers([...db.users, targetAdmin]);
      } else if (targetAdmin.rol !== 'admin') {
        targetAdmin = { ...targetAdmin, rol: 'admin' };
        updateUsers(db.users.map(u => u.id === targetAdmin!.id ? targetAdmin! : u));
      }
      setCurrentUser(targetAdmin);
      localStorage.setItem('instituto_currentUser', JSON.stringify(targetAdmin));
      setActiveTab('dashboard');
      showToast(`¡Bienvenido al sistema, ${targetAdmin.nombre}!`, 'success');
      return;
    }

    // 1. Search in local db.users
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

      const userPass = (u.pass || '').trim();
      const passMatch = userPass === cleanPass || 
                        userPass.toLowerCase() === cleanPass.toLowerCase() || 
                        userCode === cleanPass.toLowerCase() ||
                        userCedula === cleanPass.toLowerCase();
      return idMatch && passMatch;
    });

    // 2. Real-time Cloud Verification: If not matched in local memory (or password changed recently on another device)
    if (!matchedUser) {
      setIsLoggingIn(true);
      try {
        const cloudUser = await fetchUserByCredentials(cleanId);
        if (cloudUser) {
          const cloudPass = (cloudUser.pass || '').trim();
          const cloudCode = (cloudUser.codigo || '').trim().toLowerCase();
          const cloudCedula = (cloudUser.cedula || '').trim().toLowerCase();

          const passMatches = cloudPass === cleanPass ||
                              cloudPass.toLowerCase() === cleanPass.toLowerCase() ||
                              cloudCode === cleanPass.toLowerCase() ||
                              cloudCedula === cleanPass.toLowerCase();

          if (passMatches) {
            matchedUser = cloudUser;
            // Update local memory and cache so subsequent actions are instant
            const existingIdx = db.users.findIndex(u => u.id === cloudUser.id);
            let nextUsers: User[];
            if (existingIdx > -1) {
              nextUsers = [...db.users];
              nextUsers[existingIdx] = cloudUser;
            } else {
              nextUsers = [...db.users, cloudUser];
            }
            updateUsers(nextUsers);
          } else {
            showToast(`Contraseña incorrecta para ${cloudUser.nombre}. Recuerda que puedes pulsar "¿Olvidaste tu contraseña?" o consultar con tu cédula.`, 'error');
            setIsLoggingIn(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Error verifying credentials with cloud:', err);
      } finally {
        setIsLoggingIn(false);
      }
    }

    // 3. Fallback self-healing system for demonstration/seed users
    if (!matchedUser) {
      const defaultUsers: User[] = [
        { id: 'admin-fallback-id', nombre: 'WASHINGTON QUIÑONES', email: 'quinoneswash70@gmail.com', pass: '1234', rol: 'admin', creado: new Date().toISOString() },
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
      showToast('Credenciales no encontradas. Verifica tu correo, cédula o código institucional, o pulsa "¿Olvidaste tu contraseña?".', 'error');
      return;
    }

    setCurrentUser(matchedUser);
    localStorage.setItem('instituto_currentUser', JSON.stringify(matchedUser));
    
    // Set landing tab based on role
    setActiveTab('dashboard');
    showToast(`¡Bienvenido al sistema, ${matchedUser.nombre}!`, 'success');
  };

  const handleSecretLogoTouch = () => {
    // Configuración estratégica y discreta solicitada por el usuario:
    // Al pulsar el logo/emblema se prepara el correo institucional administrativo pero NUNCA ingresa directo sin contraseña.
    setLoginEmail('quinoneswash70@gmail.com');
    setLoginPass('');
    showToast('Identificador preparado. Ingresa tu contraseña de acceso.', 'info');
    setTimeout(() => {
      const passInput = document.getElementById('login-password') as HTMLInputElement | null;
      if (passInput) {
        passInput.focus();
      }
    }, 120);
  };

  // Access Control Guard for Student Categories & Roles
  const isTabAllowedForUser = (tab: string, user?: User | null): boolean => {
    if (!user) return false;
    if (user.rol === 'admin') return true;
    if (tab === 'dashboard' || tab === 'notificaciones') return true;

    const catObj = getModuleCategory(tab);
    const catId = catObj.id;

    if (user.rol === 'estudiante') {
      const allowedCategories = user.permisosCategorias && user.permisosCategorias.length > 0
        ? user.permisosCategorias
        : ['estudiante', 'recursos']; // Default student permissions: only Estudiante & Recursos!

      if (user.permisosModulos && user.permisosModulos.includes(tab)) return true;
      return allowedCategories.includes(catId);
    }

    if (user.rol === 'docente') {
      const allowedCategories = user.permisosCategorias && user.permisosCategorias.length > 0
        ? user.permisosCategorias
        : ['docente', 'recursos', 'gestion'];

      if (user.permisosModulos && user.permisosModulos.includes(tab)) return true;
      if (tab === 'registroNotas' || tab === 'trabajos') return true;
      return allowedCategories.includes(catId);
    }

    return true;
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
    if (!regCedula.trim()) {
      showToast('Por favor escribe tu número de cédula o documento', 'warning');
      return;
    }
    if (!regCelular.trim()) {
      showToast('Por favor escribe tu número de celular (campo obligatorio)', 'warning');
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
        nombre: regNombre.trim(),
        email: regEmail.trim().toLowerCase(),
        pass: regPass.trim(),
        rol: 'estudiante',
        codigo: newStudentCode,
        cedula: regCedula.trim(),
        celular: regCelular.trim(),
        semestre: regSemestre || 'SEMESTRE I',
        foto: regFoto.trim() || undefined,
        permisosCategorias: ['estudiante', 'recursos'],
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
      setRegFoto('');

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
        deleteDocFromFirestore(collName, item.id).catch(() => {});
        deleteDocFromSupabase(collName, item.id).catch(() => {});
      }
    });
  };

  const updateStateField = <K extends keyof AppState>(field: K, nextList: AppState[K], collName?: string): AppState => {
    const prevFieldList = (currentDbRef.current[field] as any[]) || [];
    if (collName) {
      syncDeletions(collName, prevFieldList, (nextList as any[]) || []);
    }
    const updated: AppState = { ...currentDbRef.current, [field]: nextList };
    currentDbRef.current = updated;
    saveState(updated);
    setDb(updated);
    return updated;
  };

  const updateUsers = (next: User[]) => {
    const updated = updateStateField('users', next, 'users');
    next.forEach(u => {
      saveDocToFirestore('users', u, true).catch(() => {});
    });
    return updated;
  };
  const updateInstitutions = (next: Institution[]) => updateStateField('institutions', next, 'institutions');
  const updateSubjects = (next: Subject[]) => updateStateField('subjects', next, 'subjects');
  const updateSemesters = (next: Semester[]) => updateStateField('semesters', next, 'semesters');
  const updateParciales = (next: Parcial[]) => updateStateField('parciales', next, 'parciales');
  const updateExams = (next: Exam[]) => updateStateField('exams', next, 'exams');
  const updateGradeRecords = (next: GradeRecord[]) => updateStateField('gradeRecords', next, 'gradeRecords');
  const updateAssignments = (next: Assignment[]) => updateStateField('assignments', next, 'assignments');
  const updateAssignmentSubmissions = (next: AssignmentSubmission[]) => updateStateField('assignmentSubmissions', next, 'assignmentSubmissions');

  const updateSubmissions = async (next: Submission[], forceIds?: string[]): Promise<{
    success: boolean;
    remoteSynced: boolean;
    error?: string;
    successfulIds?: string[];
    failedIds?: string[];
  }> => {
    // 1. Obtener sincrónicamente las entregas previas desde la referencia viva más reciente
    const currentSubs = currentDbRef.current.submissions || [];
    const forceSet = new Set(forceIds || []);

    // 2. Actualizar estado local inmediatamente para no perder datos en memoria ni localStorage
    updateStateField('submissions', next, 'submissions');

    // 3. Detectar entregas modificadas de forma canónica O forzadas explícitamente para reintento remoto
    const changed = next.filter(item => {
      if (forceSet.has(item.id)) return true;
      const prev = currentSubs.find(p => p.id === item.id);
      if (!prev) return true;
      if (prev.puntaje !== item.puntaje) return true;
      if (prev.estado !== item.estado) return true;
      if (prev.aprobado !== item.aprobado) return true;
      if (prev.actualizado !== item.actualizado) return true;
      if (prev.gradedAt !== item.gradedAt) return true;
      if (JSON.stringify(prev.manualScores || {}) !== JSON.stringify(item.manualScores || {})) return true;
      if (JSON.stringify(prev.manualComments || {}) !== JSON.stringify(item.manualComments || {})) return true;
      if (JSON.stringify(prev.respuestas || {}) !== JSON.stringify(item.respuestas || {})) return true;
      return false;
    });

    if (changed.length === 0) {
      if (forceIds && forceIds.length > 0) {
        return {
          success: false,
          remoteSynced: false,
          error: `No se encontraron entregas correspondientes a los IDs indicados para reintento (${forceIds.join(', ')}).`,
          successfulIds: [],
          failedIds: forceIds
        };
      }
      // Sin cambios y sin IDs forzados: no hay escrituras remotas ejecutadas ni confirmadas
      return {
        success: true,
        remoteSynced: false,
        error: 'No se detectaron cambios pendientes para sincronizar con el servidor.',
        successfulIds: [],
        failedIds: []
      };
    }

    const successfulIds: string[] = [];
    const failedIds: string[] = [];
    let lastError: string | undefined;

    // 4. Persistir directamente a Supabase de forma secuencial y verificable
    for (const sub of changed) {
      const res = await saveDocToSupabase('submissions', sub);
      if (res.success) {
        successfulIds.push(sub.id);
        removePendingSubmissionId(sub.id);
      } else {
        failedIds.push(sub.id);
        addPendingSubmissionId(sub.id);
        lastError = res.error;
      }
    }

    // 5. Replicar a Firestore en background sin disparar una segunda escritura redundante a Supabase (mirrorToSupabase = false)
    for (const sub of changed) {
      saveDocToFirestore('submissions', sub, false).catch(() => {});
    }

    const allSucceeded = failedIds.length === 0;
    return {
      success: allSucceeded,
      remoteSynced: allSucceeded,
      error: allSucceeded 
        ? undefined 
        : (failedIds.length > 1 ? `Falló persistencia en ${failedIds.length} entregas (${failedIds.join(', ')}): ${lastError}` : lastError),
      successfulIds,
      failedIds
    };
  };

  const handleDeduplicateSemesters = () => {
    const { state: updatedDb, duplicateIds, report } = deduplicateSemesters(currentDbRef.current);
    if (duplicateIds.length === 0) {
      showToast('No se detectaron semestres duplicados. Hay exactamente 9 semestres.', 'info');
      return;
    }
    currentDbRef.current = updatedDb;
    saveState(updatedDb);
    setDb(updatedDb);
    duplicateIds.forEach(id => {
      registerDeletedId(id, 'semesters');
      deleteDocFromFirestore('semesters', id).catch(() => {});
      deleteDocFromSupabase('semesters', id).catch(() => {});
    });
    showToast(`Se depuraron y unificaron ${duplicateIds.length} semestres duplicados con éxito (9 semestres oficiales).`, 'success');
  };

  const handleDeduplicateSubjects = () => {
    const { state: updatedDb, duplicateIds, report } = deduplicateSubjects(currentDbRef.current);
    if (duplicateIds.length === 0) {
      showToast('No se detectaron materias duplicadas en el catálogo.', 'info');
      return;
    }
    currentDbRef.current = updatedDb;
    saveState(updatedDb);
    setDb(updatedDb);
    duplicateIds.forEach(id => {
      registerDeletedId(id, 'subjects');
      deleteDocFromFirestore('subjects', id).catch(() => {});
      deleteDocFromSupabase('subjects', id).catch(() => {});
    });
    showToast(`Se depuraron y unificaron ${duplicateIds.length} materias duplicadas con éxito.`, 'success');
  };

  const handleDeduplicateParciales = () => {
    const { state: updatedDb, duplicateIds, report } = deduplicateParciales(currentDbRef.current);
    if (duplicateIds.length === 0) {
      showToast('No se detectaron parciales duplicados en el catálogo.', 'info');
      return;
    }
    currentDbRef.current = updatedDb;
    saveState(updatedDb);
    setDb(updatedDb);
    duplicateIds.forEach(id => {
      registerDeletedId(id, 'parciales');
      deleteDocFromFirestore('parciales', id).catch(() => {});
      deleteDocFromSupabase('parciales', id).catch(() => {});
    });
    showToast(`Se depuraron ${duplicateIds.length} parciales duplicados (se conservaron intactos los parciales con evaluaciones de estudiantes).`, 'success');
  };

  const handleSendToRecycle = (
    tipo: RecycleItem['tipo'],
    item: any,
    titulo: string,
    subtitulo?: string,
    detalles?: string
  ) => {
    if (!item || !item.id) return;
    const currentRecycle = currentDbRef.current.recycleBin || getRecycleBin();
    const recItem: RecycleItem = {
      id: uid(),
      originalId: item.id,
      tipo,
      titulo,
      subtitulo: subtitulo || '',
      detalles: detalles || '',
      fechaEliminacion: now(),
      data: item,
      payload: item
    };
    const nextRecycle = [recItem, ...currentRecycle];
    saveRecycleBin(nextRecycle);
    saveRecycleItemToFirestore(recItem).catch(err => console.warn('Recycle Firestore error:', err));
    markAsDeleted(item.id);

    let nextDb = { ...currentDbRef.current, recycleBin: nextRecycle };
    if (tipo === 'estudiante') {
      nextDb.users = (nextDb.users || []).filter(u => u.id !== item.id);
      deleteDocFromFirestore('users', item.id).catch(() => {});
      deleteDocFromSupabase('users', item.id).catch(() => {});
    } else if (tipo === 'parcial') {
      nextDb.parciales = (nextDb.parciales || []).filter(p => p.id !== item.id);
      deleteDocFromFirestore('parciales', item.id).catch(() => {});
      deleteDocFromSupabase('parciales', item.id).catch(() => {});
    } else if (tipo === 'examen') {
      nextDb.exams = (nextDb.exams || []).filter(e => e.id !== item.id);
      deleteDocFromFirestore('exams', item.id).catch(() => {});
    } else if (tipo === 'materia') {
      nextDb.subjects = (nextDb.subjects || []).filter(s => s.id !== item.id);
      deleteDocFromFirestore('subjects', item.id).catch(() => {});
      deleteDocFromSupabase('subjects', item.id).catch(() => {});
    } else if (tipo === 'semestre') {
      nextDb.semesters = (nextDb.semesters || []).filter(s => s.id !== item.id);
      deleteDocFromFirestore('semesters', item.id).catch(() => {});
      deleteDocFromSupabase('semesters', item.id).catch(() => {});
    }

    currentDbRef.current = nextDb;
    saveState(nextDb);
    setDb(nextDb);
    showToast(`"${titulo}" fue enviado a la Papelera de Reciclaje`, 'success');
  };

  const handleRestoreFromRecycle = (item: RecycleItem) => {
    const currentRecycle = currentDbRef.current.recycleBin || getRecycleBin();
    const nextRecycle = currentRecycle.filter(r => r.id !== item.id);
    saveRecycleBin(nextRecycle);
    deleteRecycleItemFromFirestore(item.id).catch(err => console.warn('Delete recycle Firestore error:', err));
    unmarkAsDeleted(item.originalId);
    unRegisterDeletedId(item.originalId);

    let nextDb = { ...currentDbRef.current, recycleBin: nextRecycle };
    const payload = item.data || item.payload;
    if (payload && payload.id) {
      if (item.tipo === 'estudiante') {
        const nextUsers = [payload, ...(nextDb.users || []).filter(u => u.id !== payload.id)];
        nextDb.users = nextUsers;
        saveDocToFirestore('users', payload).catch(() => {});
      } else if (item.tipo === 'parcial') {
        const nextParciales = [payload, ...(nextDb.parciales || []).filter(p => p.id !== payload.id)];
        nextDb.parciales = nextParciales;
        saveDocToFirestore('parciales', payload).catch(() => {});
      } else if (item.tipo === 'examen') {
        const nextExams = [payload, ...(nextDb.exams || []).filter(e => e.id !== payload.id)];
        nextDb.exams = nextExams;
        saveDocToFirestore('exams', payload).catch(() => {});
      } else if (item.tipo === 'materia') {
        const nextSubjects = [payload, ...(nextDb.subjects || []).filter(s => s.id !== payload.id)];
        nextDb.subjects = nextSubjects;
        saveDocToFirestore('subjects', payload).catch(() => {});
      } else if (item.tipo === 'semestre') {
        const nextSemesters = [payload, ...(nextDb.semesters || []).filter(s => s.id !== payload.id)];
        nextDb.semesters = nextSemesters;
        saveDocToFirestore('semesters', payload).catch(() => {});
      }
    }

    currentDbRef.current = nextDb;
    saveState(nextDb);
    setDb(nextDb);
    showToast(`"${item.titulo}" fue restaurado con éxito ✓`, 'success');
  };

  const handlePermanentDelete = (itemId: string, originalId: string, tipo: string) => {
    const currentRecycle = currentDbRef.current.recycleBin || getRecycleBin();
    const nextRecycle = currentRecycle.filter(r => r.id !== itemId);
    saveRecycleBin(nextRecycle);
    deleteRecycleItemFromFirestore(itemId).catch(err => console.warn('Delete recycle Firestore error:', err));
    registerDeletedId(originalId);
    markAsDeleted(originalId);

    const nextDb = { ...currentDbRef.current, recycleBin: nextRecycle };
    currentDbRef.current = nextDb;
    saveState(nextDb);
    setDb(nextDb);
    showToast('Registro eliminado definitivamente del sistema', 'info');
  };

  const handleEmptyTrash = () => {
    const currentRecycle = currentDbRef.current.recycleBin || getRecycleBin();
    currentRecycle.forEach(it => {
      deleteRecycleItemFromFirestore(it.id).catch(() => {});
      registerDeletedId(it.originalId);
      markAsDeleted(it.originalId);
    });
    saveRecycleBin([]);
    const nextDb = { ...currentDbRef.current, recycleBin: [] };
    currentDbRef.current = nextDb;
    saveState(nextDb);
    setDb(nextDb);
    showToast('La Papelera de Reciclaje ha sido vaciada por completo', 'success');
  };

  const handleDeduplicateStudents = () => {
    const { state: updatedDb, duplicateStudents, report } = deduplicateStudents(currentDbRef.current);
    if (duplicateStudents.length === 0) {
      showToast('No se detectaron estudiantes repetidos en el directorio.', 'info');
      return;
    }

    // Move duplicate records to recycle bin so they are restorable if needed
    const currentRecycle = updatedDb.recycleBin || getRecycleBin();
    const newRecycleItems: RecycleItem[] = duplicateStudents.map(st => ({
      id: uid(),
      originalId: st.id,
      tipo: 'estudiante' as const,
      titulo: st.nombre || 'Estudiante Duplicado',
      subtitulo: `${st.email || 'Sin correo'} · Cód: ${st.codigo || 'S/C'}`,
      detalles: `Registro duplicado unificado. Se conservaron intactos todos los historiales de exámenes y notas.`,
      fechaEliminacion: now(),
      data: st,
      payload: st
    }));

    newRecycleItems.forEach(it => {
      saveRecycleItemToFirestore(it).catch(() => {});
      registerDeletedId(it.originalId, 'users');
      deleteDocFromFirestore('users', it.originalId).catch(() => {});
      deleteDocFromSupabase('users', it.originalId).catch(() => {});
    });

    const finalRecycle = [...newRecycleItems, ...currentRecycle];
    saveRecycleBin(finalRecycle);
    const finalDb = { ...updatedDb, recycleBin: finalRecycle };

    currentDbRef.current = finalDb;
    saveState(finalDb);
    setDb(finalDb);
    showToast(`Se unificaron ${duplicateStudents.length} estudiantes repetidos. Las copias fueron enviadas a la Papelera.`, 'success');
  };

  // Helper to get module category id & display name
  const getModuleCategory = (tab: string): { id: string; name: string } => {
    switch (tab) {
      case 'asistencia':
      case 'boletines':
      case 'agenda':
      case 'tablon':
      case 'finanzas':
        return { id: 'gestion', name: 'Gestión Escolar' };

      case 'educativo':
      case 'biblia':
        return { id: 'recursos', name: 'Recursos y Comunidad' };

      case 'misExamenes':
      case 'examenes':
      case 'parciales':
      case 'resultados':
        return { id: 'docente', name: 'Docente' };

      case 'misMaterias':
      case 'misExamenesTake':
      case 'miHistorial':
        return { id: 'estudiante', name: 'Estudiante' };

      case 'notificaciones':
        return currentUser?.rol === 'docente' 
          ? { id: 'docente', name: 'Docente' }
          : currentUser?.rol === 'admin'
            ? { id: 'admin', name: 'Administrador' }
            : { id: 'estudiante', name: 'Estudiante' };

      case 'usuarios':
      case 'docentes':
      case 'instituciones':
      case 'asignaturas':
      case 'materias':
      case 'semestres':
      case 'registroNotas':
      case 'trabajos':
      case 'historialAcademico':
      case 'estudiantes':
      case 'papelera':
        return { id: 'admin', name: 'Administrador' };

      default:
        return { id: 'todas', name: 'Menú Principal' };
    }
  };

  // Helper to get friendly name of active module
  const getModuleName = (tab: string) => {
    switch (tab) {
      case 'notificaciones': return 'Centro de Notificaciones';
      case 'asistencia': return 'Control de Asistencia';
      case 'boletines': return 'Boletines Académicos';
      case 'agenda': return 'Agenda Escolar';
      case 'tablon': return 'Tablón de Anuncios';
      case 'finanzas': return 'Finanzas & Tesorería';
      case 'educativo': return 'Biblioteca de Conocimiento';
      case 'biblia': return 'La Sagrada Biblia';
      case 'examenes':
      case 'misExamenes': return 'Banco de Exámenes';
      case 'parciales': return 'Mis Parciales';
      case 'resultados': return 'Resultados & Calificaciones';
      case 'misMaterias': return 'Mis Asignaturas';
      case 'misExamenesTake': return 'Exámenes Disponibles';
      case 'miHistorial': return 'Mi Historial de Notas';
      case 'usuarios':
      case 'docentes': return 'Directorio de Usuarios';
      case 'instituciones': return 'Sedes e Institutos';
      case 'asignaturas':
      case 'materias': return 'Asignaturas & Materias';
      case 'semestres': return 'Semestres Académicos';
      case 'registroNotas': return 'Registro Oficial de Notas';
      case 'trabajos': return 'Trabajos Académicos';
      case 'historialAcademico': return 'Historial Académico Global';
      case 'estudiantes': return 'Gestión de Estudiantes';
      case 'papelera': return 'Papelera de Reciclaje';
      default: return tab;
    }
  };

  const ALL_MODULE_TABS: Array<{ id: string; name: string; catId: string; catName: string }> = [
    { id: 'notificaciones', name: 'Centro de Notificaciones', catId: 'estudiante', catName: 'Estudiante' },
    { id: 'asistencia', name: 'Control de Asistencia', catId: 'gestion', catName: 'Gestión Escolar' },
    { id: 'boletines', name: 'Boletines Académicos', catId: 'gestion', catName: 'Gestión Escolar' },
    { id: 'agenda', name: 'Agenda Escolar', catId: 'gestion', catName: 'Gestión Escolar' },
    { id: 'tablon', name: 'Tablón de Anuncios', catId: 'gestion', catName: 'Gestión Escolar' },
    { id: 'finanzas', name: 'Finanzas & Tesorería', catId: 'gestion', catName: 'Gestión Escolar' },
    { id: 'educativo', name: 'Biblioteca de Conocimiento', catId: 'recursos', catName: 'Recursos y Comunidad' },
    { id: 'biblia', name: 'La Sagrada Biblia', catId: 'recursos', catName: 'Recursos y Comunidad' },
    { id: 'misExamenes', name: 'Banco de Exámenes', catId: 'docente', catName: 'Docente' },
    { id: 'parciales', name: 'Mis Parciales', catId: 'docente', catName: 'Docente' },
    { id: 'resultados', name: 'Resultados & Calificaciones', catId: 'docente', catName: 'Docente' },
    { id: 'misMaterias', name: 'Mis Asignaturas', catId: 'estudiante', catName: 'Estudiante' },
    { id: 'misExamenesTake', name: 'Exámenes Disponibles', catId: 'estudiante', catName: 'Estudiante' },
    { id: 'miHistorial', name: 'Mi Historial de Notas', catId: 'estudiante', catName: 'Estudiante' },
    { id: 'asignaturas', name: 'Asignaturas & Materias', catId: 'admin', catName: 'Administrador' },
    { id: 'semestres', name: 'Semestres Académicos', catId: 'admin', catName: 'Administrador' },
    { id: 'estudiantes', name: 'Gestión de Estudiantes', catId: 'admin', catName: 'Administrador' },
    { id: 'registroNotas', name: 'Registro Oficial de Notas', catId: 'admin', catName: 'Administrador' },
    { id: 'trabajos', name: 'Trabajos Académicos', catId: 'admin', catName: 'Administrador' },
    { id: 'historialAcademico', name: 'Historial Académico Global', catId: 'admin', catName: 'Administrador' },
    { id: 'usuarios', name: 'Directorio de Usuarios', catId: 'admin', catName: 'Administrador' },
    { id: 'instituciones', name: 'Sedes e Institutos', catId: 'admin', catName: 'Administrador' },
    { id: 'papelera', name: 'Papelera de Reciclaje', catId: 'admin', catName: 'Administrador' },
  ];

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
          onBack={() => {
            setActiveEditExamId(null);
            setDashboardCategory('docente');
            try { localStorage.setItem('synapsis_dash_cat', 'docente'); } catch(e) {}
          }}
          onUpdateExams={updateExams}
          toast={showToast}
        />
      );
    }

    // Access Control & Category Permissions Guard for Students and Restricted Roles
    if (activeTab !== 'dashboard' && !isTabAllowedForUser(activeTab, currentUser)) {
      const modCat = getModuleCategory(activeTab);
      const studentAllowedCats = (currentUser.permisosCategorias && currentUser.permisosCategorias.length > 0)
        ? currentUser.permisosCategorias
        : ['estudiante', 'recursos'];

      const catDisplayNames: Record<string, string> = {
        estudiante: 'Estudiante',
        recursos: 'Recursos y Comunidad',
        gestion: 'Gestión Escolar',
        docente: 'Docente',
        admin: 'Administrador'
      };

      return (
        <div className="flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-3xl border border-rose-200 shadow-md max-w-xl mx-auto my-8 animate-fade-in select-none">
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-4 shadow-sm border border-rose-100">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <span className="text-[11px] font-black uppercase tracking-widest text-rose-600 font-mono mb-1">
            Acceso Restringido · Perfil Estudiante
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 mb-2">
            Módulo no autorizado: {getModuleName(activeTab)}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mb-5 max-w-md leading-relaxed">
            Este módulo pertenece a la categoría <strong>«{modCat.name}»</strong>. Tu perfil de estudiante actualmente tiene permiso únicamente para las siguientes categorías institucionales:
          </p>

          <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
            {studentAllowedCats.map(cId => (
              <span key={cId} className="px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
                ✓ {catDisplayNames[cId] || cId}
              </span>
            ))}
          </div>

          <p className="text-[11px] text-slate-400 mb-6 max-w-sm">
            Si eres monitor o requieres acceso adicional a este módulo, solicita a la dirección o a tu docente que habilite la categoría en tu ficha de estudiante.
          </p>

          <button
            type="button"
            onClick={() => {
              setDashboardCategory('estudiante');
              setActiveTab('dashboard');
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-slate-950 font-bold text-xs shadow-md cursor-pointer transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Mi Panel de Estudiante</span>
          </button>
        </div>
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
            subjects={db.subjects}
            semesters={db.semesters}
            assignments={db.assignments}
            assignmentSubmissions={db.assignmentSubmissions}
            parciales={db.parciales}
            theme={theme}
            initialCategory={dashboardCategory}
            onNavigate={(page) => {
              const cat = getModuleCategory(page);
              setDashboardCategory(cat.id);
              try { localStorage.setItem('synapsis_dash_cat', cat.id); } catch(e) {}
              setActiveTab(page);
              setActiveEditExamId(null);
            }}
            onTakeExam={(examId) => setActiveTakeExamId(examId)}
          />
        );
      case 'examenes':
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
            onSendToRecycle={(exam) => handleSendToRecycle('examen', exam, exam.titulo, exam.materia, `Semestre: ${exam.semestre || 'S/S'}`)}
          />
        );
      case 'resultados':
        return (
          <Resultados
            currentUser={currentUser}
            users={db.users}
            exams={db.exams}
            submissions={db.submissions}
            subjects={db.subjects}
            parciales={db.parciales}
            onUpdateSubmissions={updateSubmissions}
            onRefreshSubmissions={() => refreshRemoteData(true)}
            toast={showToast}
          />
        );
      case 'misMaterias':
        return (
          <MisMaterias
            currentUser={currentUser}
            subjects={db.subjects}
            semesters={db.semesters}
            users={db.users}
            exams={db.exams}
            onNavigate={(tab) => setActiveTab(tab)}
            onTakeExam={(id) => setActiveTakeExamId(id)}
          />
        );
      case 'misExamenesTake':
        return (
          <MisExamenesTake
            currentUser={currentUser}
            exams={db.exams}
            submissions={db.submissions}
            subjects={db.subjects}
            semesters={db.semesters}
            parciales={db.parciales}
            onTakeExam={(id) => setActiveTakeExamId(id)}
          />
        );
      case 'miHistorial':
        return (
          <MiHistorial
            currentUser={currentUser}
            exams={db.exams}
            submissions={db.submissions}
            gradeRecords={db.gradeRecords}
            subjects={db.subjects}
            parciales={db.parciales}
            semesters={db.semesters}
            assignments={db.assignments}
            assignmentSubmissions={db.assignmentSubmissions || []}
          />
        );
      case 'docentes':
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
      case 'materias':
      case 'asignaturas':
        return (
          <Asignaturas
            subjects={db.subjects}
            semesters={db.semesters}
            users={db.users}
            onUpdateSubjects={updateSubjects}
            toast={showToast}
            onDeduplicateSubjects={handleDeduplicateSubjects}
          />
        );
      case 'semestres':
        return (
          <Semestres
            semesters={db.semesters}
            onUpdateSemesters={updateSemesters}
            toast={showToast}
            onDeduplicateSemesters={handleDeduplicateSemesters}
          />
        );
      case 'parciales':
        return (
          <Parciales
            parciales={db.parciales}
            semesters={db.semesters}
            subjects={db.subjects}
            exams={db.exams}
            submissions={db.submissions}
            onUpdateParciales={updateParciales}
            toast={showToast}
            currentUser={currentUser}
            users={db.users}
            onDeduplicateParciales={handleDeduplicateParciales}
            onSendToRecycle={(p) => handleSendToRecycle('parcial', p, p.nombre, p.asignatura, `Semestre: ${p.semestre || 'S/S'}`)}
            onOpenBuilder={(id) => setActiveEditExamId(id)}
            onUpdateExams={updateExams}
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
            assignments={db.assignments}
            assignmentSubmissions={db.assignmentSubmissions || []}
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
            gradeRecords={db.gradeRecords}
            onUpdateGradeRecords={updateGradeRecords}
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
              setActiveTab('historialAcademico');
              showToast('Mostrando ficha del estudiante seleccionado', 'success');
            }}
            toast={showToast}
            onDeduplicateStudents={handleDeduplicateStudents}
            onSendToRecycle={(st) => handleSendToRecycle('estudiante', st, st.nombre, st.email, `Cédula: ${st.cedula || 'S/C'} · Código: ${st.codigo || 'S/C'}`)}
          />
        );
      case 'papelera':
        return (
          <Papelera
            items={db.recycleBin || []}
            onRestore={handleRestoreFromRecycle}
            onPermanentDelete={handlePermanentDelete}
            onEmptyTrash={handleEmptyTrash}
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
      case 'notificaciones':
        return (
          <CentroNotificaciones
            currentUser={currentUser}
            exams={db.exams}
            assignments={db.assignments}
            assignmentSubmissions={db.assignmentSubmissions || []}
            submissions={db.submissions}
            subjects={db.subjects}
            parciales={db.parciales}
            onNavigate={(tab) => {
              setActiveTab(tab);
              setActiveEditExamId(null);
            }}
            onTakeExam={(id) => setActiveTakeExamId(id)}
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
        <div id="loginPage" className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#070d18] relative overflow-x-hidden flex-col select-none">
          {/* Subtle cosmic ambient background lighting */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-b from-cyan-500/10 via-blue-600/5 to-transparent blur-3xl pointer-events-none" />
          <div className="absolute bottom-10 -right-20 w-80 h-80 bg-emerald-500/5 blur-3xl pointer-events-none" />
          
          {/* Subtle cosmic grid backdrop */}
          <div 
            className="absolute inset-0 opacity-[0.035] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(rgba(255,255,255,0.7) 1px, transparent 1px)',
              backgroundSize: '28px 28px'
            }}
          />

          {/* Centered Floating Bio-Cosmic Card (Exact match to image_2728e0a8.png) */}
          <div className="w-full max-w-[430px] bg-[#0c1626]/95 backdrop-blur-2xl rounded-[32px] p-6 sm:p-8 border border-[#1b2b48]/90 shadow-[0_25px_70px_rgba(0,0,0,0.85)] relative z-10 flex flex-col items-center">
            
            {/* Top Glowing Emblem: Touching it discreetly prepares the admin identifier but NEVER enters without password */}
            <div 
              onClick={handleSecretLogoTouch}
              title="Portal Bio-Cósmico Synapsis"
              className="group relative cursor-pointer flex flex-col items-center justify-center transition-transform hover:scale-105 active:scale-95 select-none"
            >
              {/* Outer soft glowing neon halo */}
              <div className="absolute inset-0 rounded-full bg-cyan-500/20 blur-md group-hover:bg-cyan-400/35 transition-all duration-300" />
              
              {/* Emblem Artwork Container */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-[0_0_15px_rgba(6,182,212,0.6)]">
                  {/* Outer glowing circular ring */}
                  <circle cx="80" cy="80" r="74" fill="none" stroke="url(#emblemGlow)" strokeWidth="2.5" strokeDasharray="3 2" opacity="0.65" />
                  <circle cx="80" cy="80" r="68" fill="#091424" stroke="#0e3b5e" strokeWidth="2" />
                  
                  {/* Cyber pixel accents left & right */}
                  <rect x="24" y="70" width="4" height="4" fill="#38bdf8" opacity="0.8" />
                  <rect x="29" y="76" width="3" height="3" fill="#38bdf8" opacity="0.6" />
                  <rect x="132" y="70" width="4" height="4" fill="#38bdf8" opacity="0.8" />
                  <rect x="128" y="76" width="3" height="3" fill="#38bdf8" opacity="0.6" />
                  <rect x="124" y="82" width="3" height="3" fill="#38bdf8" opacity="0.5" />
                  
                  {/* Open Book Wings */}
                  <path 
                    d="M 40 86 Q 80 96 80 84 Q 80 96 120 86 L 118 106 Q 80 98 80 110 Q 80 98 42 106 Z" 
                    fill="url(#bookGrad)" 
                    stroke="#38bdf8" 
                    strokeWidth="1.5" 
                  />
                  <line x1="80" y1="84" x2="80" y2="110" stroke="#bae6fd" strokeWidth="1.5" />

                  {/* Graduation Cap */}
                  <polygon points="80,36 122,50 80,64 38,50" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
                  <polygon points="56,56 80,64 104,56 100,68 80,75 60,68" fill="#0369a1" />
                  {/* Tassel */}
                  <path d="M 80 50 L 114 62 L 114 74" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
                  <circle cx="114" cy="74" r="2" fill="#fbbf24" />

                  {/* Radiant central spark/cross */}
                  <circle cx="80" cy="78" r="2.5" fill="#ffffff" />
                  <path d="M 80 72 L 80 84 M 74 78 L 86 78" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

                  {/* Inner Banner "SYNAPSIS" */}
                  <text 
                    x="80" 
                    y="126" 
                    textAnchor="middle" 
                    fontSize="13" 
                    fontWeight="900" 
                    fontFamily="Inter, sans-serif" 
                    letterSpacing="3" 
                    fill="#38bdf8"
                  >
                    SYNAPSIS
                  </text>
                  
                  {/* Motto "Aprende · Crece · Sirve" */}
                  <text 
                    x="80" 
                    y="138" 
                    textAnchor="middle" 
                    fontSize="5" 
                    fontWeight="700" 
                    fontFamily="Inter, sans-serif" 
                    letterSpacing="1" 
                    fill="#7dd3fc" 
                    opacity="0.8"
                  >
                    Aprende • Crece • Sirve
                  </text>

                  {/* SVG Gradients */}
                  <defs>
                    <linearGradient id="emblemGlow" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="50%" stopColor="#22d3ee" />
                      <stop offset="100%" stopColor="#059669" />
                    </linearGradient>
                    <linearGradient id="bookGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0284c7" />
                      <stop offset="100%" stopColor="#034b75" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Title & Subtitle exact match to image_2728e0a8.png */}
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-2 text-center">
              Synapsis
            </h1>
            <p className="text-[11px] font-black text-[#22d3ee] tracking-[0.22em] uppercase mt-1 font-mono text-center">
              PORTAL BIO-CÓSMICO
            </p>
            <p className="text-xs text-slate-400 font-normal text-center max-w-[280px] mt-2 leading-relaxed">
              Descubre, aprende y evalúa en conexión con el universo y el conocimiento
            </p>

            {/* FORM BODY */}
            {loginTab === 'login' ? (
              <form onSubmit={handleLogin} className="w-full mt-6 space-y-4">
                {/* Field 1: CORREO INSTITUCIONAL */}
                <div className="w-full">
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest block mb-1.5 text-left font-sans">
                    CORREO INSTITUCIONAL
                  </label>
                  <div className="w-full bg-white rounded-2xl flex items-center px-4 py-3 shadow-inner border border-transparent focus-within:border-cyan-500 transition-all">
                    <UserIcon className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                    <input 
                      type="text" 
                      name="email"
                      id="email"
                      required
                      value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)}
                      placeholder="ej: correo@synapsis.edu"
                      className="w-full bg-transparent text-slate-900 text-xs sm:text-sm font-medium outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                {/* Field 2: CONTRASEÑA ÚNICA */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-widest font-sans">
                      CONTRASEÑA ÚNICA
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsRecuperarModalOpen(true)}
                      className="text-[11px] text-[#22d3ee] hover:text-[#67e8f9] font-medium transition-colors cursor-pointer"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                  <div className="w-full bg-white rounded-2xl flex items-center px-4 py-3 shadow-inner border border-transparent focus-within:border-cyan-500 transition-all">
                    <Lock className="w-4 h-4 text-slate-400 mr-2.5 shrink-0" />
                    <input 
                      type={showPassword ? "text" : "password"}
                      name="password"
                      id="login-password"
                      required
                      value={loginPass}
                      onChange={e => setLoginPass(e.target.value)}
                      placeholder="........"
                      className="w-full bg-transparent text-slate-900 text-xs sm:text-sm font-medium outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded cursor-pointer shrink-0 ml-1"
                      title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Submit Button: Iniciar sesión portal */}
                <button 
                  type="submit" 
                  disabled={isLoggingIn}
                  className="w-full mt-5 py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#00b080] via-[#059669] to-[#0d9488] hover:from-[#059669] hover:to-[#0f766e] text-white font-bold text-sm tracking-wide shadow-lg shadow-emerald-500/25 transition-all transform active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isLoggingIn ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Verificando credenciales en la nube...</span>
                    </>
                  ) : (
                    <span>Iniciar sesión portal</span>
                  )}
                </button>
              </form>
            ) : (
              /* REGISTRO DE NUEVO ESTUDIANTE EN LA MISMA TARJETA */
              <form onSubmit={handleRegisterStudent} className="w-full mt-5 space-y-3 animate-fade-in text-left">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-2 mb-2">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Matrícula de Nuevo Estudiante
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setLoginTab('login')}
                    className="text-[11px] text-cyan-400 hover:underline cursor-pointer"
                  >
                    ← Iniciar sesión
                  </button>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Nombre Completo *
                  </label>
                  <input 
                    type="text" 
                    required
                    value={regNombre}
                    onChange={e => setRegNombre(e.target.value)}
                    placeholder="ej: María Carmen Gómez"
                    className="w-full bg-white rounded-xl px-3.5 py-2 text-slate-900 text-xs font-medium outline-none placeholder:text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                      Correo *
                    </label>
                    <input 
                      type="email" 
                      required
                      value={regEmail}
                      onChange={e => setRegEmail(e.target.value)}
                      placeholder="correo@ejemplo.com"
                      className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 text-xs font-medium outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                      Cédula *
                    </label>
                    <input 
                      type="text" 
                      required
                      value={regCedula}
                      onChange={e => setRegCedula(e.target.value)}
                      placeholder="ej: 1107065653"
                      className="w-full bg-white rounded-xl px-3 py-2 text-slate-900 text-xs font-medium outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                      Celular *
                    </label>
                    <input 
                      type="tel" 
                      required
                      value={regCelular}
                      onChange={e => setRegCelular(e.target.value)}
                      placeholder="ej: 3001234567"
                      className="w-full bg-white rounded-xl px-3.5 py-2 text-slate-900 text-xs font-medium outline-none placeholder:text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                      Semestre
                    </label>
                    <select 
                      value={regSemestre}
                      onChange={e => setRegSemestre(e.target.value)}
                      className="w-full bg-white rounded-xl px-2 py-2 text-slate-900 text-xs font-medium outline-none cursor-pointer"
                    >
                      <option value="SEMESTRE I">SEMESTRE I</option>
                      <option value="SEMESTRE II">SEMESTRE II</option>
                      <option value="SEMESTRE III">SEMESTRE III</option>
                      <option value="SEMESTRE IV">SEMESTRE IV</option>
                      <option value="SEMESTRE V">SEMESTRE V</option>
                      <option value="SEMESTRE VI">SEMESTRE VI</option>
                      <option value="SEMESTRE VII">SEMESTRE VII</option>
                      <option value="SEMESTRE VIII">SEMESTRE VIII</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-300 uppercase tracking-wider block mb-1">
                    Contraseña *
                  </label>
                  <div className="w-full bg-white rounded-xl flex items-center px-3.5 py-2">
                    <input 
                      type={regShowPass ? "text" : "password"}
                      required
                      minLength={6}
                      value={regPass}
                      onChange={e => setRegPass(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full bg-transparent text-slate-900 text-xs font-medium outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="button"
                      onClick={() => setRegShowPass(!regShowPass)}
                      className="text-slate-400 hover:text-slate-700 transition-colors p-0.5 rounded cursor-pointer shrink-0 ml-1"
                      title={regShowPass ? "Ocultar contraseña" : "Ver contraseña"}
                    >
                      {regShowPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isRegistering}
                  className="w-full mt-3 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  {isRegistering ? 'Matriculando...' : 'Completar Matrícula y Acceder'}
                </button>
              </form>
            )}

            {/* Horizontal divider */}
            <div className="w-full border-t border-slate-800/80 my-5" />

            {/* Footer link exact match to image_2728e0a8.png */}
            <button
              type="button"
              onClick={() => setLoginTab(loginTab === 'login' ? 'register' : 'login')}
              className="text-xs text-slate-300 hover:text-[#22d3ee] font-medium transition-colors cursor-pointer select-none"
            >
              {loginTab === 'login' ? '¿Eres nuevo? Regístrate aquí' : '¿Ya tienes cuenta? Iniciar sesión aquí'}
            </button>
          </div>

          {/* Institutional copyright note */}
          <p className="mt-5 text-[11px] text-slate-500 font-medium text-center">
            Synapsis ERP · Sistema Integral Cloud · Conexión Segura SSL
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
            onOpenShareModal={() => setIsShareModalOpen(true)}
            onSyncFirebase={handleManualSync}
            isSyncing={isSyncingFirebase}
            onNavigate={(tab) => {
              if (tab === 'dashboard') {
                const defaultCat = currentUser?.rol === 'estudiante' ? 'estudiante' : currentUser?.rol === 'docente' ? 'docente' : 'admin';
                setDashboardCategory(defaultCat);
                try { localStorage.setItem('synapsis_dash_cat', defaultCat); } catch(e) {}
              }
              setActiveTab(tab);
              setActiveEditExamId(null);
            }}
            activeTab={activeTab}
            categoryName={activeTab !== 'dashboard' ? getModuleCategory(activeTab).name : undefined}
            recycleCount={(db.recycleBin || []).length}
          />

          <div className={`flex-1 flex flex-col relative pt-[60px] ${activeTab === 'dashboard' ? 'bg-[#03181e]' : 'bg-slate-50'}`}>
            {/* MAIN CONTENT WORKSPACE (Full width pantalla completa & focused module view) */}
            <main className={`flex-1 p-2 sm:p-4 md:p-5 ${activeTab === 'dashboard' ? 'bg-[#03181e] min-h-[calc(100vh-60px)]' : 'bg-slate-50'} w-full overflow-x-hidden relative`}>
              {/* Opción destacada: Volver a la categoría exacta del módulo o al menú general */}
              {activeTab !== 'dashboard' && (
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-[#05242a] via-[#072f38] to-[#093944] border border-[#11505e] px-4 py-2.5 rounded-2xl shadow-md animate-fade-in select-none">
                  <div className="flex items-center gap-2">
                    {/* Botón principal: Volver a Menú (regresa posicionado en la categoría del módulo con sus tarjetas visibles, tal como en la segunda captura) */}
                    <button
                      type="button"
                      onClick={() => {
                        const cat = getModuleCategory(activeTab);
                        setDashboardCategory(cat.id);
                        try { localStorage.setItem('synapsis_dash_cat', cat.id); } catch(e) {}
                        setActiveTab('dashboard');
                        setActiveEditExamId(null);
                      }}
                      className="flex items-center gap-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 px-4 py-2 rounded-xl transition-all cursor-pointer shadow-md group active:scale-95"
                      title="Regresar al menú principal"
                    >
                      <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                      <span>Volver a Menú</span>
                    </button>

                    {/* Botón secundario: Ver Todas las Categorías */}
                    <button
                      type="button"
                      onClick={() => {
                        setDashboardCategory('todas');
                        try { localStorage.setItem('synapsis_dash_cat', 'todas'); } catch(e) {}
                        setActiveTab('dashboard');
                        setActiveEditExamId(null);
                      }}
                      className="flex items-center gap-1.5 text-xs font-semibold text-teal-200 hover:text-white bg-[#041c21] hover:bg-[#0a3842] border border-[#115463] px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                      title="Ver todas las categorías del menú"
                    >
                      <LayoutGrid className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Todas las Categorías</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <span className="text-[11px] font-mono text-teal-200/70 hidden sm:inline">
                      Módulo actual:
                    </span>
                    <div className="relative">
                      <select
                        value={activeTab}
                        onChange={(e) => {
                          const newTab = e.target.value;
                          if (newTab !== activeTab) {
                            setActiveTab(newTab);
                            setActiveEditExamId(null);
                          }
                        }}
                        className="bg-[#041c21] border border-[#115463] text-cyan-300 text-xs font-bold rounded-xl pl-3 pr-7 py-1.5 focus:outline-none focus:border-cyan-400 cursor-pointer shadow-xs appearance-none truncate max-w-[210px] sm:max-w-[250px]"
                        title="Cambiar a otro módulo sin tener que salir al menú principal"
                      >
                        {ALL_MODULE_TABS
                          .filter(m => isTabAllowedForUser(m.id, currentUser))
                          .map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-cyan-400 text-[9px]">
                        ▼
                      </div>
                    </div>
                  </div>
                </div>
              )}

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
              onExit={() => {
                setActiveTakeExamId(null);
                setDashboardCategory('estudiante');
                try { localStorage.setItem('synapsis_dash_cat', 'estudiante'); } catch(e) {}
              }}
              onSubmit={async (sub) => {
                // Marcar en cola de respaldo local mientras confirmamos persistencia remota
                addPendingSubmissionId(sub.id);
                const latestSubs = currentDbRef.current.submissions || [];
                const existingIdx = latestSubs.findIndex(s => s.id === sub.id);
                const nextSubs = existingIdx > -1
                  ? latestSubs.map((s, idx) => idx === existingIdx ? sub : s)
                  : [sub, ...latestSubs];

                const res = await updateSubmissions(nextSubs, [sub.id]);
                if (res.remoteSynced) {
                  removePendingSubmissionId(sub.id);
                  showToast('Examen enviado y guardado correctamente en la nube ✓', 'success');
                } else {
                  showToast('Examen guardado en tu dispositivo. Se sincronizará automáticamente al restablecer conexión.', 'warning');
                }
                return res;
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
        currentState={db}
        stats={{
          subjects: db.subjects.length,
          semesters: db.semesters.length,
          parciales: db.parciales.length,
          users: db.users.length,
          exams: db.exams.length,
          grades: db.gradeRecords.length,
          submissions: db.submissions.length
        }}
      />

      {/* PASSWORD RECOVERY & CREDENTIAL LOOKUP MODAL */}
      <RecuperarPasswordModal
        isOpen={isRecuperarModalOpen}
        onClose={() => setIsRecuperarModalOpen(false)}
        users={db.users}
        prefillIdentifier={loginEmail}
        toast={showToast}
        onPasswordResetSuccess={(updatedUser) => {
          // 1. Update user in local state immediately
          const existingIdx = db.users.findIndex(u => u.id === updatedUser.id);
          let nextUsers: User[];
          if (existingIdx > -1) {
            nextUsers = [...db.users];
            nextUsers[existingIdx] = updatedUser;
          } else {
            nextUsers = [...db.users, updatedUser];
          }
          updateUsers(nextUsers);

          // 2. Prefill login form
          setLoginEmail(updatedUser.email);
          setLoginPass(updatedUser.pass);
          setLoginTab('login');
          showToast(`¡Contraseña restablecida con éxito para ${updatedUser.nombre}! Ya puedes ingresar.`, 'success');
        }}
      />

    </div>
  );
}
