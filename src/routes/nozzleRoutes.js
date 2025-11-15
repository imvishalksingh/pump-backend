import express from "express";
import {
  getNozzles,
  getNozzle,
  createNozzle,
  updateNozzle,
  deleteNozzle,
  updateNozzleReading,
} from "../controllers/nozzleController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getNozzles);
router.get("/:id", getNozzle);
router.post("/", createNozzle);
router.put("/:id", updateNozzle);
router.delete("/:id", deleteNozzle);
router.patch("/:id/reading", updateNozzleReading);

export default router;