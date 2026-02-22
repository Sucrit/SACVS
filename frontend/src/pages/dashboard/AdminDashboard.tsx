import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import {
  AlertCircle,
  ArrowRight,
  CircleUserRound,
  Clock3,
  Database,
  ListFilter,
  Mail,
  MapPin,
  RefreshCw,
  Search,
  Server,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { User, UserRole, UserService, UserStatus } from '../../services/user.service';

type AdminSection = 'overview' | 'users' | 'logs' | 'settings';
type RoleFilter = UserRole | 'ALL';
type StatusFilter = UserStatus | 'ALL';

const ROLE_OPTIONS: RoleFilter[] = ['ALL', 'STUDENT', 'EMPLOYER', 'INSTITUTION', 'ADMIN'];
const STATUS_OPTIONS: StatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
const USER_STATUS_ACTIONS: UserStatus[] = ['APPROVED', 'REJECTED', 'SUSPENDED', 'PENDING'];

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString();
};

const getFullName = (user: User) => [user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ').trim();

const getInitials = (user: User) => {
  const source = getFullName(user) || user.email || 'U';
  const tokens = source.split(' ').filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase();
};

const getRoleStyles = (role: UserRole) => {
  if (role === 'ADMIN') return 'border-slate-400 bg-slate-100 text-slate-800';
  if (role === 'INSTITUTION') return 'border-cyan-200 bg-cyan-50 text-cyan-800';
  if (role === 'EMPLOYER') return 'border-violet-200 bg-violet-50 text-violet-800';
  return 'border-slate-200 bg-slate-50 text-slate-700';
};

const getSection = (pathname: string): AdminSection => {
  if (pathname.includes('/dashboard/admin/users')) return 'users';
  if (pathname.includes('/dashboard/admin/logs')) return 'logs';
  if (pathname.includes('/dashboard/admin/settings')) return 'settings';
  return 'overview';
};

export default function AdminDashboard() {
  const location = useLocation();
  const section = getSection(location.pathname);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    setUsersError(null);

    try {
      const data = await UserService.list();
      setUsers(data);
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
      setUsersError('Unable to load users from the backend.');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

  const totalUsers = users.length;
  const approvedUsers = users.filter(user => user.status === 'APPROVED').length;
  const pendingUsers = users.filter(user => user.status === 'PENDING').length;
  const suspendedUsers = users.filter(user => user.status === 'SUSPENDED').length;
  const profiledStudents = users.filter(user => user.role === 'STUDENT' && user.profile).length;

  const roleDistribution = useMemo(() => {
    return {
      STUDENT: users.filter(user => user.role === 'STUDENT').length,
      EMPLOYER: users.filter(user => user.role === 'EMPLOYER').length,
      INSTITUTION: users.filter(user => user.role === 'INSTITUTION').length,
      ADMIN: users.filter(user => user.role === 'ADMIN').length,
    };
  }, [users]);

  const statusDistribution = useMemo(() => {
    return {
      APPROVED: approvedUsers,
      PENDING: pendingUsers,
      REJECTED: users.filter(user => user.status === 'REJECTED').length,
      SUSPENDED: suspendedUsers,
    };
  }, [approvedUsers, pendingUsers, suspendedUsers, users]);

  const recentUsers = useMemo(() => {
    return [...users]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 8);
  }, [users]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter(user => {
      if (roleFilter !== 'ALL' && user.role !== roleFilter) return false;
      if (statusFilter !== 'ALL' && user.status !== statusFilter) return false;

      if (!keyword) return true;

      const searchable = [
        user.id,
        user.email,
        user.firstName,
        user.middleName || '',
        user.lastName,
        user.profile?.studentNumber || '',
        user.profile?.department || '',
        user.profile?.courseOfStudy || '',
        user.profile?.phone || '',
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [users, roleFilter, statusFilter, search]);

  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }

    const hasSelectedUser = selectedUserId && filteredUsers.some(user => user.id === selectedUserId);
    if (!hasSelectedUser) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId]);

  const selectedUser = useMemo(
    () => filteredUsers.find(user => user.id === selectedUserId) || null,
    [filteredUsers, selectedUserId],
  );

  const pendingQueue = useMemo(
    () =>
      users
        .filter(user => user.status === 'PENDING')
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    [users],
  );

  const handleStatusUpdate = useCallback(async (userId: string, status: UserStatus) => {
    setIsUpdatingStatus(userId);
    setUsersError(null);

    try {
      const updated = await UserService.updateStatus(userId, status);
      setUsers(previous => previous.map(user => (user.id === userId ? { ...user, ...updated } : user)));
    } catch (error) {
      console.error('Failed to update user status:', error);
      setUsersError('Unable to update user status at this time.');
    } finally {
      setIsUpdatingStatus(null);
    }
  }, []);

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Users" className="border-slate-900 bg-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{totalUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-300">All accounts</p>
            </div>
            <Users size={22} className="text-white" />
          </div>
        </Card>

        <Card title="Approved">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-emerald-700">{approvedUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Active users</p>
            </div>
            <UserRoundCheck size={22} className="text-emerald-700" />
          </div>
        </Card>

        <Card title="Pending">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-amber-700">{pendingUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Needs approval</p>
            </div>
            <Clock3 size={22} className="text-amber-700" />
          </div>
        </Card>

        <Card title="Student Profiles">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-slate-900">{profiledStudents}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">With profile data</p>
            </div>
            <Database size={22} className="text-slate-700" />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <Card
            title="Recent User Registrations"
            action={
              <Link
                to="/dashboard/admin/users"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                View All
                <ArrowRight size={14} />
              </Link>
            }
          >
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingUsers && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers && recentUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers &&
                    recentUsers.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">{getFullName(user)}</p>
                          <p className="mt-1 text-xs text-slate-500">ID: {user.id}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{user.email}</td>
                        <td className="px-5 py-4">
                          <span className={`rounded-md border px-2.5 py-1 text-xs font-semibold ${getRoleStyles(user.role)}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <Badge status={user.status} />
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">{formatDate(user.createdAt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Role Distribution">
            <div className="space-y-3">
              {Object.entries(roleDistribution).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Users size={14} className="text-slate-600" />
                    <span className="text-sm font-semibold text-slate-800">{role}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Status Distribution">
            <div className="space-y-3">
              {Object.entries(statusDistribution).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Server size={14} className="text-slate-600" />
                    <span className="text-sm font-semibold text-slate-800">{status}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-700">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );

  const renderUserManagement = () => (
    <div className="space-y-6">
      <Card
        title="User Management"
        action={
          <button
            onClick={loadUsers}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Search</label>
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Name, email, student number, department..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Role</label>
            <select
              value={roleFilter}
              onChange={event => setRoleFilter(event.target.value as RoleFilter)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
            >
              {ROLE_OPTIONS.map(role => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Status</label>
            <select
              value={statusFilter}
              onChange={event => setStatusFilter(event.target.value as StatusFilter)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800"
            >
              {STATUS_OPTIONS.map(status => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
          <ListFilter size={14} />
          Showing {filteredUsers.length} of {users.length} users
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <Card title="Accounts">
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Student Number</th>
                    <th className="px-5 py-3">Department</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingUsers && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers && filteredUsers.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                        No users matched your filters.
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers &&
                    filteredUsers.map(user => {
                      const isSelected = user.id === selectedUserId;

                      return (
                        <tr
                          key={user.id}
                          className={`cursor-pointer transition-colors hover:bg-slate-50/80 ${isSelected ? 'bg-slate-50' : ''}`}
                          onClick={() => setSelectedUserId(user.id)}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                                {getInitials(user)}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900">{getFullName(user)}</p>
                                <p className="text-xs text-slate-500">{user.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-xs">
                            <span className={`rounded-md border px-2.5 py-1 font-semibold ${getRoleStyles(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <Badge status={user.status} />
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600">{user.profile?.studentNumber || '-'}</td>
                          <td className="px-5 py-4 text-sm text-slate-600">{user.profile?.department || '-'}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2">
          <Card title="Selected User Details">
            {!selectedUser && <p className="text-sm text-slate-500">Select a user to view complete profile details.</p>}

            {selectedUser && (
              <div className="space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{getFullName(selectedUser)}</p>
                      <p className="mt-1 text-sm text-slate-500">{selectedUser.email}</p>
                    </div>
                    <Badge status={selectedUser.status} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="uppercase tracking-[0.1em] text-slate-500">User ID</p>
                      <p className="mt-1 break-all font-semibold text-slate-700">{selectedUser.id}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.1em] text-slate-500">Role</p>
                      <p className="mt-1 font-semibold text-slate-700">{selectedUser.role}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.1em] text-slate-500">Created</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDateTime(selectedUser.createdAt)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.1em] text-slate-500">Updated</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDateTime(selectedUser.updatedAt)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.1em] text-slate-500">Approved At</p>
                      <p className="mt-1 font-semibold text-slate-700">{formatDateTime(selectedUser.approvedAt)}</p>
                    </div>
                    <div>
                      <p className="uppercase tracking-[0.1em] text-slate-500">Approved By ID</p>
                      <p className="mt-1 break-all font-semibold text-slate-700">{selectedUser.approvedById || '-'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Status Actions</p>
                  <div className="grid grid-cols-2 gap-2">
                    {USER_STATUS_ACTIONS.map(nextStatus => (
                      <button
                        key={nextStatus}
                        disabled={isUpdatingStatus === selectedUser.id || selectedUser.status === nextStatus}
                        onClick={() => void handleStatusUpdate(selectedUser.id, nextStatus)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                          selectedUser.status === nextStatus
                            ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {isUpdatingStatus === selectedUser.id && selectedUser.status !== nextStatus ? 'Updating...' : nextStatus}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center gap-2">
                    <CircleUserRound size={15} className="text-slate-600" />
                    <p className="text-sm font-semibold text-slate-800">Student Profile</p>
                  </div>

                  {!selectedUser.profile && (
                    <p className="text-sm text-slate-500">No student profile was submitted for this account.</p>
                  )}

                  {selectedUser.profile && (
                    <div className="space-y-2 text-sm text-slate-700">
                      <p>
                        <span className="font-semibold text-slate-800">Student Number:</span> {selectedUser.profile.studentNumber}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Department:</span> {selectedUser.profile.department}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Course of Study:</span> {selectedUser.profile.courseOfStudy}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Year Level:</span> {selectedUser.profile.yearLevel}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Phone:</span> {selectedUser.profile.phone}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-800">Address:</span>{' '}
                        {[
                          selectedUser.profile.street,
                          selectedUser.profile.barangay,
                          selectedUser.profile.city,
                          selectedUser.profile.province,
                          selectedUser.profile.zipCode,
                        ]
                          .filter(Boolean)
                          .join(', ')}
                      </p>
                      <p className="text-xs text-slate-500">
                        Profile updated: {formatDateTime(selectedUser.profile.updatedAt)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );

  const renderLogsPlaceholder = () => (
    <Card title="System Logs">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm text-slate-700">
          TODO: Audit/system logs page
        </p>
      </div>
    </Card>
  );

  const renderSettingsPlaceholder = () => (
    <Card title="Admin Settings">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
        <p className="text-sm text-slate-700">
          TODO: Admin system page
        </p>
      </div>
    </Card>
  );

  return (
    <div className="space-y-6">
      {usersError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {usersError}
        </div>
      )}

      {section === 'overview' && renderOverview()}
      {section === 'users' && renderUserManagement()}
      {section === 'logs' && renderLogsPlaceholder()}
      {section === 'settings' && renderSettingsPlaceholder()}

      {section === 'overview' && pendingQueue.length > 0 && (
        <Card title="Pending Approval Queue">
          <div className="space-y-3">
            {pendingQueue.slice(0, 4).map(user => (
              <div key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{getFullName(user)}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Mail size={12} />
                      {user.email}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={12} />
                      {user.profile?.department || 'No department'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    disabled={isUpdatingStatus === user.id}
                    onClick={() => void handleStatusUpdate(user.id, 'APPROVED')}
                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={isUpdatingStatus === user.id}
                    onClick={() => void handleStatusUpdate(user.id, 'REJECTED')}
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    disabled={isUpdatingStatus === user.id}
                    onClick={() => void handleStatusUpdate(user.id, 'SUSPENDED')}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Suspend
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

    </div>
  );
}
