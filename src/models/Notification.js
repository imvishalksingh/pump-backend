// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ["Stock", "System", "Price", "Shift"]
  },
  description: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    required: true,
    enum: ["Low", "Medium", "High"],
    default: "Medium"
  },
  status: {
    type: String,
    required: true,
    enum: ["Read", "Unread"],
    default: "Unread"
  }
}, {
  timestamps: true
});

const Notification = mongoose.model("Notification", notificationSchema);
export default Notification;