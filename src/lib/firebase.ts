import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection, onSnapshot, getDocFromServer, deleteDoc, getDoc, query, where } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = (!firebaseConfig.firestoreDatabaseId || firebaseConfig.firestoreDatabaseId === '(default)')
  ? getFirestore(app)
  : getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Firebase Disconnected: Platform operates exclusively on Supabase (PostgreSQL) and Render
async function testConnection() {
  // Disconnected
  return;
}

// Define error helper as instructed in SKILL.md
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Standalone mode: Firebase disconnected, routing to Supabase
let isFirestoreAvailable = false;

export function enableFirestore() {
  isFirestoreAvailable = false;
}

export function getIsFirestoreAvailable(): boolean {
  return false;
}

export function getFirebaseAppInfo() {
  const pId = firebaseConfig.projectId || 'synapsis-ec';
  return {
    projectId: pId,
    appId: firebaseConfig.appId,
    appName: pId,
    databaseId: firebaseConfig.firestoreDatabaseId || '(default)',
    officialUrl: `https://${pId}.web.app`
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

import { 
  saveDocToSupabase, 
  deleteDocFromSupabase, 
  fetchCollectionFromSupabase, 
  pushAllStateToSupabase,
  fetchUserByCredentials as fetchUserByCredentialsFromSupabase,
  resetUserPasswordInCloud as resetUserPasswordInCloudFromSupabase
} from './supabase';

/**
 * Generic Firebase synchronization methods (Delegated to Supabase)
 */
export async function fetchCollectionFromFirestore<T>(collName: string): Promise<T[]> {
  return fetchCollectionFromSupabase<T>(collName);
}

export function sanitizeForFirestore(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

export async function saveDocToFirestore<T extends { id: string }>(collName: string, item: T, _mirrorToSupabase: boolean = true): Promise<void> {
  // Disconnected from Firebase: write directly to Supabase
  await saveDocToSupabase(collName, item);
  itemSyncCache.set(`${collName}/${item.id}`, JSON.stringify(item));
}

export async function deleteDocFromFirestore(collName: string, docId: string): Promise<void> {
  if (!docId) return;
  markAsDeleted(docId);
  itemSyncCache.delete(`${collName}/${docId}`);
  // Disconnected from Firebase: delete directly from Supabase
  await deleteDocFromSupabase(collName, docId);
}

import { User, Subject, Semester, Parcial, GradeRecord, Assignment, AssignmentSubmission, Institution, Exam, Submission, RecycleItem } from '../types';
import { mergeStates, saveState, getDeletedIds, markAsDeleted, unmarkAsDeleted, getRecycleBin, saveRecycleBin, PROTECTED_IDS } from './db';

export interface AppState {
  users: User[];
  institutions: Institution[];
  subjects: Subject[];
  semesters: Semester[];
  parciales: Parcial[];
  exams: Exam[];
  submissions: Submission[];
  gradeRecords: GradeRecord[];
  assignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  recycleBin?: RecycleItem[];
}

/**
 * Synchronize deleted IDs with Firestore to ensure that once a record is deleted,
 * it never reappears on refresh or across devices.
 */
export async function syncDeletedIdsWithFirestore(): Promise<Set<string>> {
  const localDeleted = getDeletedIds();
  if (!isFirestoreAvailable) {
    PROTECTED_IDS.forEach(pid => localDeleted.delete(pid));
    return localDeleted;
  }
  try {
    const metaRef = doc(db, 'system_metadata', 'deleted_records');
    const snap = await getDoc(metaRef);
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.ids)) {
        data.ids.forEach((id: string) => {
          if (id && !PROTECTED_IDS.has(id)) localDeleted.add(id);
        });
      }
    }
    PROTECTED_IDS.forEach(pid => localDeleted.delete(pid));
    // Update local storage
    try {
      localStorage.setItem('ep_deleted_ids', JSON.stringify(Array.from(localDeleted)));
    } catch (e) {}

    // Save consolidated set back to Firestore
    await setDoc(metaRef, { ids: Array.from(localDeleted), lastUpdated: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('Could not synchronize deleted records with cloud, continuing with local set.', e);
  }
  PROTECTED_IDS.forEach(pid => localDeleted.delete(pid));
  return localDeleted;
}

/**
 * Permanently registers an ID as deleted both locally and in Cloud Firestore.
 */
export async function registerDeletedId(id: string, collName?: string): Promise<void> {
  if (!id || PROTECTED_IDS.has(id)) return;
  markAsDeleted(id);
  if (collName) {
    deleteDocFromFirestore(collName, id).catch(() => {});
  }
  if (isFirestoreAvailable) {
    try {
      const metaRef = doc(db, 'system_metadata', 'deleted_records');
      const allDeleted = Array.from(getDeletedIds());
      await setDoc(metaRef, { ids: allDeleted, lastUpdated: new Date().toISOString() }, { merge: true });
    } catch (e) {
      // Background sync error ignored
    }
  }
}

/**
 * Removes an ID from the deleted registry (e.g. when restored from the Recycle Bin).
 */
export async function unRegisterDeletedId(id: string): Promise<void> {
  if (!id) return;
  unmarkAsDeleted(id);
  if (isFirestoreAvailable) {
    try {
      const metaRef = doc(db, 'system_metadata', 'deleted_records');
      const allDeleted = Array.from(getDeletedIds());
      await setDoc(metaRef, { ids: allDeleted, lastUpdated: new Date().toISOString() }, { merge: true });
    } catch (e) {
      // Background sync error ignored
    }
  }
}

export async function saveRecycleItemToFirestore(item: RecycleItem): Promise<void> {
  if (!isFirestoreAvailable) return;
  try {
    await saveDocToFirestore('recycle_bin', item, false);
  } catch (e) {
    console.warn('Failed to save recycle item to Firestore:', e);
  }
}

export async function deleteRecycleItemFromFirestore(id: string): Promise<void> {
  if (!isFirestoreAvailable) return;
  try {
    await deleteDocFromFirestore('recycle_bin', id);
  } catch (e) {
    console.warn('Failed to delete recycle item from Firestore:', e);
  }
}

/**
 * Fetch the complete application state from Firestore (Disconnected: Supabase is authoritative)
 */
export async function fetchFullStateFromFirestore(): Promise<AppState | null> {
  // Disconnected from Firebase: all data is fetched from Supabase
  return null;
}

/**
 * Seeds the fresh Firestore database structures with default seed state (Disconnected)
 */
export async function seedFirestore(_initialState: AppState): Promise<void> {
  return;
}

// Keep a local cache of individual synced items to avoid redundant Firestore writes and save quota
let itemSyncCache = new Map<string, string>();

/**
 * Intelligently synchronizes the local AppState changes to cloud (Delegated to Supabase).
 */
export async function syncToFirestore(newState: AppState): Promise<void> {
  try {
    await pushAllStateToSupabase(newState);
  } catch (error) {
    console.error('Error synchronizing local AppState changes to Supabase:', error);
  }
}

/**
 * Initialize cache after downloading full state
 */
export function initializeSyncCache(state: AppState) {
  itemSyncCache.clear();
  const keys: (keyof AppState)[] = [
    'users',
    'institutions',
    'subjects',
    'semesters',
    'parciales',
    'exams',
    'submissions',
    'gradeRecords',
    'assignments',
    'assignmentSubmissions'
  ];
  keys.forEach((key) => {
    const list = state[key] as any[];
    if (list && Array.isArray(list)) {
      list.forEach((item) => {
        itemSyncCache.set(`${key}/${item.id}`, JSON.stringify(item));
      });
    }
  });
}

/**
 * Pushes all records of the given AppState to Cloud (Delegated to Supabase)
 */
export async function pushAllStateToFirestore(state: AppState): Promise<number> {
  const count = await pushAllStateToSupabase(state);
  initializeSyncCache(state);
  return count;
}

/**
 * Specifically uploads all official biblical subjects and their academic semester configuration to Firestore
 */
export async function uploadTheologicalSubjectsToFirestore(subjects: Subject[]): Promise<number> {
  enableFirestore();
  let count = 0;
  const deletedIds = getDeletedIds();
  const promises: Promise<void>[] = [];

  for (const sub of subjects) {
    if (sub && sub.id && !deletedIds.has(sub.id)) {
      count++;
      promises.push(saveDocToFirestore('subjects', sub).catch(e => {
        console.warn(`Error writing subject ${sub.nombre} to Firestore:`, e);
      }));
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
    console.log(`Uploaded ${count} subjects to Cloud Firestore.`);
  }
  return count;
}

/**
 * Uploads all registered students to Cloud Firestore
 */
export async function uploadAllStudentsToFirestore(users: User[]): Promise<number> {
  enableFirestore();
  let count = 0;
  const deletedIds = getDeletedIds();
  const promises: Promise<void>[] = [];

  for (const user of users) {
    if (user && user.id && !deletedIds.has(user.id)) {
      count++;
      promises.push(saveDocToFirestore('users', user).catch(e => {
        console.warn(`Error writing user ${user.nombre} to Firestore:`, e);
      }));
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
    console.log(`Uploaded ${count} students/users to Cloud Firestore.`);
  }
  return count;
}

/**
 * Uploads all registered exams to Cloud Firestore
 */
export async function uploadAllExamsToFirestore(exams: Exam[]): Promise<number> {
  enableFirestore();
  let count = 0;
  const deletedIds = getDeletedIds();
  const promises: Promise<void>[] = [];

  for (const exam of exams) {
    if (exam && exam.id && !deletedIds.has(exam.id)) {
      count++;
      promises.push(saveDocToFirestore('exams', exam).catch(e => {
        console.warn(`Error writing exam ${exam.titulo} to Firestore:`, e);
      }));
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
    console.log(`Uploaded ${count} exams to Cloud Firestore.`);
  }
  return count;
}

/**
 * Uploads all registered parciales to Cloud Firestore
 */
export async function uploadAllParcialesToFirestore(parciales: Parcial[]): Promise<number> {
  enableFirestore();
  let count = 0;
  const deletedIds = getDeletedIds();
  const promises: Promise<void>[] = [];

  for (const p of parciales) {
    if (p && p.id && !deletedIds.has(p.id)) {
      count++;
      promises.push(saveDocToFirestore('parciales', p).catch(e => {
        console.warn(`Error writing parcial ${p.nombre} to Firestore:`, e);
      }));
    }
  }

  if (promises.length > 0) {
    await Promise.all(promises);
    console.log(`Uploaded ${count} parciales to Cloud Firestore.`);
  }
  return count;
}

/**
 * Synchronizes auxiliary collections stored in localStorage with Cloud Firestore
 */
export async function syncSecondaryCollections(): Promise<number> {
  enableFirestore();
  let count = 0;

  // 1. Tablón de anuncios
  try {
    const remoteNotices = await fetchCollectionFromFirestore<any>('tablon');
    const localNoticesRaw = localStorage.getItem('ep_tablon');
    const localNotices = localNoticesRaw ? JSON.parse(localNoticesRaw) : [];

    const map = new Map<string, any>();
    remoteNotices.forEach((n) => n.id && map.set(n.id, n));
    localNotices.forEach((n: any) => {
      if (n && n.id) {
        if (!map.has(n.id)) {
          map.set(n.id, n);
        } else {
          const rem = map.get(n.id);
          const lT = n.creado || '';
          const rT = rem.creado || '';
          if (lT >= rT) map.set(n.id, n);
        }
      }
    });
    const mergedNotices = Array.from(map.values());
    if (mergedNotices.length > 0) {
      localStorage.setItem('ep_tablon', JSON.stringify(mergedNotices));
      for (const notice of mergedNotices) {
        await saveDocToFirestore('tablon', notice);
        count++;
      }
    }
  } catch (e) {
    console.warn('Tablon sync error:', e);
  }

  // 2. Finanzas (pagos)
  try {
    const remotePayments = await fetchCollectionFromFirestore<any>('payments');
    const localPaymentsRaw = localStorage.getItem('ep_finanzas');
    const localPayments = localPaymentsRaw ? JSON.parse(localPaymentsRaw) : [];

    const map = new Map<string, any>();
    remotePayments.forEach((p) => p.id && map.set(p.id, p));
    localPayments.forEach((p: any) => {
      if (p && p.id) map.set(p.id, p);
    });
    const mergedPayments = Array.from(map.values());
    if (mergedPayments.length > 0) {
      localStorage.setItem('ep_finanzas', JSON.stringify(mergedPayments));
      for (const payment of mergedPayments) {
        await saveDocToFirestore('payments', payment);
        count++;
      }
    }
  } catch (e) {
    console.warn('Finanzas sync error:', e);
  }

  // 3. Agenda
  try {
    const remoteAgenda = await fetchCollectionFromFirestore<any>('agenda');
    const localAgendaRaw = localStorage.getItem('ep_agenda');
    const localAgenda = localAgendaRaw ? JSON.parse(localAgendaRaw) : [];

    const map = new Map<string, any>();
    remoteAgenda.forEach((a) => a.id && map.set(a.id, a));
    localAgenda.forEach((a: any) => {
      if (a && a.id) map.set(a.id, a);
    });
    const mergedAgenda = Array.from(map.values());
    if (mergedAgenda.length > 0) {
      localStorage.setItem('ep_agenda', JSON.stringify(mergedAgenda));
      for (const item of mergedAgenda) {
        await saveDocToFirestore('agenda', item);
        count++;
      }
    }
  } catch (e) {
    console.warn('Agenda sync error:', e);
  }

  // 4. Wiki Articles (Educativo)
  try {
    const remoteWiki = await fetchCollectionFromFirestore<any>('wikiArticles');
    const localWikiRaw = localStorage.getItem('ep_wiki_articles');
    const localWiki = localWikiRaw ? JSON.parse(localWikiRaw) : [];

    const map = new Map<string, any>();
    remoteWiki.forEach((w) => w.id && map.set(w.id, w));
    localWiki.forEach((w: any) => {
      if (w && w.id) map.set(w.id, w);
    });
    const mergedWiki = Array.from(map.values());
    if (mergedWiki.length > 0) {
      localStorage.setItem('ep_wiki_articles', JSON.stringify(mergedWiki));
      for (const item of mergedWiki) {
        await saveDocToFirestore('wikiArticles', item);
        count++;
      }
    }
  } catch (e) {
    console.warn('Wiki sync error:', e);
  }

  // 5. Asistencia (attendance)
  try {
    const remoteAtt = await fetchCollectionFromFirestore<any>('attendance');
    const localAttRaw = localStorage.getItem('ep_attendance');
    const localAtt = localAttRaw ? JSON.parse(localAttRaw) : [];

    const map = new Map<string, any>();
    remoteAtt.forEach((a) => a.id && map.set(a.id, a));
    localAtt.forEach((a: any) => {
      if (a && a.id) map.set(a.id, a);
    });
    const mergedAtt = Array.from(map.values());
    if (mergedAtt.length > 0) {
      localStorage.setItem('ep_attendance', JSON.stringify(mergedAtt));
      for (const item of mergedAtt) {
        await saveDocToFirestore('attendance', item);
        count++;
      }
    }
  } catch (e) {
    console.warn('Attendance sync error:', e);
  }

  return count;
}

/**
 * Executes a complete bidirectional synchronization between local state and Cloud Firestore:
 * 1. Pulls all remote documents from Firestore.
 * 2. Merges with local documents (retaining newest edits).
 * 3. Pushes any non-synced documents back to Cloud Firestore.
 * 4. Synchronizes secondary collections (Tablón, Finanzas, Agenda, Wiki, Asistencia).
 * 5. Updates cache and saves to local storage.
 */
export async function fullBidirectionalSync(
  currentState: AppState
): Promise<{ success: boolean; pushedCount: number; pulledCount: number; mergedState: AppState }> {
  enableFirestore();
  let pushedCount = 0;
  let pulledCount = 0;

  try {
    // 1. Fetch remote full state
    const remoteState = await fetchFullStateFromFirestore();
    let mergedState = currentState;

    if (remoteState) {
      mergedState = mergeStates(currentState, remoteState);
      const keys: (keyof AppState)[] = [
        'users',
        'institutions',
        'subjects',
        'semesters',
        'parciales',
        'exams',
        'submissions',
        'gradeRecords',
        'assignments',
        'assignmentSubmissions'
      ];
      keys.forEach((k) => {
        pulledCount += remoteState[k]?.length || 0;
      });
    }

    // 2. Upload all items of mergedState to Firestore
    const keys: (keyof AppState)[] = [
      'users',
      'institutions',
      'subjects',
      'semesters',
      'parciales',
      'exams',
      'submissions',
      'gradeRecords',
      'assignments',
      'assignmentSubmissions'
    ];

    const pushPromises: Promise<void>[] = [];
    for (const key of keys) {
      const list = (mergedState[key] || []) as any[];
      for (const item of list) {
        if (item && item.id) {
          pushedCount++;
          pushPromises.push(saveDocToFirestore(key, item));
        }
      }
    }
    await Promise.all(pushPromises);

    // 3. Sync secondary collections
    const secCount = await syncSecondaryCollections();
    pushedCount += secCount;

    // 4. Update sync cache and localStorage
    initializeSyncCache(mergedState);
    saveState(mergedState);

    return {
      success: true,
      pushedCount,
      pulledCount,
      mergedState
    };
  } catch (err) {
    console.error('Full bidirectional sync failed:', err);
    return {
      success: false,
      pushedCount,
      pulledCount,
      mergedState: currentState
    };
  }
}

/**
 * Live search for a user in Supabase by email, codigo, cedula or id.
 * Essential for immediate student login after password reset or student registration.
 */
export async function fetchUserByCredentials(identifier: string): Promise<User | null> {
  return fetchUserByCredentialsFromSupabase(identifier);
}

/**
 * Direct password reset for a user in Supabase
 */
export async function resetUserPasswordInCloud(user: User, newPass: string): Promise<User> {
  const updated = await resetUserPasswordInCloudFromSupabase(user, newPass);
  itemSyncCache.set(`users/${updated.id}`, JSON.stringify(updated));
  return updated;
}



