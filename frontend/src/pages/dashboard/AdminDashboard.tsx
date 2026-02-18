import React, { useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { Users, Server, Shield, Activity } from 'lucide-react';

const MOCK_USERS = [
    { id: '1', name: 'John Doe', role: 'STUDENT', status: 'ACTIVE', lastActive: '2 mins ago' },
    { id: '2', name: 'Jane Smith', role: 'REGISTRAR', status: 'ACTIVE', lastActive: '1 hour ago' },
    { id: '3', name: 'Robert Brown', role: 'STUDENT', status: 'SUSPENDED', lastActive: '2 days ago' },
];

export default function AdminDashboard() {
  const [users, setUsers] = useState(MOCK_USERS);

  return (
    <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card title="Total Users" className="border-l-4 border-l-blue-500">
               <div className="flex items-center justify-between">
                   <div className="text-3xl font-bold">1,245</div>
                   <Users className="text-blue-100" size={32} />
               </div>
            </Card>
            <Card title="System Health" className="border-l-4 border-l-green-500">
               <div className="flex items-center justify-between">
                   <div className="text-3xl font-bold text-green-600">99.9%</div>
                   <Server className="text-green-100" size={32} />
               </div>
            </Card>
            <Card title="Security Alerts" className="border-l-4 border-l-red-500">
               <div className="flex items-center justify-between">
                   <div className="text-3xl font-bold text-red-600">3</div>
                   <Shield className="text-red-100" size={32} />
               </div>
            </Card>
             <Card title="Active Sessions" className="border-l-4 border-l-purple-500">
               <div className="flex items-center justify-between">
                   <div className="text-3xl font-bold text-purple-600">45</div>
                   <Activity className="text-purple-100" size={32} />
               </div>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
                <Card title="User Management">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Role</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Last Active</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {users.map(u => (
                                    <tr key={u.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3 font-medium">{u.name}</td>
                                        <td className="px-4 py-3 text-xs">
                                            <span className={`px-2 py-1 rounded bg-gray-100 border border-gray-200 font-mono`}>{u.role}</span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {u.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-500">{u.lastActive}</td>
                                        <td className="px-4 py-3 text-right">
                                            <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">Manage</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
            
            <div className="space-y-6">
                <Card title="System Logs">
                    <div className="space-y-4 text-sm">
                        <div className="border-l-2 border-green-500 pl-3">
                            <p className="text-gray-800 font-medium">Database Backup</p>
                            <p className="text-gray-500 text-xs">Completed successfully at 02:00 AM</p>
                        </div>
                        <div className="border-l-2 border-yellow-500 pl-3">
                            <p className="text-gray-800 font-medium">High Latency</p>
                            <p className="text-gray-500 text-xs">Gateway response time > 200ms</p>
                        </div>
                         <div className="border-l-2 border-blue-500 pl-3">
                            <p className="text-gray-800 font-medium">New Registrar Added</p>
                            <p className="text-gray-500 text-xs">Admin action by System</p>
                        </div>
                    </div>
                    <button className="w-full mt-4 text-center text-indigo-600 text-sm hover:underline">View All Logs</button>
                </Card>
            </div>
        </div>
    </div>
  );
}