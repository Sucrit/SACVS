import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, PauseCircle, Pencil, Search, Trash2, Upload, UserPlus, X, XCircle } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import ActionMenu from '../../../components/common/ActionMenu';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import SearchFilterModal, { SearchFilterGroup } from '../../../components/common/SearchFilterModal';
import { getUploadDropzoneClass, UPLOAD_DROPZONE_CTA_CLASS } from '../../../components/common/uploadSurface';
import Input from '../../../components/ui/Input';
import Modal, { ModalFooter } from '../../../components/ui/Modal';
import Select from '../../../components/ui/Select';
import { User, UserStatus } from '../../../services/user.service';
import { StudentFormState, StudentStatusFilter, STUDENT_STATUS_OPTIONS } from '../types';
import UserAvatar from '../../../components/common/UserAvatar';
import { getStudentFullName, getUserInitials } from '../utils';
import {
  DEFAULT_DEPARTMENT_OPTIONS,
  OTHER_PHINMA_PROGRAMS,
  PHINMA_DEPARTMENT_COURSE_MAP,
} from '../constants';
import {
  MODAL_BACKDROP_VARIANTS,
  MODAL_PANEL_VARIANTS,
  MODAL_TRANSITION,
} from '../../../components/common/modal-motion';

interface InstitutionStudentsSectionProps {
  studentForm: StudentFormState;
  isSubmittingStudent: boolean;
  isBulkImporting: boolean;
  onSetStudentFormValue: (field: keyof StudentFormState, value: string) => void;
  onCreateStudent: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onBulkCsvUpload: (
    fileOrEvent: File | ChangeEvent<HTMLInputElement>,
    options?: { onBeforeStepUp?: () => void },
  ) => Promise<'success' | 'cancelled' | 'failed' | 'validation-error'>;
  students: User[];
  isLoadingStudents: boolean;
  studentSearch: string;
  studentStatusFilter: StudentStatusFilter;
  studentDepartmentFilter: string;
  departmentOptions: string[];
  onStudentSearchChange: (value: string) => void;
  onStudentStatusFilterChange: (value: StudentStatusFilter) => void;
  onStudentDepartmentFilterChange: (value: string) => void;
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
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const DEFAULT_YEAR_LEVEL_OPTIONS = [
  '1st Year',
  '2nd Year',
  '3rd Year',
  '4th Year',
  '5th Year',
  'Graduate',
];

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
  const [activeModal, setActiveModal] = useState<'add' | 'bulk' | null>(null);
  const [isBulkDragOver, setIsBulkDragOver] = useState(false);
  const [selectedBulkFile, setSelectedBulkFile] = useState<File | null>(null);

  const closeBulkModal = (clearSelectedFile = true) => {
    setActiveModal(null);
    setIsBulkDragOver(false);
    if (clearSelectedFile) {
      setSelectedBulkFile(null);
    }
  };

  const handleBulkImport = async (fileOrEvent: File | ChangeEvent<HTMLInputElement>) => {
    if (isBulkImporting) return;

    const file = fileOrEvent instanceof File ? fileOrEvent : fileOrEvent.target.files?.[0];
    if (!file) return;

    setSelectedBulkFile(file);

    const result = await onBulkCsvUpload(fileOrEvent, {
      onBeforeStepUp: () => {
        closeBulkModal(false);
      },
    });

    if (result === 'success') {
      setSelectedBulkFile(null);
      return;
    }

    if (result === 'cancelled' || result === 'failed') {
      setActiveModal('bulk');
      return;
    }
  };

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

