import express from "express";
import {
  getNozzlemanSales,
  getNozzlemanSalesDetail
} from "../controllers/nozzlemanSalesController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(protect, getNozzlemanSales);

router.route("/:nozzlemanId")
  .get(protect, getNozzlemanSalesDetail);

export default router;