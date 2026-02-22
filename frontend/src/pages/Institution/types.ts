import { CredentialRequest, CredentialRequestStatus } from '../../services/credential.service';
import { InstitutionStudentPayload, User, UserStatus } from '../../services/user.service';

export type InstitutionSection = 'overview' | 'students' | 'requests' | 'verify' | 'history' | 'notifications';
export type StudentStatusFilter = UserStatus | 'ALL';
export type RequestStatusFilter = CredentialRequestStatus | 'ALL';
export type ActivityType = 'STUDENT' | 'REQUEST' | 'SECURITY' | 'SYSTEM' | 'NOTIFICATION';
export type NotificationTarget = 'ALL' | 'APPROVED_ONLY' | 'SUSPENDED_ONLY';

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  createdAt: string;
}

export interface OutboundNotification {
  id: string;
  target: NotificationTarget;
  title: string;
  message: string;
  createdAt: string;
}

export interface StudentFormState extends InstitutionStudentPayload {
  middleName: string;
  zipCode: string;
}

export interface InstitutionDashboardData {
  requests: CredentialRequest[];
  students: User[];
  pendingCount: number;
  approvedCount: number;
  completedCount: number;
  rejectedCount: number;
  processedCount: number;
  duplicateStudentEmails: string[];
  studentCounts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    suspended: number;
  };
}

export const STUDENT_STATUS_OPTIONS: UserStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
export const REQUEST_STATUS_OPTIONS: RequestStatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
export const DEFAULT_STUDENT_FORM: StudentFormState = {
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  studentNumber: '',
  street: '',
  barangay: '',
  city: '',
  province: '',
  zipCode: '',
  phone: '',
  courseOfStudy: '',
  yearLevel: '',
  department: '',
  status: 'PENDING',
};
