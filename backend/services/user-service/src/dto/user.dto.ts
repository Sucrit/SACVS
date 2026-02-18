import { Role, Status } from '@prisma/client';

export interface CreateUserDto {
  clerkId: string;
  email?: string;
  fullName?: string;
  role?: Role | string;
  status?: Status | string;
  // Student profile fields (included during self-registration)
  studentNumber?: string;
  address?: string;
  phone?: string;
  courseOfStudy?: string;
  yearLevel?: string;
  department?: string;
}

export interface UpdateUserStatusDto {
  status: Status | string;
}

export interface UpdateProfileDto {
  email?: string;
  fullName?: string;
  studentNumber?: string;
  address?: string;
  phone?: string;
  courseOfStudy?: string;
  yearLevel?: string;
  department?: string;
}

export interface StudentProfileDto {
  id: string;
  userId: string;
  studentNumber: string;
  address?: string | null;
  phone?: string | null;
  courseOfStudy?: string | null;
  yearLevel?: string | null;
  department?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserResponseDto {
  id: string;
  clerkId: string;
  email?: string | null;
  fullName?: string | null;
  role: Role;
  status: Status;
  approvedById?: string | null;
  approvedAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  profile?: StudentProfileDto | null;
}

export interface UserListQuery {
  role?: Role;
  status?: Status;
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
