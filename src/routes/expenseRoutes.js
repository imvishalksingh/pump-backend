// routes/expenseRoutes.js - UPDATED WITH SYNC ROUTE
import express from "express";
import { 
  getExpenses, 
  getExpense, 
  createExpense, 
  updateExpense, 
  deleteExpense,
  approveExpense,
  rejectExpense,
  syncShiftExpense,  // NEW IMPORT
} from "../controllers/expenseController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Apply protection to all routes
router.use(protect);

// GET routes
router.get("/", getExpenses);
router.get("/:id", getExpense);

// POST routes
router.post("/", createExpense);
router.post("/sync", syncShiftExpense);  // NEW SYNC ROUTE

// PUT routes
router.put("/:id", updateExpense);
router.put("/:id/approve", approveExpense);
router.put("/:id/reject", rejectExpense);

// DELETE routes
router.delete("/:id", deleteExpense);

export default router;