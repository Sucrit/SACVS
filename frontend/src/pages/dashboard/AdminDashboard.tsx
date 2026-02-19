import { useCallback, useEffect, useMemo, useState } from 'react';
import Card from '../../components/common/Card';
import { Users, Server, Shield, Activity, Database, RefreshCw, AlertCircle } from 'lucide-react';
import { User, UserService } from '../../services/user.service';

const formatDate = (value: string | null | undefined) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
};

const getInitials = (firstName: string, middleName: string | null, lastName: string, email: string) => {
  const source = [firstName, middleName, lastName].filter(Boolean).join(' ') || email || 'U';
  const tokens = source.split(' ').filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] || ''}${tokens[1][0] || ''}`.toUpperCase();
};

export default function AdminDashboard() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);

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

  const roleDistribution = useMemo(() => {
    return {
      STUDENT: users.filter(user => user.role === 'STUDENT').length,
      REGISTRAR: users.filter(user => user.role === 'REGISTRAR').length,
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Total Users" className="border-slate-900 bg-slate-900 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-white">{totalUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-300">Backend source</p>
            </div>
            <Users size={22} className="text-white" />
          </div>
        </Card>

        <Card title="Approved">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-emerald-700">{approvedUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Active accounts</p>
            </div>
            <Server size={22} className="text-emerald-700" />
          </div>
        </Card>

        <Card title="Pending Approval">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-amber-700">{pendingUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Needs review</p>
            </div>
            <Activity size={22} className="text-amber-700" />
          </div>
        </Card>

        <Card title="Suspended">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-rose-700">{suspendedUsers}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.1em] text-slate-500">Requires action</p>
            </div>
            <Shield size={22} className="text-rose-700" />
          </div>
        </Card>
      </div>

      {usersError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {usersError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
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
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">User</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {isLoadingUsers && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers && users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                        No users found.
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers &&
                    users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-xs font-bold text-slate-700">
                              {getInitials(user.firstName, user.middleName, user.lastName, user.email)}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{[user.firstName, user.middleName, user.lastName].filter(Boolean).join(' ')}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span
                            className={`rounded-md border px-2.5 py-1 font-semibold ${
                              user.role === 'ADMIN'
                                ? 'border-slate-400 bg-slate-100 text-slate-800'
                                : user.role === 'REGISTRAR'
                                  ? 'border-cyan-200 bg-cyan-50 text-cyan-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold ${
                              user.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : user.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800'
                                  : user.status === 'SUSPENDED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current"></span>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-500">{formatDate(user.updatedAt)}</td>
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
                    <Database size={14} className="text-slate-600" />
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
}
