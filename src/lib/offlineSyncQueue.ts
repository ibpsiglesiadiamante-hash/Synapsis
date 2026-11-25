/**
 * Shared IndexedDB outbox for Background Sync (accessible from both Window and Service Worker).
 */

export const SYNC_DB_NAME = 'synapsis-offline-sync';
export const SYNC_DB_VERSION = 1;
export const SYNC_STORE_NAME = 'pending_submissions';
export const EXAM_SYNC_TAG = 'synapsis-exam-submissions-sync';

export interface QueuedSubmissionRecord {
  id: string;
  table: 'submissions';
  payload: Record<string, unknown>;
  examTitle?: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  queuedAt: string;
}

function openSyncDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB no disponible en este entorno'));
      return;
    }

    const request = indexedDB.open(SYNC_DB_NAME, SYNC_DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SYNC_STORE_NAME)) {
        db.createObjectStore(SYNC_STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('No se pudo abrir IndexedDB'));
  });
}

export async function putQueuedSubmission(record: QueuedSubmissionRecord): Promise<void> {
  const db = await openSyncDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_STORE_NAME);
    store.put(record);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Error guardando entrega en cola offline'));
    };
  });
}

export async function getAllQueuedSubmissions(): Promise<QueuedSubmissionRecord[]> {
  try {
    const db = await openSyncDatabase();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SYNC_STORE_NAME, 'readonly');
      const store = tx.objectStore(SYNC_STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        db.close();
        resolve((req.result || []) as QueuedSubmissionRecord[]);
      };
      req.onerror = () => {
        db.close();
        reject(req.error || new Error('Error leyendo cola offline'));
      };
    });
  } catch {
    return [];
  }
}

export async function removeQueuedSubmission(id: string): Promise<void> {
  try {
    const db = await openSyncDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
      const store = tx.objectStore(SYNC_STORE_NAME);
      store.delete(id);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error || new Error('Error eliminando registro sincronizado'));
      };
    });
  } catch {
    // Ignore cleanup errors
  }
}

export async function getQueuedSubmissionCount(): Promise<number> {
  const items = await getAllQueuedSubmissions();
  return items.length;
}

function extractMissingCol(message: string): string | null {
  const pgrstMatch = message.match(/Could not find the '([^']+)' column of/);
  if (pgrstMatch && pgrstMatch[1]) return pgrstMatch[1];
  const pgMatch = message.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
  if (pgMatch && pgMatch[1]) return pgMatch[1];
  return null;
}

async function postSubmissionToSupabaseREST(record: QueuedSubmissionRecord): Promise<boolean> {
  const cleanPayload: Record<string, unknown> = { ...record.payload };
  delete cleanPayload.actualizado;

  const endpoint = `${record.supabaseUrl}/rest/v1/${record.table}?on_conflict=id`;

  for (let attempt = 0; attempt < 8; attempt++) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        apikey: record.supabaseAnonKey,
        Authorization: `Bearer ${record.supabaseAnonKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(cleanPayload),
    });

    if (response.ok) {
      return true;
    }

    const errText = await response.text().catch(() => '');
    const missingCol = extractMissingCol(errText);
    if (missingCol && cleanPayload[missingCol] !== undefined) {
      delete cleanPayload[missingCol];
      continue;
    }

    // 4xx non-schema errors shouldn't loop forever; 5xx will be retried on next sync
    if (response.status >= 400 && response.status < 500) {
      console.warn(`[Background Sync] Supabase rejected submission ${record.id}:`, response.status, errText);
      return false;
    }

    throw new Error(`Supabase HTTP ${response.status}`);
  }

  return false;
}

export interface ReplaySyncResult {
  syncedIds: string[];
  failedIds: string[];
  syncedTitles: string[];
}

export async function replayQueuedSubmissionsWithSupabase(): Promise<ReplaySyncResult> {
  const queued = await getAllQueuedSubmissions();
  const syncedIds: string[] = [];
  const failedIds: string[] = [];
  const syncedTitles: string[] = [];

  for (const record of queued) {
    try {
      const ok = await postSubmissionToSupabaseREST(record);
      if (ok) {
        await removeQueuedSubmission(record.id);
        syncedIds.push(record.id);
        if (record.examTitle) {
          syncedTitles.push(record.examTitle);
        }
      } else {
        failedIds.push(record.id);
      }
    } catch {
      failedIds.push(record.id);
    }
  }

  return { syncedIds, failedIds, syncedTitles };
}

interface SyncManagerLike {
  register: (tag: string) => Promise<void>;
}

export async function enqueueSubmissionForBackgroundSync(
  record: QueuedSubmissionRecord
): Promise<void> {
  await putQueuedSubmission(record);

  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: SyncManagerLike;
    };
    if (registration.sync && typeof registration.sync.register === 'function') {
      await registration.sync.register(EXAM_SYNC_TAG);
    }
  } catch (err) {
    console.warn('Background Sync registration notice:', err);
  }
}

export async function triggerManualSWBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = (await navigator.serviceWorker.ready) as ServiceWorkerRegistration & {
      sync?: SyncManagerLike;
    };

    if (registration.sync && typeof registration.sync.register === 'function') {
      await registration.sync.register(EXAM_SYNC_TAG).catch(() => {});
    }

    const activeWorker = navigator.serviceWorker.controller || registration.active;
    activeWorker?.postMessage({ type: 'SYNAPSIS_FLUSH_SYNC' });
  } catch {
    // Fallback handled by window online listener
  }
}
