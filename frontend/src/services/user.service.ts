import { api } from '../api/client';

export type UserRole = 'STUDENT' | 'ADMIN' | 'EMPLOYER' | 'INSTITUTION';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface StudentProfile {
  id: string;
  userId: string;
  studentNumber: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: number;
  phone: string;
  courseOfStudy: string;
  yearLevel: string;
  department: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerProfile {
  id: string;
  companyName: string;
  registrationNumber: string;
  taxId: string;
  email: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface InstitutionProfile {
  id: string;
  name: string;
  accreditationNumber: string;
  registrationNumber: string;
  email: string;
  phoneNumber: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  employerId: string | null;
  institutionId: string | null;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: StudentProfile | null;
  employer?: EmployerProfile | null;
  institution?: InstitutionProfile | null;
}

export interface CreateUserPayload {
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  role?: UserRole;
}

export interface UpsertStudentProfilePayload {
  studentNumber: string;
  street: string;
  barangay: string;
  city: string;
  province: string;
  zipCode: number;
  phone: string;
  courseOfStudy: string;
  yearLevel: string;
  department: string;
}

export interface CompleteStudentOnboardingPayload extends UpsertStudentProfilePayload {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}

export type OrganizationRole = 'EMPLOYER' | 'INSTITUTION';

interface CompleteOrganizationOnboardingBasePayload {
  role: OrganizationRole;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  registrationNumber: string;
  organizationEmail: string;
  phoneNumber: string;
}

export interface CompleteEmployerOnboardingPayload extends CompleteOrganizationOnboardingBasePayload {
  role: 'EMPLOYER';
  companyName: string;
  taxId: string;
}

export interface CompleteInstitutionOnboardingPayload extends CompleteOrganizationOnboardingBasePayload {
  role: 'INSTITUTION';
  name: string;
  accreditationNumber: string;
}

export type CompleteOrganizationOnboardingPayload =
  | CompleteEmployerOnboardingPayload
  | CompleteInstitutionOnboardingPayload;

export interface UserListQuery {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface UpdateUserRolePayload {
  role: UserRole;
}

export interface InstitutionStudentPayload extends UpsertStudentProfilePayload {
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  status?: UserStatus;
}

export interface InstitutionStudentBulkPayload {
  students: InstitutionStudentPayload[];
}

export interface InstitutionStudentBulkResult {
  created: number;
  failed: Array<{
    index: number;
    email: string;
    error: string;
  }>;
}

export interface DeleteInstitutionStudentResult {
  id: string;
  email: string;
  message: string;
}

export const UserService = {
  getMe: async () => {
    const response = await api.get<User>('/users/me');
    return response.data;
  },

  completeOrganizationOnboarding: async (data: CompleteOrganizationOnboardingPayload) => {
    const response = await api.post<User>('/users/me/onboarding', data);
    return response.data;
  },

  upsertMyProfile: async (data: UpsertStudentProfilePayload) => {
    const response = await api.put<User>('/users/me/profile', data);
    return response.data;
  },

  create: async (data: CreateUserPayload) => {
    const response = await api.post<User>('/users', data);
    return response.data;
  },

  list: async (query: UserListQuery = {}) => {
    const response = await api.get<User[]>('/users', { params: query });
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get<User>(`/users/${id}`);
    return response.data;
  },

  updateStatus: async (id: string, status: UserStatus) => {
    const response = await api.put<User>(`/users/${id}/status`, { status });
    return response.data;
  },

  updateRole: async (id: string, role: UserRole) => {
    const response = await api.put<User>(`/users/${id}/role`, { role } as UpdateUserRolePayload);
    return response.data;
  },

  listInstitutionStudents: async () => {
    const response = await api.get<User[]>('/users/me/institution/students');
    return response.data;
  },

  createInstitutionStudent: async (data: InstitutionStudentPayload) => {
    const response = await api.post<User>('/users/me/institution/students', data);
    return response.data;
  },

  createInstitutionStudentsBulk: async (data: InstitutionStudentBulkPayload) => {
    const response = await api.post<InstitutionStudentBulkResult>('/users/me/institution/students/bulk', data);
    return response.data;
  },

  updateInstitutionStudentStatus: async (id: string, status: UserStatus) => {
    const response = await api.put<User>(`/users/me/institution/students/${id}/status`, { status });
    return response.data;
  },

  updateInstitutionStudent: async (id: string, data: InstitutionStudentPayload) => {
    const response = await api.put<User>(`/users/me/institution/students/${id}`, data);
    return response.data;
  },

  deleteInstitutionStudent: async (id: string) => {
    const response = await api.delete<DeleteInstitutionStudentResult>(`/users/me/institution/students/${id}`);
    return response.data;
  },
};
