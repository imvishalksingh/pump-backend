import mongoose from "mongoose";

const shiftSchema = mongoose.Schema(
  {
    shiftId: {
      type: String,
      required: true,
      unique: true,
    },
    assignment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      // required: true,
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
    // Reading proof images
    startReadingImage: {
      type: String, // URL to stored image
      required: true,
    },
    endReadingImage: {
      type: String, // URL to stored image
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
    // Audit fields
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
    // Sales breakdown
    phonePeSales: {
      type: Number,
      default: 0,
    },
    posSales: {
      type: Number,
      default: 0,
    },
    otpSales: {
      type: Number,
      default: 0,
    },
    creditSales: {
      type: Number,
      default: 0,
    },
     isManualEntry: {
      type: Boolean,
      default: false
    },
    expenses: {
      type: Number,
      default: 0,
    },
    cashDeposit: {
      type: Number,
      default: 0,
    },
    meterReadingHSD: {
      opening: { type: Number, default: 0 },
      closing: { type: Number, default: 0 }
    },
    meterReadingPetrol: {
      opening: { type: Number, default: 0 },
      closing: { type: Number, default: 0 }
    },
    cashInHand: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Shift = mongoose.model("Shift", shiftSchema);
export default Shift;