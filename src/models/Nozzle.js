import mongoose from "mongoose";

const nozzleSchema = mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
    },
    pump: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pump",
      required: true,
    },
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Maintenance"],
      default: "Active",
    },
    currentReading: {
      type: Number,
      default: 0,
    },
    totalDispensed: {
      type: Number,
      default: 0,
    },
    lastCalibration: {
      type: Date,
      default: Date.now,
    },
    rate: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Nozzle = mongoose.model("Nozzle", nozzleSchema);
export default Nozzle;