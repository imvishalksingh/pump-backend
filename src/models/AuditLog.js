// models/AuditLog.js - UPDATED
import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
  action: {
    type: String,
    enum: ["approved", "rejected", "verified", "flagged"],
    required: true
  },
  entityType: {
    type: String,
    enum: ["Shift", "CashEntry", "Stock", "Sales", "StockAdjustment"], // ✅ ADDED "StockAdjustment"
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  entityName: {
    type: String,
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  notes: {
    type: String
  },
  details: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

export default mongoose.model("AuditLog", auditLogSchema);