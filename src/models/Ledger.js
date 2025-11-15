// models/Ledger.js
import mongoose from "mongoose";

const ledgerSchema = mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    type: {
      type: String,
      enum: ["Sale", "Payment", "Adjustment"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    balance: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    reference: {
      type: String, // Could be sale ID, payment ID, etc.
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

const Ledger = mongoose.model("Ledger", ledgerSchema);
export default Ledger;