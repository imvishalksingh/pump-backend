import mongoose from "mongoose";

const pumpSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG"],
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Maintenance", "Inactive"],
      default: "Active",
    },
    currentReading: {
      type: Number,
      default: 0,
    },
    totalSales: {
      type: Number,
      default: 0,
    },
    lastCalibration: {
      type: Date,
      default: Date.now,
    },
    capacity: {
      type: Number,
    },
    nozzles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle",
    }],
  },
  {
    timestamps: true,
  }
);

const Pump = mongoose.model("Pump", pumpSchema);
export default Pump;