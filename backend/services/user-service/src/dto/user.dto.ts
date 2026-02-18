export interface CreateUserDto {
  email: string;
  fullName: string;
  role?: 'STUDENT' | 'ADMIN' | 'REGISTRAR'; 
  clerkId: string;
}

export interface UpdateUserStatusDto {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SUSPENDED'; 
}