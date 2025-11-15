import mongoose from "mongoose";

const expenseSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    enum: ['Maintenance', 'Salary', 'Utilities', 'Supplies', 'Other']
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
  }
}, { 
  timestamps: true 
});

export default mongoose.model("Expense", expenseSchema);