// routes/stockRoutes.js - UPDATED
import express from "express";
import {
  createFuelStock,
  getFuelStocks,
  getFuelStock,
  updateFuelStock,
  deleteFuelStock,
  getLatestStocks,
  getFuelStockStats,
  createStockAdjustment,
  getStockAdjustments,
  getAdjustmentStats
} from "../controllers/fuelStockController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Fuel stock routes
router.get("/", getFuelStocks);
router.get("/latest", getLatestStocks);
router.get("/stats", getFuelStockStats);
router.get("/:id", getFuelStock);
router.post("/", createFuelStock);
router.put("/:id", updateFuelStock);
router.delete("/:id", deleteFuelStock);

// ✅ UPDATED STOCK ADJUSTMENT ROUTES
router.post("/adjustment", createStockAdjustment);
router.get("/adjustments/history", getStockAdjustments); // Now includes status filter
router.get("/adjustments/stats", getAdjustmentStats);

export default router;