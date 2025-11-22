// routes/tankConfigRoutes.js - UPDATED
import express from "express";
import multer from "multer";
import {
  createTankConfig,
  getTankConfigs,
  getTankConfig,
  updateTankConfig,
  deleteTankConfig,
  calculateDipQuantity,
  uploadCalibrationCSV,
  addCalibrationPoint
} from "../controllers/tankConfigController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

// Public routes (all authenticated users)
router.get("/", getTankConfigs);
router.get("/:id", getTankConfig);
router.post("/calculate", calculateDipQuantity);

// Admin-only routes
router.post("/", authorize("admin"), createTankConfig);
router.put("/:id", authorize("admin"), updateTankConfig);
router.delete("/:id", authorize("admin"), deleteTankConfig);

// Calibration management routes
router.post("/:id/upload-calibration", authorize("admin"), upload.single('csvFile'), uploadCalibrationCSV);
router.post("/:id/calibration", authorize("admin"), addCalibrationPoint);

export default router;