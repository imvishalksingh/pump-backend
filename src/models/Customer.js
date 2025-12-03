// models/Customer.js - COMPLETE REAL-WORLD VERSION
import mongoose from "mongoose";

const customerSchema = mongoose.Schema(
  {
    // Basic Information
    customerId: {
      type: String,
      required: true,
      unique: true,
      default: () => `CUST-${Date.now().toString().slice(-6)}`
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    businessName: {
      type: String,
      trim: true
    },
    customerType: {
      type: String,
      enum: ["Corporate", "Transport", "Fleet", "Individual", "Government"],
      default: "Corporate"
    },
    
    // Contact Information
    mobile: {
      type: String,
      required: true,
      unique: true,
      match: [/^[0-9]{10}$/, "Please enter a valid 10-digit mobile number"]
    },
    alternateMobile: {
      type: String
    },
    email: {
      type: String,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, "Please enter a valid email"]
    },
    
    // Business Details
    gstNumber: {
      type: String,
      uppercase: true
    },
    panNumber: {
      type: String,
      uppercase: true
    },
    address: {
      street: String,
      city: String,
      state: String,
      pincode: String,
      landmark: String
    },
    
    // Credit Information
    creditLimit: {
      type: Number,
      required: true,
      min: 0,
      default: 0
    },
    currentBalance: {
      type: Number,
      default: 0,
      min: 0
    },
    availableCredit: {
      type: Number,
      default: function() {
        return this.creditLimit - this.currentBalance;
      }
    },
    creditPeriod: {
      type: Number,
      default: 30, // days
      min: 7,
      max: 90
    },
    
    // Fuel Preferences
    allowedFuelTypes: [{
      type: String,
      enum: ["Petrol", "Diesel", "CNG"]
    }],
    assignedNozzles: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Nozzle"
    }],
    rateType: {
      type: String,
      enum: ["Regular", "Special", "Corporate"],
      default: "Regular"
    },
    specialRate: {
      type: Number
    },
    
    // Financial Settings
    paymentTerms: {
      type: String,
      enum: ["Net 30", "Net 45", "Net 60", "Weekly", "Monthly"],
      default: "Net 30"
    },
    taxExempted: {
      type: Boolean,
      default: false
    },
    taxPercentage: {
      type: Number,
      default: 18 // GST percentage
    },
    
    // Status & Tracking
    status: {
      type: String,
      enum: ["Active", "Suspended", "Blocked", "Inactive", "Under Review"],
      default: "Active"
    },
    registrationDate: {
      type: Date,
      default: Date.now
    },
    lastTransactionDate: {
      type: Date
    },
    lastPaymentDate: {
      type: Date
    },
    
    // Documents
    documents: [{
      documentType: String,
      documentNumber: String,
      fileUrl: String,
      uploadedAt: Date,
      verified: {
        type: Boolean,
        default: false
      }
    }],
    
    // References
    referenceName: String,
    referenceMobile: String,
    
    // Settings
    autoCreditLimitIncrease: {
      type: Boolean,
      default: false
    },
    sendSMSAlerts: {
      type: Boolean,
      default: true
    },
    sendEmailStatements: {
      type: Boolean,
      default: true
    },
    
    // Audit
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    },
    approvalDate: Date,
    
    // Notes
    notes: String,
    internalNotes: String,
    
    // Risk Score (AI/ML can update this)
    riskScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 50
    },
    paymentScore: {
      type: Number,
      min: 0,
      max: 10,
      default: 5
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual for overdue amount
customerSchema.virtual("overdueAmount").get(function() {
  // This would be calculated from ledger entries
  return 0;
});

// Virtual for days since last payment
customerSchema.virtual("daysSinceLastPayment").get(function() {
  if (!this.lastPaymentDate) return null;
  const diffTime = Math.abs(new Date() - this.lastPaymentDate);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Indexes for performance
customerSchema.index({ mobile: 1 });
customerSchema.index({ customerId: 1 });
customerSchema.index({ status: 1 });
customerSchema.index({ createdBy: 1 });
customerSchema.index({ currentBalance: -1 });
customerSchema.index({ "address.city": 1 });
customerSchema.index({ customerType: 1 });
customerSchema.index({ createdAt: -1 });

// Pre-save middleware to calculate available credit
customerSchema.pre("save", function(next) {
  this.availableCredit = Math.max(0, this.creditLimit - this.currentBalance);
  next();
});

// Method to check if customer can make purchase
customerSchema.methods.canPurchase = function(amount) {
  return this.availableCredit >= amount && this.status === "Active";
};

// Method to get customer summary
customerSchema.methods.getSummary = function() {
  return {
    customerId: this.customerId,
    name: this.name,
    businessName: this.businessName,
    mobile: this.mobile,
    creditLimit: this.creditLimit,
    currentBalance: this.currentBalance,
    availableCredit: this.availableCredit,
    status: this.status,
    lastTransactionDate: this.lastTransactionDate,
    lastPaymentDate: this.lastPaymentDate
  };
};

const Customer = mongoose.model("Customer", customerSchema);
export default Customer;