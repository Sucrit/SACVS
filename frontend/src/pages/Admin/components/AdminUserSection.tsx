import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, PauseCircle, Search, XCircle } from 'lucide-react';
import ActionMenu from '../../../components/common/ActionMenu';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import PaginationControls from '../../../components/common/PaginationControls';
import SearchFilterModal, { SearchFilterGroup } from '../../../components/common/SearchFilterModal';
import UserAvatar from '../../../components/common/UserAvatar';
import AdminUserDetailsDrawer from './AdminUserDetailsDrawer';
import { User, UserRole, UserStatus } from '../../../services/user.service';
import { formatDate } from '../../../utils/formatting';
import {
  getFullName,
  getInitials,
  getRoleStyles,
  getLinkedOrganizationLabel,
  ROLE_OPTIONS,
  STATUS_OPTIONS,
} from '../useAdminDashboardState';
import type { RoleFilter, StatusFilter } from '../useAdminDashboardState';

interface AdminUserSectionProps {
  filteredUsers: User[];
  isLoadingUsers: boolean;
  search: string;
  setSearch: (v: string) => void;
  roleFilter: RoleFilter;
  setRoleFilter: (v: RoleFilter) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  selectedUserId: string | null;
  setSelectedUserId: (id: string | null) => void;
  selectedUser: User | null;
  isUpdatingStatus: string | null;
  isUpdatingRole: string | null;
  handleStatusUpdate: (userId: string, status: UserStatus) => Promise<void>;
  handleRoleUpdate: (userId: string, role: UserRole) => Promise<void>;
}

export default function AdminUserSection({
  filteredUsers,
  isLoadingUsers,
  search,
  setSearch,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  selectedUserId,
  setSelectedUserId,
  selectedUser,
  isUpdatingStatus,
  isUpdatingRole,
  handleStatusUpdate,
  handleRoleUpdate,
}: AdminUserSectionProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12;

  const filterGroups = useMemo<SearchFilterGroup[]>(() => [
    {
      id: 'admin-user-role',
      label: 'Role',
      value: roleFilter,
      defaultValue: 'ALL',
      options: ROLE_OPTIONS.map(role => ({
        value: role,
        label: role === 'ALL' ? 'All roles' : role,
      })),
      onChange: value => setRoleFilter(value as RoleFilter),
    },
    {
      id: 'admin-user-status',
      label: 'Status',
      value: statusFilter,
      defaultValue: 'ALL',
      options: STATUS_OPTIONS.map(status => ({
        value: status,
        label: status === 'ALL' ? 'All statuses' : status,
      })),
      onChange: value => setStatusFilter(value as StatusFilter),
    },
  ], [roleFilter, setRoleFilter, setStatusFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pagedUsers = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, safeCurrentPage]);

  return (
    <div className="min-h-[calc(100vh-220px)] space-y-4 pb-4">
      <Card title="User Management">
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full max-w-xl items-center gap-2">
            <div className="relative flex-1">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search name, email, role, organization..."
                className="h-9 w-full rounded-lg border border-neutral-200 bg-neutral-50 pl-9 pr-3 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-primary-100 focus:border-primary-500 transition-all"
              />
            </div>
            <SearchFilterModal
              hideLabel
              groups={filterGroups}
              description="Refine the user directory by account role and approval status."
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 pb-[10px]">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="hidden px-4 py-3 md:table-cell">Organization Name</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 sm:table-cell">Created At</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 bg-white">
              {isLoadingUsers && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-500">
                    Loading users...
                  </td>
                </tr>
              )}
              {!isLoadingUsers && filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-neutral-500">
                    No users matched your filters.
                  </td>
                </tr>
              )}
               {!isLoadingUsers && pagedUsers.map((user, index) => (
                <motion.tr
                  key={user.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={`cursor-pointer transition-colors hover:bg-neutral-50/80 ${user.id === selectedUserId ? 'bg-neutral-50' : ''}`}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar initials={getInitials(user)} />
                      <div>
                        <p className="font-semibold text-neutral-900">{getFullName(user)}</p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`font-semibold tracking-[0.08em] ${getRoleStyles(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-600 md:table-cell">
                    {getLinkedOrganizationLabel(user)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={user.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-600 sm:table-cell">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <ActionMenu
                        items={[
                          ...(user.status === 'PENDING' ? [
                            {
                              label: 'Approve',
                              icon: <Check size={14} className="text-emerald-600" />,
                              onClick: () => void handleStatusUpdate(user.id, 'APPROVED'),
                              disabled: isUpdatingStatus === user.id,
                            },
                            {
                              label: 'Reject',
                              icon: <XCircle size={14} className="text-rose-600" />,
                              onClick: () => void handleStatusUpdate(user.id, 'REJECTED'),
                              disabled: isUpdatingStatus === user.id,
                              className: 'text-rose-700',
                            }
                          ] : []),
                          ...(user.status === 'SUSPENDED' ? [{
                            label: 'Approve',
                            icon: <Check size={14} className="text-emerald-600" />,
                            onClick: () => void handleStatusUpdate(user.id, 'APPROVED'),
                            disabled: isUpdatingStatus === user.id,
                          }] : []),
                          ...(user.status === 'APPROVED' ? [{
                            label: 'Suspend',
                            icon: <PauseCircle size={14} className="text-orange-600" />,
                            onClick: () => void handleStatusUpdate(user.id, 'SUSPENDED'),
                            disabled: isUpdatingStatus === user.id,
                          }] : []),
                        ]}
                      />
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {!isLoadingUsers && filteredUsers.length > 0 && (
          <PaginationControls
            currentPage={safeCurrentPage}
            totalItems={filteredUsers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            itemLabel="users"
          />
        )}
      </Card>

      <AdminUserDetailsDrawer
        isOpen={selectedUserId !== null}
        user={selectedUser}
        isUpdatingStatus={isUpdatingStatus}
        isUpdatingRole={isUpdatingRole}
        onClose={() => setSelectedUserId(null)}
        onStatusUpdate={handleStatusUpdate}
        onRoleUpdate={handleRoleUpdate}
      />
    </div>
  );
}
