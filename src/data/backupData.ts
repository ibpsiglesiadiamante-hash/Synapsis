/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AppState } from '../types';
import usersAndInst from './backupUsers.json';
import subjectsData from './backupSubjects.json';
import semParcData from './backupSemestersParciales.json';
import examsData from './backupExams.json';
import subsData from './backupSubmissions.json';

export const backupAppState: AppState = {
  users: usersAndInst.users as any,
  institutions: usersAndInst.institutions as any,
  subjects: subjectsData.subjects as any,
  semesters: semParcData.semesters as any,
  parciales: semParcData.parciales as any,
  exams: examsData.exams as any,
  submissions: (subsData.submissions || []) as any,
  gradeRecords: (subsData.gradeRecords || []) as any,
  assignments: [],
  assignmentSubmissions: []
};
