// models/Sale.js - UPDATED WITH TANK DEDUCTION
import mongoose from "mongoose";

const saleSchema = mongoose.Schema(
  {
    transactionId: {
      type: String,
      required: true,
      unique: true,
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    nozzle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle",
      required: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
    },
    liters: {
      type: Number,
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    totalAmount: {
      type: Number,
      required: true,
    },
    paymentMode: {
      type: String,
      enum: ["Cash", "UPI", "Card", "Credit"],
      default: "Cash",
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // NEW FIELDS FOR TANK DEDUCTION
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG"],
      required: true
    },
    tankDeducted: {
      type: Boolean,
      default: false
    },
    tankReference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TankConfig"
    },
    deductionNotes: {
      type: String
    }
  },
  {
    timestamps: true,
    strictPopulate: false
  }
);

const Sale = mongoose.model("Sale", saleSchema);
export default Sale;