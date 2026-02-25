export type UserRole = 'STUDENT' | 'ADMIN' | 'EMPLOYER' | 'INSTITUTION';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED';
export type OrganizationRole = 'EMPLOYER' | 'INSTITUTION';
export type InstitutionManagedStudentStatus = UserStatus;
export type StudentSex = 'MALE' | 'FEMALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';

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

export interface CreateInstitutionStudentDto {
  email: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  studentNumber: string;
  courseOfStudy: string;
  yearLevel: string;
  department: string;
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
  birthday?: string | null;
  sex?: StudentSex | null;
  guardianFullName?: string | null;
  guardianRelationship?: string | null;
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
  institutionName: string;
  accreditationNumber: string;
}

export type CompleteOrganizationOnboardingDto =
  | CompleteEmployerOnboardingDto
  | CompleteInstitutionOnboardingDto;
