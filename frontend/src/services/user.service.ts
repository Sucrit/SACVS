import { api } from '../api/client';

export type UserRole = 'STUDENT' | 'REGISTRAR' | 'ADMIN';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface StudentProfile {
  id: string;
  userId: string;
  studentNumber: string;
  address: string;
  phone: string;
  courseOfStudy: string;
  yearLevel: string;
  department: string;
  createdAt: string;
  updatedAt: string;
}

export interface User {
  id: string;
  clerkId: string;
  email: string | null;
  fullName: string | null;
  role: UserRole;
  status: UserStatus;
  approvedById: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  profile?: StudentProfile | null;
}

export interface CreateUserPayload {
  email?: string | null;
  fullName?: string | null;
  role?: UserRole;
}

export interface RegisterPayload {
  email: string;
  fullName?: string | null;
}

export interface LoginPayload {
  email: string;
}

export interface VerifyOtpPayload {
  email: string;
  otp: string;
}

export interface AuthChallengeResponse {
  message: string;
  requiresOtp: boolean;
  otpBypassCode?: string;
  email?: string;
  user?: User;
}

export interface AuthVerifyResponse {
  token: string;
  user: User;
}

export interface UpsertStudentProfilePayload {
  studentNumber: string;
  address: string;
  phone: string;
  courseOfStudy: string;
  yearLevel: string;
  department: string;
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

  register: async (data: RegisterPayload) => {
    const response = await api.post<AuthChallengeResponse>('/users/auth/register', data);
    return response.data;
  },

  login: async (data: LoginPayload) => {
    const response = await api.post<AuthChallengeResponse>('/users/auth/login', data);
    return response.data;
  },

  verifyOtp: async (data: VerifyOtpPayload) => {
    const response = await api.post<AuthVerifyResponse>('/users/auth/verify-otp', data);
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
