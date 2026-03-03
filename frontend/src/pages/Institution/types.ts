import { CredentialRequestStatus } from '../../services/credential.service';
import { UserStatus } from '../../services/user.service';

export type InstitutionSection = 'overview' | 'students' | 'requests' | 'issue' | 'notifications' | 'logs';
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

export interface StudentFormState {
  email: string;
  firstName: string;
  middleName: string;
  lastName: string;
  studentNumber: string;
  courseOfStudy: string;
  yearLevel: string;
  department: string;
  status: UserStatus;
}

export const STUDENT_STATUS_OPTIONS: UserStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
export const REQUEST_STATUS_OPTIONS: RequestStatusFilter[] = ['ALL', 'PENDING', 'APPROVED', 'COMPLETED', 'REJECTED', 'CANCELLED'];
export const DEFAULT_STUDENT_FORM: StudentFormState = {
  email: '',
  firstName: '',
  middleName: '',
  lastName: '',
  studentNumber: '',
  courseOfStudy: '',
  yearLevel: '',
  department: '',
  status: 'APPROVED',
};


