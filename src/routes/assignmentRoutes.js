// routes/assignmentRoutes.js - COMPLETE VERSION
import express from "express";
import {
  getAssignments,
  createAssignment,
  removeAssignment,
  updateAssignmentStatus,
  getTodayAssignments,
  createBulkAssignments
} from "../controllers/assignmentController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

// Assignment routes
router.get("/", getAssignments);
router.get("/today/:nozzlemanId", getTodayAssignments);
router.post("/", createAssignment);
router.post("/bulk", createBulkAssignments);
router.delete("/:id", removeAssignment);
router.patch("/:id/status", updateAssignmentStatus);

export default router;