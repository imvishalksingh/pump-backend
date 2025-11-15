// models/CashHandover.js
import mongoose from "mongoose";

const cashHandoverSchema = mongoose.Schema(
  {
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true,
    },
    nozzleman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzleman",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Verified", "Rejected"],
      default: "Pending",
    },
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    verifiedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const CashHandover = mongoose.model("CashHandover", cashHandoverSchema);
export default CashHandover;