import express from "express";
import { getDailyReport, getShiftReport, getSalesReport, getStockReport, getFinancialReport, getEmployeeReport, getAuditReport } from "../controllers/reportController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/daily", getDailyReport);
router.get("/shift", getShiftReport);
router.get("/sales", getSalesReport);
router.get("/stock", getStockReport);
router.get("/financial", getFinancialReport);
router.get("/employee", getEmployeeReport);
router.get("/audit", getAuditReport);

export default router;
