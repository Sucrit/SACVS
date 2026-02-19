export type UserRole = 'STUDENT' | 'ADMIN' | 'REGISTRAR';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';

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

export interface CompleteStudentOnboardingDto extends UpsertStudentProfileDto {
  firstName: string;
  middleName?: string | null;
  lastName: string;
}
