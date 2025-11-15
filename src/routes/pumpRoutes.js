import express from "express";
import { getPumps, getPump, createPump, updatePump, deletePump } from "../controllers/pumpController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getPumps);
router.get("/:id", getPump);
router.post("/", createPump);
router.put("/:id", updatePump);
router.delete("/:id", deletePump);

export default router;