  const filterGroups = useMemo<SearchFilterGroup[]>(() => [
    {
      id: 'student-status',
      label: 'Status',
      value: studentStatusFilter,
      defaultValue: 'ALL',
      options: ['ALL', ...STUDENT_STATUS_OPTIONS].map(status => ({
        value: status,
        label: status === 'ALL' ? 'All statuses' : status,
      })),
      onChange: value => onStudentStatusFilterChange(value as StudentStatusFilter),
    },
    {
      id: 'student-department',
      label: 'Department',
      value: studentDepartmentFilter,
      defaultValue: 'ALL',
      options: departmentOptions.map(option => ({
        value: option,
        label: option === 'ALL' ? 'All departments' : option,
      })),
      onChange: onStudentDepartmentFilterChange,
    },
  ], [departmentOptions, onStudentDepartmentFilterChange, onStudentStatusFilterChange, studentDepartmentFilter, studentStatusFilter]);

  const getStudentActionItems = (student: User) => [
    ...(student.status === 'PENDING' ? [
      {
        label: 'Approve',
        icon: <Check size={14} className="text-emerald-600" />,
        onClick: () => void onStudentStatusUpdate(student.id, 'APPROVED'),
        disabled: updatingStudentId === student.id,
      },
      {
        label: 'Reject',
        icon: <XCircle size={14} className="text-rose-600" />,
        onClick: () => void onStudentStatusUpdate(student.id, 'REJECTED'),
        disabled: updatingStudentId === student.id,
        className: 'text-rose-700',
      }
    ] : []),
    {
      label: 'Edit profile',
      icon: <Pencil size={14} />,
      onClick: () => onStartEditStudent(student),
    },
    ...(student.status !== 'APPROVED' && student.status !== 'PENDING' ? [{
      label: 'Approve',
      icon: <Check size={14} className="text-emerald-600" />,
      onClick: () => void onStudentStatusUpdate(student.id, 'APPROVED'),
      disabled: updatingStudentId === student.id,
    }] : []),
    ...(student.status !== 'SUSPENDED' ? [{
      label: 'Suspend',
      icon: <PauseCircle size={14} className="text-orange-600" />,
      onClick: () => void onStudentStatusUpdate(student.id, 'SUSPENDED'),
      disabled: updatingStudentId === student.id,
    }] : []),
    {
      label: 'Delete',
      icon: <Trash2 size={14} className="text-rose-600" />,
      onClick: () => void onRemoveStudent(student),
      className: 'text-rose-700',
    },
  ];

