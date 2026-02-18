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

const getInitials = (fullName: string | null, email: string | null) => {
  const source = fullName || email || 'U';
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
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Total Users</p>
              <h3 className="text-3xl font-display font-bold text-gray-800 mt-2">{totalUsers}</h3>
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 px-2 py-0.5 mt-2 font-medium">
                backend source
              </span>
            </div>
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-600 group-hover:bg-blue-500 group-hover:text-white transition-colors">
              <Users size={24} />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Approved</p>
              <h3 className="text-3xl font-display font-bold text-emerald-600 mt-2">{approvedUsers}</h3>
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 px-2 py-0.5 mt-2 font-medium">
                active accounts
              </span>
            </div>
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-600 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
              <Server size={24} />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Pending Approval</p>
              <h3 className="text-3xl font-display font-bold text-amber-600 mt-2">{pendingUsers}</h3>
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 px-2 py-0.5 mt-2 font-medium">
                awaiting review
              </span>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
              <Activity size={24} />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl relative overflow-hidden group">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 text-xs font-bold uppercase tracking-wider">Suspended</p>
              <h3 className="text-3xl font-display font-bold text-rose-600 mt-2">{suspendedUsers}</h3>
              <span className="inline-flex items-center gap-1 text-[10px] text-gray-400 px-2 py-0.5 mt-2 font-medium">
                requires action
              </span>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl text-rose-600 group-hover:bg-rose-500 group-hover:text-white transition-colors">
              <Shield size={24} />
            </div>
          </div>
        </div>
      </div>

      {usersError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} />
          {usersError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <Card
            title="User Management"
            action={
              <button
                onClick={loadUsers}
                className="text-xs bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-800 transition inline-flex items-center gap-1"
              >
                <RefreshCw size={12} />
                Refresh
              </button>
            }
          >
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="w-full text-left">
                <thead className="bg-gray-50/50 text-gray-500 text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {isLoadingUsers && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                        Loading users...
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers && users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                        No users found.
                      </td>
                    </tr>
                  )}
                  {!isLoadingUsers &&
                    users.map(user => (
                      <tr key={user.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">
                              {getInitials(user.fullName, user.email)}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-700">{user.fullName || 'Unnamed User'}</div>
                              <div className="text-xs text-gray-400">{user.email || 'No email'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs">
                          <span
                            className={`px-2.5 py-1 rounded-md font-medium border ${
                              user.role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-700 border-purple-200'
                                : user.role === 'REGISTRAR'
                                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                                  : 'bg-gray-50 text-gray-600 border-gray-200'
                            }`}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full w-fit ${
                              user.status === 'APPROVED'
                                ? 'bg-green-100 text-green-700'
                                : user.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-700'
                                  : user.status === 'SUSPENDED'
                                    ? 'bg-rose-100 text-rose-700'
                                    : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                user.status === 'APPROVED'
                                  ? 'bg-green-500'
                                  : user.status === 'PENDING'
                                    ? 'bg-amber-500'
                                    : user.status === 'SUSPENDED'
                                      ? 'bg-rose-500'
                                      : 'bg-gray-500'
                              }`}
                            ></span>
                            {user.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-400 font-mono">{formatDate(user.updatedAt)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Role Distribution">
            <div className="space-y-4">
              {Object.entries(roleDistribution).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-indigo-500" />
                    <span className="text-sm font-semibold text-gray-800">{role}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Status Distribution">
            <div className="space-y-4">
              {Object.entries(statusDistribution).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2">
                    <Database size={16} className="text-slate-500" />
                    <span className="text-sm font-semibold text-gray-800">{status}</span>
                  </div>
                  <span className="text-sm font-bold text-gray-600">{count}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}