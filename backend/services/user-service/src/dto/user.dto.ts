export interface CreateUserDto {
  clerkId: string;
  role: string
}

export interface UserResponseDto {
  id: string;
  clerkId: string;
  role: 'STUDENT' | 'ADMIN' | 'EMPLOYEE';
  createdAt: Date;
  updatedAt: Date;
}
