// models/StockAdjustment.js - UPDATED FOR TANK-CENTRIC
import mongoose from "mongoose";

const stockAdjustmentSchema = new mongoose.Schema({
  // TANK-CENTRIC: Reference specific tank
  tank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TankConfig",
    required: true
  },
  
  adjustmentType: {
    type: String,
    required: [true, "Adjustment type is required"],
    enum: ["addition", "deduction", "calibration", "daily_update"]
  },
  
  quantity: {
    type: Number,
    required: [true, "Quantity is required"]
  },
  
  dipReading: {
    type: Number,
    min: 0
  },
  
  calculatedQuantity: {
    type: Number,
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
  
  // ... rest of the fields remain the same
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

// Add index for tank-based queries
stockAdjustmentSchema.index({ tank: 1, date: -1 });
stockAdjustmentSchema.index({ adjustedBy: 1 });
stockAdjustmentSchema.index({ status: 1 });

const StockAdjustment = mongoose.model("StockAdjustment", stockAdjustmentSchema);
export default StockAdjustment;