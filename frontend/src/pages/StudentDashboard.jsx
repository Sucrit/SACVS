import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  GraduationCap,
  FileCheck,
  Clock,
  CheckCircle2,
  Shield,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import CredentialCard from '@/components/credentials/CredentialCard';
import AIValidationPanel from '@/components/dashboard/AIValidationPanel';
import BlockchainIndicator from '@/components/dashboard/BlockchainIndicator';
import StatusIndicator from '@/components/ui/StatusIndicator';
import { fetchStudentCredentials } from '@/api/credentials';
import { useUser } from '@clerk/clerk-react';

export default function StudentDashboard() {
  const [selectedCredential, setSelectedCredential] = useState(null);
  const { user } = useUser();

  // Fetch credentials from backend
  const { data: credentials = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['studentCredentials', user?.id],
    queryFn: () => fetchStudentCredentials(user?.id),
  });

  const issuedCredentials = credentials.filter((c) => c.status === 'issued');
  const pendingCredentials = credentials.filter((c) => c.status === 'pending' || c.status === 'ai_review');

  const stats = {
    total: credentials.length,
    issued: issuedCredentials.length,
    pending: pendingCredentials.length,
    verified: credentials.filter((c) => c.status === 'verified' || c.status === 'issued').length,
  };

  const renderLoadingState = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={`student-skeleton-${i}`} className="surface-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
          <Skeleton className="h-16 w-full rounded-xl" />
          <div className="flex gap-2">
            <Skeleton className="h-9 flex-1 rounded-lg" />
            <Skeleton className="h-9 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderErrorState = () => (
    <Alert variant="destructive" className="surface-card border-destructive/40">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Unable to load credentials</AlertTitle>
      <AlertDescription className="mt-2 flex items-center justify-between gap-3">
        <span>We could not fetch your records from the server. Try again.</span>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );

  const renderEmptyState = (title, description) => (
    <Card className="text-center py-16 surface-card">
      <CardContent>
        <div className="w-16 h-16 bg-muted/40 rounded-2xl mx-auto flex items-center justify-center mb-4">
          <GraduationCap className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-muted-foreground mt-2">{description}</p>
      </CardContent>
    </Card>
  );

  const renderCredentialGrid = (list, showBlockchain = false) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {list.map((credential) => (
        <div key={credential.id}>
          <CredentialCard
            credential={credential}
            showBlockchain={showBlockchain ? credential.status === 'issued' : false}
            onView={(c) => setSelectedCredential(c)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <DashboardLayout
      title="Student Dashboard"
      subtitle="View and track your academic credentials"
      stats={[
        { title: 'Total Credentials', value: stats.total, icon: GraduationCap },
        { title: 'Issued', value: stats.issued, icon: CheckCircle2 },
        { title: 'Pending Review', value: stats.pending, icon: Clock },
        { title: 'Blockchain Verified', value: stats.verified, icon: Shield },
      ]}
    >
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList className="bg-muted border border-border">
          <TabsTrigger value="all">All Credentials</TabsTrigger>
          <TabsTrigger value="issued">Issued</TabsTrigger>
        <TabsTrigger value="pending">Pending</TabsTrigger>
      </TabsList>

      <TabsContent value="all" className="space-y-4">
        {isLoading
          ? renderLoadingState()
          : isError
            ? renderErrorState()
            : credentials.length === 0
              ? renderEmptyState('No Credentials Yet', 'No credentials have been issued to your account yet.')
              : renderCredentialGrid(credentials, true)}
        </TabsContent>

        <TabsContent value="issued" className="space-y-4">
          {isLoading
            ? renderLoadingState()
            : isError
              ? renderErrorState()
              : issuedCredentials.length === 0
                ? renderEmptyState('No Issued Credentials', 'Issued credentials will appear here once approved.')
                : renderCredentialGrid(issuedCredentials, true)}
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {isLoading
            ? renderLoadingState()
            : isError
              ? renderErrorState()
              : pendingCredentials.length === 0
                ? renderEmptyState('No Pending Credentials', 'You have no credentials waiting for review right now.')
                : renderCredentialGrid(pendingCredentials)}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedCredential} onOpenChange={() => setSelectedCredential(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground">
              <FileCheck className="w-5 h-5 text-primary" />
              Credential Details
            </DialogTitle>
          </DialogHeader>
          {selectedCredential && (
            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center">
                  <GraduationCap className="w-8 h-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">{selectedCredential.title}</h3>
                  <p className="text-muted-foreground">{selectedCredential.institution_name}</p>
                  <StatusIndicator status={selectedCredential.status} className="mt-2" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AIValidationPanel
                  confidenceScore={selectedCredential.ai_confidence_score || 85}
                  fraudFlags={selectedCredential.ai_fraud_flags || []}
                  status={selectedCredential.status === 'ai_review' ? 'processing' : 'completed'}
                />
                <BlockchainIndicator
                  hash={selectedCredential.blockchain_hash}
                  timestamp={selectedCredential.blockchain_timestamp || selectedCredential.created_date}
                  verified={selectedCredential.status === 'issued'}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
