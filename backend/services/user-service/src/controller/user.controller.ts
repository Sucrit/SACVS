import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import { CreateUserDto, UpdateUserStatusDto } from '../dto/user.dto';

const userService = new UserService();

export class UserController {
  // Create a new user
  async createUser(req: Request, res: Response): Promise<Response> {
    try {
      const userData: CreateUserDto = req.body;

      if (userData.role && !['STUDENT', 'ADMIN', 'REGISTRAR'].includes(userData.role)) {
        return res.status(400).json({ error: 'Invalid role provided.' });
      }

      const newUser = await userService.createUser(userData);
      return res.status(201).json(newUser); 
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Get a user by ID
  async getUserById(req: Request, res: Response): Promise<Response> {
    const userId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const user = await userService.getUserById(userId);
      if (user) {
        return res.status(200).json(user); 
      } else {
        return res.status(404).json({ error: 'User not found' });
      }
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  // Update user status
  async updateUserStatus(req: Request, res: Response): Promise<Response> {
    const userId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status }: UpdateUserStatusDto = req.body;
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    try {
      const updatedUser = await userService.updateUserStatus(userId, { status });
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user status:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
