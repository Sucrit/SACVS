import { Router } from 'express';
import { UserController } from '../controller/user.controller';
import { healthCheck } from '../controller/health.controller';
import { requireAuth } from '@clerk/express';

const router = Router();

// public
router.get('/health', healthCheck);
// private
router.post('', requireAuth(), UserController.createUser);
router.get('', requireAuth(), UserController.getUsers);
router.delete('/:id', requireAuth(), UserController.deleteUser);

export default router;
