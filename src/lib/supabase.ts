/// <reference types="vite/client" />

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { AppState, User, Subject, Semester, Parcial, Exam, Submission, GradeRecord, Institution, Assignment, AssignmentSubmission } from '../types';
import { getDeletedIds, markAsDeleted, PROTECTED_IDS } from './db';

// Supabase configuration provided by the user
export const SUPABASE_URL = (((import.meta as any).env?.VITE_SUPABASE_URL as string) || 'https://hbkgtsqeeudpwewopazy.supabase.co')
  .replace(/\/rest\/v1\/?$/, '')
  .replace(/\/+$/, '');
export const SUPABASE_ANON_KEY = (((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || 'sb_publishable_oQR6cQ6PydzcYtKVKlVtbQ_OkCHjvhK').trim();

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

export const KNOWN_SUPABASE_TABLES = new Set([
  'users',
  'subjects',
  'semesters',
  'parciales',
  'exams',
  'submissions',
  'institutions',
  'gradeRecords',
  'assignments',
  'assignmentSubmissions',
  'payments',
  'matriculaStatus',
  'agenda',
  'wikiArticles',
  'deleted_records',
  'attendance',
]);

/**
 * Tests connection to Supabase and returns table count overview in parallel
 */
export async function testSupabaseConnection(): Promise<{ ok: boolean; message: string; counts?: Record<string, number> }> {
  try {
    const tables = ['users', 'subjects', 'semesters', 'parciales', 'exams', 'submissions', 'institutions', 'gradeRecords'];
    const results = await Promise.all(
      tables.map(async (t) => {
        try {
          const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
          return { table: t, count: typeof count === 'number' && !error ? count : 0, error };
        } catch (e: any) {
          return { table: t, count: 0, error: e };
        }
      })
    );

    const counts: Record<string, number> = {};
    results.forEach(r => {
      counts[r.table] = r.count;
    });

    return {
      ok: true,
      message: 'Conexión exitosa a Supabase (PostgreSQL)',
      counts
    };
  } catch (err: any) {
    console.error('Supabase test connection failed:', err);
    return {
      ok: false,
      message: err.message || 'Error de conexión a Supabase'
    };
  }
}

export interface RemoteWriteResult {
  success: boolean;
  error?: string;
  table: string;
  id: string;
}

// Cache of known columns missing in the live Supabase PostgreSQL schema per table
const missingColumnsByTable = new Map<string, Set<string>>([
  ['submissions', new Set(['actualizado'])],
]);

function extractMissingColumnFromError(message?: string): string | null {
  if (!message) return null;
  const pgrstMatch = message.match(/Could not find the '([^']+)' column of/);
  if (pgrstMatch && pgrstMatch[1]) return pgrstMatch[1];
  const pgMatch = message.match(/column "([^"]+)" of relation "[^"]+" does not exist/i);
  if (pgMatch && pgMatch[1]) return pgMatch[1];
  return null;
}

function recordMissingColumn(table: string, col: string) {
  let set = missingColumnsByTable.get(table);
  if (!set) {
    set = new Set();
    missingColumnsByTable.set(table, set);
  }
  set.add(col);
}

/**
 * Generic upsert to Supabase with verifiable multi-column schema adaptation
 */
export async function saveDocToSupabase(table: string, item: any): Promise<RemoteWriteResult> {
  if (!item || !item.id || !KNOWN_SUPABASE_TABLES.has(table)) {
    const errorMsg = `Tabla no autorizada o documento sin id válido (tabla: ${table})`;
    console.warn(`[Supabase Write Rejected] ${errorMsg}`);
    return {
      success: false,
      error: errorMsg,
      table,
      id: item?.id || 'unknown'
    };
  }
  try {
    let cleanItem = sanitizeForSupabase(item, table);
    let lastError: any = null;

    // Self-healing loop: strip any columns missing from live Supabase schema (up to 15 iterations)
    for (let attempt = 0; attempt < 15; attempt++) {
      const { error } = await supabase.from(table).upsert(cleanItem);
      if (!error) {
        return {
          success: true,
          table,
          id: item.id
        };
      }

      lastError = error;
      const missingCol = extractMissingColumnFromError(error.message);
      if (missingCol && cleanItem[missingCol] !== undefined) {
        console.warn(`[Supabase Adaptive Fix] Omitting column "${missingCol}" not present in table "${table}" and retrying.`);
        recordMissingColumn(table, missingCol);
        delete cleanItem[missingCol];
        continue;
      }

      // Non-schema error: break immediately
      break;
    }

    const errMsg = lastError?.message || 'Error al escribir en Supabase';
    console.warn(`Supabase upsert warning on table "${table}":`, errMsg);
    return {
      success: false,
      error: errMsg,
      table,
      id: item.id
    };
  } catch (err: any) {
    const msg = err?.message || 'Error de conexión a Supabase';
    console.warn(`Error saving document ${item.id} to Supabase table "${table}":`, msg);
    return {
      success: false,
      error: msg,
      table,
      id: item.id
    };
  }
}

