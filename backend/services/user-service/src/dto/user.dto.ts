export type UserRole = 'STUDENT' | 'ADMIN' | 'REGISTRAR';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

export interface RegisterDto {
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
}

export interface LoginDto {
  email: string;
}

export interface VerifyOtpDto {
  email: string;
  otp: string;
}

export interface CreateUserDto {
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
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
