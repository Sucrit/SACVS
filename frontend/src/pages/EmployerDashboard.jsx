import React, { useState } from 'react';
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
  Eye,
  Plus,
  FileCheck,
  AlertTriangle,
  History,
  MoreHorizontal,
  Download,
  Filter
} from 'lucide-react';
import { format } from 'date-fns';
import BlockchainIndicator from '@/components/dashboard/BlockchainIndicator';
import AIValidationPanel from '@/components/dashboard/AIValidationPanel';
import SecurityBadge from '@/components/ui/SecurityBadge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const pseudoHashFrom = (value = '') =>
  '0x' +
  String(value)
    .split('')
    .map((char) => char.charCodeAt(0).toString(16))
    .join('')
    .padEnd(64, '0')
    .slice(0, 64);

export default function EmployerDashboard() {
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterText, setFilterText] = useState('');

  // Demo data for verificationRequests
  const verificationRequests = [
    { id: 1, applicant: 'Alex Rivers', status: 'completed', verification_result: 'authentic', purpose: 'Software Engineer Application', request_date: '2026-01-25', credential_id: 'CRED-8832', type: 'Degree', blockchain: 'Verified' },
    { id: 2, applicant: 'Jordan Lee', status: 'pending', verification_result: 'pending', purpose: 'Background Check', request_date: '2026-01-26', credential_id: 'CRED-9941', type: 'Certificate', blockchain: 'Pending' },
    { id: 3, applicant: 'Casey Smith', status: 'completed', verification_result: 'suspicious', purpose: 'Internship Validator', request_date: '2026-01-20', credential_id: 'CRED-7721', type: 'Diploma', blockchain: 'Failed' },
    { id: 4, applicant: 'Morgan Chen', status: 'completed', verification_result: 'authentic', purpose: 'Senior Dev Role', request_date: '2026-01-18', credential_id: 'CRED-5512', type: 'Degree', blockchain: 'Verified'},
    { id: 5, applicant: 'Taylor White', status: 'processing', verification_result: 'pending', purpose: 'Contract Renewal', request_date: '2026-01-27', credential_id: 'CRED-3392', type: 'License', blockchain: 'Checking'},
  ];

  const filteredRequests = verificationRequests.filter(req => 
    req.applicant.toLowerCase().includes(filterText.toLowerCase()) || 
    req.credential_id.toLowerCase().includes(filterText.toLowerCase())
  );

  const stats = {
    total: verificationRequests.length,
    completed: verificationRequests.filter((r) => r.status === 'completed').length,
    authentic: verificationRequests.filter((r) => r.verification_result === 'authentic').length,
    pending: verificationRequests.filter((r) => r.status === 'pending' || r.status === 'processing').length,
  };

  const statusStyles = {
    authentic: 'bg-green-100 text-green-700 border-green-200',
    suspicious: 'bg-amber-100 text-amber-700 border-amber-200',
    fraudulent: 'bg-red-100 text-red-700 border-red-200',
    pending: 'bg-slate-100 text-slate-700 border-slate-200',
    processing: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <DashboardLayout
      title="Employer Dashboard"
      subtitle="Verify candidate credentials and track applications"
      actions={[
        <SecurityBadge key="secure" variant="locked" label="Secure Verification" size="md" />,
        <Button key="verify" className="bg-primary hover:bg-primary/90 shadow-sm">
          <Plus className="w-4 h-4 mr-2" />
          New Verification Request
        </Button>
      ]}
      stats={[
        { title: 'Total Requests', value: stats.total, icon: Search },
        { title: 'Completed', value: stats.completed, icon: CheckCircle2 },
        { title: 'Verified Authentic', value: stats.authentic, icon: Shield },
        { title: 'Pending Review', value: stats.pending, icon: Clock },
      ]}
    >
      <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden flex flex-col">
        {/* Table Header / Toolbar */}
        <div className="p-4 border-b border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 bg-muted/10">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-muted-foreground" />
              Recent Verifications
            </h2>
            <Badge variant="outline" className="ml-2 font-normal bg-background">{filteredRequests.length}</Badge>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search applicant or ID..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="pl-9 h-9 bg-background"
              />
            </div>
            <Button variant="outline" size="sm" className="h-9">
              <Filter className="w-3.5 h-3.5 mr-2" />
              Filter
            </Button>
            <Button variant="outline" size="sm" className="h-9">
              <Download className="w-3.5 h-3.5 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow className="hover:bg-transparent border-border/60">
                <TableHead className="w-[180px]">Applicant / ID</TableHead>
                <TableHead>Type & Purpose</TableHead>
                <TableHead>Date Sent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Blockchain</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-48 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 opacity-20" />
                      <p>No verification requests found matching your search.</p>
                      <Button variant="link" onClick={() => setFilterText('')}>Clear Filters</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredRequests.map((request) => (
                  <TableRow key={request.id} className="hover:bg-muted/10 border-border/60 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{request.applicant}</span>
                        <span className="text-xs text-muted-foreground font-mono">{request.credential_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                         <span className="text-sm font-medium">{request.type}</span>
                         <span className="text-xs text-muted-foreground">{request.purpose}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(request.request_date), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusStyles[request.verification_result] || statusStyles.pending}`}>
                         {request.verification_result === 'authentic' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                         {request.verification_result === 'suspicious' && <AlertTriangle className="w-3 h-3 mr-1" />}
                         {request.verification_result === 'pending' && <Clock className="w-3 h-3 mr-1" />}
                         <span className="capitalize">{request.verification_result}</span>
                      </span>
                    </TableCell>
                    <TableCell>
                       <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <div className={`w-1.5 h-1.5 rounded-full ${request.blockchain === 'Verified' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          {request.blockchain}
                       </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                            <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setSelectedRequest(request)}>
                            <Eye className="w-4 h-4 mr-2" /> View Details
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem>
                             <Download className="w-4 h-4 mr-2" /> Download Report
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination placeholder */}
        <div className="border-t border-border/60 p-4 flex items-center justify-between text-xs text-muted-foreground">
           <span>Showing 1-{filteredRequests.length} of {filteredRequests.length} results</span>
           <div className="flex gap-2">
             <Button variant="outline" size="sm" disabled className="h-8 w-8 p-0">&lt;</Button>
             <Button variant="outline" size="sm" disabled className="h-8 w-8 p-0">&gt;</Button>
           </div>
        </div>
      </div>

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
                  hash={selectedRequest.blockchain_verified ? pseudoHashFrom(selectedRequest.credential_id) : null}
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
