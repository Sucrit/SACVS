export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
  role: string
}

export interface UpdateUserDto {
  username?: string;
  email?: string;
  password?: string;
}

export interface UserResponseDto {
  id: string;
  username: string;
  email: string;
  role: 'STUDENT' | 'ADMIN' | 'EMPLOYEE';
  createdAt: Date;
  updatedAt: Date;
}
