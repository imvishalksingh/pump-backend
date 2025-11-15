import mongoose from "mongoose";

const nozzlemanSchema = mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    mobile: {
      type: String,
      required: true,
    },
    shift: {
      type: String,
      enum: ["Morning", "Evening", "Night"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "On Leave"],
      default: "Active",
    },
    assignedPump: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pump",
    },
    assignedNozzles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle",
    }],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalShifts: {
      type: Number,
      default: 0,
    },
    totalFuelDispensed: {
      type: Number,
      default: 0,
    },
    averageCashHandled: {
      type: Number,
      default: 0,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Nozzleman = mongoose.model("Nozzleman", nozzlemanSchema);
export default Nozzleman;