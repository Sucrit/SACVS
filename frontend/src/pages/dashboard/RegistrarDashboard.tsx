import React, { useState } from 'react';
import Card from '../../components/common/Card';
import Badge from '../../components/common/Badge';
import { Check, X, Eye, FileText } from 'lucide-react';

const MOCK_REQUESTS = [
  { id: '101', student: 'Alice Johnson', type: 'Transcript', date: '2026-02-18', status: 'PENDING', aiScore: 98 },
  { id: '102', student: 'Bob Smith', type: 'Diploma', date: '2026-02-17', status: 'PENDING', aiScore: 45 }, // Low score example
  { id: '103', student: 'Charlie Davis', type: 'Certificate', date: '2026-02-16', status: 'APPROVED', aiScore: 99 },
];

export default function RegistrarDashboard() {
  const [requests, setRequests] = useState(MOCK_REQUESTS);
  
  const handleAction = (id: string, action: 'APPROVE' | 'REJECT') => {
      // Mock API call
      setRequests((prev) => 
        prev.map(r => r.id === id ? { ...r, status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' } : r)
      );
  };

  return (
    <div className="space-y-8">
      <div className="flex gap-4">
        <Card title="Pending Review" className="flex-1">
             <div className="text-3xl font-bold text-indigo-600">{requests.filter(r => r.status === 'PENDING').length}</div>
        </Card>
        <Card title="Verified Today" className="flex-1">
             <div className="text-3xl font-bold text-green-600">12</div>
        </Card>
        <Card title="Flagged by AI" className="flex-1">
             <div className="text-3xl font-bold text-red-500">2</div>
        </Card>
      </div>

      <Card title="Credential Verification Requests">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs font-semibold text-gray-500 uppercase border-b border-gray-100">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Document Type</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-center">AI Confidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-4 py-4 text-sm font-medium text-gray-900">#{req.id}</td>
                  <td className="px-4 py-4 text-sm text-gray-600">{req.student}</td>
                  <td className="px-4 py-4 text-sm text-gray-600 flex items-center gap-2">
                    <FileText size={16} className="text-indigo-400" />
                    {req.type}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-500">{req.date}</td>
                  <td className="px-4 py-4 text-center">
                    <div className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-100 border border-gray-200">
                        <div className={`w-2 h-2 rounded-full ${req.aiScore > 90 ? 'bg-green-500' : req.aiScore > 70 ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                        <span className="text-xs font-semibold">{req.aiScore}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge status={req.status as any} />
                  </td>
                  <td className="px-4 py-4 text-right flex justify-end gap-2 opacity-100">
                     {req.status === 'PENDING' && (
                        <>
                            <button 
                                onClick={() => handleAction(req.id, 'APPROVE')}
                                className="p-2 text-green-600 bg-green-50 rounded hover:bg-green-100 transition" 
                                title="Approve"
                            >
                                <Check size={18} />
                            </button>
                            <button 
                                onClick={() => handleAction(req.id, 'REJECT')}
                                className="p-2 text-red-600 bg-red-50 rounded hover:bg-red-100 transition" 
                                title="Reject"
                            >
                                <X size={18} />
                            </button>
                        </>
                     )}
                     <button className="p-2 text-gray-600 bg-gray-50 rounded hover:bg-gray-100 transition" title="View Details">
                        <Eye size={18} />
                     </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      
      {/* Mock AI Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card title="Live AI Analysis Stream">
              <div className="space-y-4">
                  <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="mt-1 animate-pulse">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      </div>
                      <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Document #102 Flagged</p>
                          <p className="text-xs text-gray-500">Anomaly detected in grade distribution pattern. Standard deviation exceeds threshold.</p>
                      </div>
                      <span className="text-xs text-gray-400">Now</span>
                  </div>
                  <div className="flex items-start gap-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                       <div className="mt-1">
                          <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                      </div>
                      <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">Blockchain Anchor Created</p>
                          <p className="text-xs text-gray-500">Hash 0x7f...3a9 verified on Ethereum Mainnet for Document #100.</p>
                      </div>
                      <span className="text-xs text-gray-400">2m ago</span>
                  </div>
              </div>
          </Card>
      </div>
    </div>
  );
}