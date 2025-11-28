// models/TankConfig.js - ENSURE proper defaults
import mongoose from "mongoose";

const tankConfigSchema = new mongoose.Schema({
  tankName: {
    type: String,
    required: true,
    unique: true
  },
  product: {
    type: String,
    required: true,
    enum: ["MS", "HSD"]
  },
  capacity: {
    type: Number,
    required: true
  },
  // ENSURE THESE FIELDS HAVE PROPER DEFAULTS
  currentStock: {
    type: Number,
    default: 0, // This ensures it starts at 0
    min: 0
  },
  currentLevel: {
    type: Number,
    default: 0, // This ensures it starts at 0%
    min: 0,
    max: 100
  },
  alert: {
    type: Boolean,
    default: false
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  tankShape: {
    type: String,
    enum: ["horizontal_cylinder", "vertical_cylinder", "rectangular"],
    default: "horizontal_cylinder"
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastCalibrationBy: {
    type: String,
    default: "System"
  }
}, {
  timestamps: true
});

export default mongoose.model("TankConfig", tankConfigSchema);