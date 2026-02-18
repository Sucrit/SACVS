export type UserRole = 'STUDENT' | 'ADMIN' | 'REGISTRAR';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface RegisterDto {
  email: string;
  fullName?: string | null;
  role?: UserRole;
}

export interface LoginDto {
  email: string;
}

export interface VerifyOtpDto {
  email: string;
  otp: string;
}

export interface CreateUserDto {
  email?: string | null;
  fullName?: string | null;
  role?: UserRole;
}

export interface UpdateUserStatusDto {
  status: UserStatus;
}

export interface UpsertStudentProfileDto {
  studentNumber: string;
  address: string;
  phone: string;
  courseOfStudy: string;
  yearLevel: string;
  department: string;
}
