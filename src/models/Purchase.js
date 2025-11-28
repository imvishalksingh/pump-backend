// models/Purchase.js - UPDATED WITH FUELSTOCK INTEGRATION
import mongoose from "mongoose";

const purchaseSchema = new mongoose.Schema({
  purchaseType: {
    type: String,
    required: [true, "Purchase type is required"],
    enum: ["fuel", "lube", "fixed-asset"]
  },
  
  // Common fields for all purchase types
  supplier: {
    type: String,
    required: [true, "Supplier name is required"],
    trim: true
  },
  invoiceNumber: {
    type: String,
    required: [true, "Invoice number is required"],
    unique: true,
    trim: true
  },
  invoiceDate: {
    type: Date,
    required: [true, "Invoice date is required"]
  },
  totalValue: {
    type: Number,
    required: [true, "Total value is required"],
    min: 0
  },
  
  // Fuel Purchase specific fields (VAT based)
  product: {
    type: String,
    enum: ["MS", "HSD"]
  },
  tank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TankConfig",
    required: function() { return this.purchaseType === "fuel"; }
  },
  purchaseQuantity: {
    type: Number,
    min: 0,
    required: function() { return this.purchaseType === "fuel"; }
  },
  purchaseValue: {
    type: Number,
    min: 0,
    required: function() { return this.purchaseType === "fuel"; }
  },
  ratePerLiter: {
    type: Number,
    min: 0,
    required: function() { return this.purchaseType === "fuel"; }
  },
  vehicleNumber: {
    type: String,
    trim: true
  },
  density: {
    type: Number,
    min: 0
  },
  
  // Tax breakdown fields
  vat: {
    type: Number,
    default: 0,
    min: 0
  },
  otherCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // GST breakdown fields (for Lube and Fixed Assets)
  taxableValue: {
    type: Number,
    min: 0
  },
  cgst: {
    type: Number,
    default: 0,
    min: 0
  },
  sgst: {
    type: Number,
    default: 0,
    min: 0
  },
  igst: {
    type: Number,
    default: 0,
    min: 0
  },
  discount: {
    type: Number,
    default: 0,
    min: 0
  },
  
  // Fixed Asset specific fields
  assetName: {
    type: String,
    trim: true
  },
  assetCategory: {
    type: String,
    enum: ["machinery", "equipment", "vehicle", "furniture", "computer", "other"]
  },
  assetDescription: {
    type: String,
    trim: true
  },
  
  // GST Filing specific fields
  gstInvoice: {
    type: Boolean,
    default: false
  },
  hsnCode: {
    type: String,
    trim: true
  },
  placeOfSupply: {
    type: String,
    trim: true
  },
  
  // Status fields
  status: {
    type: String,
    enum: ["pending", "approved", "rejected", "completed"],
    default: "completed"
  },
  
  // Linked FuelStock transaction (for fuel purchases)
  fuelStockEntry: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "FuelStock"
  },
  
  // Audit fields
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Virtual for GST total (CGST + SGST + IGST)
purchaseSchema.virtual("gstTotal").get(function() {
  return (this.cgst || 0) + (this.sgst || 0) + (this.igst || 0);
});

// Virtual for net amount before tax
purchaseSchema.virtual("netAmount").get(function() {
  if (this.purchaseType === "fuel") {
    return this.purchaseValue || 0;
  } else {
    return this.taxableValue || 0;
  }
});

// Pre-save middleware to calculate total value if not provided
purchaseSchema.pre("save", function(next) {
  // Only validate fuel purchases with tank reference
  if (this.purchaseType === "fuel" && this.tank) {
    // Basic validation - ensure purchaseQuantity is positive
    if (this.purchaseQuantity <= 0) {
      return next(new Error("Purchase quantity must be greater than 0"));
    }
  }
  next();
});


// Instance method to get tax summary
purchaseSchema.methods.getTaxSummary = function() {
  if (this.purchaseType === "fuel") {
    return {
      type: "VAT",
      taxableValue: this.purchaseValue,
      taxAmount: this.vat,
      otherCharges: this.otherCharges,
      totalValue: this.totalValue
    };
  } else {
    return {
      type: "GST",
      taxableValue: this.taxableValue,
      cgst: this.cgst,
      sgst: this.sgst,
      igst: this.igst,
      discount: this.discount,
      gstTotal: this.gstTotal,
      totalValue: this.totalValue
    };
  }
};

