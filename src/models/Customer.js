// models/Customer.js
import mongoose from "mongoose";

const customerSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    mobile: {
      type: String,
      required: true,
    },
    email: {
      type: String,
    },
    creditLimit: {
      type: Number,
      required: true,
      default: 0,
    },
    balance: {
      type: Number,
      default: 0,
    },
    address: {
      type: String,
    },
    status: {
      type: String,
      enum: ["Active", "Suspended", "Inactive"],
      default: "Active",
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

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;