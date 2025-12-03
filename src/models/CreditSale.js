// models/CreditSale.js - SPECIFIC FOR CREDIT SALES
import mongoose from "mongoose";

const creditSaleSchema = mongoose.Schema(
  {
    // Core Information
    creditSaleId: {
      type: String,
      required: true,
      unique: true,
      default: () => `CRS-${Date.now().toString().slice(-8)}`
    },
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift",
      required: true
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true
    },
    
    // Sale Details
    nozzle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle",
      required: true
    },
    pump: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Pump",
      required: true
    },
    nozzleman: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzleman",
      required: true
    },
    
    // Fuel Details
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG"],
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.1
    },
    rate: {
      type: Number,
      required: true,
      min: 1
    },
    
    // Amount Calculation
    baseAmount: {
      type: Number,
      required: true
    },
    taxPercentage: {
      type: Number,
      default: 18
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    
    // Vehicle Information
    vehicleNumber: {
      type: String,
      required: true
    },
    vehicleType: {
      type: String,
      enum: ["Truck", "Bus", "Car", "SUV", "Auto", "TwoWheeler", "Other"]
    },
    
    // Bill Information
    billNumber: {
      type: String,
      required: true,
      unique: true
    },
    billDate: {
      type: Date,
      default: Date.now
    },
    
    // Payment Terms
    dueDate: {
      type: Date,
      required: true
    },
    creditPeriod: {
      type: Number,
      default: 30
    },
    
    // Status
    status: {
      type: String,
      enum: [
        "Pending",        // Created but not approved
        "Approved",       // Supervisor approved
        "Billed",         // Bill generated
        "Partially Paid", // Partial payment received
        "Paid",           // Fully paid
        "Overdue",        // Payment delayed
        "Cancelled",      // Sale cancelled
        "Disputed"        // Under dispute
      ],
      default: "Pending"
    },
    
    // Payment Tracking
    paidAmount: {
      type: Number,
      default: 0
    },
    balanceAmount: {
      type: Number,
      default: function() {
        return this.totalAmount - this.paidAmount;
      }
    },
    
    // Verification
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    verifiedAt: {
      type: Date
    },
    
    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    
    // Attachments
    attachments: [{
      fileName: String,
      fileUrl: String,
      fileType: String
    }],
    
    // Notes
    customerNotes: String,
    internalNotes: String,
    
    // Timestamps
    saleTime: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtuals
creditSaleSchema.virtual("isOverdue").get(function() {
  return new Date() > this.dueDate && this.balanceAmount > 0;
});

creditSaleSchema.virtual("overdueDays").get(function() {
  if (!this.isOverdue) return 0;
  return Math.ceil((new Date() - this.dueDate) / (1000 * 60 * 60 * 24));
});

// Pre-save middleware
creditSaleSchema.pre("save", function(next) {
  // Calculate amounts
  this.baseAmount = this.quantity * this.rate;
  this.taxAmount = (this.baseAmount * this.taxPercentage) / 100;
  this.totalAmount = this.baseAmount + this.taxAmount;
  this.balanceAmount = this.totalAmount - this.paidAmount;
  
  // Auto-generate bill number if not provided
  if (!this.billNumber) {
    this.billNumber = `BILL-${Date.now().toString().slice(-8)}`;
  }
  
  // Set due date if not provided
  if (!this.dueDate) {
    const due = new Date(this.billDate || new Date());
    due.setDate(due.getDate() + this.creditPeriod);
    this.dueDate = due;
  }
  
  // Update status based on payment
  if (this.balanceAmount <= 0) {
    this.status = "Paid";
  } else if (this.paidAmount > 0) {
    this.status = "Partially Paid";
  } else if (this.isOverdue) {
    this.status = "Overdue";
  }
  
  next();
});

// Indexes
creditSaleSchema.index({ customer: 1 });
creditSaleSchema.index({ shift: 1 });
creditSaleSchema.index({ billNumber: 1 });
creditSaleSchema.index({ status: 1 });
creditSaleSchema.index({ dueDate: 1 });
creditSaleSchema.index({ vehicleNumber: 1 });
creditSaleSchema.index({ createdAt: -1 });

const CreditSale = mongoose.model("CreditSale", creditSaleSchema);
export default CreditSale;