import express from "express";
import {
  getNozzlemanDashboard,
  getNozzlemanShifts
} from "../controllers/nozzlemanDashboardController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);
router.use(authorize("nozzleman")); // Only nozzlemen can access these routes

router.get("/dashboard", getNozzlemanDashboard);
router.get("/shifts", getNozzlemanShifts);

export default router;