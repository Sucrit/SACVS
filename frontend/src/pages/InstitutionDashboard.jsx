import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchInstitutionCredentials } from '@/api/credentials';
import { Button } from '@/components/ui/button';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
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
  AlertTriangle,
  RefreshCw,
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
  const [locallyIssuedIds, setLocallyIssuedIds] = useState(() => new Set());

  // Fetch credentials from backend
  const { data: credentials = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['institutionCredentials'],
    queryFn: fetchInstitutionCredentials,
  });

  const handleIssue = (credential) => {
    setLocallyIssuedIds((prev) => {
      const next = new Set(prev);
      next.add(credential.id);
      return next;
    });
    setSelectedCredential((prev) => (prev && prev.id === credential.id ? { ...prev, status: 'issued' } : prev));
  };

  const statusOf = (credential) => (locallyIssuedIds.has(credential.id) ? 'issued' : credential.status);

  const filteredCredentials = credentials.filter(
    (c) =>
      c.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.student_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: credentials.length,
    issued: credentials.filter((c) => statusOf(c) === 'issued').length,
    pending: credentials.filter((c) => statusOf(c) === 'pending' || statusOf(c) === 'ai_review' || statusOf(c) === 'verified').length,
    students: new Set(credentials.map((c) => c.student_email)).size,
  };

  const renderLoadingRow = () => (
    <TableRow>
      <TableCell colSpan={7} className="py-8">
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`inst-skeleton-${i}`} className="grid grid-cols-7 gap-3">
              <Skeleton className="h-8 col-span-2" />
              <Skeleton className="h-8 col-span-1" />
              <Skeleton className="h-8 col-span-1" />
              <Skeleton className="h-8 col-span-1" />
              <Skeleton className="h-8 col-span-1" />
              <Skeleton className="h-8 col-span-1" />
            </div>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );

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
                renderLoadingRow()
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-6">
                    <Alert variant="destructive" className="border-destructive/40">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Unable to load issuance queue</AlertTitle>
                      <AlertDescription className="mt-2 flex items-center justify-between gap-3">
                        <span>The credential list could not be retrieved from the server.</span>
                        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                          Retry
                        </Button>
                      </AlertDescription>
                    </Alert>
                  </TableCell>
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
                        {statusOf(credential) === 'issued' && 'Issued'}
                        {statusOf(credential) === 'pending' && 'Pending'}
                        {statusOf(credential) === 'verified' && 'Verified'}
                        {statusOf(credential) === 'ai_review' && 'AI Review'}
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
                        {statusOf(credential) !== 'issued' && (
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
              {locallyIssuedIds.has(selectedCredential.id) && (
                <Alert className="border-primary/30 bg-primary/5">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertTitle>Credential marked as issued</AlertTitle>
                  <AlertDescription>
                    This is a local UI update for workflow preview until issue API wiring is completed.
                  </AlertDescription>
                </Alert>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AIValidationPanel
                  confidenceScore={selectedCredential.ai_confidence_score || 85}
                  fraudFlags={selectedCredential.ai_fraud_flags || []}
                  status={statusOf(selectedCredential) === 'ai_review' ? 'processing' : 'completed'}
                />
                <BlockchainIndicator
                  hash={selectedCredential.blockchain_hash}
                  timestamp={selectedCredential.blockchain_timestamp}
                  verified={statusOf(selectedCredential) === 'issued'}
                />
              </div>

              {statusOf(selectedCredential) !== 'issued' && (
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
