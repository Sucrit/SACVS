import { InstitutionStudentPayload, User } from '../../services/user.service';
import { InstitutionSection } from './types';

export { formatDate, formatDateTime } from '../../utils/formatting';
export { getApiErrorMessage } from '../../utils/errors';

export const getInstitutionSection = (pathname: string): InstitutionSection => {
  if (pathname.startsWith('/institution/analytics')) return 'analytics';
  if (pathname.startsWith('/institution/reports')) return 'reports';
  if (pathname.startsWith('/institution/students')) return 'students';
  if (pathname.startsWith('/institution/requests')) return 'requests';
  if (pathname.startsWith('/institution/announcement')) return 'announcement';
  if (pathname.startsWith('/institution/receipt-verify')) return 'receipt-verify';
  if (pathname === '/institution/issue/awaiting') return 'issue-awaiting';
  if (pathname === '/institution/issue/manage') return 'issue-manage';
  if (pathname.startsWith('/institution/issue')) return 'issue';
  if (pathname.startsWith('/institution/notifications')) return 'notifications';
  if (pathname.startsWith('/institution/logs')) return 'logs';
  return 'overview';
};

export const getStudentFullName = (student: User) =>
  [student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ').trim();

export const getUserInitials = (user: User) => {
  const fullName = getStudentFullName(user);
  if (fullName) {
    return fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part[0]?.toUpperCase() ?? '')
      .join('');
  }

  return user.email.slice(0, 2).toUpperCase();
};

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

    students.push({
      email: pick('email'),
      firstName: pick('firstname'),
      middleName: pick('middlename') || null,
      lastName: pick('lastname'),
      studentNumber: pick('studentnumber'),
      courseOfStudy: pick('courseofstudy'),
      yearLevel: pick('yearlevel'),
      department: pick('department'),
      status: 'APPROVED',
    });
  }

  return { students, error: null };
};

export const createClientId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
