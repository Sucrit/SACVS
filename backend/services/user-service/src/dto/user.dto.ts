export interface CreateUserDto {
  username: string;
  email: string;
  password: string;
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
  createdAt: Date;
  updatedAt: Date;
}
