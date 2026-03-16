import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import Badge from '../../../components/common/Badge';
import ButtonLoadingContent from '../../../components/common/ButtonLoadingContent';
import Button from '../../../components/ui/Button';
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
          className="fixed inset-0 z-90 flex justify-end bg-neutral-950/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={onClose}
        >
          <motion.aside
            className="flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-neutral-200 px-4 py-4 sm:px-7 sm:py-6">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900">User Details</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Inspect user identity context, authorization settings, and history.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-neutral-400 transition hover:text-neutral-900"
                aria-label="Close user details"
              >
                <X size={24} strokeWidth={1.8} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-7 sm:py-6">
              <div className="space-y-8">
                {/* Identity header / profile block */}
                <section className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-base font-bold text-neutral-700">
                    {getInitials(user)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xl font-semibold text-neutral-900">{getFullName(user)}</p>
                    <p className="mt-1 text-sm text-neutral-500">{user.email}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${getRoleStyles(user.role)}`}>
                        {user.role}
                      </span>
                      <Badge status={user.status} />
                    </div>
                  </div>
                </section>

                <section className="border-t border-neutral-200 pt-6">
                   <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Account Details</h3>
                   <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                     <div>
                       <p className="text-xs font-semibold text-neutral-500">User ID</p>
                       <p className="mt-2 text-sm text-neutral-700 break-all">{user.id}</p>
                     </div>
                     <div>
                       <p className="text-xs font-semibold text-neutral-500">Linked Organization</p>
                       <p className="mt-2 text-sm text-neutral-700">{getLinkedOrganizationLabel(user)}</p>
                     </div>
                   </div>
                </section>

                <section className="border-t border-neutral-200 pt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Timestamps</h3>
                  <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold text-neutral-500">Created At</p>
                      <p className="mt-2 text-sm text-neutral-700">{formatDateTime(user.createdAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-500">Updated At</p>
                      <p className="mt-2 text-sm text-neutral-700">{formatDateTime(user.updatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-500">Approved At</p>
                      <p className="mt-2 text-sm text-neutral-700">{formatDateTime(user.approvedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-neutral-500">Approved By</p>
                      <p className="mt-2 text-sm text-neutral-700 break-all">{user.approverName || user.approvedById || '-'}</p>
                    </div>
                  </div>
                </section>

                <section className="border-t border-neutral-200 pt-6">
                  <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-xs text-neutral-500">
                    <span className="font-semibold">Privacy guardrail:</span> student & institution profile data payload is hidden from admin-level tools by default unless requested for risk review.
                  </div>
                </section>
              </div>
            </div>

            {/* Sticky Actions */}
            <div className="border-t border-neutral-200 bg-neutral-50 px-4 py-4 sm:px-7 shrink-0 space-y-6">
              {/* Role actions */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Role Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {USER_ROLE_ACTIONS.map(nextRole => (
                    <Button
                      key={nextRole}
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={isUpdatingRole === user.id || user.role === nextRole}
                      onClick={() => void onRoleUpdate(user.id, nextRole)}
                      className={user.role === nextRole ? 'border-neutral-200 bg-neutral-100 text-neutral-400' : ''}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {isUpdatingRole === user.id && user.role !== nextRole
                          ? <ButtonLoadingContent label="" />
                          : nextRole}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Status actions */}
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
                  Status Actions
                </p>
                <div className="flex flex-wrap gap-2">
                  {(VALID_STATUS_TRANSITIONS[user.status] ?? []).length === 0 ? (
                    <p className="text-sm text-neutral-400">No status transitions available.</p>
                  ) : (
                    (VALID_STATUS_TRANSITIONS[user.status] ?? []).map(nextStatus => (
                      <Button
                        key={nextStatus}
                        type="button"
                        variant={nextStatus === 'REJECTED' || nextStatus === 'SUSPENDED' ? 'danger' : 'secondary'}
                        size="sm"
                        disabled={isUpdatingStatus === user.id}
                        onClick={() => void onStatusUpdate(user.id, nextStatus)}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          {isUpdatingStatus === user.id
                            ? <ButtonLoadingContent label="" />
                            : nextStatus}
                        </span>
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
