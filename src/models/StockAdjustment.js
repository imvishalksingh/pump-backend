// models/StockAdjustment.js - COMPLETE VERSION
import mongoose from "mongoose";

const stockAdjustmentSchema = new mongoose.Schema({
  product: {
    type: String,
    required: [true, "Product name is required"],
    enum: ["Petrol", "Diesel", "CNG"]
  },
  adjustmentType: {
    type: String,
    required: [true, "Adjustment type is required"],
    enum: ["addition", "deduction", "calibration"]
  },
  quantity: {
    type: Number,
    required: [true, "Quantity is required"],
    min: 0
  },
  reason: {
    type: String,
    required: [true, "Reason is required"],
    trim: true
  },
  previousStock: {
    type: Number,
    required: true
  },
  newStock: {
    type: Number,
    required: true
  },
  adjustedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  // ✅ ADD THESE FIELDS FOR APPROVAL
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  status: {
    type: String,
    enum: ["Pending", "Approved", "Rejected"],
    default: "Pending"
  },
  approvalNotes: {
    type: String
  },
  approvedAt: {
    type: Date
  },
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Add index for better query performance
stockAdjustmentSchema.index({ product: 1, date: -1 });
stockAdjustmentSchema.index({ adjustedBy: 1 });
stockAdjustmentSchema.index({ status: 1 }); // For filtering by status

const StockAdjustment = mongoose.model("StockAdjustment", stockAdjustmentSchema);
export default StockAdjustment;