/**
 * Delete document from Supabase with verifiable outcome propagation
 */
export async function deleteDocFromSupabase(table: string, id: string): Promise<RemoteWriteResult> {
  if (!id || PROTECTED_IDS.has(id) || !KNOWN_SUPABASE_TABLES.has(table)) {
    const errorMsg = `ID protegido o tabla no válida (${table}/${id})`;
    return {
      success: false,
      error: errorMsg,
      table,
      id
    };
  }
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.warn(`Supabase delete warning on table "${table}":`, error.message);
      return {
        success: false,
        error: error.message,
        table,
        id
      };
    }
    return {
      success: true,
      table,
      id
    };
  } catch (err: any) {
    const msg = err?.message || 'Error de conexión a Supabase';
    console.warn(`Error deleting document ${id} from Supabase table "${table}":`, msg);
    return {
      success: false,
      error: msg,
      table,
      id
    };
  }
}

/**
 * Cleans object properties before writing to Supabase
 */
function sanitizeForSupabase(obj: any, table?: string): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj;
  const knownMissing = table ? missingColumnsByTable.get(table) : undefined;
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      if (knownMissing && knownMissing.has(key)) {
        continue;
      }
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * Fetches all rows of a Supabase table using pagination so >1000 rows are never silently truncated.
 */
async function fetchAllRowsFromTable<T>(table: string): Promise<{ data: T[]; error: any }> {
  const PAGE_SIZE = 1000;
  let allRows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      return { data: allRows, error };
    }

    const batch = (data || []) as T[];
    allRows = allRows.concat(batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }
    from += PAGE_SIZE;
  }

  return { data: allRows, error: null };
}

/**
 * Fetches the entire application state from Supabase
 */
export async function fetchFullStateFromSupabase(): Promise<Partial<AppState> | null> {
  try {
    const deletedIds = getDeletedIds();

    const [
      { data: users, error: errUsers },
      { data: subjects, error: errSubjects },
      { data: semesters },
      { data: parciales },
      { data: exams },
      { data: submissions, error: errSubmissions },
      { data: institutions },
      { data: gradeRecords },
      { data: assignments },
      { data: assignmentSubmissions },
    ] = await Promise.all([
      fetchAllRowsFromTable<User>('users'),
      fetchAllRowsFromTable<Subject>('subjects'),
      fetchAllRowsFromTable<Semester>('semesters'),
      fetchAllRowsFromTable<Parcial>('parciales'),
      fetchAllRowsFromTable<Exam>('exams'),
      fetchAllRowsFromTable<Submission>('submissions'),
      fetchAllRowsFromTable<Institution>('institutions'),
      fetchAllRowsFromTable<GradeRecord>('gradeRecords'),
      fetchAllRowsFromTable<Assignment>('assignments'),
      fetchAllRowsFromTable<AssignmentSubmission>('assignmentSubmissions'),
    ]);

    if (errUsers) console.warn('Supabase fetch users warning:', errUsers.message);
    if (errSubjects) console.warn('Supabase fetch subjects warning:', errSubjects.message);
    if (errSubmissions) console.warn('Supabase fetch submissions warning:', errSubmissions.message);

    const filterAlive = <T extends { id: string }>(list: T[] | null | undefined): T[] => {
      return (list || []).filter(item => item && item.id && !deletedIds.has(item.id));
    };

    return {
      users: filterAlive(users),
      subjects: filterAlive(subjects),
      semesters: filterAlive(semesters),
      parciales: filterAlive(parciales),
      exams: filterAlive(exams),
      submissions: filterAlive(submissions),
      institutions: filterAlive(institutions),
      gradeRecords: filterAlive(gradeRecords),
      assignments: filterAlive(assignments),
      assignmentSubmissions: filterAlive(assignmentSubmissions),
    };
  } catch (err) {
    console.error('Failed to fetch full state from Supabase:', err);
    return null;
  }
}

