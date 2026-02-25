import { ChangeEvent, FormEvent, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, PauseCircle, Pencil, RefreshCw, Search, Trash2, Upload, UserPlus, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import { User, UserStatus } from '../../../services/user.service';
import { StudentFormState, StudentStatusFilter, STUDENT_STATUS_OPTIONS } from '../types';
import { getStudentFullName } from '../utils';

interface InstitutionStudentsSectionProps {
  studentForm: StudentFormState;
  isSubmittingStudent: boolean;
  isBulkImporting: boolean;
  onSetStudentFormValue: (field: keyof StudentFormState, value: string) => void;
  onCreateStudent: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onBulkCsvUpload: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  students: User[];
  isLoadingStudents: boolean;
  studentSearch: string;
  studentStatusFilter: StudentStatusFilter;
  studentDepartmentFilter: string;
  departmentOptions: string[];
  onStudentSearchChange: (value: string) => void;
  onStudentStatusFilterChange: (value: StudentStatusFilter) => void;
  onStudentDepartmentFilterChange: (value: string) => void;
  onRefreshStudents: () => void;
  updatingStudentId: string | null;
  onStartEditStudent: (student: User) => void;
  onStudentStatusUpdate: (studentId: string, status: UserStatus) => Promise<void>;
  onRemoveStudent: (student: User) => Promise<void>;
  editingStudentId: string | null;
  editStudentForm: StudentFormState;
  onSetEditStudentFormValue: (field: keyof StudentFormState, value: string) => void;
  onSaveEditedStudent: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onCancelEditStudent: () => void;
}

const formatDateTime = (value: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const PHINMA_DEPARTMENT_COURSE_MAP: Record<string, string[]> = {
  'College of Engineering and Architecture (CEA)': [
    'Bachelor of Science in Civil Engineering',
    'Bachelor of Science in Architecture',
    'Bachelor of Science in Electronics Communication Engineering',
    'Bachelor of Science in Computer Engineering',
    'Bachelor of Science in Electrical Engineering',
    'Certificate in Building Technology',
  ],
  'College of Information Technology Education (CITE)': [
    'Bachelor of Science in Information Technology',
    'Associate in Computer Technology',
  ],
  'College of Allied Health Sciences (CAHS)': [
    'Bachelor of Science in Nursing',
    'Bachelor of Science in Medical Laboratory Science',
    'Bachelor of Science in Physical Therapy',
    'Diploma in Midwifery',
    'Diploma in Caregiving',
  ],
  'College of Management and Accountancy (CMA)': [
    'Bachelor of Science in Business Administration (Financial Management)',
    'Bachelor of Science in Business Administration (Marketing Management)',
    'Bachelor of Science in Accountancy',
    'Bachelor of Science in Accounting Technology',
    'Bachelor of Science in Hotel and Restaurant Management',
    'Bachelor of Science in Tourism Management',
  ],
  'College of Education and Liberal Arts (CELA)': [
    'Bachelor of Elementary Education',
    'Bachelor of Secondary Education (English)',
    'Bachelor of Secondary Education (Mathematics)',
    'Bachelor of Secondary Education (Biology)',
    'Bachelor of Secondary Education (Filipino)',
    'Bachelor of Arts in Mass Communication',
    'Bachelor of Arts in Political Science',
  ],
  'College of Social Sciences (CSS)': [
    'Bachelor of Arts in Political Science',
    'Bachelor of Arts in Mass Communication',
  ],
  'College of Criminal Justice Education (CCJE)': [
    'Bachelor of Science in Criminology',
  ],
};

const OTHER_PHINMA_PROGRAMS = [
  'Bachelor of Laws',
];

const DEFAULT_YEAR_LEVEL_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  'Graduate',
];

const DEFAULT_DEPARTMENT_OPTIONS = Object.keys(PHINMA_DEPARTMENT_COURSE_MAP);

export default function InstitutionStudentsSection({
  studentForm,
  isSubmittingStudent,
  isBulkImporting,
  onSetStudentFormValue,
  onCreateStudent,
  onBulkCsvUpload,
  students,
  isLoadingStudents,
  studentSearch,
  studentStatusFilter,
  studentDepartmentFilter,
  departmentOptions,
  onStudentSearchChange,
  onStudentStatusFilterChange,
  onStudentDepartmentFilterChange,
  onRefreshStudents,
  updatingStudentId,
  onStartEditStudent,
  onStudentStatusUpdate,
  onRemoveStudent,
  editingStudentId,
  editStudentForm,
  onSetEditStudentFormValue,
  onSaveEditedStudent,
  onCancelEditStudent,
}: InstitutionStudentsSectionProps) {
  const [activePanel, setActivePanel] = useState<'add' | 'bulk' | null>(null);
  const addPanelContentRef = useRef<HTMLDivElement | null>(null);
  const [addPanelHeight, setAddPanelHeight] = useState(0);

  useLayoutEffect(() => {
    const contentNode = addPanelContentRef.current;
    if (!contentNode) return;

    const updateHeight = () => {
      setAddPanelHeight(contentNode.scrollHeight);
    };

    updateHeight();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => updateHeight());
      observer.observe(contentNode);
      return () => observer.disconnect();
    }

    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  useLayoutEffect(() => {
    if (activePanel !== 'add') return;
    if (!addPanelContentRef.current) return;
    setAddPanelHeight(addPanelContentRef.current.scrollHeight);
  }, [activePanel]);

  const addFormCourseOptions = useMemo(() => {
    const values = new Set<string>();
    const selectedDepartment = studentForm.department.trim();

    if (selectedDepartment && PHINMA_DEPARTMENT_COURSE_MAP[selectedDepartment]) {
      PHINMA_DEPARTMENT_COURSE_MAP[selectedDepartment].forEach(course => values.add(course));
    } else {
      Object.values(PHINMA_DEPARTMENT_COURSE_MAP)
        .flat()
        .forEach(course => values.add(course));
    }

    OTHER_PHINMA_PROGRAMS.forEach(course => values.add(course));

    students.forEach(student => {
      const department = student.profile?.department?.trim();
      const course = student.profile?.courseOfStudy?.trim();
      if (!course) return;
      if (!selectedDepartment || department === selectedDepartment) {
        values.add(course);
      }
    });

    if (studentForm.courseOfStudy.trim()) {
      values.add(studentForm.courseOfStudy.trim());
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [studentForm.courseOfStudy, studentForm.department, students]);

  const editFormCourseOptions = useMemo(() => {
    const values = new Set<string>();
    const selectedDepartment = editStudentForm.department.trim();

    if (selectedDepartment && PHINMA_DEPARTMENT_COURSE_MAP[selectedDepartment]) {
      PHINMA_DEPARTMENT_COURSE_MAP[selectedDepartment].forEach(course => values.add(course));
    } else {
      Object.values(PHINMA_DEPARTMENT_COURSE_MAP)
        .flat()
        .forEach(course => values.add(course));
    }

    OTHER_PHINMA_PROGRAMS.forEach(course => values.add(course));

    students.forEach(student => {
      const department = student.profile?.department?.trim();
      const course = student.profile?.courseOfStudy?.trim();
      if (!course) return;
      if (!selectedDepartment || department === selectedDepartment) {
        values.add(course);
      }
    });

    if (editStudentForm.courseOfStudy.trim()) {
      values.add(editStudentForm.courseOfStudy.trim());
    }

    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [editStudentForm.courseOfStudy, editStudentForm.department, students]);

  const addFormYearLevelOptions = useMemo(() => {
    const values = new Set(DEFAULT_YEAR_LEVEL_OPTIONS);
    students.forEach(student => {
      const value = student.profile?.yearLevel?.trim();
      if (value) values.add(value);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const addFormDepartmentOptions = useMemo(() => {
    const values = new Set(DEFAULT_DEPARTMENT_OPTIONS);
    departmentOptions
      .filter(option => option !== 'ALL')
      .forEach(option => values.add(option));
    students.forEach(student => {
      const value = student.profile?.department?.trim();
      if (value) values.add(value);
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [departmentOptions, students]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setActivePanel(previous => (previous === 'add' ? null : 'add'))}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${
            activePanel === 'add'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <UserPlus size={14} />
          Student Account
          <ChevronDown size={14} className={`transition-transform ${activePanel === 'add' ? 'rotate-180' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => setActivePanel(previous => (previous === 'bulk' ? null : 'bulk'))}
          className={`inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold ${
            activePanel === 'bulk'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <Upload size={14} />
          Bulk Account Import (CSV)
          <ChevronDown size={14} className={`transition-transform ${activePanel === 'bulk' ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <div className="w-full">
        <div
          className={`w-full overflow-hidden transition-[max-height,opacity,margin] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            activePanel === 'add' ? 'mt-4 opacity-100' : 'mt-0 opacity-0 pointer-events-none'
          }`}
          style={{ maxHeight: activePanel === 'add' ? `${addPanelHeight}px` : '0px' }}
        >
          <div ref={addPanelContentRef}>
            <Card title="Add Student Account">
              <form className="space-y-3" onSubmit={onCreateStudent}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 md:col-span-2 xl:col-span-3">
                    Personal Info
                  </p>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      First name <span className="text-rose-500">*</span>
                    </span>
                    <input required value={studentForm.firstName} onChange={event => onSetStudentFormValue('firstName', event.target.value)} placeholder="First name" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Middle name
                    </span>
                    <input value={studentForm.middleName} onChange={event => onSetStudentFormValue('middleName', event.target.value)} placeholder="Middle name (optional)" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Last name <span className="text-rose-500">*</span>
                    </span>
                    <input required value={studentForm.lastName} onChange={event => onSetStudentFormValue('lastName', event.target.value)} placeholder="Last name" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Email <span className="text-rose-500">*</span>
                    </span>
                    <input required type="email" value={studentForm.email} onChange={event => onSetStudentFormValue('email', event.target.value)} placeholder="Email" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  </label>

                  <p className="pt-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 md:col-span-2 xl:col-span-3">
                    Student Record
                  </p>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Student number <span className="text-rose-500">*</span>
                    </span>
                    <input required value={studentForm.studentNumber} onChange={event => onSetStudentFormValue('studentNumber', event.target.value)} placeholder="Student number" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
                  </label>

                  <p className="pt-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 md:col-span-2 xl:col-span-3">
                    Academic Info
                  </p>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Course of study <span className="text-rose-500">*</span>
                    </span>
              <select
                required
                value={studentForm.courseOfStudy}
                onChange={event => onSetStudentFormValue('courseOfStudy', event.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                    >
                      <option value="" disabled>Select course of study</option>
                      {addFormCourseOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Year level <span className="text-rose-500">*</span>
                    </span>
                    <select
                      required
                      value={studentForm.yearLevel}
                      onChange={event => onSetStudentFormValue('yearLevel', event.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
                    >
                      <option value="" disabled>Select year level</option>
                      {addFormYearLevelOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1.5">
                    <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Department <span className="text-rose-500">*</span>
                    </span>
              <select
                required
                value={studentForm.department}
                onChange={event => {
                  const nextDepartment = event.target.value;
                  onSetStudentFormValue('department', nextDepartment);
                  const allowedCourses = new Set(PHINMA_DEPARTMENT_COURSE_MAP[nextDepartment] ?? []);
                  if (studentForm.courseOfStudy && !allowedCourses.has(studentForm.courseOfStudy)) {
                    onSetStudentFormValue('courseOfStudy', '');
                  }
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
              >
                <option value="" disabled>Select department</option>
                {addFormDepartmentOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <button type="submit" disabled={isSubmittingStudent} className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60">
                  <UserPlus size={14} />
                  {isSubmittingStudent ? 'Creating...' : 'Create Student'}
                </button>
              </form>
            </Card>
          </div>
        </div>

        <div
          className={`w-full overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-out ${
            activePanel === 'bulk' ? 'mt-4 max-h-[420px] opacity-100' : 'mt-0 max-h-0 opacity-0 pointer-events-none'
          }`}
        >
          <Card title="Bulk Import (CSV)">
            <p className="text-sm text-slate-600">
              Use headers:
              <span className="mt-2 block max-w-full break-all rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                email,firstName,middleName,lastName,studentNumber,courseOfStudy,yearLevel,department
              </span>
            </p>
            <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100">
              <Upload size={14} />
              {isBulkImporting ? 'Importing...' : 'Upload CSV'}
              <input type="file" accept=".csv,text/csv" onChange={event => { void onBulkCsvUpload(event); }} className="hidden" />
            </label>
          </Card>
        </div>
      </div>

      <Card title="Institution Students" action={<button onClick={onRefreshStudents} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"><RefreshCw size={14} />Refresh</button>}>
        <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="md:col-span-2 relative">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={studentSearch} onChange={event => onStudentSearchChange(event.target.value)} placeholder="Search name, email, student #, department..." className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none" />
          </div>
          <select value={studentStatusFilter} onChange={event => onStudentStatusFilterChange(event.target.value as StudentStatusFilter)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">
            <option value="ALL">All statuses</option>
            {STUDENT_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={studentDepartmentFilter} onChange={event => onStudentDepartmentFilterChange(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">
            {departmentOptions.map(option => <option key={option} value={option}>{option === 'ALL' ? 'All departments' : option}</option>)}
          </select>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
              <tr><th className="px-4 py-3">Student</th><th className="px-4 py-3">Student #</th><th className="px-4 py-3">Department</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Approval</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {isLoadingStudents && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">Loading students...</td></tr>}
              {!isLoadingStudents && students.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">No students found.</td></tr>}
              {!isLoadingStudents && students.map(student => (
                <tr key={student.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3"><p className="font-semibold text-slate-900">{getStudentFullName(student)}</p><p className="mt-1 text-xs text-slate-500">{student.email}</p></td>
                  <td className="px-4 py-3 text-sm text-slate-700">{student.profile?.studentNumber || '-'}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{student.profile?.department || '-'}</td>
                  <td className="px-4 py-3"><Badge status={student.status} /></td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    <p><span className="font-semibold text-slate-700">By:</span> {student.approverName || '-'}</p>
                    <p className="mt-1"><span className="font-semibold text-slate-700">At:</span> {formatDateTime(student.approvedAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-right"><div className="inline-flex gap-2">
                    <button onClick={() => onStartEditStudent(student)} className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100" title="Edit student profile"><Pencil size={14} /></button>
                    <button disabled={updatingStudentId === student.id} onClick={() => void onStudentStatusUpdate(student.id, 'APPROVED')} className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50" title="Approve"><Check size={14} /></button>
                    <button disabled={updatingStudentId === student.id} onClick={() => void onStudentStatusUpdate(student.id, 'SUSPENDED')} className="rounded-lg border border-orange-200 bg-orange-50 p-2 text-orange-700 hover:bg-orange-100 disabled:opacity-50" title="Deactivate"><PauseCircle size={14} /></button>
                    <button onClick={() => void onRemoveStudent(student)} className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100" title="Delete student account"><Trash2 size={14} /></button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editingStudentId && (
        <Card title="Edit Student Profile">
          <form className="space-y-3" onSubmit={onSaveEditedStudent}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <input required value={editStudentForm.firstName} onChange={event => onSetEditStudentFormValue('firstName', event.target.value)} placeholder="First name" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
              <input value={editStudentForm.middleName} onChange={event => onSetEditStudentFormValue('middleName', event.target.value)} placeholder="Middle name" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
              <input required value={editStudentForm.lastName} onChange={event => onSetEditStudentFormValue('lastName', event.target.value)} placeholder="Last name" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
              <input required value={editStudentForm.studentNumber} onChange={event => onSetEditStudentFormValue('studentNumber', event.target.value)} placeholder="Student number" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
              <select
                required
                value={editStudentForm.courseOfStudy}
                onChange={event => onSetEditStudentFormValue('courseOfStudy', event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
              >
                <option value="" disabled>Select course of study</option>
                {editFormCourseOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                required
                value={editStudentForm.yearLevel}
                onChange={event => onSetEditStudentFormValue('yearLevel', event.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
              >
                <option value="" disabled>Select year level</option>
                {addFormYearLevelOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <select
                required
                value={editStudentForm.department}
                onChange={event => {
                  const nextDepartment = event.target.value;
                  onSetEditStudentFormValue('department', nextDepartment);
                  const allowedCourses = new Set(PHINMA_DEPARTMENT_COURSE_MAP[nextDepartment] ?? []);
                  if (editStudentForm.courseOfStudy && !allowedCourses.has(editStudentForm.courseOfStudy)) {
                    onSetEditStudentFormValue('courseOfStudy', '');
                  }
                }}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none"
              >
                <option value="" disabled>Select department</option>
                {addFormDepartmentOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <input required type="email" value={editStudentForm.email} onChange={event => onSetEditStudentFormValue('email', event.target.value)} placeholder="Email" className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none" />
              <select value={editStudentForm.status} onChange={event => onSetEditStudentFormValue('status', event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm outline-none">
                {STUDENT_STATUS_OPTIONS.map(status => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-black"><Check size={14} />Save Changes</button>
              <button type="button" onClick={onCancelEditStudent} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-100"><X size={14} />Cancel</button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}
