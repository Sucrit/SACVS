import { Role, Status } from '@prisma/client';

export interface CreateUserDto {
  clerkId: string;
  role?: Role | string;
  status?: Status | string;
}

export interface UpdateUserStatusDto {
  status: Status | string;
}

export interface UserResponseDto {
  id: string;
  clerkId: string;
  role: Role;
  status: Status;
  approvedById?: string | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
