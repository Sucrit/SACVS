import React, { useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { FileText, Download, CheckCircle, Clock } from 'lucide-react';

const MOCK_CREDENTIALS = [
  { id: '1', title: 'B.Sc. Computer Science', institution: 'University of Technology', status: 'ISSUED', date: '2025-05-20' },
  { id: '2', title: 'Data Science Certificate', institution: 'Online Academy', status: 'PENDING', date: '2026-01-10' },
];

export default function StudentDashboard() {
  const [loading, setLoading] = useState(false);

  const handleRequest = () => {
    setLoading(true);
    // TODO: Call API
    setTimeout(() => {
        setLoading(false);
        alert("Request Submitted!");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Total Credentials">
           <div className="text-4xl font-bold text-indigo-600">5</div>
           <p className="text-sm text-gray-500 mt-1">Acquired over 4 years</p>
        </Card>
        <Card title="Applications Status">
           <div className="text-4xl font-bold text-yellow-500">2</div>
           <p className="text-sm text-gray-500 mt-1">Pending Review</p>
        </Card>
        <Card title="Action Required">
           <div className="text-4xl font-bold text-red-500">0</div>
           <p className="text-sm text-gray-500 mt-1">All good!</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
            <Card title="My Credentials">
                <div className="overflow-x-auto">
                    <table className="min-w-full text-left">
                        <thead>
                            <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wider">
                                <th className="pb-3 font-medium">Credential</th>
                                <th className="pb-3 font-medium">Institution</th>
                                <th className="pb-3 font-medium">Date</th>
                                <th className="pb-3 font-medium">Status</th>
                                <th className="pb-3 font-medium text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {MOCK_CREDENTIALS.map((cred) => (
                                <tr key={cred.id} className="group hover:bg-gray-50 transition-colors">
                                    <td className="py-4 pr-4">
                                        <div className="font-medium text-gray-800">{cred.title}</div>
                                    </td>
                                    <td className="py-4 pr-4 text-sm text-gray-500">{cred.institution}</td>
                                    <td className="py-4 pr-4 text-sm text-gray-500">{cred.date}</td>
                                    <td className="py-4 pr-4">
                                        <Badge status={cred.status as any} />
                                    </td>
                                    <td className="py-4 text-right">
                                        {cred.status === 'ISSUED' && (
                                            <button className="text-indigo-600 hover:text-indigo-800 p-2 rounded-lg hover:bg-indigo-50 transition">
                                                <Download size={18} />
                                            </button>
                                        )}
                                        {cred.status === 'PENDING' && (
                                            <span className="text-xs text-gray-400 italic">Processing</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>

        <div className="space-y-6">
            <Card title="Request New Credential">
                <p className="text-gray-600 text-sm mb-4">Request official transcripts or diplomas directly from your dashboard.</p>
                <button 
                  onClick={handleRequest}
                  disabled={loading}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition flex items-center justify-center gap-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <span className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></span>
                    ) : (
                        <>
                           <FileText size={18} />
                           Submit Request
                        </>
                    )}
                </button>
            </Card>

            <Card title="Recent Activity">
                <div className="space-y-4">
                    <div className="flex gap-3">
                        <div className="mt-1">
                             <CheckCircle size={16} className="text-green-500" />
                        </div>
                        <div>
                             <p className="text-sm font-medium text-gray-800">Transcript Verified</p>
                             <p className="text-xs text-gray-500">2 days ago</p>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <div className="mt-1">
                             <Clock size={16} className="text-yellow-500" />
                        </div>
                        <div>
                             <p className="text-sm font-medium text-gray-800">Application Submitted</p>
                             <p className="text-xs text-gray-500">5 days ago</p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
      </div>
    </div>
  );
}