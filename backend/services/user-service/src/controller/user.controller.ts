import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import {
  BulkCreateInstitutionStudentsDto,
  CreateInstitutionStudentDto,
  CompleteOrganizationOnboardingDto,
  CreateUserDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UpsertStudentProfileDto,
  UserStatus,
} from '../dto/user.dto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const userService = new UserService();

const getAuthUserId = (req: Request): string | null => {
  const authReq = req as AuthenticatedRequest;
  return authReq.auth?.sub ?? null;
};

export class UserController {
  private isStudentEmailAlreadyExistsError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      if (
        message === 'email_already_linked_to_another_account' ||
        (message.includes('email') && (message.includes('already') || message.includes('exists') || message.includes('taken')))
      ) {
        return true;
      }
    }

    if (typeof error === 'object' && error !== null) {
      const err = error as {
        code?: string;
        meta?: { target?: string[] | string };
        errors?: Array<{ code?: string; message?: string }>;
      };

      if (err.code === 'P2002') {
        const target = err.meta?.target;
        const targetValues = Array.isArray(target) ? target : typeof target === 'string' ? [target] : [];
        if (targetValues.some(value => value.toLowerCase().includes('email'))) {
          return true;
        }
      }

      if (Array.isArray(err.errors)) {
        const duplicateEmail = err.errors.some(item => {
          const code = (item.code ?? '').toLowerCase();
          const message = (item.message ?? '').toLowerCase();
          return (
            code.includes('form_identifier_exists') ||
            (message.includes('email') && (message.includes('already') || message.includes('exists') || message.includes('taken')))
          );
        });

        if (duplicateEmail) {
          return true;
        }
      }
    }

    return false;
  }

  private validateInstitutionStudentPayload(payload: unknown): {
    data: CreateInstitutionStudentDto | null;
    error: string | null;
  } {
    if (!payload || typeof payload !== 'object') {
      return { data: null, error: 'Invalid payload.' };
    }

    const data = payload as Partial<CreateInstitutionStudentDto>;
    const requiredStringFields: Array<keyof CreateInstitutionStudentDto> = [
      'email',
      'firstName',
      'lastName',
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
      const value = data[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingField) {
      return { data: null, error: `Missing required field: ${missingField}` };
    }

    const parsedZipCode = Number(data.zipCode);
    if (!Number.isInteger(parsedZipCode) || parsedZipCode <= 0) {
      return { data: null, error: 'Missing required field: zipCode' };
    }

    const validStatuses: UserStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (data.status && !validStatuses.includes(data.status)) {
      return { data: null, error: 'Invalid status value.' };
    }

    return {
      data: {
        email: data.email!.trim(),
        firstName: data.firstName!.trim(),
        middleName: typeof data.middleName === 'string' ? data.middleName.trim() || null : null,
        lastName: data.lastName!.trim(),
        status: data.status ?? 'PENDING',
        studentNumber: data.studentNumber!.trim(),
        street: data.street!.trim(),
        barangay: data.barangay!.trim(),
        city: data.city!.trim(),
        province: data.province!.trim(),
        zipCode: parsedZipCode,
        phone: data.phone!.trim(),
        courseOfStudy: data.courseOfStudy!.trim(),
        yearLevel: data.yearLevel!.trim(),
        department: data.department!.trim(),
      },
      error: null,
    };
  }

  private inferOrganizationRoleFromPayload(payload: unknown): 'EMPLOYER' | 'INSTITUTION' | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const role = typeof data.role === 'string' ? data.role : null;
    if (role === 'EMPLOYER' || role === 'INSTITUTION') {
      return role;
    }

    const hasEmployerHints =
      typeof data.companyName === 'string' ||
      typeof data.taxId === 'string';
    const hasInstitutionHints =
      typeof data.name === 'string' ||
      typeof data.accreditationNumber === 'string';

    if (hasEmployerHints && !hasInstitutionHints) {
      return 'EMPLOYER';
    }
    if (hasInstitutionHints && !hasEmployerHints) {
      return 'INSTITUTION';
    }

    return null;
  }

  private isLikelyOrganizationOnboardingPayload(payload: unknown): boolean {
    if (!payload || typeof payload !== 'object') {
      return false;
    }

    const data = payload as Record<string, unknown>;
    const hasOrgCommonHints =
      typeof data.firstName === 'string' ||
      typeof data.lastName === 'string' ||
      typeof data.registrationNumber === 'string' ||
      typeof data.organizationEmail === 'string' ||
      typeof data.phoneNumber === 'string' ||
      typeof data.organizationName === 'string' ||
      typeof data.companyName === 'string' ||
      typeof data.name === 'string' ||
      typeof data.taxId === 'string' ||
      typeof data.accreditationNumber === 'string';

    const hasStudentHints =
      typeof data.studentNumber === 'string' ||
      typeof data.street === 'string' ||
      typeof data.barangay === 'string' ||
      typeof data.city === 'string' ||
      typeof data.province === 'string' ||
      typeof data.courseOfStudy === 'string' ||
      typeof data.yearLevel === 'string' ||
      typeof data.department === 'string';

    return hasOrgCommonHints && !hasStudentHints;
  }

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

  async completeOrganizationOnboarding(req: Request, res: Response): Promise<Response> {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    // Legacy payload compatibility: support "organizationName".
    if (typeof body.organizationName === 'string') {
      if (body.role === 'EMPLOYER' && typeof body.companyName !== 'string') {
        body.companyName = body.organizationName;
      }
      if (body.role === 'INSTITUTION' && typeof body.name !== 'string') {
        body.name = body.organizationName;
      }
    }

    const data = body as unknown as CompleteOrganizationOnboardingDto;
    if (!data?.role || !['EMPLOYER', 'INSTITUTION'].includes(data.role)) {
      return res.status(400).json({ error: 'Missing required field: role' });
    }
    if (!data?.firstName || typeof data.firstName !== 'string') {
      return res.status(400).json({ error: 'Missing required field: firstName' });
    }
    if (!data?.lastName || typeof data.lastName !== 'string') {
      return res.status(400).json({ error: 'Missing required field: lastName' });
    }

    const requiredCommonFields: Array<keyof CompleteOrganizationOnboardingDto> = [
      'registrationNumber',
      'organizationEmail',
      'phoneNumber',
    ];

    const missingCommonField = requiredCommonFields.find(field => {
      const value = data?.[field];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingCommonField) {
      return res.status(400).json({ error: `Missing required field: ${missingCommonField}` });
    }

    if (data.role === 'EMPLOYER') {
      if (!data.companyName || typeof data.companyName !== 'string' || data.companyName.trim().length === 0) {
        return res.status(400).json({ error: 'Missing required field: companyName' });
      }
      if (!data.taxId || typeof data.taxId !== 'string' || data.taxId.trim().length === 0) {
        return res.status(400).json({ error: 'Missing required field: taxId' });
      }
    }

    if (data.role === 'INSTITUTION') {
      if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
        return res.status(400).json({ error: 'Missing required field: name' });
      }
      if (
        !data.accreditationNumber ||
        typeof data.accreditationNumber !== 'string' ||
        data.accreditationNumber.trim().length === 0
      ) {
        return res.status(400).json({ error: 'Missing required field: accreditationNumber' });
      }
    }

    try {
      const user = await userService.completeOrganizationOnboarding(userId, data);
      return res.status(200).json(user);
    } catch (error) {
      if (error instanceof Error && error.message === 'CLERK_EMAIL_NOT_AVAILABLE') {
        return res.status(400).json({ error: 'Authenticated account has no usable email.' });
      }
      if (error instanceof Error && error.message === 'EMAIL_ALREADY_LINKED_TO_ANOTHER_ACCOUNT') {
        return res.status(409).json({ error: 'Email is already linked to another account.' });
      }
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2002'
      ) {
        return res.status(409).json({ error: 'A record with the same unique value already exists.' });
      }

      console.error('Error completing organization onboarding:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async upsertMyProfile(req: Request, res: Response): Promise<Response> {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.auth?.sub ?? null;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const inferredRole = this.inferOrganizationRoleFromPayload(req.body);
    if (inferredRole || this.isLikelyOrganizationOnboardingPayload(req.body)) {
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Invalid request payload.' });
      }

      const bodyWithRole = req.body as Record<string, unknown>;
      if (typeof bodyWithRole.role !== 'string' && inferredRole) {
        bodyWithRole.role = inferredRole;
      }

      if (typeof bodyWithRole.role !== 'string') {
        return res.status(400).json({ error: 'Missing required field: role' });
      }

      return this.completeOrganizationOnboarding(req, res);
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

  async listMyInstitutionStudents(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const students = await userService.listInstitutionStudents(actorId);
      return res.status(200).json(students);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'FORBIDDEN_ROLE' || error.message === 'INSTITUTION_CONTEXT_MISSING')
      ) {
        return res.status(403).json({ error: 'Only institution accounts can manage students.' });
      }

      console.error('Error listing institution students:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createInstitutionStudent(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { data, error } = this.validateInstitutionStudentPayload(req.body);
    if (error || !data) {
      return res.status(400).json({ error: error ?? 'Invalid payload.' });
    }

    try {
      const student = await userService.createInstitutionStudent(actorId, data);
      return res.status(201).json(student);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'FORBIDDEN_ROLE' || err.message === 'INSTITUTION_CONTEXT_MISSING')
      ) {
        return res.status(403).json({ error: 'Only institution accounts can create students.' });
      }
      if (this.isStudentEmailAlreadyExistsError(err)) {
        return res.status(409).json({ error: 'Student email already exists.' });
      }

      console.error('Error creating institution student:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createInstitutionStudentsBulk(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = req.body as BulkCreateInstitutionStudentsDto | undefined;
    if (!payload || !Array.isArray(payload.students) || payload.students.length === 0) {
      return res.status(400).json({ error: 'Missing required field: students' });
    }

    const validatedStudents: CreateInstitutionStudentDto[] = [];
    const validationErrors: Array<{ index: number; error: string }> = [];

    payload.students.forEach((student, index) => {
      const result = this.validateInstitutionStudentPayload(student);
      if (!result.data || result.error) {
        validationErrors.push({ index, error: result.error ?? 'Invalid row payload.' });
        return;
      }
      validatedStudents.push(result.data);
    });

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'One or more rows are invalid.',
        details: validationErrors,
      });
    }

    try {
      const result = await userService.createInstitutionStudentsBulk(actorId, validatedStudents);
      return res.status(201).json(result);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'FORBIDDEN_ROLE' || err.message === 'INSTITUTION_CONTEXT_MISSING')
      ) {
        return res.status(403).json({ error: 'Only institution accounts can create students.' });
      }

      console.error('Error bulk creating institution students:', err);
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

      if (userData.role && !['STUDENT', 'ADMIN', 'EMPLOYER', 'INSTITUTION'].includes(userData.role)) {
        return res.status(400).json({ error: 'Invalid role provided.' });
      }

      const newUser = await userService.createUser(userData);
      return res.status(201).json(newUser);
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateInstitutionStudentStatus(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { status }: UpdateUserStatusDto = req.body;
    const validStatuses: UserStatus[] = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value.' });
    }

    try {
      const updated = await userService.updateInstitutionStudentStatus(actorId, studentId, status);
      return res.status(200).json(updated);
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'FORBIDDEN_ROLE' || error.message === 'INSTITUTION_CONTEXT_MISSING')
      ) {
        return res.status(403).json({ error: 'Only institution accounts can update student status.' });
      }
      if (error instanceof Error && error.message === 'STUDENT_NOT_FOUND_OR_FORBIDDEN') {
        return res.status(404).json({ error: 'Student not found for this institution.' });
      }

      console.error('Error updating institution student status:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateInstitutionStudent(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { data, error } = this.validateInstitutionStudentPayload(req.body);
    if (error || !data) {
      return res.status(400).json({ error: error ?? 'Invalid payload.' });
    }

    try {
      const updated = await userService.updateInstitutionStudent(actorId, studentId, data);
      return res.status(200).json(updated);
    } catch (err) {
      if (
        err instanceof Error &&
        (err.message === 'FORBIDDEN_ROLE' || err.message === 'INSTITUTION_CONTEXT_MISSING')
      ) {
        return res.status(403).json({ error: 'Only institution accounts can update students.' });
      }
      if (err instanceof Error && err.message === 'STUDENT_NOT_FOUND_OR_FORBIDDEN') {
        return res.status(404).json({ error: 'Student not found for this institution.' });
      }
      if (this.isStudentEmailAlreadyExistsError(err)) {
        return res.status(409).json({ error: 'Student email already exists.' });
      }

      console.error('Error updating institution student:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async deleteInstitutionStudent(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const studentId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    try {
      const deleted = await userService.deleteInstitutionStudent(actorId, studentId);
      return res.status(200).json({
        id: deleted.id,
        email: deleted.email,
        message: 'Student account deleted from database and Clerk.',
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message === 'FORBIDDEN_ROLE' || error.message === 'INSTITUTION_CONTEXT_MISSING')
      ) {
        return res.status(403).json({ error: 'Only institution accounts can delete students.' });
      }
      if (error instanceof Error && error.message === 'STUDENT_NOT_FOUND_OR_FORBIDDEN') {
        return res.status(404).json({ error: 'Student not found for this institution.' });
      }
      if (error instanceof Error && error.message === 'CLERK_DELETE_FAILED') {
        return res.status(502).json({ error: 'Failed to delete student account from Clerk.' });
      }

      console.error('Error deleting institution student:', error);
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

  async updateUserRole(req: Request, res: Response): Promise<Response> {
    const userId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { role }: UpdateUserRoleDto = req.body;
    const validRoles = ['STUDENT', 'ADMIN', 'EMPLOYER', 'INSTITUTION'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role value.' });
    }

    try {
      const updatedUser = await userService.updateUserRole(userId, { role });
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user role:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
