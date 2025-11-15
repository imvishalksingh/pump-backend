// models/Shift.js - UPDATED VERSION
import mongoose from "mongoose";

const shiftSchema = mongoose.Schema(
  {
    shiftId: {
      type: String,
      required: true,
      unique: true,
    },
    nozzleman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzleman",
      required: true,
    },
    pump: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pump",
      required: true,
    },
    nozzle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle",
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
    },
    startReading: {
      type: Number,
      required: true,
    },
    endReading: {
      type: Number,
    },
    fuelDispensed: {
      type: Number,
      default: 0,
    },
    cashCollected: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Active", "Completed", "Pending Approval", "Approved", "Rejected"],
      default: "Active",
    },
    notes: {
      type: String,
    },
    
    // ✅ ADD THESE AUDIT FIELDS:
    auditNotes: {
      type: String,
    },
    auditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    auditedAt: {
      type: Date,
    },
    
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Shift = mongoose.model("Shift", shiftSchema);
export default Shift;