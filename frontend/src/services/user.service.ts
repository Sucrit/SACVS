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

export interface User {
  id: string;
  firstName: string;
  middleName: string | null;
  lastName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: StudentProfile | null;
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

export interface UserListQuery {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}

export const UserService = {
  getMe: async () => {
    const response = await api.get<User>('/users/me');
    return response.data;
  },

  completeStudentOnboarding: async (data: CompleteStudentOnboardingPayload) => {
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
};
