// models/Ledger.js - COMPLETE REAL-WORLD VERSION
import mongoose from "mongoose";

const ledgerSchema = mongoose.Schema(
  {
    // Core Information
    ledgerId: {
      type: String,
      required: true,
      unique: true,
      default: () => `LED-${Date.now().toString().slice(-8)}`
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
      index: true
    },
    
    // Transaction Details
    transactionType: {
      type: String,
      enum: [
        "Sale",           // Fuel sale on credit
        "Payment",        // Payment received
        "Adjustment",     // Manual adjustment
        "Credit Note",    // Return/refund
        "Debit Note",     // Additional charge
        "Interest",       // Late payment interest
        "Write Off",      // Bad debt write off
        "Opening Balance" // Initial balance
      ],
      required: true
    },
    
    // Amount Information
    amount: {
      type: Number,
      required: true
    },
    taxAmount: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    balanceAfter: {
      type: Number,
      required: true
    },
    
    // Reference Information
    referenceNumber: {
      type: String
    },
    referenceType: {
      type: String,
      enum: ["Bill", "Invoice", "Receipt", "Shift", "Payment", "Adjustment"]
    },
    
    // Sale Specific Fields
    shift: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Shift"
    },
    nozzle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle"
    },
    fuelType: {
      type: String,
      enum: ["Petrol", "Diesel", "CNG"]
    },
    quantity: {
      type: Number
    },
    rate: {
      type: Number
    },
    vehicleNumber: {
      type: String
    },
    billNumber: {
      type: String
    },
    
    // Payment Specific Fields
    paymentMode: {
      type: String,
      enum: ["Cash", "Cheque", "Bank Transfer", "UPI", "Credit Card", "Debit Card", "DD"]
    },
    bankName: {
      type: String
    },
    chequeNumber: {
      type: String
    },
    transactionId: {
      type: String
    },
    paymentDate: {
      type: Date
    },
    clearanceDate: {
      type: Date
    },
    isCleared: {
      type: Boolean,
      default: false
    },
    
    // Adjustment Specific Fields
    adjustmentType: {
      type: String,
      enum: ["Increase", "Decrease", "Correction"]
    },
    reason: {
      type: String
    },
    
    // Date Information
    transactionDate: {
      type: Date,
      required: true,
      default: Date.now
    },
    dueDate: {
      type: Date
    },
    
    // Description
    description: {
      type: String,
      required: true
    },
    detailedDescription: {
      type: String
    },
    
    // Status
    status: {
      type: String,
      enum: ["Pending", "Completed", "Cancelled", "Reversed", "Disputed"],
      default: "Completed"
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
      fileType: String,
      uploadedAt: Date
    }],
    
    // Notes
    notes: String,
    internalNotes: String,
    
    // Reconciliation
    reconciled: {
      type: Boolean,
      default: false
    },
    reconciledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    reconciledAt: {
      type: Date
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for overdue days
ledgerSchema.virtual("overdueDays").get(function() {
  if (!this.dueDate || this.transactionType !== "Sale") return 0;
  const today = new Date();
  const due = new Date(this.dueDate);
  if (today > due) {
    return Math.ceil((today - due) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

// Virtual for age group
ledgerSchema.virtual("ageGroup").get(function() {
  if (this.transactionType !== "Sale") return null;
  
  const age = this.overdueDays;
  if (age === 0) return "Current";
  if (age <= 30) return "1-30 Days";
  if (age <= 60) return "31-60 Days";
  if (age <= 90) return "61-90 Days";
  return "Over 90 Days";
});

// Indexes for performance
ledgerSchema.index({ customer: 1, transactionDate: -1 });
ledgerSchema.index({ transactionType: 1 });
ledgerSchema.index({ status: 1 });
ledgerSchema.index({ referenceNumber: 1 });
ledgerSchema.index({ billNumber: 1 });
ledgerSchema.index({ dueDate: 1 });
ledgerSchema.index({ createdBy: 1 });
ledgerSchema.index({ transactionDate: -1 });
ledgerSchema.index({ "attachments.fileType": 1 });

// Pre-save middleware
ledgerSchema.pre("save", async function(next) {
  if (this.isNew) {
    // Auto-generate reference numbers
    if (this.transactionType === "Sale" && !this.billNumber) {
      this.billNumber = `BILL-${Date.now().toString().slice(-6)}`;
    }
    
    if (this.transactionType === "Payment" && !this.referenceNumber) {
      this.referenceNumber = `PAY-${Date.now().toString().slice(-6)}`;
    }
    
    // Set due date for sales
    if (this.transactionType === "Sale") {
      const customer = await mongoose.model("Customer").findById(this.customer);
      if (customer && customer.creditPeriod) {
        const dueDate = new Date(this.transactionDate);
        dueDate.setDate(dueDate.getDate() + customer.creditPeriod);
        this.dueDate = dueDate;
      }
    }
  }
  next();
});

// Static method to get aging report
ledgerSchema.statics.getAgingReport = async function(customerId) {
  const pipeline = [
    {
      $match: {
        customer: mongoose.Types.ObjectId(customerId),
        transactionType: "Sale",
        status: { $ne: "Cancelled" }
      }
    },
    {
      $group: {
        _id: "$ageGroup",
        totalAmount: { $sum: "$balanceAfter" },
        count: { $sum: 1 }
      }
    }
  ];
  
  return await this.aggregate(pipeline);
};

const Ledger = mongoose.model("Ledger", ledgerSchema);
export default Ledger;