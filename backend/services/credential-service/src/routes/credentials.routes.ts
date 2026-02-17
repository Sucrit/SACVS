import express from 'express';
import { requireAuth } from '@clerk/express';
import { createCredential, getCredentials, getCredential, getStudentCredentials } from '../controller/credential.controller';
import { healthCheck } from '../controller/health.controller';
import { requireRegistrar } from '../middleware/registrar.middleware';

const router = express.Router();

router.get('/health', healthCheck);
router.post('/', requireAuth(), requireRegistrar, createCredential);
router.get('/student', getStudentCredentials);
router.get('/', getCredentials);
router.get('/:id', getCredential);

export default router;
