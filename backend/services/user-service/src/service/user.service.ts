import { UserRepository } from '../repository/user.repository';
import { CreateUserDto, UpdateUserStatusDto } from '../dto/user.dto';

const userRepository = new UserRepository();

export class UserService {
  async createUser(data: CreateUserDto) {
    return userRepository.createUser(data);
  }

  async getUserById(userId: string) {
    return userRepository.getUserById(userId);
  }

  async updateUserStatus(userId: string, data: UpdateUserStatusDto) {
    return userRepository.updateUserStatus(userId, data.status);
  }
}