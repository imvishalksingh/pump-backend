import express from "express";
import {
  getNozzlemen,
  getNozzleman,
  createNozzleman,
  updateNozzleman,
  deleteNozzleman,
} from "../controllers/nozzlemanController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getNozzlemen);
router.get("/:id", getNozzleman);
router.post("/", createNozzleman);
router.put("/:id", updateNozzleman);
router.delete("/:id", deleteNozzleman);

export default router;