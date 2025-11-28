// routes/tankConfigRoutes.js
import express from "express";
import multer from "multer";
import {
  createTankConfig,
  getTankConfigs,
  getTankConfig,
  updateTankConfig,
  deleteTankConfig,
  calculateDipQuantity,
  initializeTankStocks,
  getTankStatus
} from "../controllers/tankConfigController.js";
import { protect, authorize } from "../middleware/authMiddleware.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(protect);

// Public routes (all authenticated users)
router.get("/", getTankConfigs);
router.get("/:id", getTankConfig);
router.post("/calculate", calculateDipQuantity);
router.get("/debug/status", getTankStatus);

// Admin-only routes
router.post("/", authorize("admin"), createTankConfig);
router.put("/:id", authorize("admin"), updateTankConfig);
router.delete("/:id", authorize("admin"), deleteTankConfig);
router.post("/initialize-stocks", authorize("admin"), initializeTankStocks);

export default router;