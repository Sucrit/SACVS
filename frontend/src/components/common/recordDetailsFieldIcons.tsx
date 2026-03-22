import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertTriangle,
  AlignLeft,
  Calendar,
  CalendarCheck,
  CheckCircle,
  FileText,
  GraduationCap,
  Hash,
  Mail,
  Shield,
  Tag,
  User,
} from 'lucide-react';
import type { RecordDetailsField } from './RecordDetailsDrawer';

const COMMON_FIELD_ICONS: Record<string, LucideIcon> = {
  Name: User,
  Actor: User,
  Email: Mail,
  'Student Number': Hash,
  'User ID': Hash,
  Document: FileText,
  Metadata: FileText,
  Program: GraduationCap,
  Type: Tag,
  Delivery: Tag,
  'Target Type': Tag,
  'Reason Code': Tag,
  Status: CheckCircle,
  Action: Activity,
  Severity: AlertTriangle,
  'Actor Role': Shield,
  Timestamp: Calendar,
  'Requested At': Calendar,
  'Created At': Calendar,
  'Observed At': Calendar,
  'Processed At': CalendarCheck,
  'Reviewed At': CalendarCheck,
  'Approved At': CalendarCheck,
  'Purpose': AlignLeft,
  'Description': AlignLeft,
  'Notes': AlignLeft,
  'Reason Detail': AlignLeft,
  'Rejection Reason': AlignLeft,
  'Linked Organization': Shield,
  'Approved By': User,
  'Model Version': Activity,
  'Risk Score': Activity,
  'Risk Band': Shield,
  'Review Status': CheckCircle,
};

export function iconForRecordField(label: string): LucideIcon | undefined {
  return COMMON_FIELD_ICONS[label];
}

export function detailField(
  label: string,
  value: ReactNode,
  icon?: LucideIcon,
): RecordDetailsField {
  return {
    label,
    value,
    icon: icon ?? iconForRecordField(label),
  };
}
