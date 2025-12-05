// routes/nozzlemanSalesRoutes.js - UPDATED
import express from "express";
import {
  getNozzlemanSales,
  getNozzlemanSalesDetail,
} from "../controllers/nozzlemanSalesController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.use(protect);

router.route("/")
  .get(getNozzlemanSales);


router.route("/:nozzlemanId")
  .get(getNozzlemanSalesDetail);

export default router;