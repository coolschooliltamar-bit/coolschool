// Users, roles and the permission context (spec 10).
// Every data access goes through tools.js with an AuthContext built HERE – never from what the
// answering engine (or later, the AI model) asks for.
import { STUDENTS, TEACHERS, PARENTS, ADMINS, CLASSES } from './data.js';
import { db } from './store.js';

export const ROLE_NAMES = { student: 'תלמיד/ה', parent: 'הורה', teacher: 'מורה', school_admin: 'הנהלת בית הספר' };

export function findUser(id) {
  const s = STUDENTS.find(u => u.id === id); if (s) return { ...s, role: 'student' };
  const t = TEACHERS.find(u => u.id === id); if (t) return { ...t, role: 'teacher' };
  const p = PARENTS.find(u => u.id === id); if (p) return { ...p, role: 'parent' };
  const a = ADMINS.find(u => u.id === id); if (a) return { ...a, role: 'school_admin' };
  return null;
}

export const activeLinks = parentId => db().links.filter(l => l.parentId === parentId && l.status === 'active');

export function buildContext(userId) {
  const u = findUser(userId);
  if (!u) throw new Error('unknown user');
  const ctx = { userId: u.id, role: u.role, user: u, allowedStudentIds: [], classIds: [], scopes: {} };
  const pol = db().policies;
  if (u.role === 'student') {
    ctx.allowedStudentIds = [u.id];
    ctx.scopes = { grades: true, assignments: true, schedule: true, attendance: true, messages: true, send: true };
  } else if (u.role === 'parent') {
    ctx.allowedStudentIds = activeLinks(u.id).map(l => l.studentId);
    // parents never see the child's own messages or conversations (spec 07)
    ctx.scopes = { grades: pol.parentGrades, assignments: pol.parentAssignments, schedule: true, attendance: pol.parentAttendance, messages: false, announcements: true, send: true };
  } else if (u.role === 'teacher') {
    // a teacher teaches their subjects in every demo class; a homeroom teacher also sees all subjects of that class
    ctx.classIds = CLASSES.map(c => c.id);
    ctx.subjects = u.subjects;
    ctx.homeroom = u.homeroom || null;
    ctx.allowedStudentIds = STUDENTS.filter(s => ctx.classIds.includes(s.classId)).map(s => s.id);
    ctx.scopes = { classSummary: true, inbox: true };
  } else if (u.role === 'school_admin') {
    ctx.scopes = { admin: true };
  }
  return ctx;
}

export class Forbidden extends Error { constructor(m = 'אין הרשאה') { super(m); this.code = 'forbidden'; } }

// gendered word helper: g(user, 'm form', 'f form')
export const g = (u, m, f) => (u && u.gender === 'f' ? f : m);
