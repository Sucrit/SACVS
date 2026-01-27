import { Router } from 'express';
import { UserController } from '../controller/user.controller';
import { healthCheck } from '../controller/health.controller';
import { requireAuth } from '@clerk/express';

const router = Router();

// public
router.get('/health', healthCheck);
router.post('', UserController.createUser);
// private
router.get('', requireAuth(), UserController.getUsers);
router.delete('/:id', requireAuth(), UserController.deleteUser);

export default router;
