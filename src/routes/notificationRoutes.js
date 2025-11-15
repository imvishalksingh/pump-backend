// routes/notificationRoutes.js
import express from "express";
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  getNotificationStats
} from "../controllers/notificationController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.route("/")
  .get(protect, getNotifications);

router.route("/stats")
  .get(protect, getNotificationStats);

router.route("/read-all")
  .put(protect, markAllAsRead);

router.route("/:id/read")
  .put(protect, markAsRead);

export default router;