import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link, useLocation } from 'react-router-dom';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { AlertCircle, Check, FileText, PauseCircle, RefreshCw, Upload, UserPlus, X } from 'lucide-react';
import { CredentialRequest, CredentialService } from '../../services/credential.service';
import { InstitutionStudentPayload, User, UserService, UserStatus } from '../../services/user.service';

type StudentStatusFilter = UserStatus | 'ALL';
const STUDENT_STATUS_OPTIONS: UserStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const splitCsvLine = (line: string): string[] => line.split(',').map(cell => cell.trim());

const parseCsvStudents = (rawCsv: string): { students: InstitutionStudentPayload[]; error: string | null } => {
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
    'email', 'firstname', 'lastname', 'studentnumber', 'street', 'barangay', 'city',
    'province', 'zipcode', 'phone', 'courseofstudy', 'yearlevel', 'department',
  ];
  const missing = required.filter(name => index(name) === -1);
  if (missing.length > 0) {
    return { students: [], error: `Missing required headers: ${missing.join(', ')}` };
  }

  const students: InstitutionStudentPayload[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const row = splitCsvLine(lines[i]);
    const pick = (name: string) => row[index(name)] ?? '';
    const zip = Number(pick('zipcode'));
    if (!Number.isInteger(zip) || zip <= 0) {
      return { students: [], error: `Invalid zipCode at row ${i + 1}` };
    }

    const statusRaw = pick('status').toUpperCase();
    const status = STUDENT_STATUS_OPTIONS.includes(statusRaw as UserStatus) ? (statusRaw as UserStatus) : 'PENDING';
    const payload: InstitutionStudentPayload = {
      email: pick('email'),
      firstName: pick('firstname'),
      middleName: pick('middlename') || null,
      lastName: pick('lastname'),
      studentNumber: pick('studentnumber'),
      street: pick('street'),
      barangay: pick('barangay'),
      city: pick('city'),
      province: pick('province'),
      zipCode: zip,
      phone: pick('phone'),
      courseOfStudy: pick('courseofstudy'),
      yearLevel: pick('yearlevel'),
      department: pick('department'),
      status,
    };
    students.push(payload);
  }

  return { students, error: null };
};

const getApiErrorMessage = (error: unknown): string | null => {
  if (!isAxiosError(error)) {
    if (error instanceof Error && error.message.trim().length > 0) {
      return error.message;
    }
    return null;
  }

  if (typeof error.response?.data === 'string' && error.response.data.trim().length > 0) {
    return error.response.data;
  }

  const responseData = error.response?.data as { error?: string; message?: string } | undefined;
  if (typeof responseData?.error === 'string' && responseData.error.trim().length > 0) {
    return responseData.error;
  }
  if (typeof responseData?.message === 'string' && responseData.message.trim().length > 0) {
    return responseData.message;
  }

  if (typeof error.message === 'string' && error.message.trim().length > 0) {
    return error.message;
  }

  return null;
};

