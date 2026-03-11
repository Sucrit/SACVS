import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import Badge from '../../../components/common/Badge';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import { User, UserRole, UserStatus } from '../../../services/user.service';
import { formatDateTime } from '../../../utils/formatting';
import {
  getFullName,
  getInitials,
  getRoleStyles,
  getLinkedOrganizationLabel,
  USER_ROLE_ACTIONS,
} from '../useAdminDashboardState';

const VALID_STATUS_TRANSITIONS: Record<UserStatus, UserStatus[]> = {
  PENDING: ['APPROVED', 'REJECTED'],
  APPROVED: ['SUSPENDED'],
  SUSPENDED: ['APPROVED'],
  REJECTED: [],
};

interface AdminUserDetailsDrawerProps {
  isOpen: boolean;
  user: User | null;
  isUpdatingStatus: string | null;
  isUpdatingRole: string | null;
  onClose: () => void;
  onStatusUpdate: (userId: string, status: UserStatus) => Promise<void>;
  onRoleUpdate: (userId: string, role: UserRole) => Promise<void>;
}

export default function AdminUserDetailsDrawer({
  isOpen,
  user,
  isUpdatingStatus,
  isUpdatingRole,
  onClose,
  onStatusUpdate,
  onRoleUpdate,
}: AdminUserDetailsDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && user && (
        <motion.div
          className="fixed inset-0 z-[90] flex justify-end bg-neutral-950/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onClose}
        >
          <motion.aside
            className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
              <p className="text-sm font-semibold text-neutral-900">User Details</p>
              <button
                onClick={onClose}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Identity card */}
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-sm font-bold text-neutral-700">
                    {getInitials(user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-neutral-900">{getFullName(user)}</p>
                    <p className="mt-0.5 text-sm text-neutral-500">{user.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2.5 py-0.5 text-[11px] font-semibold ${getRoleStyles(user.role)}`}>
                        {user.role}
                      </span>
                      <Badge status={user.status} />
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-neutral-500">User ID</p>
                    <p className="mt-0.5 break-all font-semibold text-neutral-700">{user.id}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Organization</p>
                    <p className="mt-0.5 font-semibold text-neutral-700">{getLinkedOrganizationLabel(user)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Created</p>
                    <p className="mt-0.5 font-semibold text-neutral-700">{formatDateTime(user.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Updated</p>
                    <p className="mt-0.5 font-semibold text-neutral-700">{formatDateTime(user.updatedAt)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Approved At</p>
                    <p className="mt-0.5 font-semibold text-neutral-700">{formatDateTime(user.approvedAt)}</p>
                  </div>
                  <div>
                    <p className="text-neutral-500">Approved By</p>
                    <p className="mt-0.5 break-all font-semibold text-neutral-700">{user.approverName || user.approvedById || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Role actions */}
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-500">
                  Role Actions
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {USER_ROLE_ACTIONS.map(nextRole => (
                    <button
                      key={nextRole}
                      disabled={isUpdatingRole === user.id || user.role === nextRole}
                      onClick={() => void onRoleUpdate(user.id, nextRole)}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                        user.role === nextRole
                          ? 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
                          : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isUpdatingRole === user.id && user.role !== nextRole
                          ? <ButtonLoadingContent label="" />
                          : nextRole}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Status actions */}
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-500">
                  Status Actions
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(VALID_STATUS_TRANSITIONS[user.status] ?? []).length === 0 ? (
                    <p className="col-span-2 text-xs text-neutral-400">No status transitions available.</p>
                  ) : (
                    (VALID_STATUS_TRANSITIONS[user.status] ?? []).map(nextStatus => (
                      <button
                        key={nextStatus}
                        disabled={isUpdatingStatus === user.id}
                        onClick={() => void onStatusUpdate(user.id, nextStatus)}
                        className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {isUpdatingStatus === user.id
                            ? <ButtonLoadingContent label="" />
                            : nextStatus}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500">
                Privacy guardrail: student profile data is hidden from admin-level tools by default.
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
