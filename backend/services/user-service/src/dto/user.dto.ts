export type UserRole = 'STUDENT' | 'ADMIN' | 'EMPLOYER' | 'INSTITUTION';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type OrganizationRole = 'EMPLOYER' | 'INSTITUTION';
export type InstitutionManagedStudentStatus = UserStatus;

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

export interface UpdateUserRoleDto {
  role: UserRole;
}

export interface CreateInstitutionStudentDto extends UpsertStudentProfileDto {
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  status?: InstitutionManagedStudentStatus;
}

export interface BulkCreateInstitutionStudentsDto {
  students: CreateInstitutionStudentDto[];
}

export interface BulkCreateInstitutionStudentsResultDto {
  created: number;
  failed: Array<{
    index: number;
    email: string;
    error: string;
  }>;
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

interface CompleteOrganizationOnboardingBaseDto {
  firstName: string;
  middleName?: string | null;
  lastName: string;
  registrationNumber: string;
  organizationEmail: string;
  phoneNumber: string;
}

export interface CompleteEmployerOnboardingDto extends CompleteOrganizationOnboardingBaseDto {
  role: 'EMPLOYER';
  companyName: string;
  taxId: string;
}

export interface CompleteInstitutionOnboardingDto extends CompleteOrganizationOnboardingBaseDto {
  role: 'INSTITUTION';
  name: string;
  accreditationNumber: string;
}

export type CompleteOrganizationOnboardingDto =
  | CompleteEmployerOnboardingDto
  | CompleteInstitutionOnboardingDto;