export default function InstitutionDashboard() {
  const location = useLocation();
  const isStudentsPage = location.pathname.startsWith('/dashboard/institution/students');

  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);

  const [students, setStudents] = useState<User[]>([]);
  const [isLoadingStudents, setIsLoadingStudents] = useState(true);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [studentsHint, setStudentsHint] = useState<string | null>(null);
  const [createStudentError, setCreateStudentError] = useState<string | null>(null);
  const [createStudentHint, setCreateStudentHint] = useState<string | null>(null);
  const [updatingStudentId, setUpdatingStudentId] = useState<string | null>(null);
  const [isSubmittingStudent, setIsSubmittingStudent] = useState(false);
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentStatusFilter, setStudentStatusFilter] = useState<StudentStatusFilter>('ALL');

  const [studentForm, setStudentForm] = useState({
    email: '',
    firstName: '',
    middleName: '',
    lastName: '',
    studentNumber: '',
    street: '',
    barangay: '',
    city: '',
    province: '',
    zipCode: '',
    phone: '',
    courseOfStudy: '',
    yearLevel: '',
    department: '',
    status: 'PENDING' as UserStatus,
  });

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    setRequestsError(null);
    try {
      setRequests(await CredentialService.listRequests());
    } catch (error) {
      console.error('Failed to load institution requests:', error);
      setRequests([]);
      setRequestsError('Unable to load verification requests from the backend.');
    } finally {
      setIsLoadingRequests(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setIsLoadingStudents(true);
    setStudentsError(null);
    try {
      setStudents(await UserService.listInstitutionStudents());
    } catch (error) {
      console.error('Failed to load institution students:', error);
      setStudents([]);
      setStudentsError('Unable to load students from the backend.');
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    void loadStudents();
  }, [loadRequests, loadStudents]);

  const pendingCount = requests.filter(request => request.status === 'PENDING').length;
  const processedTodayCount = requests.filter(request => request.status !== 'PENDING').length;
  const newTodayCount = requests.length;
  const studentCounts = useMemo(
    () => ({
      total: students.length,
      pending: students.filter(student => student.status === 'PENDING').length,
      approved: students.filter(student => student.status === 'APPROVED').length,
      suspended: students.filter(student => student.status === 'SUSPENDED').length,
    }),
    [students],
  );

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    return students.filter(student => {
      if (studentStatusFilter !== 'ALL' && student.status !== studentStatusFilter) return false;
      if (!keyword) return true;
      const searchable = [
        student.firstName,
        student.middleName || '',
        student.lastName,
        student.email,
        student.profile?.studentNumber || '',
      ].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [studentSearch, studentStatusFilter, students]);

  const setFormValue = (field: keyof typeof studentForm, value: string) => {
    setStudentForm(previous => ({ ...previous, [field]: value }));
  };

  const resetForm = () => {
    setStudentForm({
      email: '',
      firstName: '',
      middleName: '',
      lastName: '',
      studentNumber: '',
      street: '',
      barangay: '',
      city: '',
      province: '',
      zipCode: '',
      phone: '',
      courseOfStudy: '',
      yearLevel: '',
      department: '',
      status: 'PENDING',
    });
  };

  const handleCreateStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateStudentError(null);
    setCreateStudentHint(null);

    const zipCode = Number(studentForm.zipCode);
    if (!Number.isInteger(zipCode) || zipCode <= 0) {
      setCreateStudentError('Zip code must be a positive integer.');
      return;
    }

    const payload: InstitutionStudentPayload = {
      email: studentForm.email.trim(),
      firstName: studentForm.firstName.trim(),
      middleName: studentForm.middleName.trim() || null,
      lastName: studentForm.lastName.trim(),
      studentNumber: studentForm.studentNumber.trim(),
      street: studentForm.street.trim(),
      barangay: studentForm.barangay.trim(),
      city: studentForm.city.trim(),
      province: studentForm.province.trim(),
      zipCode,
      phone: studentForm.phone.trim(),
      courseOfStudy: studentForm.courseOfStudy.trim(),
      yearLevel: studentForm.yearLevel.trim(),
      department: studentForm.department.trim(),
      status: studentForm.status,
    };

    setIsSubmittingStudent(true);
    try {
      await UserService.createInstitutionStudent(payload);
      resetForm();
      setCreateStudentHint('Student account created successfully.');
      await loadStudents();
    } catch (error) {
      console.error('Failed to create student:', error);
      setCreateStudentError(getApiErrorMessage(error) || 'Unable to create student account.');
    } finally {
      setIsSubmittingStudent(false);
    }
  };

  const handleBulkCsvUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setStudentsError(null);
    setStudentsHint(null);
    setIsBulkImporting(true);
    try {
      const parsed = parseCsvStudents(await file.text());
      if (parsed.error) {
        setStudentsError(parsed.error);
        return;
      }

      const result = await UserService.createInstitutionStudentsBulk({ students: parsed.students });
      setStudentsHint(`Bulk import complete: ${result.created} created, ${result.failed.length} failed.`);
      await loadStudents();
    } catch (error) {
      console.error('Failed bulk importing students:', error);
      setStudentsError('Unable to import students from CSV.');
    } finally {
      setIsBulkImporting(false);
      event.target.value = '';
    }
  };

  const handleStudentStatusUpdate = async (studentId: string, status: UserStatus) => {
    setUpdatingStudentId(studentId);
    setStudentsError(null);
    setStudentsHint(null);
    try {
      const updated = await UserService.updateInstitutionStudentStatus(studentId, status);
      setStudents(previous => previous.map(student => (student.id === studentId ? { ...student, ...updated } : student)));
    } catch (error) {
      console.error('Failed updating student status:', error);
      setStudentsError('Unable to update student status.');
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'APPROVE' | 'REJECT') => {
    setUpdatingRequestId(requestId);
    try {
      const updated = await CredentialService.updateRequestStatus(
        requestId,
        action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
        action === 'REJECT' ? 'Rejected by institution review.' : undefined,
      );
      setRequests(previous => previous.map(request => (request.id === requestId ? { ...request, ...updated } : request)));
    } catch (error) {
      console.error('Failed updating request status:', error);
      setRequestsError('Unable to update request status.');
    } finally {
      setUpdatingRequestId(null);
    }
  };

  return (
    <div className="space-y-6">
      {isStudentsPage ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Total Students" className="border-slate-900 bg-slate-900 text-white">
            <p className="text-3xl font-bold text-white">{studentCounts.total}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-300">Institution roster</p>
          </Card>
          <Card title="Pending">
            <p className="text-3xl font-bold text-amber-700">{studentCounts.pending}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Needs review</p>
          </Card>
          <Card title="Approved">
            <p className="text-3xl font-bold text-emerald-700">{studentCounts.approved}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Active access</p>
          </Card>
          <Card title="Suspended">
            <p className="text-3xl font-bold text-orange-700">{studentCounts.suspended}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Restricted</p>
          </Card>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Card title="Pending Review" className="border-slate-900 bg-slate-900 text-white">
            <p className="text-3xl font-bold text-white">{pendingCount}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-300">Awaiting decision</p>
          </Card>
          <Card title="Processed Today">
            <p className="text-3xl font-bold text-emerald-700">{processedTodayCount}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Approved/rejected</p>
          </Card>
          <Card title="New Today">
            <p className="text-3xl font-bold text-slate-900">{newTodayCount}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Incoming requests</p>
          </Card>
          <Card title="Students">
            <p className="text-3xl font-bold text-cyan-700">{studentCounts.total}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Managed by institution</p>
          </Card>
        </div>
      )}

      {!isStudentsPage && requestsError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {requestsError}
        </div>
      )}

      {isStudentsPage && (studentsError || studentsHint) && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${studentsError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          <AlertCircle size={16} />
          {studentsError || studentsHint}
        </div>
      )}

      {isStudentsPage ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card title="Add Student Account">
              <form className="space-y-3" onSubmit={handleCreateStudent}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input required value={studentForm.firstName} onChange={event => setFormValue('firstName', event.target.value)} placeholder="First name" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input value={studentForm.middleName} onChange={event => setFormValue('middleName', event.target.value)} placeholder="Middle name (optional)" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.lastName} onChange={event => setFormValue('lastName', event.target.value)} placeholder="Last name" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required type="email" value={studentForm.email} onChange={event => setFormValue('email', event.target.value)} placeholder="Email" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.studentNumber} onChange={event => setFormValue('studentNumber', event.target.value)} placeholder="Student number" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.phone} onChange={event => setFormValue('phone', event.target.value)} placeholder="Phone" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.street} onChange={event => setFormValue('street', event.target.value)} placeholder="Street" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.barangay} onChange={event => setFormValue('barangay', event.target.value)} placeholder="Barangay" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.city} onChange={event => setFormValue('city', event.target.value)} placeholder="City" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.province} onChange={event => setFormValue('province', event.target.value)} placeholder="Province" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.zipCode} onChange={event => setFormValue('zipCode', event.target.value)} placeholder="Zip code" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <select value={studentForm.status} onChange={event => setFormValue('status', event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">{STUDENT_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}</select>
                  <input required value={studentForm.courseOfStudy} onChange={event => setFormValue('courseOfStudy', event.target.value)} placeholder="Course of study" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.yearLevel} onChange={event => setFormValue('yearLevel', event.target.value)} placeholder="Year level" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  <input required value={studentForm.department} onChange={event => setFormValue('department', event.target.value)} placeholder="Department" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                </div>
                <button type="submit" disabled={isSubmittingStudent} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60">
                  <UserPlus size={14} />
                  {isSubmittingStudent ? 'Creating...' : 'Create Student'}
                </button>
                {createStudentError && <p className="text-sm text-rose-700">{createStudentError}</p>}
                {createStudentHint && <p className="text-sm text-emerald-700">{createStudentHint}</p>}
              </form>
            </Card>

            <Card title="Bulk Import (CSV)">
              <p className="text-sm text-slate-600">
                Use headers:
                <span className="mt-2 block rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                  email,firstName,middleName,lastName,studentNumber,street,barangay,city,province,zipCode,phone,courseOfStudy,yearLevel,department,status
                </span>
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
                <Upload size={14} />
                {isBulkImporting ? 'Importing...' : 'Upload CSV'}
                <input type="file" accept=".csv,text/csv" onChange={event => { void handleBulkCsvUpload(event); }} className="hidden" />
              </label>
              <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.1em] text-slate-500">Student Status Summary</p>
                <p className="mt-2 text-sm text-slate-700">Pending: {studentCounts.pending} | Approved: {studentCounts.approved} | Suspended: {studentCounts.suspended}</p>
              </div>
            </Card>
          </div>

          <Card title="Institution Students" action={<button onClick={loadStudents} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"><RefreshCw size={14} />Refresh</button>}>
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <input value={studentSearch} onChange={event => setStudentSearch(event.target.value)} placeholder="Search students..." className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none md:col-span-2" />
              <select value={studentStatusFilter} onChange={event => setStudentStatusFilter(event.target.value as StudentStatusFilter)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">
                <option value="ALL">ALL</option>
                {STUDENT_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student #</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingStudents && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">Loading students...</td></tr>}
                  {!isLoadingStudents && filteredStudents.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-500">No students found.</td></tr>}
                  {!isLoadingStudents && filteredStudents.map(student => (
                    <tr key={student.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3"><p className="font-semibold text-slate-900">{[student.firstName, student.middleName, student.lastName].filter(Boolean).join(' ')}</p><p className="mt-1 text-xs text-slate-500">{student.email}</p></td>
                      <td className="px-4 py-3 text-sm text-slate-700">{student.profile?.studentNumber || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-700">{student.profile?.department || '-'}</td>
                      <td className="px-4 py-3"><Badge status={student.status} /></td>
                      <td className="px-4 py-3 text-right"><div className="inline-flex gap-2">
                        <button disabled={updatingStudentId === student.id} onClick={() => void handleStudentStatusUpdate(student.id, 'APPROVED')} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" title="Approve"><Check size={14} /></button>
                        <button disabled={updatingStudentId === student.id} onClick={() => void handleStudentStatusUpdate(student.id, 'REJECTED')} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50" title="Reject"><X size={14} /></button>
                        <button disabled={updatingStudentId === student.id} onClick={() => void handleStudentStatusUpdate(student.id, 'SUSPENDED')} className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-orange-700 hover:bg-orange-100 disabled:opacity-50" title="Suspend"><PauseCircle size={14} /></button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : (
        <Card
          title="Student Records"
          action={
            <Link
              to="/dashboard/institution/students"
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              Open Student Management
            </Link>
          }
        >
          <p className="text-sm text-slate-600">
            Student account creation, CSV import, and status management are available on the dedicated student records page.
          </p>
        </Card>
      )}

      {!isStudentsPage && (
        <Card title="Credential Verification Requests" action={<button onClick={loadRequests} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"><RefreshCw size={14} />Refresh</button>}>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr><th className="px-5 py-3">Student</th><th className="px-5 py-3">Document</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Status</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingRequests && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">Loading verification requests...</td></tr>}
              {!isLoadingRequests && requests.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">No requests available.</td></tr>}
              {!isLoadingRequests && requests.map(request => (
                <tr key={request.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4"><p className="font-semibold text-slate-900">{request.studentId}</p><p className="mt-1 text-xs text-slate-500">Request ID: {request.id}</p></td>
                  <td className="px-5 py-4"><span className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-700"><FileText size={14} />{request.type}</span></td>
                  <td className="px-5 py-4 text-sm text-slate-600">{formatDate(request.createdAt)}</td>
                  <td className="px-5 py-4"><Badge status={request.status} /></td>
                  <td className="px-5 py-4 text-right">{request.status === 'PENDING' ? <div className="inline-flex gap-2">
                    <button disabled={updatingRequestId === request.id} onClick={() => void handleRequestAction(request.id, 'APPROVE')} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" title="Approve"><Check size={16} /></button>
                    <button disabled={updatingRequestId === request.id} onClick={() => void handleRequestAction(request.id, 'REJECT')} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50" title="Reject"><X size={16} /></button>
                  </div> : <span className="text-xs text-slate-500">Completed</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}
