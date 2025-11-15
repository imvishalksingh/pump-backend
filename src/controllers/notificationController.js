// controllers/notificationController.js
import Notification from "../models/Notification.js";
import asyncHandler from "express-async-handler";

// @desc    Get all notifications
// @route   GET /api/notifications
// @access  Private
export const getNotifications = asyncHandler(async (req, res) => {
  const { type, status, priority } = req.query;
  
  let query = {};
  if (type && type !== "all") query.type = type;
  if (status && status !== "all") query.status = status;
  if (priority && priority !== "all") query.priority = priority;

  const notifications = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(100);

  res.json(notifications);
});

// @desc    Mark notification as read
// @route   PUT /api/notifications/:id/read
// @access  Private
export const markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);
  
  if (!notification) {
    res.status(404);
    throw new Error("Notification not found");
  }

  notification.status = "Read";
  await notification.save();

  res.json({ message: "Notification marked as read", notification });
});

// @desc    Mark all notifications as read
// @route   PUT /api/notifications/read-all
// @access  Private
export const markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { status: "Unread" },
    { status: "Read" }
  );

  res.json({ message: "All notifications marked as read" });
});

// @desc    Get notification statistics
// @route   GET /api/notifications/stats
// @access  Private
export const getNotificationStats = asyncHandler(async (req, res) => {
  const total = await Notification.countDocuments();
  const unread = await Notification.countDocuments({ status: "Unread" });
  const highPriority = await Notification.countDocuments({ priority: "High", status: "Unread" });

  res.json({
    total,
    unread,
    highPriority
  });
});