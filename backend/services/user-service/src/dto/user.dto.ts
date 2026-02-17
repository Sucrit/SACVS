import { Role } from '@prisma/client';

export interface CreateUserDto {
  clerkId: string;
  role: Role;
}

export interface UserResponseDto {
  id: string;
  clerkId: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}
