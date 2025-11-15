// models/FuelStock.js
import mongoose from "mongoose";

const fuelStockSchema = new mongoose.Schema({
  product: {
    type: String,
    required: [true, "Product name is required"],
    enum: ["Petrol", "Diesel", "CNG"]
  },
  openingStock: {
    type: Number,
    required: [true, "Opening stock is required"],
    min: 0
  },
  purchases: {
    type: Number,
    required: [true, "Purchase quantity is required"],
    min: 0
  },
  sales: {
    type: Number,
    default: 0,
    min: 0
  },
  closingStock: {
    type: Number,
    min: 0
  },
  capacity: {
    type: Number,
    required: [true, "Tank capacity is required"],
    min: 0
  },
  currentLevel: {
    type: Number,
    min: 0,
    max: 100
  },
  alert: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: Date.now
  },
  rate: {
    type: Number,
    required: [true, "Rate per liter is required"],
    min: 0
  },
  amount: {
    type: Number,
    required: [true, "Total amount is required"],
    min: 0
  },
  supplier: {
    type: String,
    required: [true, "Supplier name is required"]
  },
  invoiceNumber: {
    type: String,
    required: [true, "Invoice number is required"]
  }
}, {
  timestamps: true
});

// Calculate closing stock before saving
fuelStockSchema.pre("save", function(next) {
  this.closingStock = this.openingStock + this.purchases - this.sales;
  this.currentLevel = Math.round((this.closingStock / this.capacity) * 100);
  this.alert = this.currentLevel <= 20; // Alert if below 20%
  next();
});

const FuelStock = mongoose.model("FuelStock", fuelStockSchema);
export default FuelStock;