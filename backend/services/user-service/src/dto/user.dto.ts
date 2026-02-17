export interface CreateUserDto {
  clerkId: string;
  role: string
}

export interface UserResponseDto {
  id: string;
  clerkId: string;
  role: 'STUDENT' | 'ADMIN' | 'REGISTRAR';
  createdAt: Date;
  updatedAt: Date;
}
