import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import { CompleteStudentOnboardingDto, CreateUserDto, UpdateUserStatusDto, UpsertStudentProfileDto } from '../dto/user.dto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const userService = new UserService();

const getAuthUserId = (req: Request): string | null => {
  const authReq = req as AuthenticatedRequest;
  return authReq.auth?.sub ?? null;
};

export class UserController {
  async getCurrentUser(req: Request, res: Response): Promise<Response> {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await userService.getCurrentUser(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.status(200).json(user);
    } catch (error) {
      console.error('Error fetching current user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async completeStudentOnboarding(req: Request, res: Response): Promise<Response> {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const data: CompleteStudentOnboardingDto = req.body;
    if (!data?.firstName || typeof data.firstName !== 'string') {
      return res.status(400).json({ error: 'Missing required field: firstName' });
    }
    if (!data?.lastName || typeof data.lastName !== 'string') {
      return res.status(400).json({ error: 'Missing required field: lastName' });
    }

    const requiredStringFields: Array<keyof CompleteStudentOnboardingDto> = [
      'studentNumber',
      'street',
      'barangay',
      'city',
      'province',
      'phone',
      'courseOfStudy',
      'yearLevel',
      'department',
    ];

    const missingField = requiredStringFields.find(field => {
      const value = data?.[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingField) {
      return res.status(400).json({ error: `Missing required field: ${missingField}` });
    }

    const parsedZipCode = Number(data?.zipCode);
    if (!Number.isInteger(parsedZipCode) || parsedZipCode <= 0) {
      return res.status(400).json({ error: 'Missing required field: zipCode' });
    }

    try {
      const user = await userService.completeStudentOnboarding(userId, {
        ...data,
        zipCode: parsedZipCode,
      });
      return res.status(200).json(user);
    } catch (error) {
      if (error instanceof Error && error.message === 'CLERK_EMAIL_NOT_AVAILABLE') {
        return res.status(400).json({ error: 'Authenticated account has no usable email.' });
      }
      if (error instanceof Error && error.message === 'EMAIL_ALREADY_LINKED_TO_ANOTHER_ACCOUNT') {
        return res.status(409).json({ error: 'Email is already linked to another account.' });
      }

      console.error('Error completing student onboarding:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async upsertMyProfile(req: Request, res: Response): Promise<Response> {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.sub ?? null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (authReq.auth?.role !== 'STUDENT') {
      return res.status(403).json({ error: 'Only student accounts can submit student profiles.' });
    }

    const profileData: UpsertStudentProfileDto = req.body;
    const requiredStringFields: Array<keyof UpsertStudentProfileDto> = [
      'studentNumber',
      'street',
      'barangay',
      'city',
      'province',
      'phone',
      'courseOfStudy',
      'yearLevel',
      'department',
    ];

    const missingField = requiredStringFields.find(field => {
      const value = profileData?.[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingField) {
      return res.status(400).json({ error: `Missing required field: ${missingField}` });
    }

    const parsedZipCode = Number(profileData?.zipCode);
    if (!Number.isInteger(parsedZipCode) || parsedZipCode <= 0) {
      return res.status(400).json({ error: 'Missing required field: zipCode' });
    }

    try {
      const updatedUser = await userService.upsertStudentProfileByUserId(userId, {
        ...profileData,
        zipCode: parsedZipCode,
      });
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error upserting student profile:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async listUsers(_req: Request, res: Response): Promise<Response> {
    try {
      const users = await userService.listUsers();
      return res.status(200).json(users);
    } catch (error) {
      console.error('Error listing users:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createUser(req: Request, res: Response): Promise<Response> {
    try {
      const userData: CreateUserDto = req.body;

      if (!userData?.email || typeof userData.email !== 'string') {
        return res.status(400).json({ error: 'Email is required.' });
      }
      if (!userData?.firstName || typeof userData.firstName !== 'string') {
        return res.status(400).json({ error: 'First name is required.' });
      }
      if (!userData?.lastName || typeof userData.lastName !== 'string') {
        return res.status(400).json({ error: 'Last name is required.' });
      }

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

  async getUserById(req: Request, res: Response): Promise<Response> {
    const userId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    try {
      const user = await userService.getUserById(userId);
      if (user) {
        return res.status(200).json(user);
      }
      return res.status(404).json({ error: 'User not found' });
    } catch (error) {
      console.error('Error fetching user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateUserStatus(req: Request, res: Response): Promise<Response> {
    const userId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actorId = getAuthUserId(req);
    const { status }: UpdateUserStatusDto = req.body;
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    try {
      const updatedUser = await userService.updateUserStatus(userId, { status }, actorId);
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user status:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
