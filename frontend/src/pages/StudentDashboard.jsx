import React, { useState } from 'react';
// import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import DashboardLayout from '@/layouts/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  GraduationCap,
  Upload,
  FileCheck,
  Clock,
  CheckCircle2,
  Plus,
  Shield,
} from 'lucide-react';
import { motion } from 'framer-motion';
import CredentialCard from '@/components/credentials/CredentialCard';
import CredentialUploadForm from '@/components/forms/CredentialUploadForm';
import AIValidationPanel from '@/components/dashboard/AIValidationPanel';
import BlockchainIndicator from '@/components/dashboard/BlockchainIndicator';
import StatusIndicator from '@/components/ui/StatusIndicator';

export default function StudentDashboard() {
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [selectedCredential, setSelectedCredential] = useState(null);
  // Demo data for credentials
  const credentials = [
    { id: 1, status: 'issued' },
    { id: 2, status: 'pending' },
    { id: 3, status: 'verified' },
  ];
  const stats = {
    total: credentials.length,
    issued: credentials.filter((c) => c.status === 'issued').length,
    pending: credentials.filter((c) => c.status === 'pending' || c.status === 'ai_review').length,
    verified: credentials.filter((c) => c.status === 'verified' || c.status === 'issued').length,
  };

  return (
    <DashboardLayout
      title="Student Dashboard"
      subtitle="Manage and track your academic credentials"
      actions={
        <Button onClick={() => setShowUploadDialog(true)} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Upload Credential
        </Button>
      }
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
          {credentials.length === 0 ? (
            <Card className="text-center py-16 bg-card border border-border">
              <CardContent>
                <div className="w-16 h-16 bg-muted/30 rounded-2xl mx-auto flex items-center justify-center mb-4">
                  <GraduationCap className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">No Credentials Yet</h3>
                <p className="text-muted-foreground mt-2 mb-6">Upload your first credential to get started</p>
                <Button onClick={() => setShowUploadDialog(true)} className="bg-primary hover:bg-primary/90">
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Credential
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {credentials.map((credential, index) => (
                <motion.div key={credential.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  <CredentialCard
                    credential={credential}
                    showBlockchain={credential.status === 'issued'}
                    onView={(c) => setSelectedCredential(c)}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="issued" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {credentials
              .filter((c) => c.status === 'issued')
              .map((credential, index) => (
                <motion.div key={credential.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  <CredentialCard credential={credential} showBlockchain onView={(c) => setSelectedCredential(c)} />
                </motion.div>
              ))}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {credentials
              .filter((c) => c.status === 'pending' || c.status === 'ai_review')
              .map((credential, index) => (
                <motion.div key={credential.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                  <CredentialCard credential={credential} onView={(c) => setSelectedCredential(c)} />
                </motion.div>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              Upload New Credential
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
