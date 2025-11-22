// models/TankConfig.js - COMPLETELY UPDATED
import mongoose from "mongoose";

const tankConfigSchema = new mongoose.Schema({
  tankName: {
    type: String,
    required: [true, "Tank name is required"],
    unique: true
  },
  product: {
    type: String,
    required: [true, "Product is required"],
    enum: ["Petrol", "Diesel", "CNG"]
  },
  capacity: {
    type: Number,
    required: [true, "Tank capacity is required"],
    min: 0
  },
  currentStock: {
    type: Number,
    default: 0,
    min: 0
  },
  
  currentLevel: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  
  alert: {
    type: Boolean,
    default: false
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // NEW: Real tank shapes
  tankShape: {
    type: String,
    enum: ["horizontal_cylinder", "rectangular", "capsule", "custom"],
    default: "horizontal_cylinder"
  },
  
  dimensions: {
    length: { type: Number }, // in meters
    diameter: { type: Number }, // for cylindrical tanks
    width: { type: Number }, // for rectangular tanks
    height: { type: Number } // in meters
  },
  
  // REPLACED: Calibration table instead of formulas
  calibrationTable: [{
    dipMM: {
      type: Number,
      required: true,
      min: 0
    },
    volumeLiters: {
      type: Number,
      required: true,
      min: 0
    }
  }],
  
  // Metadata
  isActive: {
    type: Boolean,
    default: true
  },
  calibrationDate: {
    type: Date,
    default: Date.now
  },
  lastCalibrationBy: {
    type: String // Agency or technician name
  }
}, {
  timestamps: true
});

// In models/TankConfig.js - UPDATE calculateVolumeFromDip with debugging
tankConfigSchema.methods.calculateVolumeFromDip = function(dipMM) {
  console.log(`📐 Calculating volume for dip: ${dipMM}mm on tank: ${this.tankName}`);
  
  if (!this.calibrationTable || this.calibrationTable.length === 0) {
    console.log("❌ No calibration data available");
    throw new Error("No calibration data available for this tank");
  }
  
  // Sort calibration table by dipMM
  const sortedTable = [...this.calibrationTable].sort((a, b) => a.dipMM - b.dipMM);
  
  console.log(`📊 Calibration table points:`, sortedTable.map(p => `${p.dipMM}mm -> ${p.volumeLiters}L`));
  
  // Handle edge cases
  if (dipMM <= sortedTable[0].dipMM) {
    console.log(`🔽 Below minimum - using: ${sortedTable[0].volumeLiters}L`);
    return sortedTable[0].volumeLiters;
  }
  
  if (dipMM >= sortedTable[sortedTable.length - 1].dipMM) {
    console.log(`🔼 Above maximum - using: ${sortedTable[sortedTable.length - 1].volumeLiters}L`);
    return sortedTable[sortedTable.length - 1].volumeLiters;
  }
  
  // Find the calibration points for interpolation
  let lowerIndex = 0;
  let upperIndex = 0;
  
  for (let i = 0; i < sortedTable.length - 1; i++) {
    if (sortedTable[i].dipMM <= dipMM && sortedTable[i + 1].dipMM >= dipMM) {
      lowerIndex = i;
      upperIndex = i + 1;
      break;
    }
  }
  
  const lower = sortedTable[lowerIndex];
  const upper = sortedTable[upperIndex];
  
  console.log(`📈 Interpolation between: ${lower.dipMM}mm->${lower.volumeLiters}L and ${upper.dipMM}mm->${upper.volumeLiters}L`);
  
  // Linear interpolation
  const ratio = (dipMM - lower.dipMM) / (upper.dipMM - lower.dipMM);
  const interpolatedVolume = lower.volumeLiters + ratio * (upper.volumeLiters - lower.volumeLiters);
  
  console.log(`🎯 Final calculation: ratio=${ratio.toFixed(3)}, volume=${interpolatedVolume.toFixed(2)}L`);
  
  return Math.max(0, interpolatedVolume);
};

// Validation for calibration table
tankConfigSchema.pre('save', function(next) {
  if (this.calibrationTable && this.calibrationTable.length > 0) {
    // Check for duplicate dip readings
    const dipReadings = this.calibrationTable.map(row => row.dipMM);
    const uniqueReadings = new Set(dipReadings);
    
    if (uniqueReadings.size !== dipReadings.length) {
      return next(new Error("Duplicate dip readings in calibration table"));
    }
    
    // Check if table is sorted and volumes are increasing
    const sortedTable = [...this.calibrationTable].sort((a, b) => a.dipMM - b.dipMM);
    for (let i = 1; i < sortedTable.length; i++) {
      if (sortedTable[i].volumeLiters < sortedTable[i - 1].volumeLiters) {
        return next(new Error("Calibration table volumes must be non-decreasing"));
      }
    }
  }
  next();
});

const TankConfig = mongoose.model("TankConfig", tankConfigSchema);
export default TankConfig;