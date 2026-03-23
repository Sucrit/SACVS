import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck, MoreVertical, Upload } from 'lucide-react';
import Card from '../../../components/common/Card';
import Modal, { ModalFooter } from '../../../components/ui/Modal';
import Button from '../../../components/ui/Button';
import UserAvatar from '../../../components/common/UserAvatar';
import { getUploadDropzoneClass, UPLOAD_DROPZONE_CTA_CLASS } from '../../../components/common/uploadSurface';
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
  const [reissueModalCredentialId, setReissueModalCredentialId] = useState<string | null>(null);
  const [isReissueFileDragOver, setIsReissueFileDragOver] = useState(false);

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
  const reissueCredential = useMemo(
    () => institutionCredentials.find(credential => credential.id === reissueModalCredentialId) || null,
    [institutionCredentials, reissueModalCredentialId],
  );

  return (
    <Card title="Manage Student Credentials">
      <div className="rounded-lg border border-neutral-200 pb-[10px]">
        <table className="w-full text-left">
          <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
            <tr>
              <th className="px-4 py-3">Student</th>
              <th className="px-4 py-3">Credential</th>
              <th className="px-4 py-3">Status</th>
              <th className="hidden px-4 py-3 md:table-cell">Last Update</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 bg-white">
            {isLoadingCredentials && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                  Loading institution credentials...
                </td>
              </tr>
            )}
            {!isLoadingCredentials && institutionCredentials.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-neutral-500">
                  No credentials found for your institution.
                </td>
              </tr>
            )}
            {!isLoadingCredentials &&
              institutionCredentials.map((credential, index) => (
                <motion.tr
                  key={credential.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="cursor-pointer hover:bg-neutral-50/70"
                  onClick={() => onViewCredentialDetails(credential.id)}
                >
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
                                <UserAvatar initials={getUserInitials(student)} />
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
                        <td className="px-4 py-3">
                          <div className="relative flex items-center justify-end action-menu-container">
                            <button
                              onClick={event => {
                                event.stopPropagation();
                                setOpenMenuId(openMenuId === credential.id ? null : credential.id);
                              }}
                              className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
                            >
                              <MoreVertical size={18} />
                            </button>

                            {openMenuId === credential.id && (
                              <div
                                className="absolute right-0 top-full z-50 mt-1 flex w-48 flex-col gap-1 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg"
                                onClick={event => event.stopPropagation()}
                              >
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
                                    setReissueModalCredentialId(credential.id);
                                    setOpenMenuId(null);
                                  }}
                                  disabled={reissuingCredentialId === credential.id || isRevoked}
                                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
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
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>


      <Modal
        open={reissueCredential !== null}
        onClose={() => {
          setReissueModalCredentialId(null);
          setIsReissueFileDragOver(false);
        }}
        title="Re-issue Credential"
        description="Upload a replacement credential file before re-issuing this record."
        size="md"
        footer={
          reissueCredential ? (
            <ModalFooter
              leftActions={
                <Button
                  variant="outline"
                  onClick={() => {
                    setReissueModalCredentialId(null);
                    setIsReissueFileDragOver(false);
                  }}
                >
                  Cancel
                </Button>
              }
              rightActions={
                <Button
                  variant="primary"
                  onClick={() => {
                    setReissuingCredentialId(reissueCredential.id);
                    const file = reissueFileByCredentialId[reissueCredential.id] ?? undefined;
                    void onCredentialReissue(reissueCredential.id, file)
                      .then(() => {
                        setReissueFileByCredentialId(previous => {
                          const next = { ...previous };
                          delete next[reissueCredential.id];
                          return next;
                        });
                        setReissueModalCredentialId(null);
                        setIsReissueFileDragOver(false);
                      })
                      .catch(() => undefined)
                      .finally(() => {
                        setReissuingCredentialId(current => (current === reissueCredential.id ? null : current));
                      });
                  }}
                  disabled={!reissueFileByCredentialId[reissueCredential.id] || reissuingCredentialId === reissueCredential.id}
                  loading={reissuingCredentialId === reissueCredential.id}
                >
                  Confirm & Re-issue
                </Button>
              }
            />
          ) : null
        }
      >
        {reissueCredential && (
          <div className="flex flex-col gap-5">
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">{reissueCredential.title}</p>
              <p className="mt-1 text-xs text-neutral-500">{reissueCredential.type}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="manage-reissue-file-upload" className="text-sm font-semibold text-neutral-800">
                Replacement Credential<span className="ml-1 text-rose-500">*</span>
              </label>
              <div
                role="button"
                tabIndex={0}
                onClick={() => document.getElementById('manage-reissue-file-upload')?.click()}
                onKeyDown={event => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    document.getElementById('manage-reissue-file-upload')?.click();
                  }
                }}
                onDragOver={event => {
                  event.preventDefault();
                  setIsReissueFileDragOver(true);
                }}
                onDragLeave={event => {
                  event.preventDefault();
                  setIsReissueFileDragOver(false);
                }}
                onDrop={event => {
                  event.preventDefault();
                  setIsReissueFileDragOver(false);
                  setReissueFileByCredentialId(previous => ({
                    ...previous,
                    [reissueCredential.id]: event.dataTransfer.files?.[0] ?? null,
                  }));
                }}
                className={getUploadDropzoneClass({
                  active: isReissueFileDragOver,
                  className: 'flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-6 py-8 text-center transition',
                })}
              >
                <Upload size={28} className="mb-3 text-neutral-400" />
                <p className="text-base text-neutral-700">
                  <span className={UPLOAD_DROPZONE_CTA_CLASS}>Upload a file</span> or drag and drop
                </p>
                <p className="mt-2 text-sm text-neutral-500">PDF, PNG, JPG up to 10MB</p>
                {reissueFileByCredentialId[reissueCredential.id] && (
                  <p className="mt-4 max-w-full truncate rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm font-medium text-neutral-700" title={reissueFileByCredentialId[reissueCredential.id]?.name || undefined}>
                    {reissueFileByCredentialId[reissueCredential.id]?.name}
                  </p>
                )}
              </div>
              <input
                id="manage-reissue-file-upload"
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                className="hidden"
                onChange={event =>
                  setReissueFileByCredentialId(previous => ({
                    ...previous,
                    [reissueCredential.id]: event.target.files?.[0] ?? null,
                  }))
                }
              />
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
