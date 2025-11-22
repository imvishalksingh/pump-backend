// routes/stockRoutes.js - SEPARATE ADJUSTMENT AND PURCHASE ROUTES
import express from "express";
import {
  // Stock routes
  getFuelStocks,
  getFuelStock,
  updateFuelStock,
  deleteFuelStock,
  getLatestStocks,
  getFuelStockStats,
  getStockTransactions,
  
  // Adjustment routes
  createStockAdjustment,
  getStockAdjustments,
  getAdjustmentStats,
  
  // Purchase routes
  createPurchase,
  getPurchases,
  getPurchaseById,
  getTaxSummary,
  updatePurchaseStatus,
  deletePurchase,
  createTankPurchase
} from "../controllers/fuelStockController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// ===== STOCK TRANSACTION ROUTES =====
router.get("/transactions", getStockTransactions);
router.get("/", getFuelStocks);
router.get("/latest", getLatestStocks);
router.get("/stats", getFuelStockStats);
router.get("/:id", getFuelStock);
router.put("/:id", updateFuelStock);
router.delete("/:id", deleteFuelStock);

// ===== STOCK ADJUSTMENT ROUTES =====
// THESE SHOULD BE SEPARATE FROM PURCHASE VALIDATION
router.post("/adjustment", createStockAdjustment);
router.get("/adjustments/history", getStockAdjustments);
router.get("/adjustments/stats", getAdjustmentStats);

// ===== PURCHASE ROUTES =====
// THESE HAVE DIFFERENT VALIDATION (require product, purchaseValue, etc.)
router.post("/purchase", createPurchase);
router.post("/purchase/tank", createTankPurchase);
router.get("/purchases/all", getPurchases);
router.get("/purchases/tax/summary", getTaxSummary);
router.get("/purchases/:id", getPurchaseById);
router.put("/purchases/:id/status", updatePurchaseStatus);
router.delete("/purchases/:id", deletePurchase);

export default router;