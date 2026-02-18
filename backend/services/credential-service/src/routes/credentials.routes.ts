import express from 'express';
import { requireAuth } from '@clerk/express';
import {
  createCredential,
  getCredentials,
  getCredential,
  getStudentCredentials,
  updateCredentialStatus,
  deleteCredential,
  getStats,
  createRequest,
  getMyRequests,
  getRequestById,
  getPendingRequests,
  getAllRequests,
  processRequest,
} from '../controller/credential.controller';
import { healthCheck } from '../controller/health.controller';
import { resolveUser, requireRegistrar, requireStudent, requireAdmin } from '../middleware/registrar.middleware';

const router = express.Router();

// ── Health ────────────────────────────────────────────────────
router.get('/health', healthCheck);

// ── Student: own credentials & requests ──────────────────────
router.get('/my', requireAuth(), resolveUser, requireStudent, getStudentCredentials);
router.post('/requests', requireAuth(), resolveUser, requireStudent, createRequest);
router.get('/requests/my', requireAuth(), resolveUser, requireStudent, getMyRequests);

// ── Registrar / Admin: credential management ─────────────────
router.post('/', requireAuth(), resolveUser, requireRegistrar, createCredential);
router.get('/stats', requireAuth(), resolveUser, requireRegistrar, getStats);
router.get('/requests/pending', requireAuth(), resolveUser, requireRegistrar, getPendingRequests);
router.get('/requests', requireAuth(), resolveUser, requireRegistrar, getAllRequests);
router.get('/requests/:id', requireAuth(), resolveUser, requireRegistrar, getRequestById);
router.patch('/requests/:id/process', requireAuth(), resolveUser, requireRegistrar, processRequest);

// ── Shared authenticated routes ──────────────────────────────
router.get('/', requireAuth(), resolveUser, getCredentials);
router.get('/:id', requireAuth(), resolveUser, getCredential);
router.patch('/:id/status', requireAuth(), resolveUser, requireRegistrar, updateCredentialStatus);
router.delete('/:id', requireAuth(), resolveUser, requireAdmin, deleteCredential);

export default router;
