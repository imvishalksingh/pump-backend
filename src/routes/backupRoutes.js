import express from "express";
import {
  createBackup,
  getBackupStatus,
  listBackups,
  downloadBackup
} from "../controllers/backupController.js";
import {
  listBackupsForRestore,
  getBackupInfo,
  restoreBackup,
  validateBackup
} from "../controllers/restoreController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// 🔓 PUBLIC TEST ENDPOINT (add this BEFORE the protect middleware)
router.get("/public-status", async (req, res) => {
  console.log('🔓 [PUBLIC] Public status endpoint called');
  try {
    const backupService = await import("../utils/backupService.js");
    const status = await backupService.default.getBackupStatus();
    
    res.status(200).json({
      success: true,
      message: "Public status endpoint",
      data: status
    });
  } catch (error) {
    console.error('❌ [PUBLIC] Public status error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Apply protection to all other backup routes
router.use(protect);

// Backup routes (protected)
router.get("/status", getBackupStatus);
router.get("/list", listBackups);
router.post("/create", createBackup);
router.get("/download/:backupName", downloadBackup);

// Restore routes (protected)
router.get("/restore/list", listBackupsForRestore);
router.get("/restore/info/:backupName", getBackupInfo);
router.post("/restore/:backupName", restoreBackup);
router.get("/restore/validate/:backupName", validateBackup);

export default router;