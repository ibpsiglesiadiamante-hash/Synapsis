import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDocs, collection, onSnapshot, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
export const auth = getAuth(app);

// Test connection on boot as instructed in SKILL.md
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();

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

// Circuit breaker state to prevent infinite exception/retry cycles when Firestore permissions are restricted
let isFirestoreAvailable = true;

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  
  // Trip the circuit breaker on permission or connectivity failures
  if (
    errStr.includes('permission') || 
    errStr.includes('insufficient') || 
    errStr.includes('unavailable') || 
    errStr.includes('offline')
  ) {
    if (isFirestoreAvailable) {
      console.warn("Cloud Firestore permission or connectivity restriction detected. Tripping sync circuit-breaker. App will run in standalone safe local mode.");
      isFirestoreAvailable = false;
    }
  }

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

/**
 * Generic Firebase synchronization methods
 */
export async function fetchCollectionFromFirestore<T>(collName: string): Promise<T[]> {
  if (!isFirestoreAvailable) {
    return [];
  }
  try {
    const querySnapshot = await getDocs(collection(db, collName));
    const items: T[] = [];
    querySnapshot.forEach((docSnapshot) => {
      items.push(docSnapshot.data() as T);
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, collName);
    return [];
  }
}

export async function saveDocToFirestore<T extends { id: string }>(collName: string, item: T): Promise<void> {
  if (!isFirestoreAvailable) {
    return;
  }
  try {
    await setDoc(doc(db, collName, item.id), item as any);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${collName}/${item.id}`);
  }
}

import { User, Subject, Semester, Parcial, GradeRecord, Assignment, Institution, Exam, Submission } from '../types';

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
}

/**
 * Fetch the complete application state from Firestore
 * Returns null if the users collection is empty (meaning database is completely uninitialized)
 */
export async function fetchFullStateFromFirestore(): Promise<AppState | null> {
  if (!isFirestoreAvailable) {
    return null;
  }

  const fetchPromise = async (): Promise<AppState | null> => {
    try {
      const users = await fetchCollectionFromFirestore<User>('users');
      if (users.length === 0) {
        return null; // DB is completely fresh/empty
      }

      const [
        institutions,
        subjects,
        semesters,
        parciales,
        exams,
        submissions,
        gradeRecords,
        assignments
      ] = await Promise.all([
        fetchCollectionFromFirestore<Institution>('institutions'),
        fetchCollectionFromFirestore<Subject>('subjects'),
        fetchCollectionFromFirestore<Semester>('semesters'),
        fetchCollectionFromFirestore<Parcial>('parciales'),
        fetchCollectionFromFirestore<Exam>('exams'),
        fetchCollectionFromFirestore<Submission>('submissions'),
        fetchCollectionFromFirestore<GradeRecord>('gradeRecords'),
        fetchCollectionFromFirestore<Assignment>('assignments'),
      ]);

      return {
        users,
        institutions,
        subjects,
        semesters,
        parciales,
        exams,
        submissions,
        gradeRecords,
        assignments,
      };
    } catch (error) {
      console.error('Failed to download full db state from Firestore, running local.', error);
      return null;
    }
  };

  // Prevent app loader hanging indefinitely if firestore calls hover forever due to network or configuration blocks
  const timeoutPromise = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.warn("Firestore collection download timed out. Continuing in safety standalone mode.");
      isFirestoreAvailable = false;
      resolve(null);
    }, 3000);
  });

  return Promise.race([fetchPromise(), timeoutPromise]);
}

/**
 * Seeds the fresh Firestore database structures with default seed state
 */
export async function seedFirestore(initialState: AppState): Promise<void> {
  if (!isFirestoreAvailable) {
    return;
  }

  const seedPromise = async (): Promise<void> => {
    try {
      console.log('Seeding fresh Firestore database with institutional structures...');
      const promises: Promise<void>[] = [];

      initialState.users.forEach(item => promises.push(saveDocToFirestore('users', item)));
      initialState.institutions.forEach(item => promises.push(saveDocToFirestore('institutions', item)));
      initialState.subjects.forEach(item => promises.push(saveDocToFirestore('subjects', item)));
      initialState.semesters.forEach(item => promises.push(saveDocToFirestore('semesters', item)));
      initialState.parciales.forEach(item => promises.push(saveDocToFirestore('parciales', item)));
      initialState.exams.forEach(item => promises.push(saveDocToFirestore('exams', item)));
      initialState.submissions.forEach(item => promises.push(saveDocToFirestore('submissions', item)));
      initialState.gradeRecords.forEach(item => promises.push(saveDocToFirestore('gradeRecords', item)));
      initialState.assignments.forEach(item => promises.push(saveDocToFirestore('assignments', item)));

      await Promise.all(promises);
      console.log('Firestore seeding completed successfully.');
    } catch (error) {
      console.error('Failed to seed default state onto Firestore.', error);
    }
  };

  // Guard against seed operations hanging on un-provisioned databases or blocked client environments
  const timeoutPromise = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn("Firestore database seeding timed out. Continuing in safety standalone mode.");
      isFirestoreAvailable = false;
      resolve();
    }, 3000);
  });

  return Promise.race([seedPromise(), timeoutPromise]);
}

// Keep a local cached string version of the last synced collections to avoid redundant Firestore writes and save quota
let lastSyncedCache: Record<string, string> = {};

/**
 * Intelligently synchronizes the local AppState changes to Firestore.
 * Utilizes key-based comparison (hashes/strings) to only write documents that are brand-new or modified.
 */
export async function syncToFirestore(newState: AppState): Promise<void> {
  if (!isFirestoreAvailable) {
    return;
  }
  try {
    const keys: (keyof AppState)[] = [
      'users',
      'institutions',
      'subjects',
      'semesters',
      'parciales',
      'exams',
      'submissions',
      'gradeRecords',
      'assignments'
    ];

    const promises: Promise<void>[] = [];

    keys.forEach((key) => {
      const currentList = newState[key] as any[];
      const listString = JSON.stringify(currentList);
      
      // If this list is exactly the same as the last sync cache, skip it
      if (lastSyncedCache[key] === listString) {
        return;
      }

      // Track individual items to write modified or new ones
      const oldList = lastSyncedCache[key] ? JSON.parse(lastSyncedCache[key]) : [];
      const oldMap = new Map<string, string>(oldList.map((item: any) => [item.id, JSON.stringify(item)]));

      currentList.forEach((item: any) => {
        const itemString = JSON.stringify(item);
        if (oldMap.get(item.id) !== itemString) {
          // Write to Firestore as it is modified or new
          promises.push(saveDocToFirestore(key, item));
        }
      });

      // Update cache
      lastSyncedCache[key] = listString;
    });

    if (promises.length > 0) {
      await Promise.all(promises);
      console.log(`Synced ${promises.length} modified entities to Firestore.`);
    }
  } catch (error) {
    console.error('Error synchronizing local AppState changes to remote Firestore.', error);
  }
}

/**
 * Initialize cache after downloading full state
 */
export function initializeSyncCache(state: AppState) {
  const keys: (keyof AppState)[] = [
    'users',
    'institutions',
    'subjects',
    'semesters',
    'parciales',
    'exams',
    'submissions',
    'gradeRecords',
    'assignments'
  ];
  keys.forEach((key) => {
    lastSyncedCache[key] = JSON.stringify(state[key]);
  });
}

