import express from "express";
import { 
  updatePrice, 
  priceHistory,
  getAllPriceHistory,
  getCurrentPrices,
  approvePriceChange,
  rejectPriceChange
} from "../controllers/priceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Price management routes
router.put("/update-price/:id", updatePrice);
router.get("/history/:id", priceHistory);
router.get("/price-history/all", getAllPriceHistory);
router.get("/price-history/current", getCurrentPrices);
router.put("/approve/:id", approvePriceChange);
router.put("/reject/:id", rejectPriceChange);

export default router;