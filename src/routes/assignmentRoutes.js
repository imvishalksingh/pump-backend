import express from "express";
import {
  getAssignments,
  createAssignment,
  removeAssignment,
  updateAssignmentStatus,
} from "../controllers/assignmentController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getAssignments);
router.post("/", createAssignment);
router.delete("/:id", removeAssignment);
router.patch("/:id/status", updateAssignmentStatus);

export default router;