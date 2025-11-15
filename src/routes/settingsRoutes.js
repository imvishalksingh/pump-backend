// routes/settingsRoutes.js
import express from "express";
import { 
  getSettings, 
  updateSettings, 
  resetSettings 
} from "../controllers/settingsController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

// Apply protection and authorization to all routes
router.use(protect);
router.use(authorize("admin"));

// Settings routes
router.get("/", getSettings);
router.put("/", updateSettings);
router.post("/reset", resetSettings);

export default router;