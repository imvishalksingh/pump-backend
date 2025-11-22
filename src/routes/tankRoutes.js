// routes/tankRoutes.js - FIXED
import express from "express";
import {
  getTankConfigs,
  calculateDipQuantity
} from "../controllers/tankConfigController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Use the same endpoint structure as your frontend expects
router.get("/config", getTankConfigs);
router.post("/config/calculate", calculateDipQuantity);

export default router;