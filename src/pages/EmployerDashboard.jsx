import React, { useState } from 'react';
// import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/layouts/DashboardLayout';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Search,
  Shield,
  Clock,
  CheckCircle2,
  XCircle,
  Eye,
  Plus,
  FileCheck,
  AlertTriangle,
  History,
} from 'lucide-react';
import { format } from 'date-fns';
import VerificationRequestForm from '@/components/forms/VerificationRequestForm';
import StatusIndicator from '@/components/ui/StatusIndicator';
import BlockchainIndicator from '@/components/dashboard/BlockchainIndicator';
import AIValidationPanel from '@/components/dashboard/AIValidationPanel';
import SecurityBadge from '@/components/ui/SecurityBadge';

export default function EmployerDashboard() {
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  // Demo data for verificationRequests
  const verificationRequests = [
    { id: 1, status: 'completed', verification_result: 'authentic', purpose: 'Job Application', request_date: '2026-01-01', credential_id: 'CRED-001', blockchain: 'Yes' },
    { id: 2, status: 'pending', verification_result: 'pending', purpose: 'Background Check', request_date: '2026-01-10', credential_id: 'CRED-002', blockchain: 'No' },
    { id: 3, status: 'completed', verification_result: 'suspicious', purpose: 'Internship', request_date: '2026-01-15', credential_id: 'CRED-003', blockchain: 'Yes' },
  ];

  const stats = {
    total: verificationRequests.length,
    completed: verificationRequests.filter((r) => r.status === 'completed').length,
    authentic: verificationRequests.filter((r) => r.verification_result === 'authentic').length,
    pending: verificationRequests.filter((r) => r.status === 'pending').length,
  };

  const resultConfig = {
    authentic: { icon: CheckCircle2, color: 'text-primary', bg: 'bg-primary/10', label: 'Authentic' },
    suspicious: { icon: AlertTriangle, color: 'text-primary', bg: 'bg-primary/10', label: 'Suspicious' },
    fraudulent: { icon: XCircle, color: 'text-primary', bg: 'bg-primary/10', label: 'Fraudulent' },
    pending: { icon: Clock, color: 'text-primary', bg: 'bg-primary/10', label: 'Pending' },
  };

  return (
    <DashboardLayout
      title="Employer Dashboard"
      subtitle="Verify candidate credentials securely"
      actions={[
        <SecurityBadge key="secure" variant="locked" label="Secure Verification" size="md" />,
        <Button key="verify" onClick={() => setShowVerifyDialog(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          New Verification Request
        </Button>
      ]}
      stats={[
        { title: 'Total Requests', value: stats.total, icon: Search },
        { title: 'Completed', value: stats.completed, icon: CheckCircle2 },
        { title: 'Verified Authentic', value: stats.authentic, icon: Shield },
        { title: 'Pending', value: stats.pending, icon: Clock },
      ]}
    >
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center gap-2">
          <History className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">Verification History</span>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/60 border-border">
                <TableHead className="text-muted-foreground">Credential ID</TableHead>
                <TableHead className="text-muted-foreground">Purpose</TableHead>
                <TableHead className="text-muted-foreground">Request Date</TableHead>
                <TableHead className="text-muted-foreground">Status</TableHead>
                <TableHead className="text-muted-foreground">Verification Result</TableHead>
                <TableHead className="text-muted-foreground">Blockchain</TableHead>
                <TableHead className="text-right text-muted-foreground">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {verificationRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <Search className="w-12 h-12 text-muted" />
                      <p>No verification requests yet</p>
                      <Button onClick={() => setShowVerifyDialog(true)} className="bg-primary hover:bg-primary/90">
                        Submit First Request
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                verificationRequests.map((request) => {
                  const resultConf = resultConfig[request.verification_result] || resultConfig.pending;
                  const ResultIcon = resultConf.icon;
                  return (
                    <TableRow key={request.id} className="hover:bg-muted/20 transition-colors border-border">
                      <TableCell>
                        <code className="text-sm bg-muted/30 px-2 py-0.5 rounded font-mono text-foreground">
                          {request.credential_id?.slice(0, 12)}...
                        </code>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">{request.purpose}</TableCell>
                      <TableCell>{
                        request.request_date && !isNaN(new Date(request.request_date))
                          ? format(new Date(request.request_date), 'PP')
                          : '—'
                      }</TableCell>
                      <TableCell>
                        <StatusIndicator status={request.status === 'completed' ? 'verified' : request.status} />
                      </TableCell>
                      <TableCell>
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${resultConf.bg} ${resultConf.color}`}>
                          <ResultIcon className="w-3.5 h-3.5" />
                          {resultConf.label}
                        </div>
                      </TableCell>
                      <TableCell>
                        {request.blockchain_verified ? (
                          <span className="flex items-center gap-1 text-xs text-primary">
                            <CheckCircle2 className="w-4 h-4" />
                            Verified
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(request)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Submit Verification Request
            </DialogTitle>
          </DialogHeader>
          <VerificationRequestForm
            onSubmit={() => {}}
            isLoading={false}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Verification Details
            </DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 border border-border rounded-xl">
                <div>
                  <p className="text-xs text-muted-foreground">Credential ID</p>
                  <code className="text-sm font-mono text-foreground">{selectedRequest.credential_id}</code>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Organization</p>
                  <p className="text-sm font-medium text-foreground">{selectedRequest.requester_organization}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Request Date</p>
                  <p className="text-sm font-medium text-foreground">{
                    selectedRequest.request_date && !isNaN(new Date(selectedRequest.request_date))
                      ? format(new Date(selectedRequest.request_date), 'PPpp')
                      : '—'
                  }</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Purpose</p>
                  <p className="text-sm font-medium text-foreground">{selectedRequest.purpose}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AIValidationPanel
                  confidenceScore={selectedRequest.verification_result === 'authentic' ? 95 : 45}
                  fraudFlags={
                    selectedRequest.verification_result === 'suspicious'
                      ? ['Signature mismatch detected', 'Date format inconsistency']
                      : []
                  }
                  status={selectedRequest.status === 'pending' ? 'processing' : 'completed'}
                />
                <BlockchainIndicator
                  hash={
                    selectedRequest.blockchain_verified
                      ?
                        '0x' +
                        Array(64)
                          .fill(0)
                          .map(() => Math.floor(Math.random() * 16).toString(16))
                          .join('')
                      : null
                  }
                  timestamp={selectedRequest.verified_at}
                  verified={selectedRequest.blockchain_verified}
                />
              </div>

              {selectedRequest.notes && (
                <div className="p-4 bg-muted/30 border border-border rounded-xl">
                  <p className="text-xs text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground">{selectedRequest.notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