// Static method to get purchases by type and date range
purchaseSchema.statics.getPurchasesByType = async function(type, startDate, endDate) {
  const query = { purchaseType: type };
  
  if (startDate && endDate) {
    query.invoiceDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }
  
  return this.find(query)
    .populate("tank", "tankName capacity product")
    .populate("fuelStockEntry", "previousStock newStock")
    .populate("recordedBy", "name email")
    .sort({ invoiceDate: -1 });
};

// Static method to get fuel purchases with stock impact
purchaseSchema.statics.getFuelPurchasesWithStock = async function(startDate, endDate) {
  const purchases = await this.find({
    purchaseType: "fuel",
    invoiceDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  })
  .populate("tank", "tankName product capacity currentStock")
  .populate("fuelStockEntry", "previousStock newStock")
  .sort({ invoiceDate: -1 });

  return purchases.map(purchase => ({
    ...purchase.toObject(),
    stockImpact: purchase.fuelStockEntry ? {
      previousStock: purchase.fuelStockEntry.previousStock,
      newStock: purchase.fuelStockEntry.newStock,
      increase: purchase.fuelStockEntry.newStock - purchase.fuelStockEntry.previousStock
    } : null
  }));
};

// Static method to get GST summary for filing
purchaseSchema.statics.getGSTSummary = async function(startDate, endDate) {
  const gstPurchases = await this.find({
    purchaseType: { $in: ["lube", "fixed-asset"] },
    invoiceDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  });

  const summary = {
    totalPurchases: gstPurchases.length,
    totalTaxableValue: 0,
    totalCGST: 0,
    totalSGST: 0,
    totalIGST: 0,
    totalDiscount: 0,
    totalValue: 0,
    byType: {
      lube: { count: 0, taxableValue: 0, taxAmount: 0 },
      "fixed-asset": { count: 0, taxableValue: 0, taxAmount: 0 }
    }
  };

  gstPurchases.forEach(purchase => {
    summary.totalTaxableValue += purchase.taxableValue || 0;
    summary.totalCGST += purchase.cgst || 0;
    summary.totalSGST += purchase.sgst || 0;
    summary.totalIGST += purchase.igst || 0;
    summary.totalDiscount += purchase.discount || 0;
    summary.totalValue += purchase.totalValue || 0;

    if (summary.byType[purchase.purchaseType]) {
      summary.byType[purchase.purchaseType].count++;
      summary.byType[purchase.purchaseType].taxableValue += purchase.taxableValue || 0;
      summary.byType[purchase.purchaseType].taxAmount += (purchase.cgst || 0) + (purchase.sgst || 0) + (purchase.igst || 0);
    }
  });

  return summary;
};

// Static method to get VAT summary for filing
purchaseSchema.statics.getVATSummary = async function(startDate, endDate) {
  const vatPurchases = await this.find({
    purchaseType: "fuel",
    invoiceDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  });

  const summary = {
    totalPurchases: vatPurchases.length,
    totalPurchaseValue: 0,
    totalVAT: 0,
    totalOtherCharges: 0,
    totalValue: 0,
    totalQuantity: 0,
    byProduct: {
      MS: { count: 0, purchaseValue: 0, vat: 0, quantity: 0 },
      HSD: { count: 0, purchaseValue: 0, vat: 0, quantity: 0 }
    }
  };

  vatPurchases.forEach(purchase => {
    summary.totalPurchaseValue += purchase.purchaseValue || 0;
    summary.totalVAT += purchase.vat || 0;
    summary.totalOtherCharges += purchase.otherCharges || 0;
    summary.totalValue += purchase.totalValue || 0;
    summary.totalQuantity += purchase.purchaseQuantity || 0;

    if (summary.byProduct[purchase.product]) {
      summary.byProduct[purchase.product].count++;
      summary.byProduct[purchase.product].purchaseValue += purchase.purchaseValue || 0;
      summary.byProduct[purchase.product].vat += purchase.vat || 0;
      summary.byProduct[purchase.product].quantity += purchase.purchaseQuantity || 0;
    }
  });

  return summary;
};

// Indexes for better query performance
purchaseSchema.index({ purchaseType: 1, invoiceDate: -1 });
purchaseSchema.index({ supplier: 1 });
purchaseSchema.index({ invoiceNumber: 1 });
purchaseSchema.index({ recordedBy: 1 });
purchaseSchema.index({ status: 1 });
purchaseSchema.index({ tank: 1 });

const Purchase = mongoose.model("Purchase", purchaseSchema);
export default Purchase;