  return (
    <div className="min-h-[calc(100vh-220px)] space-y-4 pb-4">
      <Card
        title="Institution's Student Management"
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={studentSearch}
                onChange={event => onStudentSearchChange(event.target.value)}
                placeholder="Search name, email, student ID, department..."
                className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all"
              />
            </div>
            <SearchFilterModal
              hideLabel
              groups={filterGroups}
              description="Refine the student roster by account status or department."
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setActiveModal('add')}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              <UserPlus size={14} />
              Student Account
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedBulkFile(null);
                setActiveModal('bulk');
              }}
              title="Bulk student account import using CSV file"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
            >
              <Upload size={14} />
              Bulk Import (CSV)
            </button>
          </div>
        </div>

        <div className="space-y-2 lg:hidden">
          {isLoadingStudents && (
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
              Loading students...
            </div>
          )}
          {!isLoadingStudents && students.length === 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white px-4 py-8 text-center text-sm text-neutral-500">
              No students found.
            </div>
          )}
          {!isLoadingStudents && students.map((student, index) => (
            <motion.div
              key={student.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              className="rounded-lg border border-neutral-200 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <UserAvatar initials={getUserInitials(student)} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                    <p className="truncate text-xs text-neutral-500">{student.email}</p>
                  </div>
                </div>
                <div className="shrink-0">
                  <ActionMenu items={getStudentActionItems(student)} />
                </div>
              </div>
              <div className="mt-2.5 grid grid-cols-1 gap-1.5 text-[11px] text-neutral-600 sm:grid-cols-2">
                <div>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Student ID</p>
                  <p className="mt-1">{student.profile?.studentNumber || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Status</p>
                  <div className="mt-1"><Badge status={student.status} /></div>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Department</p>
                  <p className="mt-1">{student.profile?.department || '-'}</p>
                </div>
                <div>
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Program</p>
                  <p className="mt-1 break-words">{student.profile?.courseOfStudy || '-'}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="font-semibold uppercase tracking-[0.08em] text-neutral-500">Approved At</p>
                  <p className="mt-1">{formatDateTime(student.approvedAt)}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-lg border border-neutral-200 lg:block">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold  text-neutral-500">
              <tr>
                <th className="px-4 py-3">Student Information</th>
                <th className="hidden px-4 py-3 sm:table-cell">Student ID</th>
                <th className="hidden px-4 py-3 md:table-cell">Department</th>
                <th className="hidden px-4 py-3 lg:table-cell">Program</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Approved At</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {isLoadingStudents && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">Loading students...</td></tr>}
              {!isLoadingStudents && students.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-neutral-500">No students found.</td></tr>}
              {!isLoadingStudents && students.map((student, index) => (
                <motion.tr
                  key={student.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="hover:bg-neutral-50/70"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar initials={getUserInitials(student)} />
                      <div>
                        <p className="font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                        <p className="mt-1 text-xs text-neutral-500">{student.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-700 sm:table-cell">{student.profile?.studentNumber || '-'}</td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-700 md:table-cell">{student.profile?.department || '-'}</td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-700 lg:table-cell">{student.profile?.courseOfStudy || '-'}</td>
                  <td className="px-4 py-3"><Badge status={student.status} /></td>
                  <td className="hidden px-4 py-3 text-xs text-neutral-600 md:table-cell">
                    <p className="mt-1"><span className="font-semibold text-neutral-700"></span> {formatDateTime(student.approvedAt)}</p>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center justify-end">
                      <ActionMenu items={getStudentActionItems(student)} />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AnimatePresence>
        {activeModal === 'add' && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-90 flex items-center justify-center bg-neutral-900/60 p-2 backdrop-blur-[1px] sm:p-4"
          onClick={() => setActiveModal(null)}
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="w-full max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg sm:max-w-5xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Add Student Account</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Create a new student profile under your institution.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="inline-flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>
            <form className="space-y-3 p-5" onSubmit={onCreateStudent}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <p className="text-xs font-semibold  text-neutral-500 md:col-span-2 xl:col-span-3">
                  Personal Info
                </p>
                <Input required label="First name" value={studentForm.firstName} onChange={event => onSetStudentFormValue('firstName', event.target.value)} placeholder="First name" className="h-10 bg-neutral-50" />
                <Input label="Middle name" value={studentForm.middleName} onChange={event => onSetStudentFormValue('middleName', event.target.value)} placeholder="Middle name (optional)" className="h-10 bg-neutral-50" />
                <Input required label="Last name" value={studentForm.lastName} onChange={event => onSetStudentFormValue('lastName', event.target.value)} placeholder="Last name" className="h-10 bg-neutral-50" />
                <Input required type="email" label="University Issued Email" value={studentForm.email} onChange={event => onSetStudentFormValue('email', event.target.value)} placeholder="Email" className="h-10 bg-neutral-50" />
                <Input required label="Student number" value={studentForm.studentNumber} onChange={event => onSetStudentFormValue('studentNumber', event.target.value)} placeholder="Student number" className="h-10 bg-neutral-50" />

                <p className="pt-2 text-xs font-semibold  text-neutral-500 md:col-span-2 xl:col-span-3">
                  Academic Info
                </p>
                <Select
                  required
                  label="Department"
                  value={studentForm.department}
                  onChange={event => {
                    const nextDepartment = event.target.value;
                    onSetStudentFormValue('department', nextDepartment);
                    const allowedCourses = new Set(PHINMA_DEPARTMENT_COURSE_MAP[nextDepartment] ?? []);
                    if (studentForm.courseOfStudy && !allowedCourses.has(studentForm.courseOfStudy)) {
                      onSetStudentFormValue('courseOfStudy', '');
                    }
                  }}
                  className="h-10 bg-neutral-50"
                >
                    <option value="" disabled>Select department</option>
                    {addFormDepartmentOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                </Select>
                <Select
                  required
                  label="Course of study"
                  value={studentForm.courseOfStudy}
                  onChange={event => onSetStudentFormValue('courseOfStudy', event.target.value)}
                  className="h-10 bg-neutral-50"
                >
                    <option value="" disabled>Select course of study</option>
                    {addFormCourseOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                </Select>
                <Select
                  required
                  label="Year level"
                  value={studentForm.yearLevel}
                  onChange={event => onSetStudentFormValue('yearLevel', event.target.value)}
                  className="h-10 bg-neutral-50"
                >
                    <option value="" disabled>Select year level</option>
                    {addFormYearLevelOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                </Select>
              </div>
              <div className="border-t border-neutral-200 pt-4">
                <ModalFooter
                  leftActions={(
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
                    >
                      <X size={14} />
                      Close
                    </button>
                  )}
                  rightActions={(
                    <button type="submit" disabled={isSubmittingStudent} className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-black disabled:opacity-60">
                      <UserPlus size={14} />
                      {isSubmittingStudent ? <ButtonLoadingContent label="Creating" /> : 'Create Student'}
                    </button>
                  )}
                />
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      <Modal
        open={activeModal === 'bulk'}
        onClose={() => closeBulkModal()}
        title="Bulk Student Account Import (CSV)"
        description="Upload a CSV file to create multiple student accounts at once."
        size="xl"
      >
        <p className="text-sm text-neutral-600">
          Strictly use the header format below:
          <span className="mt-2 block max-w-full break-all rounded-lg bg-neutral-50 p-2 text-xs text-neutral-700">
            email,firstName,middleName,lastName,studentNumber,courseOfStudy,yearLevel,department
          </span>
        </p>

        <label
          className={getUploadDropzoneClass({
            active: isBulkDragOver && !isBulkImporting,
            disabled: isBulkImporting,
            className: 'mt-4 flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition',
          })}
          onDragOver={event => {
            event.preventDefault();
            if (!isBulkImporting) setIsBulkDragOver(true);
          }}
          onDragLeave={event => {
            event.preventDefault();
            setIsBulkDragOver(false);
          }}
          onDrop={event => {
            event.preventDefault();
            setIsBulkDragOver(false);
            if (isBulkImporting) return;
            const file = event.dataTransfer.files?.[0];
            if (file) {
              void handleBulkImport(file);
            }
          }}
        >
          <Upload size={28} className="mb-3 text-neutral-400" />
          <p className="mb-2 text-xs font-semibold text-neutral-500">
            Bulk Import File <span className="text-rose-500">*</span>
          </p>
          <p className="text-base text-neutral-700">
            <span className={UPLOAD_DROPZONE_CTA_CLASS}>Upload a file</span> or drag and drop
          </p>
          <p className="mt-2 text-sm text-neutral-500">CSV up to 10MB</p>
          <p className="mt-3 text-xs text-neutral-500">
            {isBulkImporting ? <ButtonLoadingContent label="Importing" /> : 'Select your institution bulk import file'}
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={event => {
              void handleBulkImport(event);
            }}
            className="hidden"
          />
        </label>

        {selectedBulkFile && (
          <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
              Selected CSV
            </p>
            <p className="mt-1 text-sm font-medium text-neutral-800">{selectedBulkFile.name}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void handleBulkImport(selectedBulkFile);
                }}
                disabled={isBulkImporting}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-neutral-900 px-4 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload size={14} />
                Continue with selected file
              </button>
              <button
                type="button"
                onClick={() => setSelectedBulkFile(null)}
                disabled={isBulkImporting}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <X size={14} />
                Clear file
              </button>
            </div>
          </div>
        )}
      </Modal>

      <AnimatePresence>
        {editingStudentId && (
        <motion.div
          initial="initial"
          animate="animate"
          exit="exit"
          variants={MODAL_BACKDROP_VARIANTS}
          transition={MODAL_TRANSITION}
          className="fixed inset-0 z-90 flex items-center justify-center bg-neutral-900/60 p-2 backdrop-blur-[1px] sm:p-4"
          onClick={onCancelEditStudent}
        >
          <motion.div
            initial="initial"
            animate="animate"
            exit="exit"
            variants={MODAL_PANEL_VARIANTS}
            transition={MODAL_TRANSITION}
            className="w-full max-w-[95vw] max-h-[90vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg sm:max-w-5xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-neutral-200 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Edit Student Profile</p>
                <p className="mt-1 text-xs text-neutral-500">
                  Update student profile, academic metadata, and account status.
                </p>
              </div>
              <button
                type="button"
                onClick={onCancelEditStudent}
                className="inline-flex h-7 w-7 items-center justify-center text-neutral-500 transition-colors hover:text-neutral-900"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>
            <form className="space-y-3 p-5" onSubmit={onSaveEditedStudent}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                <p className="text-xs font-semibold  text-neutral-500 md:col-span-2 xl:col-span-3">
                  Personal Info
                </p>
                <Input required label="First name" value={editStudentForm.firstName} onChange={event => onSetEditStudentFormValue('firstName', event.target.value)} placeholder="First name" className="h-10 bg-neutral-50" />
                <Input label="Middle name" value={editStudentForm.middleName} onChange={event => onSetEditStudentFormValue('middleName', event.target.value)} placeholder="Middle name (optional)" className="h-10 bg-neutral-50" />
                <Input required label="Last name" value={editStudentForm.lastName} onChange={event => onSetEditStudentFormValue('lastName', event.target.value)} placeholder="Last name" className="h-10 bg-neutral-50" />
                <Input required type="email" label="Email" value={editStudentForm.email} onChange={event => onSetEditStudentFormValue('email', event.target.value)} placeholder="Email" className="h-10 bg-neutral-50" />
                <Input required label="Student number" value={editStudentForm.studentNumber} onChange={event => onSetEditStudentFormValue('studentNumber', event.target.value)} placeholder="Student number" className="h-10 bg-neutral-50" />

                <p className="pt-2 text-xs font-semibold  text-neutral-500 md:col-span-2 xl:col-span-3">
                  Academic Info
                </p>
                <Select
                  required
                  label="Course of study"
                  value={editStudentForm.courseOfStudy}
                  onChange={event => onSetEditStudentFormValue('courseOfStudy', event.target.value)}
                  className="h-10 bg-neutral-50"
                >
                    <option value="" disabled>Select course of study</option>
                    {editFormCourseOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                </Select>
                <Select
                  required
                  label="Year level"
                  value={editStudentForm.yearLevel}
                  onChange={event => onSetEditStudentFormValue('yearLevel', event.target.value)}
                  className="h-10 bg-neutral-50"
                >
                    <option value="" disabled>Select year level</option>
                    {addFormYearLevelOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                </Select>
                <Select
                  required
                  label="Department"
                  value={editStudentForm.department}
                  onChange={event => {
                    const nextDepartment = event.target.value;
                    onSetEditStudentFormValue('department', nextDepartment);
                    const allowedCourses = new Set(PHINMA_DEPARTMENT_COURSE_MAP[nextDepartment] ?? []);
                    if (editStudentForm.courseOfStudy && !allowedCourses.has(editStudentForm.courseOfStudy)) {
                      onSetEditStudentFormValue('courseOfStudy', '');
                    }
                  }}
                  className="h-10 bg-neutral-50"
                >
                    <option value="" disabled>Select department</option>
                    {addFormDepartmentOptions.map(option => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                </Select>
              </div>
              <div className="border-t border-neutral-200 pt-4">
                <ModalFooter
                  leftActions={(
                    <button type="button" onClick={onCancelEditStudent} className="inline-flex h-10 items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-4 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"><X size={14} />Cancel</button>
                  )}
                  rightActions={(
                    <button type="submit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-neutral-900 px-4 text-sm font-semibold text-white hover:bg-black"><Check size={14} />Save Changes</button>
                  )}
                />
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}

