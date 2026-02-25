import { isAxiosError } from 'axios';
import { InstitutionStudentPayload, User, UserStatus } from '../../services/user.service';
import { InstitutionSection, STUDENT_STATUS_OPTIONS } from './types';

export const getInstitutionSection = (pathname: string): InstitutionSection => {
  if (pathname.startsWith('/institution/students')) return 'students';
  if (pathname.startsWith('/institution/requests')) return 'requests';
  if (pathname.startsWith('/institution/issue')) return 'issue';
  if (pathname.startsWith('/institution/history')) return 'history';
  if (pathname.startsWith('/institution/notifications')) return 'notifications';
  return 'overview';
};

export const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

export const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

export const getStudentFullName = (student: User) =>
  [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ').trim();

const splitCsvLine = (line: string): string[] => line.split(',').map(cell => cell.trim());

export const parseCsvStudents = (rawCsv: string): { students: InstitutionStudentPayload[]; error: string | null } => {
  const lines = rawCsv
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return { students: [], error: 'CSV must include header + at least one row.' };
  }

  const header = splitCsvLine(lines[0]).map(value => value.toLowerCase());
  const index = (name: string) => header.indexOf(name.toLowerCase());
  const required = [
    'email', 'firstname', 'lastname', 'studentnumber', 'courseofstudy', 'yearlevel', 'department',
  ];
  const missing = required.filter(name => index(name) === -1);
  if (missing.length > 0) {
    return { students: [], error: `Missing required headers: ${missing.join(', ')}` };
  }

  const students: InstitutionStudentPayload[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = splitCsvLine(lines[i]);
    const pick = (name: string) => row[index(name)] ?? '';

    const statusRaw = pick('status').toUpperCase();
    const status = STUDENT_STATUS_OPTIONS.includes(statusRaw as UserStatus) ? (statusRaw as UserStatus) : 'PENDING';
    students.push({
      email: pick('email'),
      firstName: pick('firstname'),
      middleName: pick('middlename') || null,
      lastName: pick('lastname'),
      studentNumber: pick('studentnumber'),
      courseOfStudy: pick('courseofstudy'),
      yearLevel: pick('yearlevel'),
      department: pick('department'),
      status,
    });
  }

  return { students, error: null };
};

export const getApiErrorMessage = (error: unknown): string | null => {
  if (!isAxiosError(error)) {
    if (error instanceof Error && error.message.trim().length > 0) return error.message;
    return null;
  }

  if (typeof error.response?.data === 'string' && error.response.data.trim().length > 0) {
    return error.response.data;
  }

  const responseData = error.response?.data as { error?: string; message?: string } | undefined;
  if (typeof responseData?.error === 'string' && responseData.error.trim().length > 0) return responseData.error;
  if (typeof responseData?.message === 'string' && responseData.message.trim().length > 0) return responseData.message;

  if (typeof error.message === 'string' && error.message.trim().length > 0) return error.message;

  return null;
};

export const createClientId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
