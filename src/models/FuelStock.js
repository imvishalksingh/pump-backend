// models/FuelStock.js - FIXED VERSION
import mongoose from "mongoose";

const fuelStockSchema = new mongoose.Schema({
  tank: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "TankConfig",
    required: [true, "Tank reference is required"]
  },
  
  transactionType: {
    type: String,
    required: true,
    enum: ["purchase", "sale", "adjustment", "delivery"]
  },
  
  quantity: {
    type: Number,
    required: true
  },
  
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
  
  // Make purchaseReference optional
  purchaseReference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Purchase"
  },
  
  product: {
    type: String,
    enum: ["MS", "HSD"]
  },
  
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
    // REMOVED: unique: true - This was causing the duplicate key error
  },
  reason: {
    type: String,
    trim: true
  },
  
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
  },
  
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
}, {
  timestamps: true
});

// FIXED VALIDATION: Remove strict purchaseReference requirement
fuelStockSchema.pre("validate", function(next) {
  console.log(`🔍 Validating FuelStock transaction: ${this.transactionType}`);
  
  // PURCHASE VALIDATION - Simplified
  if (this.transactionType === "purchase") {
    if (!this.supplier) {
      return next(new Error("Supplier is required for purchases"));
    }
    if (!this.invoiceNumber) {
      return next(new Error("Invoice number is required for purchases"));
    }
    // purchaseReference is now optional
  }
  
  // ADJUSTMENT VALIDATION
  if (this.transactionType === "adjustment") {
    if (!this.reason) {
      return next(new Error("Reason is required for adjustments"));
    }
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
      const alert = currentLevel <= 20;
      
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

// FIXED INDEXES: Remove unique index on invoiceNumber
fuelStockSchema.index({ tank: 1, date: -1 });
fuelStockSchema.index({ transactionType: 1 });
fuelStockSchema.index({ purchaseReference: 1 });
// REMOVED: fuelStockSchema.index({ invoiceNumber: 1 }); - This was causing the duplicate key error

const FuelStock = mongoose.model("FuelStock", fuelStockSchema);
export default FuelStock;