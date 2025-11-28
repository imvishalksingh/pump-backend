// routes/nozzlemanSalesRoutes.js - UPDATED
import express from "express";
import {
  getNozzlemanSales,
  getNozzlemanSalesDetail,
  createManualEntry
} from "../controllers/nozzlemanSalesController.js";
import { protect } from "../middleware/authMiddleware.js";
import { authorize } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getNozzlemanSales);

router.route("/manual-entry")
  .post(authorize("admin", "supervisor"), createManualEntry);

router.route("/:nozzlemanId")
  .get(getNozzlemanSalesDetail);

export default router;