import express from "express";
import { 
  getExpenses, 
  getExpense, 
  createExpense, 
  updateExpense, 
  deleteExpense,
  approveExpense,
  rejectExpense
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

// PUT routes
router.put("/:id", updateExpense);
router.put("/:id/approve", approveExpense);
router.put("/:id/reject", rejectExpense);

// DELETE routes
router.delete("/:id", deleteExpense);

export default router;