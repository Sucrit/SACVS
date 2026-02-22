import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CredentialRequest, CredentialRequestStatus, CredentialService } from '../../services/credential.service';
import { InstitutionStudentPayload, User, UserService, UserStatus } from '../../services/user.service';
import InstitutionOverviewSection from './components/InstitutionOverviewSection';
import InstitutionStudentsSection from './components/InstitutionStudentsSection';
import InstitutionRequestsSection from './components/InstitutionRequestsSection';
import InstitutionVerifySection from './components/InstitutionVerifySection';
import InstitutionHistorySection from './components/InstitutionHistorySection';
import InstitutionNotificationsSection from './components/InstitutionNotificationsSection';
import {
  ActivityEvent,
  DEFAULT_STUDENT_FORM,
  NotificationTarget,
  OutboundNotification,
  RequestStatusFilter,
  StudentFormState,
  StudentStatusFilter,
} from './types';
import {
  createClientId,
  getApiErrorMessage,
  getInstitutionSection,
  parseCsvStudents,
} from './utils';

const toStudentFormState = (student: User): StudentFormState => ({
  email: student.email,
  firstName: student.firstName,
  middleName: student.middleName || '',
  lastName: student.lastName,
  studentNumber: student.profile?.studentNumber || '',
  street: student.profile?.street || '',
  barangay: student.profile?.barangay || '',
  city: student.profile?.city || '',
  province: student.profile?.province || '',
  zipCode: String(student.profile?.zipCode || ''),
  phone: student.profile?.phone || '',
  courseOfStudy: student.profile?.courseOfStudy || '',
  yearLevel: student.profile?.yearLevel || '',
  department: student.profile?.department || '',
  status: student.status,
});