/**
 * Pushes entire AppState to Supabase in batches with schema-adaptation and per-item fallback
 */
export async function pushAllStateToSupabase(state: AppState): Promise<number> {
  let count = 0;
  try {
    const deletedIds = getDeletedIds();

    const collections: { table: string; items: any[] }[] = [
      { table: 'institutions', items: state.institutions || [] },
      { table: 'semesters', items: state.semesters || [] },
      { table: 'subjects', items: state.subjects || [] },
      { table: 'parciales', items: state.parciales || [] },
      { table: 'users', items: state.users || [] },
      { table: 'exams', items: state.exams || [] },
      { table: 'submissions', items: state.submissions || [] },
      { table: 'gradeRecords', items: state.gradeRecords || [] },
      { table: 'assignments', items: state.assignments || [] },
      { table: 'assignmentSubmissions', items: state.assignmentSubmissions || [] },
    ];

    for (const { table, items } of collections) {
      const rawValidItems = items.filter(it => it && it.id && !deletedIds.has(it.id));
      if (rawValidItems.length === 0) continue;

      for (let i = 0; i < rawValidItems.length; i += 50) {
        const rawChunk = rawValidItems.slice(i, i + 50);
        let chunk = rawChunk.map(it => sanitizeForSupabase(it, table));
        let chunkSucceeded = false;

        // Try bulk upsert with up to 10 automatic missing-column strips
        for (let attempt = 0; attempt < 10; attempt++) {
          const { error } = await supabase.from(table).upsert(chunk);
          if (!error) {
            count += chunk.length;
            chunkSucceeded = true;
            break;
          }
          const missingCol = extractMissingColumnFromError(error.message);
          if (missingCol) {
            recordMissingColumn(table, missingCol);
            chunk = rawChunk.map(it => sanitizeForSupabase(it, table));
            continue;
          }
          console.warn(`Supabase bulk upsert warning on ${table}:`, error.message);
          break;
        }

        // If bulk chunk still failed, fall back to individual adaptive writes so healthy rows never get dropped
        if (!chunkSucceeded) {
          for (const rawItem of rawChunk) {
            const res = await saveDocToSupabase(table, rawItem);
            if (res.success) count++;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error pushing state to Supabase:', err);
  }
  return count;
}

/**
 * Live search for a user in Supabase by email, codigo, cedula or id.
 */
export async function fetchUserByCredentials(identifier: string): Promise<User | null> {
  const clean = (identifier || '').trim();
  if (!clean) return null;
  const cleanLower = clean.toLowerCase();

  try {
    // 1. Direct match by id
    const { data: byId } = await supabase.from('users').select('*').eq('id', clean).limit(1);
    if (byId && byId.length > 0) return byId[0] as User;

    // 2. Match by email (case-insensitive)
    const { data: byEmail } = await supabase.from('users').select('*').ilike('email', cleanLower).limit(1);
    if (byEmail && byEmail.length > 0) return byEmail[0] as User;

    // 3. Match by student code (case-insensitive)
    const { data: byCode } = await supabase.from('users').select('*').ilike('codigo', clean).limit(1);
    if (byCode && byCode.length > 0) return byCode[0] as User;

    // 4. Match by cedula
    const { data: byCedula } = await supabase.from('users').select('*').eq('cedula', clean).limit(1);
    if (byCedula && byCedula.length > 0) return byCedula[0] as User;

    return null;
  } catch (err) {
    console.warn('fetchUserByCredentials error in Supabase:', err);
    return null;
  }
}

/**
 * Direct password reset for a user in Supabase
 */
export async function resetUserPasswordInCloud(user: User, newPass: string): Promise<User> {
  const cleanPass = newPass.trim();
  const updatedUser: User = {
    ...user,
    pass: cleanPass,
    actualizado: new Date().toISOString()
  };

  const res = await saveDocToSupabase('users', updatedUser);
  if (!res.success) {
    throw new Error(res.error || 'Error al actualizar contraseña en Supabase');
  }

  return updatedUser;
}

/**
 * Fetch an individual collection/table from Supabase
 */
export async function fetchCollectionFromSupabase<T>(table: string): Promise<T[]> {
  try {
    const { data, error } = await fetchAllRowsFromTable<T>(table);
    if (error) {
      console.warn(`Supabase fetch collection warning for "${table}":`, error.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error(`Error fetching "${table}" from Supabase:`, err);
    return [];
  }
}

