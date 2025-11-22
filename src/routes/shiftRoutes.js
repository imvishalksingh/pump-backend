// routes/shiftRoutes.js - COMPLETE VERSION
import express from "express";
import {
  getShifts,
  getShift,
  startShift,
  endShift,
  updateShift,
  getShiftStats,
  getAssignedNozzles,
  verifyShift,
  getShiftsByNozzleman,
  getActiveShift,
  cancelShift
} from "../controllers/shiftController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

// SPECIFIC ROUTES FIRST
router.get("/stats", getShiftStats);
router.get("/assigned-nozzles", authorize("nozzleman"), getAssignedNozzles);
router.get("/active/nozzleman", authorize("nozzleman"), getActiveShift);
router.post("/start", startShift);
router.put("/end/:id", endShift);
router.put("/verify/:id", authorize("supervisor", "admin"), verifyShift);
router.put("/cancel/:id", authorize("supervisor", "admin"), cancelShift);

// PARAMETERIZED ROUTES LAST
router.get("/", getShifts);
router.get("/nozzleman/:nozzlemanId", getShiftsByNozzleman);
router.get("/:id", getShift);
router.put("/:id", updateShift);

export default router;