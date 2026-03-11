import { useMemo } from 'react';
import { Check, ListFilter, PauseCircle, Search, XCircle } from 'lucide-react';
import ActionMenu from '../../../components/common/ActionMenu';
import Card from '../../../components/common/Card';
import Badge from '../../../components/common/Badge';
import SearchFilterModal, { SearchFilterGroup } from '../../../components/common/SearchFilterModal';
import TopNavPortal from '../../../components/common/TopNavPortal';
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
  users: User[];
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
  users,
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

  return (
    <div className="min-h-[calc(100vh-220px)] space-y-4 pb-4">
      <TopNavPortal>
        <div className="flex w-full max-w-md items-center gap-2 justify-end">
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
      </TopNavPortal>

      <Card title="User Management">
        <div className="mb-4 flex items-center justify-end">
          <div className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-xs font-semibold text-neutral-600">
            <ListFilter size={14} />
            Showing {filteredUsers.length} of {users.length} users
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200">
          <table className="w-full text-left">
            <thead className="bg-neutral-50 text-xs font-semibold text-neutral-500">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="hidden px-4 py-3 md:table-cell">Organization</th>
                <th className="hidden px-4 py-3 sm:table-cell">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
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
              {!isLoadingUsers && filteredUsers.map(user => (
                <tr
                  key={user.id}
                  className={`cursor-pointer transition-colors hover:bg-neutral-50/80 ${user.id === selectedUserId ? 'bg-neutral-50' : ''}`}
                  onClick={() => setSelectedUserId(user.id)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-xs font-bold text-neutral-700">
                        {getInitials(user)}
                      </div>
                      <div>
                        <p className="font-semibold text-neutral-900">{getFullName(user)}</p>
                        <p className="text-xs text-neutral-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className={`rounded-md border px-2.5 py-1 font-semibold ${getRoleStyles(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge status={user.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-600 md:table-cell">
                    {getLinkedOrganizationLabel(user)}
                  </td>
                  <td className="hidden px-4 py-3 text-sm text-neutral-600 sm:table-cell">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      {user.status === 'PENDING' && (
                        <>
                          <button
                            disabled={isUpdatingStatus === user.id}
                            onClick={() => void handleStatusUpdate(user.id, 'APPROVED')}
                            className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                            title="Approve"
                          >
                            <Check size={14} />
                          </button>
                          <button
                            disabled={isUpdatingStatus === user.id}
                            onClick={() => void handleStatusUpdate(user.id, 'REJECTED')}
                            className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                            title="Reject"
                          >
                            <XCircle size={14} />
                          </button>
                        </>
                      )}
                      <ActionMenu
                        items={[
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
