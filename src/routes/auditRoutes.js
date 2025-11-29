// routes/auditRoutes.js - Make sure all routes are included
import express from 'express';
import {
  getAuditorStats,
  getPendingShifts,
  approveShift,
  getPendingCashEntries,
  verifyCashEntry,
  getStockDiscrepancies,
  approveStockAdjustment,
  getPendingSalesAudits,
  verifySalesTransaction,
  getAuditReport,
  createAuditSignOff,
  getTankLevelsForAudit, 
  adjustTankStock,
} from '../controllers/auditController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Apply authentication and authorization to all routes
router.use(protect);
router.use(authorize('auditor', 'admin'));

// Dashboard stats
router.get('/stats', getAuditorStats);

// Shift audit routes
router.get('/shifts/pending', getPendingShifts);
router.post('/shifts/:id/approve', approveShift);

// Cash audit routes
router.get('/cash/pending', getPendingCashEntries);
router.post('/cash/:id/verify', verifyCashEntry);

// Stock audit routes
router.get('/stock/discrepancies', getStockDiscrepancies);
router.post('/stock/adjustments/:id/approve', approveStockAdjustment);

// Sales audit routes
router.get('/sales/pending', getPendingSalesAudits);
router.post('/sales/:id/verify', verifySalesTransaction);
router.get("/tank-levels", getTankLevelsForAudit);
router.post("/tanks/:id/adjust", adjustTankStock);

// Audit report routes
// router.get('/report', getAuditReport);
// router.post('/report/sign-off', createAuditSignOff);

export default router;