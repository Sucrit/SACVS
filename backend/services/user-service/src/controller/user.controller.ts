import { Request, Response } from 'express';
import { UserService } from '../service/user.service';
import {
  BulkCreateInstitutionStudentsDto,
  CreateInstitutionStudentDto,
  CreateStepUpChallengeDto,
  CreateUserDto,
  VerifyStepUpChallengeDto,
  UpdateUserRoleDto,
  UpdateUserStatusDto,
  UserStatus,
} from '../dto/user.dto';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const userService = new UserService();

const getAuthUserId = (req: Request): string | null => {
  const authReq = req as AuthenticatedRequest;
  return authReq.auth?.sub ?? null;
};

const getAuthUserEmail = (req: Request): string | null => {
  const authReq = req as AuthenticatedRequest;
  return authReq.auth?.email ?? null;
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

  private mapProfileWorkflowError(error: unknown, res: Response): Response | null {
    if (!(error instanceof Error)) {
      return null;
    }

    if (error.message.startsWith('MISSING_REQUIRED_FIELD:')) {
      const field = error.message.split(':')[1] ?? 'field';
      return res.status(400).json({ error: `Missing required field: ${field}` });
    }

    const map: Record<string, { code: number; error: string }> = {
      INVALID_REQUEST_PAYLOAD: { code: 400, error: 'Invalid request payload.' },
      INVALID_PHONE_NUMBER: {
        code: 400,
        error: 'Invalid phoneNumber format. Use +63 followed by 10 digits (e.g. +639123456789).',
      },
      INVALID_PHONE_FORMAT: {
        code: 400,
        error: 'Invalid phone format. Use +63 followed by 10 digits (e.g. +639123456789).',
      },
      INVALID_PHONE: { code: 400, error: 'Invalid phone value.' },
      INVALID_BIRTHDAY: { code: 400, error: 'Invalid birthday value.' },
      INVALID_SEX: { code: 400, error: 'Invalid sex value.' },
      INVALID_GUARDIAN_FULL_NAME: { code: 400, error: 'Invalid guardianFullName value.' },
      INVALID_GUARDIAN_RELATIONSHIP: { code: 400, error: 'Invalid guardianRelationship value.' },
      BIRTHDAY_IMMUTABLE: {
        code: 400,
        error: 'Birthday is a one-time setup field and can no longer be changed.',
      },
      SEX_IMMUTABLE: {
        code: 400,
        error: 'Sex is a one-time setup field and can no longer be changed.',
      },
      STUDENT_PROFILE_FORBIDDEN: {
        code: 403,
        error: 'Only student accounts can submit student profiles.',
      },
      CLERK_TIMEOUT: { code: 504, error: 'Identity provider timed out. Please try again.' },
      CLERK_UNAVAILABLE: { code: 502, error: 'Identity provider is unavailable. Please try again.' },
      CLERK_EMAIL_NOT_AVAILABLE: { code: 400, error: 'Authenticated account has no usable email.' },
      EMAIL_ALREADY_LINKED_TO_ANOTHER_ACCOUNT: {
        code: 409,
        error: 'Email is already linked to another account.',
      },
    };

    const mapped = map[error.message];
    if (mapped) {
      return res.status(mapped.code).json({ error: mapped.error });
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'P2002'
    ) {
      return res.status(409).json({ error: 'A record with the same unique value already exists.' });
    }

    return null;
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

    return {
      data: {
        email: data.email!.trim(),
        firstName: data.firstName!.trim(),
        middleName: typeof data.middleName === 'string' ? data.middleName.trim() || null : null,
        lastName: data.lastName!.trim(),
        // Institution-managed student creation is always approved by default.
        status: 'APPROVED',
        studentNumber: data.studentNumber!.trim(),
        courseOfStudy: data.courseOfStudy!.trim(),
        yearLevel: data.yearLevel!.trim(),
        department: data.department!.trim(),
      },
      error: null,
    };
  }

  private inferOrganizationRoleFromPayload(payload: unknown): 'INSTITUTION' | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const data = payload as Record<string, unknown>;
    const role = typeof data.role === 'string' ? data.role : null;
    if (role === 'INSTITUTION') {
      return role;
    }

    const hasInstitutionHints =
      typeof data.institutionName === 'string' ||
      typeof data.name === 'string' ||
      typeof data.accreditationNumber === 'string';

    if (hasInstitutionHints) {
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
      typeof data.institutionName === 'string' ||
      typeof data.name === 'string' ||
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
    const userEmail = getAuthUserEmail(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const user = await userService.completeOrganizationOnboardingFromPayload(
        userId,
        req.body,
        userEmail ?? undefined,
      );
      return res.status(200).json(user);
    } catch (error) {
      const mapped = this.mapProfileWorkflowError(error, res);
      if (mapped) {
        return mapped;
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

    try {
      const updatedUser = await userService.submitOwnProfile({
        userId,
        authRole: authReq.auth?.role ?? null,
        authenticatedEmail: authReq.auth?.email ?? null,
        payload: req.body,
      });
      return res.status(200).json(updatedUser);
    } catch (error) {
      const mapped = this.mapProfileWorkflowError(error, res);
      if (mapped) {
        return mapped;
      }

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

  async createStepUpChallenge(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const payload = (req.body ?? {}) as Partial<CreateStepUpChallengeDto>;
    const validActions = ['ROLE_CHANGE', 'STATUS_CHANGE', 'CREDENTIAL_ISSUE', 'BULK_STUDENT_CREATE', 'QR_DOWNLOAD_ENABLE'];
    if (!payload.action || !validActions.includes(payload.action)) {
      return res.status(400).json({ error: 'Invalid step-up action.' });
    }

    try {
      const challenge = await userService.createStepUpChallenge(actorId, {
        action: payload.action,
        targetId: typeof payload.targetId === 'string' ? payload.targetId : undefined,
        payloadHash: typeof payload.payloadHash === 'string' ? payload.payloadHash : undefined,
      }, {
        correlationId: req.header('x-correlation-id') || null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.header('user-agent') || null,
      });
      return res.status(200).json(challenge);
    } catch (error) {
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(404).json({ error: 'ACTOR_NOT_FOUND' });
      }
      if (error instanceof Error && error.message === 'STEP_UP_DELIVERY_NOT_CONFIGURED') {
        return res.status(503).json({ error: 'STEP_UP_DELIVERY_NOT_CONFIGURED' });
      }
      if (error instanceof Error && error.message === 'STEP_UP_DELIVERY_FAILED') {
        return res.status(502).json({ error: 'STEP_UP_DELIVERY_FAILED' });
      }
      if (error instanceof Error && error.message === 'STEP_UP_TOKEN_INVALID') {
        return res.status(500).json({ error: 'STEP_UP_MISCONFIGURED' });
      }
      console.error('Error creating step-up challenge:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async verifyStepUpChallenge(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const challengeId = Array.isArray(req.params.challengeId) ? req.params.challengeId[0] : req.params.challengeId;
    const payload = (req.body ?? {}) as Partial<VerifyStepUpChallengeDto>;
    const otpCode = typeof payload.otpCode === 'string' ? payload.otpCode.trim() : '';
    if (!otpCode) {
      return res.status(400).json({ error: 'Missing required field: otpCode' });
    }

    try {
      const verified = await userService.verifyStepUpChallenge(actorId, challengeId, { otpCode }, {
        correlationId: req.header('x-correlation-id') || null,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.header('user-agent') || null,
      });
      return res.status(200).json(verified);
    } catch (error) {
      if (error instanceof Error && error.message === 'STEP_UP_CHALLENGE_LOCKED') {
        return res.status(423).json({ error: 'STEP_UP_CHALLENGE_LOCKED' });
      }
      if (error instanceof Error && error.message === 'STEP_UP_TOKEN_EXPIRED') {
        return res.status(410).json({ error: 'STEP_UP_TOKEN_EXPIRED' });
      }
      if (error instanceof Error && error.message === 'STEP_UP_TOKEN_INVALID') {
        return res.status(403).json({ error: 'STEP_UP_TOKEN_INVALID' });
      }
      console.error('Error verifying step-up challenge:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async listAuditLogs(req: Request, res: Response): Promise<Response> {
    const actorId = getAuthUserId(req);
    if (!actorId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
      const logs = await userService.listAuditLogs(actorId);
      return res.status(200).json(logs);
    } catch (error) {
      if (error instanceof Error && error.message === 'ACTOR_NOT_FOUND') {
        return res.status(404).json({ error: 'Authenticated user record was not found.' });
      }
      if (error instanceof Error && error.message === 'FORBIDDEN_ROLE') {
        return res.status(403).json({ error: 'Students do not have audit logging access.' });
      }

      console.error('Error listing audit logs:', error);
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

      if (userData.role && !['STUDENT', 'ADMIN', 'INSTITUTION'].includes(userData.role)) {
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
      if (error instanceof Error && error.message === 'STATUS_UNCHANGED') {
        return res.status(409).json({ error: `Student is already ${status}.` });
      }
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
        message: 'Student account has been deleted',
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
      if (error instanceof Error && error.message === 'STATUS_UNCHANGED') {
        return res.status(409).json({ error: `User is already ${status}.` });
      }
      if (error instanceof Error && error.message === 'INVALID_TRANSITION') {
        return res.status(422).json({ error: 'This status transition is not allowed.' });
      }
      console.error('Error updating user status:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateUserRole(req: Request, res: Response): Promise<Response> {
    const userId: string = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const actorId = getAuthUserId(req);
    const { role }: UpdateUserRoleDto = req.body;
    const validRoles = ['STUDENT', 'ADMIN', 'INSTITUTION'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Invalid role value.' });
    }

    try {
      const updatedUser = await userService.updateUserRole(userId, { role }, actorId);
      return res.status(200).json(updatedUser);
    } catch (error) {
      console.error('Error updating user role:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}
