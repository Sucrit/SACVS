import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Upload, FileText, Calendar, Building2, GraduationCap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const credentialTypes = [
  { value: 'diploma', label: 'Diploma' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'transcript', label: 'Transcript' },
  { value: 'degree', label: 'Degree' },
  { value: 'license', label: 'License' },
];

export default function CredentialUploadForm({ onSubmit, isLoading, className }) {
  const [formData, setFormData] = useState({
    title: '',
    type: 'diploma',
    institution_name: '',
    student_name: '',
    issue_date: '',
    expiry_date: '',
    document_url: '',
  });
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFileName(e.dataTransfer.files[0].name);
      handleChange('document_url', 'conceptual://uploaded-document.pdf');
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
      handleChange('document_url', 'conceptual://uploaded-document.pdf');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.(formData);
  };

  return (
    <form onSubmit={handleSubmit} className={cn('space-y-6', className)}>
      <div
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all',
          dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 hover:border-slate-300',
          fileName && 'border-emerald-500 bg-emerald-50'
        )}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input type="file" id="file-upload" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileSelect} />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-3">
            {fileName ? (
              <>
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="font-medium text-emerald-700">{fileName}</p>
                  <p className="text-sm text-slate-500">Click or drag to replace</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-500" />
                </div>
                <div>
                  <p className="font-medium text-slate-700">Upload credential document</p>
                  <p className="text-sm text-slate-500">PDF, JPG, or PNG (max 10MB)</p>
                </div>
              </>
            )}
          </div>
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="title" className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-slate-400" />
            Credential Title
          </Label>
          <Input
            id="title"
            placeholder="e.g., Bachelor of Science in Computer Science"
            value={formData.title}
            onChange={(e) => handleChange('title', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="type">Credential Type</Label>
          <Select value={formData.type} onValueChange={(value) => handleChange('type', value)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {credentialTypes.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="institution_name" className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-400" />
            Issuing Institution
          </Label>
          <Input
            id="institution_name"
            placeholder="e.g., State University"
            value={formData.institution_name}
            onChange={(e) => handleChange('institution_name', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="student_name">Credential Holder Name</Label>
          <Input
            id="student_name"
            placeholder="Full name as on credential"
            value={formData.student_name}
            onChange={(e) => handleChange('student_name', e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="issue_date" className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            Issue Date
          </Label>
          <Input id="issue_date" type="date" value={formData.issue_date} onChange={(e) => handleChange('issue_date', e.target.value)} required />
        </div>

        <div className="space-y-2">
          <Label htmlFor="expiry_date">Expiry Date (Optional)</Label>
          <Input id="expiry_date" type="date" value={formData.expiry_date} onChange={(e) => handleChange('expiry_date', e.target.value)} />
        </div>
      </div>

      <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700" disabled={isLoading || !formData.title || !formData.institution_name}>
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4 mr-2" />
            Submit Credential
          </>
        )}
      </Button>
    </form>
  );
}
