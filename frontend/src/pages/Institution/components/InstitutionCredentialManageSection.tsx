import { useMemo, useState } from 'react';
import { ClipboardCheck, Eye, Upload } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import {
  Credential,
  CredentialStatus,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { formatDateTime, getStudentFullName } from '../utils';

const CREDENTIAL_STATUS_OPTIONS: Record<CredentialStatus, CredentialStatus[]> = {
  PENDING: ['PENDING', 'ISSUED', 'REVOKED'],
  ISSUED: ['ISSUED', 'REVOKED'],
  REVOKED: ['REVOKED'],
  EXPIRED: ['EXPIRED'],
};

interface InstitutionCredentialManageSectionProps {
  students: User[];
  credentials: Credential[];
  isLoadingCredentials: boolean;
  onCredentialStatusUpdate: (credentialId: string, status: CredentialStatus) => Promise<void>;
  onCredentialReissue: (credentialId: string, file?: File) => Promise<void>;
  onViewCredentialDetails: (credentialId: string) => void;
}

export default function InstitutionCredentialManageSection({
  students,
  credentials,
  isLoadingCredentials,
  onCredentialStatusUpdate,
  onCredentialReissue,
  onViewCredentialDetails,
}: InstitutionCredentialManageSectionProps) {
  const [statusByCredentialId, setStatusByCredentialId] = useState<Record<string, CredentialStatus>>({});
  const [reissueFileByCredentialId, setReissueFileByCredentialId] = useState<Record<string, File | null>>({});
  const [updatingCredentialId, setUpdatingCredentialId] = useState<string | null>(null);
  const [reissuingCredentialId, setReissuingCredentialId] = useState<string | null>(null);

  const studentNameById = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach(student => {
      map.set(student.id, getStudentFullName(student) || student.email);
    });
    return map;
  }, [students]);

  const institutionCredentials = useMemo(
    () => [...credentials].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [credentials],
  );

  return (
    <Card title="Manage Student Credentials">
      <div className="rounded-lg border border-neutral-200">
        <table className="w-full text-left">
          <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Credential</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 md:table-cell">Last Update</th>
              <th className="hidden px-4 py-3 lg:table-cell">Replace File</th>
              <th className="px-4 py-3 text-right">Update</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {isLoadingCredentials && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">
                  Loading institution credentials...
                </td>
              </tr>
            )}
            {!isLoadingCredentials && institutionCredentials.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-neutral-500">
                  No credentials found for your institution.
                </td>
              </tr>
            )}
            {!isLoadingCredentials &&
              institutionCredentials.map(credential => (
                <tr key={credential.id} className="hover:bg-neutral-50/70">
                  {(() => {
                    const isRevoked = credential.status === 'REVOKED';
                    const isExpired = credential.status === 'EXPIRED';
                    const isLockedForStatusUpdate = isRevoked || isExpired;
                    const allowedStatusOptions =
                      CREDENTIAL_STATUS_OPTIONS[credential.status] ?? [credential.status];
                    const targetStatus = statusByCredentialId[credential.id] || credential.status;
                    const isStatusUnchanged = targetStatus === credential.status;
                    return (
                      <>
                        <td className="px-4 py-3 text-sm text-neutral-700">
                          {studentNameById.get(credential.studentId) || credential.studentId}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-neutral-900">{credential.title}</p>
                          <p className="mt-1 text-xs text-neutral-500">{credential.type}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge status={credential.status} />
                        </td>
                        <td className="hidden px-4 py-3 text-sm text-neutral-600 md:table-cell">{formatDateTime(credential.updatedAt)}</td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100">
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                              className="hidden"
                              onChange={event =>
                                setReissueFileByCredentialId(previous => ({
                                  ...previous,
                                  [credential.id]: event.target.files?.[0] ?? null,
                                }))
                              }
                            />
                            <Upload size={12} />
                            {reissueFileByCredentialId[credential.id]?.name || 'Upload'}
                          </label>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <select
                              value={targetStatus}
                              onChange={event =>
                                setStatusByCredentialId(previous => ({
                                  ...previous,
                                  [credential.id]: event.target.value as CredentialStatus,
                                }))
                              }
                              disabled={isLockedForStatusUpdate}
                              className="h-9 rounded-lg border border-neutral-200 bg-neutral-50 px-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {allowedStatusOptions.map(status => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            <button
                              onClick={() => onViewCredentialDetails(credential.id)}
                              className="inline-flex h-9 items-center gap-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                              title="View credential details"
                            >
                              <Eye size={12} />
                              View
                            </button>
                            <button
                              onClick={() => {
                                setUpdatingCredentialId(credential.id);
                                void onCredentialStatusUpdate(credential.id, targetStatus)
                                  .catch(() => undefined)
                                  .finally(() =>
                                    setUpdatingCredentialId(current => (current === credential.id ? null : current)),
                                  );
                              }}
                              disabled={updatingCredentialId === credential.id || isLockedForStatusUpdate || isStatusUnchanged}
                              className="inline-flex h-9 items-center rounded-lg border border-neutral-200 bg-neutral-50 px-3 text-xs font-semibold text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setReissuingCredentialId(credential.id);
                                const file = reissueFileByCredentialId[credential.id] ?? undefined;
                                void onCredentialReissue(credential.id, file)
                                  .then(() => {
                                    setReissueFileByCredentialId(previous => {
                                      const next = { ...previous };
                                      delete next[credential.id];
                                      return next;
                                    });
                                  })
                                  .catch(() => undefined)
                                  .finally(() =>
                                    setReissuingCredentialId(current => (current === credential.id ? null : current)),
                                  );
                              }}
                              disabled={reissuingCredentialId === credential.id || isRevoked}
                              className="inline-flex h-9 items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 hover:bg-cyan-100 disabled:opacity-50"
                            >
                              <ClipboardCheck size={12} />
                              Re-issue
                            </button>
                            {isLockedForStatusUpdate && (
                              <span className="inline-flex h-9 items-center rounded-lg border border-rose-200 bg-rose-50 px-3 text-[11px] font-semibold text-rose-700">
                                Locked
                              </span>
                            )}
                          </div>
                        </td>
                      </>
                    );
                  })()}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
