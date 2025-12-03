// routes/shiftRoutes.js - UPDATED WITH RECORDS ROUTES
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
  cancelShift,
  getYesterdayReadings,
  createManualShiftEntry,
} from "../controllers/shiftController.js";
import {
  getShiftRecords,
  addShiftRecord,
  updateShiftRecordsBulk
} from "../controllers/recordController.js";
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

// RECORDS ROUTES
router.get("/:shiftId/records", getShiftRecords);
router.post("/:shiftId/records", addShiftRecord);
router.put("/:shiftId/records/bulk", updateShiftRecordsBulk);

// PARAMETERIZED ROUTES LAST
router.get("/", getShifts);
router.get("/nozzleman/:nozzlemanId", getShiftsByNozzleman);
router.get("/:id", getShift);
router.put("/:id", updateShift);
router.post("/manual-entry", authorize("supervisor", "admin"), createManualShiftEntry);
router.get("/yesterday-readings/:nozzlemanId", getYesterdayReadings);

export default router;