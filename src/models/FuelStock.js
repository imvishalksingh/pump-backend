// models/FuelStock.js - UPDATED FOR BOTH PURCHASES AND ADJUSTMENTS
import mongoose from "mongoose";

const fuelStockSchema = new mongoose.Schema({
  // TANK-CENTRIC: Always reference specific tank
  tank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TankConfig",
    required: [true, "Tank reference is required"]
  },
  
  // TRANSACTION TYPE: Different validation for different types
  transactionType: {
    type: String,
    required: true,
    enum: ["purchase", "sale", "adjustment", "delivery"]
  },
  
  // For ALL transaction types
  quantity: {
    type: Number,
    required: true
  },
  
  // Stock levels before and after this transaction
  previousStock: {
    type: Number,
    required: true,
    min: 0
  },
  newStock: {
    type: Number,
    required: true,
    min: 0
  },
  
  // For PURCHASES only
  product: {
    type: String,
    enum: ["Petrol", "Diesel", "CNG"]
    // Remove required - adjustments don't need product
  },
  purchaseQuantity: {
    type: Number,
    min: 0
    // Remove required - adjustments don't have purchase quantity
  },
  purchaseValue: {
    type: Number,
    min: 0
    // Remove required - adjustments don't have purchase value
  },
  ratePerLiter: {
    type: Number,
    min: 0
  },
  
  // For ALL transaction types (optional)
  amount: {
    type: Number,
    min: 0
  },
  supplier: {
    type: String,
    trim: true
  },
  invoiceNumber: {
    type: String,
    trim: true
  },
  reason: {
    type: String,
    trim: true
  },
  
  // For purchases/deliveries
  vehicleNumber: {
    type: String,
    trim: true
  },
  density: {
    type: Number,
    min: 0
  },
  
  date: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// CUSTOM VALIDATION: Different rules for different transaction types
fuelStockSchema.pre("validate", function(next) {
  console.log(`🔍 Validating FuelStock transaction: ${this.transactionType}`);
  
  // PURCHASE VALIDATION
  if (this.transactionType === "purchase") {
    if (!this.product) {
      return next(new Error("Product name is required for purchases"));
    }
    if (!this.purchaseQuantity && this.purchaseQuantity !== 0) {
      return next(new Error("Purchase quantity is required for purchases"));
    }
    if (!this.purchaseValue && this.purchaseValue !== 0) {
      return next(new Error("Purchase value is required for purchases"));
    }
    if (!this.ratePerLiter && this.ratePerLiter !== 0) {
      return next(new Error("Rate per liter is required for purchases"));
    }
    if (!this.supplier) {
      return next(new Error("Supplier is required for purchases"));
    }
    if (!this.invoiceNumber) {
      return next(new Error("Invoice number is required for purchases"));
    }
  }
  
  // ADJUSTMENT VALIDATION
  if (this.transactionType === "adjustment") {
    if (!this.reason) {
      return next(new Error("Reason is required for adjustments"));
    }
    // Adjustments don't need product, purchaseQuantity, purchaseValue, etc.
  }
  
  next();
});

// Update tank current stock after saving
fuelStockSchema.post("save", async function() {
  try {
    const TankConfig = mongoose.model("TankConfig");
    const tank = await TankConfig.findById(this.tank);
    
    if (tank) {
      const currentLevel = Math.round((this.newStock / tank.capacity) * 100);
      const alert = currentLevel <= 20; // Alert if below 20%
      
      await TankConfig.findByIdAndUpdate(this.tank, {
        currentStock: this.newStock,
        currentLevel: currentLevel,
        alert: alert,
        lastUpdated: new Date()
      });
      
      console.log(`🔄 Updated tank ${tank.tankName}: Stock=${this.newStock}L, Level=${currentLevel}%, Alert=${alert}`);
    }
  } catch (error) {
    console.error("❌ Error updating tank stock:", error);
  }
});

// Index for better performance
fuelStockSchema.index({ tank: 1, date: -1 });
fuelStockSchema.index({ transactionType: 1 });
fuelStockSchema.index({ invoiceNumber: 1 });

const FuelStock = mongoose.model("FuelStock", fuelStockSchema);
export default FuelStock;