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

/**
 * Generic upsert to Supabase
 */
export async function saveDocToSupabase(table: string, item: any): Promise<void> {
  if (!item || !item.id || !KNOWN_SUPABASE_TABLES.has(table)) return;
  try {
    const cleanItem = sanitizeForSupabase(item);
    const { error } = await supabase.from(table).upsert(cleanItem);
    if (error) {
      console.warn(`Supabase upsert warning on table "${table}":`, error.message);
    }
  } catch (err) {
    console.warn(`Error saving document ${item.id} to Supabase table "${table}":`, err);
  }
}

/**
 * Delete document from Supabase
 */
export async function deleteDocFromSupabase(table: string, id: string): Promise<void> {
  if (!id || PROTECTED_IDS.has(id) || !KNOWN_SUPABASE_TABLES.has(table)) return;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.warn(`Supabase delete warning on table "${table}":`, error.message);
    }
  } catch (err) {
    console.warn(`Error deleting document ${id} from Supabase table "${table}":`, err);
  }
}

/**
 * Cleans object properties before writing to Supabase
 */
function sanitizeForSupabase(obj: any): any {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj;
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
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
      { data: semesters, error: errSemesters },
      { data: parciales, error: errParciales },
      { data: exams, error: errExams },
      { data: submissions, error: errSubmissions },
      { data: institutions, error: errInstitutions },
      { data: gradeRecords, error: errGrades },
      { data: assignments },
      { data: assignmentSubmissions },
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('subjects').select('*'),
      supabase.from('semesters').select('*'),
      supabase.from('parciales').select('*'),
      supabase.from('exams').select('*'),
      supabase.from('submissions').select('*'),
      supabase.from('institutions').select('*'),
      supabase.from('gradeRecords').select('*'),
      supabase.from('assignments').select('*'),
      supabase.from('assignmentSubmissions').select('*'),
    ]);

    if (errUsers) console.warn('Supabase fetch users warning:', errUsers.message);
    if (errSubjects) console.warn('Supabase fetch subjects warning:', errSubjects.message);

    const filterAlive = <T extends { id: string }>(list: T[] | null | undefined): T[] => {
      return (list || []).filter(item => item && item.id && !deletedIds.has(item.id));
    };

    return {
      users: filterAlive(users as User[]),
      subjects: filterAlive(subjects as Subject[]),
      semesters: filterAlive(semesters as Semester[]),
      parciales: filterAlive(parciales as Parcial[]),
      exams: filterAlive(exams as Exam[]),
      submissions: filterAlive(submissions as Submission[]),
      institutions: filterAlive(institutions as Institution[]),
      gradeRecords: filterAlive(gradeRecords as GradeRecord[]),
      assignments: filterAlive(assignments as Assignment[]),
      assignmentSubmissions: filterAlive(assignmentSubmissions as AssignmentSubmission[]),
    };
  } catch (err) {
    console.error('Failed to fetch full state from Supabase:', err);
    return null;
  }
}

/**
 * Pushes entire AppState to Supabase in batches
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
      const validItems = items.filter(it => it && it.id && !deletedIds.has(it.id)).map(sanitizeForSupabase);
      if (validItems.length > 0) {
        // Upsert in batches of 50 to avoid network payload limits
        for (let i = 0; i < validItems.length; i += 50) {
          const chunk = validItems.slice(i, i + 50);
          const { error } = await supabase.from(table).upsert(chunk);
          if (error) {
            console.warn(`Supabase bulk upsert error on ${table}:`, error.message);
          } else {
            count += chunk.length;
          }
        }
      }
    }
  } catch (err) {
    console.error('Error pushing state to Supabase:', err);
  }
  return count;
}
