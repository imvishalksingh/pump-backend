// routes/shiftRoutes.js - FIXED VERSION
import express from "express";
import {
  getShifts,
  getShift,
  startShift,
  endShift,
  updateShift,
  getShiftStats
} from "../controllers/shiftController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

// SPECIFIC ROUTES FIRST
router.get("/stats", getShiftStats); // This should come before /:id
router.post("/start", startShift);
router.put("/end/:id", endShift);

// PARAMETERIZED ROUTES LAST
router.get("/", getShifts);
router.get("/:id", getShift);
router.put("/:id", updateShift);

export default router;