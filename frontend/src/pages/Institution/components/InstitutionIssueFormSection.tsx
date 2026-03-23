import { FormEvent, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, ClipboardCheck, Search, Upload, X } from 'lucide-react';
import Card from '../../../components/common/Card';
import LocalDocumentPreview from '../../../components/common/LocalDocumentPreview';
import UserAvatar from '../../../components/common/UserAvatar';
import { getUploadDropzoneClass, UPLOAD_DROPZONE_CTA_CLASS } from '../../../components/common/uploadSurface';
import Button from '../../../components/ui/Button';
import { useToast } from '../../../hooks/useToast';
import {
  Credential,
  CredentialType,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { getStudentFullName, getUserInitials } from '../utils';

const CREDENTIAL_TYPES: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const EXPIRY_ALLOWED_TYPES: CredentialType[] = ['CERTIFICATE', 'LICENSE'];
type CertificateCategory = 'ACADEMIC' | 'PROFESSIONAL';
const DEFAULT_CERTIFICATE_CATEGORY: CertificateCategory = 'ACADEMIC';
const CERTIFICATE_CATEGORIES: CertificateCategory[] = ['ACADEMIC', 'PROFESSIONAL'];
const DIRECT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const DIRECT_UPLOAD_ACCEPTED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const FIELD_REORDER_TRANSITION = {
  duration: 0.22,
  ease: [0.22, 1, 0.36, 1] as const,
};

const supportsExpiryDate = (type: CredentialType) => EXPIRY_ALLOWED_TYPES.includes(type);
const requiresExpiryDate = (
  type: CredentialType,
  certificateCategory: CertificateCategory = DEFAULT_CERTIFICATE_CATEGORY,
) => type === 'LICENSE' || (type === 'CERTIFICATE' && certificateCategory === 'PROFESSIONAL');

interface InstitutionIssueFormSectionProps {
  students: User[];
  onDirectIssue: (payload: {
    studentId: string;
    type: CredentialType;
    title: string;
    description?: string;
    expiryDate?: string;
    certificateCategory?: CertificateCategory;
    file: File;
  }) => Promise<Credential>;
}

export default function InstitutionIssueFormSection({
  students,
  onDirectIssue,
}: InstitutionIssueFormSectionProps) {
  const { showToast } = useToast();
  const [directForm, setDirectForm] = useState({
    studentId: '',
    type: 'TRANSCRIPT' as CredentialType,
    title: '',
    description: '',
    expiryDate: '',
    certificateCategory: DEFAULT_CERTIFICATE_CATEGORY as CertificateCategory,
  });
  const [directFile, setDirectFile] = useState<File | null>(null);
  const [isDirectFileDragActive, setIsDirectFileDragActive] = useState(false);
  const [isDirectIssuing, setIsDirectIssuing] = useState(false);
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const deferredStudentSearchQuery = useDeferredValue(studentSearchQuery);
  const studentPickerRef = useRef<HTMLDivElement | null>(null);

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(student => {
      map.set(student.id, getStudentFullName(student) || student.email);
    });
    return map;
  }, [students]);

  const eligibleStudents = useMemo(
    () => [...students]
      .filter(student => student.role === 'STUDENT')
      .sort((left, right) => {
        const leftLabel = studentNameById.get(left.id) || left.email;
        const rightLabel = studentNameById.get(right.id) || right.email;
        return leftLabel.localeCompare(rightLabel);
      }),
    [studentNameById, students],
  );

  const selectedStudent = useMemo(
    () => eligibleStudents.find(student => student.id === directForm.studentId) || null,
    [directForm.studentId, eligibleStudents],
  );

  const studentSearchState = useMemo(() => {
    const normalizedQuery = deferredStudentSearchQuery.trim().toLowerCase();
    if (!normalizedQuery) {
      return {
        totalMatches: 0,
        results: [] as User[],
      };
    }

    const matches = eligibleStudents.filter(student => {
      const searchableFields = [
        studentNameById.get(student.id) || student.email,
        student.email,
        student.profile?.studentNumber || '',
      ];

      return searchableFields.some(value => value.toLowerCase().includes(normalizedQuery));
    });

    return {
      totalMatches: matches.length,
      results: matches.slice(0, 8),
    };
  }, [deferredStudentSearchQuery, eligibleStudents, studentNameById]);

  useEffect(() => {
    if (!isStudentPickerOpen) return undefined;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!studentPickerRef.current?.contains(target)) {
        setIsStudentPickerOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsStudentPickerOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isStudentPickerOpen]);

  const handleOpenStudentPicker = () => {
    setStudentSearchQuery('');
    setIsStudentPickerOpen(true);
  };

  const handleSelectStudent = (studentId: string) => {
    setDirectForm(previous => ({ ...previous, studentId }));
    setStudentSearchQuery('');
    setIsStudentPickerOpen(false);
  };

  const handleClearStudent = () => {
    setDirectForm(previous => ({ ...previous, studentId: '' }));
    setStudentSearchQuery('');
    setIsStudentPickerOpen(false);
  };

  const handleDirectFileSelection = (file: File | null) => {
    if (!file) {
      setDirectFile(null);
      return;
    }
    if (!DIRECT_UPLOAD_ACCEPTED_MIME.has(file.type)) {
      showToast({ variant: 'warning', message: 'Unsupported file type. Please upload PDF, PNG, or JPG.' });
      return;
    }
    if (file.size > DIRECT_UPLOAD_MAX_BYTES) {
      showToast({ variant: 'warning', message: 'File is too large. Maximum file size is 10MB.' });
      return;
    }
    setDirectFile(file);
  };

  const handleSubmitDirectIssue = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const studentId = directForm.studentId.trim();
    const title = directForm.title.trim();
    const description = directForm.description.trim();

    if (!studentId) {
      showToast({ variant: 'warning', message: 'Select a student.' });
      return;
    }
    if (!title) {
      showToast({ variant: 'warning', message: 'Title is required.' });
      return;
    }
    if (!directFile) {
      showToast({ variant: 'warning', message: 'Attach a credential file before issuing.' });
      return;
    }
    if (requiresExpiryDate(directForm.type, directForm.certificateCategory) && !directForm.expiryDate) {
      showToast({
        variant: 'warning',
        message: 'Expiry date is required for license and professional certificate credentials.',
      });
      return;
    }

    setIsDirectIssuing(true);
    try {
      await onDirectIssue({
        studentId,
        type: directForm.type,
        title,
        description: description || undefined,
        expiryDate: supportsExpiryDate(directForm.type) && directForm.expiryDate ? directForm.expiryDate : undefined,
        certificateCategory: directForm.type === 'CERTIFICATE' ? directForm.certificateCategory : undefined,
        file: directFile,
      });
      setDirectForm({
        studentId: '',
        type: 'TRANSCRIPT',
        title: '',
        description: '',
        expiryDate: '',
        certificateCategory: DEFAULT_CERTIFICATE_CATEGORY,
      });
      setDirectFile(null);
      setStudentSearchQuery('');
      setIsStudentPickerOpen(false);
      // showToast({ variant: 'success', message: 'Credential issued successfully.' });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'STEP_UP_CANCELLED' || error.message === 'STEP_UP_IN_PROGRESS')
      ) {
        return;
      }
      const message = error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Unable to issue credential directly.';
      showToast({ variant: 'error', message });
    } finally {
      setIsDirectIssuing(false);
    }
  };

  return (
    <Card title="Issue Credential"> 
          <form className="space-y-8" onSubmit={handleSubmitDirectIssue}>
        <div className="space-y-8">
            
          {/* 1. Student Selection */}
          <div>
              <div className="mb-5 border-b border-neutral-100 pb-4">
                <div>
                  <h4 className="text-base font-semibold text-neutral-900">1. Student Information</h4>
                  <p className="mt-1 text-sm text-neutral-500">
                    Search and select the recipient of this credential.
                  </p>
                </div>
              </div>

              <motion.div layout transition={FIELD_REORDER_TRANSITION} className="space-y-4">
                <div ref={studentPickerRef} className="relative">
                  <p className="mb-1.5 text-[11px] font-medium text-neutral-500">
                    Student <span className="text-rose-500">*</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => (isStudentPickerOpen ? setIsStudentPickerOpen(false) : handleOpenStudentPicker())}
                    className={`flex h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm outline-none transition-all ${
                      selectedStudent
                        ? 'border-neutral-200 bg-white text-neutral-900 hover:border-neutral-300'
                        : 'border-neutral-200 bg-white text-neutral-500 hover:border-neutral-300'
                    } focus:border-primary-500 focus:ring-2 focus:ring-primary-100`}
                    aria-haspopup="dialog"
                    aria-expanded={isStudentPickerOpen}
                  >
                    {selectedStudent ? (
                      <>
                        <UserAvatar initials={getUserInitials(selectedStudent)} className="bg-neutral-900 border-none h-9 w-9" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-neutral-900">
                            {studentNameById.get(selectedStudent.id) || selectedStudent.email}
                          </span>
                          <span className="block truncate text-xs text-neutral-500">
                            {selectedStudent.profile?.studentNumber || selectedStudent.email}
                          </span>
                        </span>
                      </>
                    ) : (
                      <span className="truncate">Search student by name, email, or student number</span>
                    )}
                    <ChevronDown size={16} className="ml-auto shrink-0 text-neutral-400" />
                  </button>

                  {isStudentPickerOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg">
                      <div className="border-b border-neutral-200 px-3 py-3">
                        <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3">
                          <Search size={15} className="shrink-0 text-neutral-400" />
                          <input
                            autoFocus
                            value={studentSearchQuery}
                            onChange={event => setStudentSearchQuery(event.target.value)}
                            placeholder="Type a student name, email, or number"
                            className="h-10 w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
                          />
                        </div>
                      </div>

                      <div className="max-h-80 overflow-y-auto p-2">
                        {deferredStudentSearchQuery.trim().length === 0 && (
                          <div className="px-3 py-10 text-center text-sm text-neutral-500">
                            Start typing to search across the institution student list.
                          </div>
                        )}

                        {deferredStudentSearchQuery.trim().length > 0 && studentSearchState.totalMatches === 0 && (
                          <div className="px-3 py-10 text-center text-sm text-neutral-500">
                            No students matched your search.
                          </div>
                        )}

                        {studentSearchState.results.map(student => (
                          <button
                            key={student.id}
                            type="button"
                            onClick={() => handleSelectStudent(student.id)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-neutral-50"
                          >
                            <UserAvatar initials={getUserInitials(student)} className="h-9 w-9" />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-neutral-900">
                                {studentNameById.get(student.id) || student.email}
                              </span>
                              <span className="block truncate text-xs text-neutral-500">
                                {student.profile?.studentNumber || 'No student number'} • {student.email}
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>

                      {studentSearchState.totalMatches > 0 && (
                        <div className="border-t border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
                          {studentSearchState.totalMatches > studentSearchState.results.length
                            ? `Showing ${studentSearchState.results.length} of ${studentSearchState.totalMatches} matching students.`
                            : `${studentSearchState.totalMatches} matching student${studentSearchState.totalMatches === 1 ? '' : 's'} found.`}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {selectedStudent && !isStudentPickerOpen && (
                    <motion.div
                      key="selected-student-summary"
                      layout
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -8, scale: 0.98 }}
                    transition={FIELD_REORDER_TRANSITION}
                    className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-1"
                  >
                      <p className="min-w-0 text-sm font-medium text-emerald-900 flex items-center gap-2">
                        <ClipboardCheck size={16} className="text-emerald-600" />
                        <span className="truncate">
                          Selected Recipient: {studentNameById.get(selectedStudent.id) || selectedStudent.email}
                        </span>
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        icon={<X size={14} />}
                        onClick={handleClearStudent}
                        className="shrink-0 text-emerald-900 hover:bg-emerald-100"
                      >
                        Clear
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>

            {/* 2. Credential Details */}
            <div>
              <div className="mb-5 border-b border-neutral-100 pb-4">
                <h4 className="text-base font-semibold text-neutral-900">2. Credential Details</h4>
                <p className="mt-1 text-sm text-neutral-500">
                  Define the type, title, and other information attached to the credential.
                </p>
              </div>

              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-neutral-500">Credential Type <span className="text-rose-500">*</span></p>
                    <select
                      value={directForm.type}
                      onChange={event =>
                        setDirectForm(previous => {
                          const nextType = event.target.value as CredentialType;
                          return {
                            ...previous,
                            type: nextType,
                            expiryDate: supportsExpiryDate(nextType) ? previous.expiryDate : '',
                            certificateCategory: nextType === 'CERTIFICATE' ? previous.certificateCategory : DEFAULT_CERTIFICATE_CATEGORY,
                          };
                        })
                      }
                      className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                    >
                      {CREDENTIAL_TYPES.map(type => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-medium text-neutral-500">
                      Credential Title <span className="text-rose-500">*</span>
                    </p>
                    <input
                      value={directForm.title}
                      onChange={event => setDirectForm(previous => ({ ...previous, title: event.target.value }))}
                      placeholder="Credential title (e.g. Bachelor of Science in IT)"
                      className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                      required
                    />
                  </div>

                  {directForm.type === 'CERTIFICATE' && (
                    <div>
                      <p className="mb-1.5 text-[11px] font-medium text-neutral-500">Certificate Category <span className="text-rose-500">*</span></p>
                      <select
                        value={directForm.certificateCategory}
                        onChange={event =>
                          setDirectForm(previous => ({
                            ...previous,
                            certificateCategory: event.target.value as CertificateCategory,
                          }))
                        }
                        className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                      >
                        {CERTIFICATE_CATEGORIES.map(category => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {supportsExpiryDate(directForm.type) && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-medium text-neutral-500">
                        Expiry Date
                        {requiresExpiryDate(directForm.type, directForm.certificateCategory) && <span className="ml-1 text-rose-500">*</span>}
                      </p>
                      <input
                        type="date"
                        value={directForm.expiryDate}
                        onChange={event => setDirectForm(previous => ({ ...previous, expiryDate: event.target.value }))}
                        aria-label="Expiry Date"
                        className="h-12 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                        required={requiresExpiryDate(directForm.type, directForm.certificateCategory)}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-1.5 text-[11px] font-medium text-neutral-500">Description</p>
                  <textarea
                    value={directForm.description}
                    onChange={event => setDirectForm(previous => ({ ...previous, description: event.target.value }))}
                    placeholder="Add an optional note or context for this credential"
                    rows={4}
                    className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* 3. Document Upload */}
            <div>
              <div className="mb-5 border-b border-neutral-100 pb-4">
                <h4 className="text-base font-semibold text-neutral-900">
                  3. Document Upload <span className="text-rose-500">*</span>
                </h4>
                <p className="mt-1 text-sm text-neutral-500">
                  Upload the final credential file.
                </p>
              </div>
              <label
                className={getUploadDropzoneClass({
                  active: isDirectFileDragActive,
                  className: 'flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-5 py-8 text-center transition-all',
                })}
                onDragOver={event => { event.preventDefault(); setIsDirectFileDragActive(true); }}
                onDragEnter={event => { event.preventDefault(); setIsDirectFileDragActive(true); }}
                onDragLeave={event => { event.preventDefault(); setIsDirectFileDragActive(false); }}
                onDrop={event => {
                  event.preventDefault();
                  setIsDirectFileDragActive(false);
                  handleDirectFileSelection(event.dataTransfer.files?.[0] ?? null);
                }}
              >
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg"
                  className="hidden"
                  onChange={event => handleDirectFileSelection(event.target.files?.[0] ?? null)}
                />
                <Upload size={22} className="mb-3 text-neutral-400" />
                <p className="text-sm text-neutral-700">
                  <span className={UPLOAD_DROPZONE_CTA_CLASS}>Upload a file</span> or drag and drop
                </p>
                <p className="mt-1 text-xs text-neutral-500">PDF, PNG, JPG up to 10MB</p>
                <p className="mt-4 min-h-5 text-xs text-neutral-600">
                  {directFile ? (
                    <>
                      Selected: <span className="font-semibold text-neutral-800">{directFile.name}</span>
                    </>
                  ) : (
                    <span className="text-transparent">No file selected</span>
                  )}
                </p>
              </label>
              <LocalDocumentPreview file={directFile} />
            </div>
        </div>

        <div className="flex items-center justify-end border-t border-neutral-200 pt-5">
          <Button
            type="submit"
            size="lg"
            loading={isDirectIssuing}
            icon={<ClipboardCheck size={14} />}
            className="rounded-xl"
          >
            Issue Credential
          </Button>
        </div>
        </form>
    </Card>
  );
}
