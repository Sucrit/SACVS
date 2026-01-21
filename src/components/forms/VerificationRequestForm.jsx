import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Search, Building2, Mail, FileText, Loader2, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function VerificationRequestForm({ onSubmit, isLoading, className }) {
  const [formData, setFormData] = useState({
    credential_id: '',
    requester_organization: '',
    requester_email: '',
    purpose: '',
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      <div className="bg-indigo-950/20 rounded-xl p-4 border border-indigo-500/20">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-indigo-500/10 rounded-lg">
            <Shield className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h4 className="font-medium text-indigo-100">Secure Verification Request</h4>
            <p className="text-sm text-indigo-300 mt-1">
              Your request will be processed through our AI validation and blockchain verification system.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="credential_id" className="flex items-center gap-2 text-foreground">
            <Search className="w-4 h-4 text-muted-foreground" />
            Credential ID or Reference Number
          </Label>
          <Input
            id="credential_id"
            placeholder="Enter credential ID to verify"
            value={formData.credential_id}
            onChange={(e) => handleChange('credential_id', e.target.value)}
            required
            className="bg-card border-input"
          />
          <p className="text-xs text-muted-foreground">This can be found on the credential document or provided by the credential holder.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="requester_organization" className="flex items-center gap-2 text-foreground">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            Your Organization
          </Label>
          <Input
            id="requester_organization"
            placeholder="e.g., ABC Corporation"
            value={formData.requester_organization}
            onChange={(e) => handleChange('requester_organization', e.target.value)}
            required
            className="bg-card border-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="requester_email" className="flex items-center gap-2 text-foreground">
            <Mail className="w-4 h-4 text-muted-foreground" />
            Contact Email
          </Label>
          <Input
            id="requester_email"
            type="email"
            placeholder="verification@organization.com"
            value={formData.requester_email}
            onChange={(e) => handleChange('requester_email', e.target.value)}
            required
            className="bg-card border-input"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="purpose" className="flex items-center gap-2 text-foreground">
            <FileText className="w-4 h-4 text-muted-foreground" />
            Purpose of Verification
          </Label>
          <Textarea
            id="purpose"
            placeholder="e.g., Employment background check for Software Engineer position"
            value={formData.purpose}
            onChange={(e) => handleChange('purpose', e.target.value)}
            className="h-24 bg-card border-input"
            required
          />
        </div>
      </div>

      <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={isLoading || !formData.credential_id || !formData.requester_organization}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Submitting Request...
          </>
        ) : (
          <>
            <Shield className="w-4 h-4 mr-2" />
            Submit Verification Request
          </>
        )}
      </Button>

      <p className="text-xs text-center text-slate-500">By submitting, you agree to our verification terms and privacy policy.</p>
    </form>
  );
}
