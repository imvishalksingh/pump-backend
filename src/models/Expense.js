// models/Expense.js - UPDATED
import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['Maintenance', 'Salary', 'Utilities', 'Supplies', 'Other', 'ShiftExpense']
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  description: {
    type: String,
    default: ""
  },
  shiftId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Shift",
    default: null
  },
  nozzlemanId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Nozzleman",
    default: null
  },
  shiftReference: {
    type: String
  },
  addedBy: {
    type: String,
    required: true,
    default: "Admin"
  },
  approvedBy: {
    type: String,
    default: null
  },
  date: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending'
  },
  isShiftExpense: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

export default mongoose.model("Expense", expenseSchema);