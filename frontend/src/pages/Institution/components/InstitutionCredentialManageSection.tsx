import { useMemo, useState, useEffect } from 'react';
import { ClipboardCheck, Eye, Upload, MoreVertical } from 'lucide-react';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import {
  Credential,
  CredentialStatus,
} from '../../../services/credential.service';
import { User } from '../../../services/user.service';
import { formatDateTime, getStudentFullName, getUserInitials } from '../utils';

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
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.action-menu-container')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const studentById = useMemo(
    () => new Map(students.map(student => [student.id, student] as const)),
    [students],
  );

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
              <th className="px-4 py-3 text-right">Action</th>
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
                          {(() => {
                            const student = studentById.get(credential.studentId);
                            if (!student) return credential.studentId;

                            return (
                              <div className="flex items-center gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-700">
                                  {getUserInitials(student)}
                                </div>
                                <div>
                                  <p className="font-semibold text-neutral-900">{getStudentFullName(student)}</p>
                                  <p className="mt-1 text-xs text-neutral-500">{student.email}</p>
                                </div>
                              </div>
                            );
                          })()}
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
                          <div className="relative flex items-center justify-end action-menu-container">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === credential.id ? null : credential.id)}
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
                            >
                              <MoreVertical size={18} />
                            </button>

                            {openMenuId === credential.id && (
                              <div className="absolute right-0 top-full z-50 mt-1 flex w-48 flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg">
                                <div className="mb-2 border-b border-neutral-100 pb-2">
                                  <label className="mb-1 block text-[10px] font-bold uppercase text-neutral-400">Update Status</label>
                                  <select
                                    value={targetStatus}
                                    onChange={event =>
                                      setStatusByCredentialId(previous => ({
                                        ...previous,
                                        [credential.id]: event.target.value as CredentialStatus,
                                      }))
                                    }
                                    disabled={isLockedForStatusUpdate}
                                    className="w-full rounded border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-xs outline-none focus:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    {allowedStatusOptions.map(status => (
                                      <option key={status} value={status}>
                                        {status}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <button
                                  onClick={() => {
                                    onViewCredentialDetails(credential.id);
                                    setOpenMenuId(null);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100"
                                >
                                  <Eye size={14} />
                                  View Details
                                </button>

                                <button
                                  onClick={() => {
                                    setUpdatingCredentialId(credential.id);
                                    void onCredentialStatusUpdate(credential.id, targetStatus)
                                      .catch(() => undefined)
                                      .finally(() => {
                                        setUpdatingCredentialId(current => (current === credential.id ? null : current));
                                        setOpenMenuId(null);
                                      });
                                  }}
                                  disabled={updatingCredentialId === credential.id || isLockedForStatusUpdate || isStatusUnchanged}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium text-neutral-700 hover:bg-neutral-100 disabled:opacity-50"
                                >
                                  <ClipboardCheck size={14} />
                                  Save Status
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
                                      .finally(() => {
                                        setReissuingCredentialId(current => (current === credential.id ? null : current));
                                        setOpenMenuId(null);
                                      });
                                  }}
                                  disabled={reissuingCredentialId === credential.id || isRevoked}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-cyan-700 hover:bg-cyan-50 disabled:opacity-50"
                                >
                                  <ClipboardCheck size={14} />
                                  Re-issue
                                </button>

                                {isLockedForStatusUpdate && (
                                  <div className="mt-1 flex items-center justify-center rounded-md bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700">
                                    Locked
                                  </div>
                                )}
                              </div>
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
