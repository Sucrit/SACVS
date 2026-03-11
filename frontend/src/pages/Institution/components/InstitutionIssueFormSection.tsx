import { FormEvent, useMemo, useState } from 'react';
import { ClipboardCheck, Upload } from 'lucide-react';
import Card from '../../../components/common/Card';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import { useToast } from '../../../hooks/useToast';
import {
  Credential,
  CredentialType,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { getStudentFullName } from '../utils';

const CREDENTIAL_TYPES: CredentialType[] = ['TRANSCRIPT', 'DIPLOMA', 'CERTIFICATE', 'DEGREE', 'LICENSE'];
const EXPIRY_ALLOWED_TYPES: CredentialType[] = ['CERTIFICATE', 'LICENSE'];
type CertificateCategory = 'ACADEMIC' | 'PROFESSIONAL';
const DEFAULT_CERTIFICATE_CATEGORY: CertificateCategory = 'ACADEMIC';
const CERTIFICATE_CATEGORIES: CertificateCategory[] = ['ACADEMIC', 'PROFESSIONAL'];
const DIRECT_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;
const DIRECT_UPLOAD_ACCEPTED_MIME = new Set(['application/pdf', 'image/png', 'image/jpeg']);

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

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(student => {
      map.set(student.id, getStudentFullName(student) || student.email);
    });
    return map;
  }, [students]);

  const eligibleStudents = useMemo(
    () => students.filter(student => student.role === 'STUDENT'),
    [students],
  );

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
      showToast({ variant: 'success', message: 'Credential issued successfully.' });
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
      <form className="space-y-4" onSubmit={handleSubmitDirectIssue}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <select
            value={directForm.studentId}
            onChange={event => setDirectForm(previous => ({ ...previous, studentId: event.target.value }))}
            className="h-11 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
            required
          >
            <option value="">Select student</option>
            {eligibleStudents.map(student => (
              <option key={student.id} value={student.id}>
                {(studentNameById.get(student.id) || student.email)} ({student.profile?.studentNumber || student.id})
              </option>
            ))}
          </select>
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
            className="h-11 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
          >
            {CREDENTIAL_TYPES.map(type => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            value={directForm.title}
            onChange={event => setDirectForm(previous => ({ ...previous, title: event.target.value }))}
            placeholder="Credential title (e.g. Bachelor of Science in IT)"
            className="h-11 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
            required
          />
          <input
            value={directForm.description}
            onChange={event => setDirectForm(previous => ({ ...previous, description: event.target.value }))}
            placeholder="Description (optional)"
            className="h-11 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
          />
          {directForm.type === 'CERTIFICATE' && (
            <select
              value={directForm.certificateCategory}
              onChange={event =>
                setDirectForm(previous => ({
                  ...previous,
                  certificateCategory: event.target.value as CertificateCategory,
                }))
              }
              className="h-11 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
            >
              {CERTIFICATE_CATEGORIES.map(category => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          )}
          {supportsExpiryDate(directForm.type) && (
            <div className="space-y-1">
              <p className="text-[11px] font-medium text-neutral-500">Expiry Date</p>
              <input
                type="date"
                value={directForm.expiryDate}
                onChange={event => setDirectForm(previous => ({ ...previous, expiryDate: event.target.value }))}
                aria-label="Expiry Date"
                className="h-11 w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-sm outline-none"
                required={requiresExpiryDate(directForm.type, directForm.certificateCategory)}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-neutral-800">Student Credential Document</p>
          <label
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
              isDirectFileDragActive
                ? 'border-sky-300 bg-sky-50'
                : 'border-neutral-300 bg-neutral-50 hover:bg-neutral-100'
            }`}
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
            <Upload size={20} className="mb-3 mt-15 text-neutral-400" />
            <p className="text-sm text-neutral-700">
              <span className="font-semibold text-sky-600">Upload a file</span> or drag and drop
            </p>
            <p className="mt-1 mb-15 text-xs text-neutral-500">PDF, PNG, JPG up to 10MB</p>
          </label>
          {directFile && (
            <p className="text-xs text-neutral-600">
              Selected: <span className="font-semibold text-neutral-800">{directFile.name}</span>
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isDirectIssuing}
          className="inline-flex h-10 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-4 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
        >
          <ClipboardCheck size={13} />
          {isDirectIssuing ? <ButtonLoadingContent label="Issuing" /> : 'Issue Credential'}
        </button>
      </form>
    </Card>
  );
}
