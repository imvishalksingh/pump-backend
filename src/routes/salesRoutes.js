import express from "express";
import { getSales, getSale, createSale, updateSale ,getSaleStats , recordSale , getDetailedSalesStats } from "../controllers/salesController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/stats", getSaleStats);
router.get("/", getSales);
router.get("/:id", getSale);
router.post("/", createSale);
router.put("/:id", updateSale);
// router.get("/stats", getSaleStats);

router.post("/record", recordSale); // Your existing recordSale endpoint
router.get("/detailed-stats", getDetailedSalesStats);

export default router;


