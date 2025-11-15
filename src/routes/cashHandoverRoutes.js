// routes/cashHandoverRoutes.js
import express from "express";
import {
  getCashHandovers,
  verifyCashHandover,
  rejectCashHandover,
} from "../controllers/cashHandoverController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.get("/", getCashHandovers);
router.put("/:id/verify", verifyCashHandover);
router.put("/:id/reject", rejectCashHandover);

export default router;