import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionCredentials } from '@/api/credentials';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Input } from '@/components/ui/input';
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
  Building2,
  FileCheck,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Eye,
  Send,
  Users,
} from 'lucide-react';
import { format } from 'date-fns';
import CredentialUploadForm from '@/components/forms/CredentialUploadForm';
import AIValidationPanel from '@/components/dashboard/AIValidationPanel';
import BlockchainIndicator from '@/components/dashboard/BlockchainIndicator';
import SecurityBadge from '@/components/ui/SecurityBadge';

export default function InstitutionDashboard() {
  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch credentials from backend
  const { data: credentials = [], isLoading, isError } = useQuery({
    queryKey: ['institutionCredentials'],
    queryFn: fetchInstitutionCredentials,
  });

  const handleIssue = (credential) => {
    updateCredentialMutation.mutate({
      id: credential.id,
      data: {
        status: 'issued',
        blockchain_hash:
          '0x' + Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        blockchain_timestamp: new Date().toISOString(),
      },
    });
  };

  const filteredCredentials = credentials.filter(
    (c) =>
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.student_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: credentials.length,
    issued: credentials.filter((c) => c.status === 'issued').length,
    pending: credentials.filter((c) => c.status === 'pending' || c.status === 'ai_review' || c.status === 'verified').length,
    students: new Set(credentials.map((c) => c.student_email)).size,
  };

  return (
    <DashboardLayout
      title="Institution Dashboard"
      subtitle="Issue and manage academic credentials"
      actions={[
        <SecurityBadge key="issuer" variant="secure" label="Authorized Issuer" size="md" />,
        <Button key="issue" onClick={() => setShowIssueDialog(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Issue Credential
        </Button>
      ]}
      stats={[
        { title: 'Total Credentials', value: stats.total, icon: FileCheck },
        { title: 'Issued', value: stats.issued, icon: CheckCircle2 },
        { title: 'Pending Issuance', value: stats.pending, icon: Clock },
        { title: 'Total Students', value: stats.students, icon: Users },
      ]}
    >
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search credentials by title or student name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-muted/30 border border-border"
        />
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-primary" />
          <span className="font-semibold text-foreground">Credential Issuance Queue</span>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/60">
                <TableHead>Credential</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>AI Score</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">Loading...</TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-red-500">Failed to load credentials.</TableCell>
                </TableRow>
              ) : filteredCredentials.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No credentials found
                  </TableCell>
                </TableRow>
              ) : (
                filteredCredentials.map((credential) => (
                  <TableRow key={credential.id} className="hover:bg-muted/20 transition-colors">
                    <TableCell>
                      <div className="font-medium text-foreground">{credential.title}</div>
                      <div className="text-xs text-muted-foreground">{credential.institution_name}</div>
                    </TableCell>
                    <TableCell>{credential.student_name}</TableCell>
                    <TableCell className="capitalize">{credential.type}</TableCell>
                    <TableCell>{credential.issue_date ? format(new Date(credential.issue_date), 'PP') : 'N/A'}</TableCell>
                    <TableCell>
                      <div className="px-4 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">
                        {credential.status === 'issued' && 'Issued'}
                        {credential.status === 'pending' && 'Pending'}
                        {credential.status === 'verified' && 'Verified'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        <span className="text-sm">{credential.ai_confidence_score || 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedCredential(credential)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {credential.status !== 'issued' && (
                          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => handleIssue(credential)}>
                            <Send className="w-4 h-4 mr-1" />
                            Issue
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={showIssueDialog} onOpenChange={setShowIssueDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              Issue New Credential
            </DialogTitle>
          </DialogHeader>
          <CredentialUploadForm
            onSubmit={() => {}}
            isLoading={false}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedCredential} onOpenChange={() => setSelectedCredential(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Credential Review
            </DialogTitle>
          </DialogHeader>
          {selectedCredential && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AIValidationPanel
                  confidenceScore={selectedCredential.ai_confidence_score || 85}
                  fraudFlags={selectedCredential.ai_fraud_flags || []}
                  status={selectedCredential.status === 'ai_review' ? 'processing' : 'completed'}
                />
                <BlockchainIndicator
                  hash={selectedCredential.blockchain_hash}
                  timestamp={selectedCredential.blockchain_timestamp}
                  verified={selectedCredential.status === 'issued'}
                />
              </div>

              {selectedCredential.status !== 'issued' && (
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setSelectedCredential(null)}>
                    Cancel
                  </Button>
                  <Button className="bg-primary hover:bg-primary/90" onClick={() => handleIssue(selectedCredential)}>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Approve & Issue to Blockchain
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