export default function InstitutionDashboard() {
  const location = useLocation();
  const section = getInstitutionSection(location.pathname);

  const [requests, setRequests] = useState<CredentialRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState<string | null>(null);
  const [requestsHint, setRequestsHint] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState<RequestStatusFilter>('ALL');
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [rejectionReasonByRequestId, setRejectionReasonByRequestId] = useState<Record<string, string>>({});

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
  const [studentDepartmentFilter, setStudentDepartmentFilter] = useState('ALL');
  const [studentForm, setStudentForm] = useState<StudentFormState>(DEFAULT_STUDENT_FORM);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentForm, setEditStudentForm] = useState<StudentFormState>(DEFAULT_STUDENT_FORM);
  const [editStudentError, setEditStudentError] = useState<string | null>(null);
  const [editStudentHint, setEditStudentHint] = useState<string | null>(null);

  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [outboundNotifications, setOutboundNotifications] = useState<OutboundNotification[]>([]);
  const [notificationTarget, setNotificationTarget] = useState<NotificationTarget>('ALL');
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notificationHint, setNotificationHint] = useState<string | null>(null);

  const createEvent = useCallback((type: ActivityEvent['type'], title: string, description: string) => {
    setActivityEvents(previous => [{ id: createClientId(), type, title, description, createdAt: new Date().toISOString() }, ...previous].slice(0, 100));
  }, []);

  const loadRequests = useCallback(async () => {
    setIsLoadingRequests(true);
    setRequestsError(null);
    try {
      setRequests(await CredentialService.listRequests());
    } catch (error) {
      setRequests([]);
      setRequestsError('Unable to load verification requests from the server.');
      console.error('Failed to load institution requests:', error);
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
      setStudents([]);
      setStudentsError('Unable to load students from the server.');
      console.error('Failed to load institution students:', error);
    } finally {
      setIsLoadingStudents(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
    void loadStudents();
    createEvent('SYSTEM', 'Institution workspace initialized', 'Institution frontend sections loaded.');
  }, [createEvent, loadRequests, loadStudents]);

  const pendingCount = requests.filter(request => request.status === 'PENDING').length;
  const approvedCount = requests.filter(request => request.status === 'APPROVED').length;
  const completedCount = requests.filter(request => request.status === 'COMPLETED').length;
  const rejectedCount = requests.filter(request => request.status === 'REJECTED').length;
  const processedCount = requests.filter(request => request.status === 'APPROVED' || request.status === 'COMPLETED' || request.status === 'REJECTED').length;

  const studentCounts = useMemo(
    () => ({
      total: students.length,
      pending: students.filter(student => student.status === 'PENDING').length,
      approved: students.filter(student => student.status === 'APPROVED').length,
      rejected: students.filter(student => student.status === 'REJECTED').length,
      suspended: students.filter(student => student.status === 'SUSPENDED').length,
    }),
    [students],
  );

  const departmentOptions = useMemo(() => {
    const values = new Set<string>();
    students.forEach(student => {
      if (student.profile?.department) values.add(student.profile.department);
    });
    return ['ALL', ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [students]);

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();
    return students.filter(student => {
      if (studentStatusFilter !== 'ALL' && student.status !== studentStatusFilter) return false;
      if (studentDepartmentFilter !== 'ALL' && student.profile?.department !== studentDepartmentFilter) return false;
      if (!keyword) return true;
      const searchable = [
        student.firstName,
        student.middleName || '',
        student.lastName,
        student.email,
        student.profile?.studentNumber || '',
        student.profile?.department || '',
      ].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [studentDepartmentFilter, studentSearch, studentStatusFilter, students]);

  const filteredRequests = useMemo(() => {
    const keyword = requestSearch.trim().toLowerCase();
    return requests.filter(request => {
      if (requestStatusFilter !== 'ALL' && request.status !== requestStatusFilter) return false;
      if (!keyword) return true;
      const searchable = [request.id, request.studentId, request.title, request.type, request.status, request.rejectionReason || ''].join(' ').toLowerCase();
      return searchable.includes(keyword);
    });
  }, [requestSearch, requestStatusFilter, requests]);

  const duplicateStudentEmails = useMemo(() => {
    const counts = new Map<string, number>();
    students.forEach(student => {
      const normalizedEmail = student.email.trim().toLowerCase();
      counts.set(normalizedEmail, (counts.get(normalizedEmail) || 0) + 1);
    });
    return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([email]) => email);
  }, [students]);

  const setStudentFormValue = (field: keyof StudentFormState, value: string) => {
    setStudentForm(previous => ({ ...previous, [field]: value }));
  };

  const setEditStudentFormValue = (field: keyof StudentFormState, value: string) => {
    setEditStudentForm(previous => ({ ...previous, [field]: value }));
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
      ...studentForm,
      middleName: studentForm.middleName.trim() || null,
      zipCode,
    };

    setIsSubmittingStudent(true);
    try {
      await UserService.createInstitutionStudent(payload);
      setStudentForm(DEFAULT_STUDENT_FORM);
      setCreateStudentHint('Student account created successfully.');
      createEvent('STUDENT', 'Student account created', `${payload.email} was added.`);
      await loadStudents();
    } catch (error) {
      setCreateStudentError(getApiErrorMessage(error) || 'Unable to create student account.');
      console.error('Failed to create student:', error);
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
      createEvent('STUDENT', 'Bulk student import', `${result.created} created, ${result.failed.length} failed.`);
      await loadStudents();
    } catch (error) {
      setStudentsError('Unable to import students from CSV.');
      console.error('Failed bulk importing students:', error);
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
      createEvent('STUDENT', 'Student status changed', `${updated.email} status changed to ${status}.`);
    } catch (error) {
      setStudentsError('Unable to update student status.');
      console.error('Failed updating student status:', error);
    } finally {
      setUpdatingStudentId(null);
    }
  };

  const handleStartEditStudent = (student: User) => {
    setEditingStudentId(student.id);
    setEditStudentForm(toStudentFormState(student));
    setEditStudentError(null);
    setEditStudentHint(null);
  };

  const handleCancelEditStudent = () => {
    setEditingStudentId(null);
    setEditStudentError(null);
    setEditStudentHint(null);
  };

  const handleSaveEditedStudent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editingStudentId) return;

    setEditStudentError(null);
    setEditStudentHint(null);

    const zipCode = Number(editStudentForm.zipCode);
    if (!Number.isInteger(zipCode) || zipCode <= 0) {
      setEditStudentError('Zip code must be a positive integer.');
      return;
    }

    const payload: InstitutionStudentPayload = {
      email: editStudentForm.email.trim(),
      firstName: editStudentForm.firstName.trim(),
      middleName: editStudentForm.middleName.trim() || null,
      lastName: editStudentForm.lastName.trim(),
      studentNumber: editStudentForm.studentNumber.trim(),
      street: editStudentForm.street.trim(),
      barangay: editStudentForm.barangay.trim(),
      city: editStudentForm.city.trim(),
      province: editStudentForm.province.trim(),
      zipCode,
      phone: editStudentForm.phone.trim(),
      courseOfStudy: editStudentForm.courseOfStudy.trim(),
      yearLevel: editStudentForm.yearLevel.trim(),
      department: editStudentForm.department.trim(),
      status: editStudentForm.status,
    };

    try {
      const updated = await UserService.updateInstitutionStudent(editingStudentId, payload);
      setStudents(previous => previous.map(student => (student.id === updated.id ? updated : student)));
      setEditStudentHint('Student profile updated successfully.');
      createEvent('STUDENT', 'Student profile updated', `${updated.email} was updated.`);
      setEditingStudentId(null);
    } catch (error) {
      setEditStudentError(getApiErrorMessage(error) || 'Unable to update student profile.');
      console.error('Failed updating student profile:', error);
    }
  };

  const handleRemoveStudent = async (student: User) => {
    if (!window.confirm(`Delete ${student.email}?\n\nThis will delete the student account in both database and Clerk.`)) {
      return;
    }

    setStudentsError(null);
    setStudentsHint(null);

    try {
      const result = await UserService.deleteInstitutionStudent(student.id);
      setStudents(previous => previous.filter(entry => entry.id !== student.id));
      setStudentsHint(result.message || `Deleted ${student.email}.`);
      createEvent('SECURITY', 'Student account deleted', `${student.email} was deleted from DB and Clerk.`);

      if (editingStudentId === student.id) {
        handleCancelEditStudent();
      }
    } catch (error) {
      setStudentsError(getApiErrorMessage(error) || 'Unable to delete student account.');
      console.error('Failed deleting student account:', error);
    }
  };

  const updateRequestStatus = async (
    requestId: string,
    status: Exclude<CredentialRequestStatus, 'PENDING' | 'CANCELLED'>,
    rejectionReason?: string,
    notes?: string,
  ) => {
    setUpdatingRequestId(requestId);
    setRequestsError(null);
    setRequestsHint(null);
    try {
      const updated = await CredentialService.updateRequestStatus(requestId, status, rejectionReason, notes);
      setRequests(previous => previous.map(request => (request.id === requestId ? { ...request, ...updated } : request)));
      return updated;
    } finally {
      setUpdatingRequestId(null);
    }
  };

  const handleRequestAction = async (requestId: string, action: 'APPROVE' | 'REJECT' | 'ISSUE') => {
    try {
      if (action === 'APPROVE') {
        await updateRequestStatus(requestId, 'APPROVED');
        setRequestsHint('Request approved.');
        createEvent('REQUEST', 'Credential request approved', `Request ${requestId} approved.`);
        return;
      }
      if (action === 'REJECT') {
        const reason = rejectionReasonByRequestId[requestId]?.trim() || 'Rejected by institution review.';
        await updateRequestStatus(requestId, 'REJECTED', reason);
        setRequestsHint('Request rejected.');
        createEvent('REQUEST', 'Credential request rejected', `Request ${requestId} rejected.`);
        return;
      }

      await updateRequestStatus(requestId, 'COMPLETED', undefined, 'Credential issued by institution.');
      setRequestsHint('Request marked as completed and credential issued.');
      createEvent('REQUEST', 'Credential issued', `Request ${requestId} marked completed.`);
    } catch (error) {
      setRequestsError(getApiErrorMessage(error) || 'Unable to update request status.');
      console.error('Failed updating request status:', error);
    }
  };

  const handleBulkRequestAction = async (action: 'APPROVE' | 'REJECT' | 'ISSUE') => {
    if (selectedRequestIds.length === 0) {
      setRequestsError('Select at least one request for bulk action.');
      return;
    }

    const results = await Promise.allSettled(
      selectedRequestIds.map(async requestId => {
        if (action === 'APPROVE') return updateRequestStatus(requestId, 'APPROVED');
        if (action === 'REJECT') {
          const reason = rejectionReasonByRequestId[requestId]?.trim() || 'Rejected during bulk review.';
          return updateRequestStatus(requestId, 'REJECTED', reason);
        }
        return updateRequestStatus(requestId, 'COMPLETED', undefined, 'Credential issued in bulk processing.');
      }),
    );

    const succeeded = results.filter(result => result.status === 'fulfilled').length;
    const failed = results.length - succeeded;
    setSelectedRequestIds([]);
    setRequestsHint(`Bulk ${action.toLowerCase()} complete: ${succeeded} updated, ${failed} failed.`);
    createEvent('REQUEST', 'Bulk request processing', `${action} applied to ${results.length} requests; ${succeeded} succeeded.`);
  };

  const handleNotificationSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNotificationError(null);
    setNotificationHint(null);

    if (!notificationTitle.trim()) {
      setNotificationError('Notification title is required.');
      return;
    }
    if (!notificationMessage.trim()) {
      setNotificationError('Notification message is required.');
      return;
    }

    const entry: OutboundNotification = {
      id: createClientId(),
      target: notificationTarget,
      title: notificationTitle.trim(),
      message: notificationMessage.trim(),
      createdAt: new Date().toISOString(),
    };
    setOutboundNotifications(previous => [entry, ...previous]);
    setNotificationTitle('');
    setNotificationMessage('');
    setNotificationHint('Notification queued in frontend log. Backend delivery endpoint will be wired next.');
    createEvent('NOTIFICATION', 'Notification queued', `${entry.target}: ${entry.title}`);
  };

  return (
    <div className="space-y-6">
      {(requestsError || requestsHint) && (section === 'requests' || section === 'verify') && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${requestsError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {requestsError || requestsHint}
        </div>
      )}
      {(studentsError || studentsHint || createStudentError || createStudentHint || editStudentError || editStudentHint) && section === 'students' && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${(studentsError || createStudentError || editStudentError) ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {studentsError || createStudentError || editStudentError || studentsHint || createStudentHint || editStudentHint}
        </div>
      )}
      {(notificationError || notificationHint) && section === 'notifications' && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm ${notificationError ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
          {notificationError || notificationHint}
        </div>
      )}

      {section === 'overview' && (
        <InstitutionOverviewSection
          pendingCount={pendingCount}
          processedCount={processedCount}
          studentCount={studentCounts.total}
          duplicateEmailCount={duplicateStudentEmails.length}
        />
      )}

      {section === 'students' && (
        <InstitutionStudentsSection
          studentCounts={studentCounts}
          studentForm={studentForm}
          isSubmittingStudent={isSubmittingStudent}
          isBulkImporting={isBulkImporting}
          onSetStudentFormValue={setStudentFormValue}
          onCreateStudent={handleCreateStudent}
          onBulkCsvUpload={handleBulkCsvUpload}
          students={filteredStudents}
          isLoadingStudents={isLoadingStudents}
          studentSearch={studentSearch}
          studentStatusFilter={studentStatusFilter}
          studentDepartmentFilter={studentDepartmentFilter}
          departmentOptions={departmentOptions}
          onStudentSearchChange={setStudentSearch}
          onStudentStatusFilterChange={setStudentStatusFilter}
          onStudentDepartmentFilterChange={setStudentDepartmentFilter}
          onRefreshStudents={loadStudents}
          updatingStudentId={updatingStudentId}
          onStartEditStudent={handleStartEditStudent}
          onStudentStatusUpdate={handleStudentStatusUpdate}
          onRemoveStudent={handleRemoveStudent}
          editingStudentId={editingStudentId}
          editStudentForm={editStudentForm}
          onSetEditStudentFormValue={setEditStudentFormValue}
          onSaveEditedStudent={handleSaveEditedStudent}
          onCancelEditStudent={handleCancelEditStudent}
        />
      )}

      {section === 'requests' && (
        <InstitutionRequestsSection
          requests={filteredRequests}
          isLoadingRequests={isLoadingRequests}
          requestSearch={requestSearch}
          requestStatusFilter={requestStatusFilter}
          selectedRequestIds={selectedRequestIds}
          rejectionReasonByRequestId={rejectionReasonByRequestId}
          updatingRequestId={updatingRequestId}
          onRefresh={loadRequests}
          onSearchChange={setRequestSearch}
          onFilterChange={setRequestStatusFilter}
          onToggleRequest={(requestId: string) => {
            setSelectedRequestIds(previous => previous.includes(requestId) ? previous.filter(id => id !== requestId) : [...previous, requestId]);
          }}
          onReasonChange={(requestId: string, reason: string) => {
            setRejectionReasonByRequestId(previous => ({ ...previous, [requestId]: reason }));
          }}
          onRequestAction={handleRequestAction}
          onBulkAction={handleBulkRequestAction}
        />
      )}

      {section === 'verify' && (
        <InstitutionVerifySection
          pendingCount={pendingCount}
          approvedCount={approvedCount}
          completedCount={completedCount}
          requests={requests}
          isLoadingRequests={isLoadingRequests}
          onRequestAction={handleRequestAction}
        />
      )}

      {section === 'history' && (
        <InstitutionHistorySection
          events={activityEvents}
          duplicateEmailCount={duplicateStudentEmails.length}
          suspendedCount={studentCounts.suspended}
          rejectedRequestCount={rejectedCount}
        />
      )}

      {section === 'notifications' && (
        <InstitutionNotificationsSection
          notificationTarget={notificationTarget}
          notificationTitle={notificationTitle}
          notificationMessage={notificationMessage}
          pendingCount={pendingCount}
          pendingStudentCount={studentCounts.pending}
          suspendedStudentCount={studentCounts.suspended}
          notifications={outboundNotifications}
          onTargetChange={setNotificationTarget}
          onTitleChange={setNotificationTitle}
          onMessageChange={setNotificationMessage}
          onSubmit={handleNotificationSubmit}
        />
      )}
    </div>
  );
}
