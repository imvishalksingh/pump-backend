// controllers/tankConfigController.js
import TankConfig from "../models/TankConfig.js";
import FuelStock from "../models/FuelStock.js";
import asyncHandler from "express-async-handler";

// @desc    Create tank configuration
// @route   POST /api/tanks/config
// @access  Private/Admin
export const createTankConfig = asyncHandler(async (req, res) => {
  const { tankName, product, capacity } = req.body;

  if (!tankName || !product || !capacity) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  const tankExists = await TankConfig.findOne({ tankName });
  if (tankExists) {
    res.status(400);
    throw new Error("Tank with this name already exists");
  }

  const tankConfig = await TankConfig.create({
    tankName,
    product,
    capacity,
    currentStock: 0,
    currentLevel: 0,
    alert: false,
    lastUpdated: new Date(),
    lastCalibrationBy: req.user?.name || "System"
  });

  res.status(201).json(tankConfig);
});

// @desc    Get all tank configurations
// @route   GET /api/tanks/config
// @access  Private
export const getTankConfigs = asyncHandler(async (req, res) => {
  const tanks = await TankConfig.find({ isActive: true }).sort({ tankName: 1 });
  
  // Ensure all tanks have required fields
  const tanksWithDefaults = tanks.map(tank => ({
    ...tank.toObject(),
    currentStock: tank.currentStock || 0,
    currentLevel: tank.currentLevel || 0,
    alert: tank.alert || false
  }));
  
  const isAdmin = req.user && req.user.role === "admin";
  
  res.json({
    tanks: tanksWithDefaults,
    isAdmin
  });
});

// @desc    Get single tank configuration
// @route   GET /api/tanks/config/:id
// @access  Private
export const getTankConfig = asyncHandler(async (req, res) => {
  const tank = await TankConfig.findById(req.params.id);
  
  if (!tank) {
    res.status(404);
    throw new Error("Tank configuration not found");
  }

  res.json(tank);
});

// @desc    Update tank configuration
// @route   PUT /api/tanks/config/:id
// @access  Private/Admin
export const updateTankConfig = asyncHandler(async (req, res) => {
  const tank = await TankConfig.findById(req.params.id);
  
  if (!tank) {
    res.status(404);
    throw new Error("Tank configuration not found");
  }

  const updatedTank = await TankConfig.findByIdAndUpdate(
    req.params.id,
    req.body,
    { 
      new: true, 
      runValidators: true
    }
  );

  res.json(updatedTank);
});

// @desc    Delete tank configuration
// @route   DELETE /api/tanks/config/:id
// @access  Private/Admin
export const deleteTankConfig = asyncHandler(async (req, res) => {
  const tank = await TankConfig.findById(req.params.id);
  
  if (!tank) {
    res.status(404);
    throw new Error("Tank configuration not found");
  }

  tank.isActive = false;
  await tank.save();

  res.json({ message: "Tank configuration removed successfully" });
});

// @desc    Initialize tank stocks (run this once)
// @route   POST /api/tanks/config/initialize-stocks
// @access  Private/Admin
export const initializeTankStocks = asyncHandler(async (req, res) => {
  const tanks = await TankConfig.find({});
  
  const results = await Promise.all(
    tanks.map(async (tank) => {
      // Get latest stock from FuelStock transactions
      const latestStock = await FuelStock.findOne({ tank: tank._id })
        .sort({ createdAt: -1 });
      
      const currentStock = latestStock ? latestStock.newStock : 0;
      const currentLevel = Math.round((currentStock / tank.capacity) * 100);
      const alert = currentLevel <= 20;
      
      return await TankConfig.findByIdAndUpdate(
        tank._id,
        {
          currentStock: currentStock,
          currentLevel: currentLevel,
          alert: alert,
          lastUpdated: new Date()
        },
        { new: true }
      );
    })
  );

  res.json({
    message: "Tank stocks initialized successfully",
    tanks: results
  });
});

// @desc    Get tank status for debugging
// @route   GET /api/tanks/config/debug/status
// @access  Private
export const getTankStatus = asyncHandler(async (req, res) => {
  const tanks = await TankConfig.find({ isActive: true });
  
  const tankStatus = await Promise.all(
    tanks.map(async (tank) => {
      const latestStock = await FuelStock.findOne({ tank: tank._id })
        .sort({ createdAt: -1 });
      
      return {
        tankId: tank._id,
        tankName: tank.tankName,
        configStock: tank.currentStock,
        configLevel: tank.currentLevel,
        latestTransaction: latestStock ? {
          newStock: latestStock.newStock,
          type: latestStock.transactionType,
          date: latestStock.createdAt
        } : null,
        discrepancy: latestStock ? (tank.currentStock !== latestStock.newStock) : false
      };
    })
  );

  res.json({
    success: true,
    tankStatus,
    summary: {
      totalTanks: tanks.length,
      tanksWithDiscrepancy: tankStatus.filter(t => t.discrepancy).length
    }
  });
});

const calculateVolumeHSD = (dipReading) => {
  const x = 1 - (dipReading / 100.0);
  const volume = 671.8 * 10000.0 * (Math.acos(x) - (x * Math.sqrt(1 - x * x))) / 1000.0;
  return volume;
};

const calculateVolumeMS = (dipReading) => {
  const x = 1 - (dipReading / 100.0);
  const volume = 496.8 * 10000.0 * (Math.acos(x) - (x * Math.sqrt(1 - x * x))) / 1000.0;
  return volume;
};

// @desc    Calculate volume from dip reading
// @route   POST /api/tanks/config/calculate
// @access  Private
export const calculateDipQuantity = asyncHandler(async (req, res) => {
  console.log("🎯 Calculate endpoint called with body:", JSON.stringify(req.body));
  
  const tankId = req.body.tankId || req.body.tank;
  const dipReading = req.body.dipReading || req.body.dipMM;

  if (!tankId) {
    return res.status(400).json({
      success: false,
      error: "Tank ID is required"
    });
  }

  if (dipReading === undefined || dipReading === null || dipReading === "") {
    return res.status(400).json({
      success: false,
      error: "Dip reading is required"
    });
  }

  const dipValue = parseFloat(dipReading);
  if (isNaN(dipValue) || dipValue < 0) {
    return res.status(400).json({
      success: false,
      error: "Valid dip reading (in centimeters) is required"
    });
  }

  const tankConfig = await TankConfig.findById(tankId);
  if (!tankConfig) {
    return res.status(404).json({
      success: false,
      error: "Tank configuration not found"
    });
  }

  try {
    let calculatedVolume;
    let formulaUsed;
    
    if (tankConfig.product === "HSD") {
      calculatedVolume = calculateVolumeHSD(dipValue);
      formulaUsed = "HSD Formula (671.8)";
    } else if (tankConfig.product === "MS") {
      calculatedVolume = calculateVolumeMS(dipValue);
      formulaUsed = "MS Formula (496.8)";
    } else {
      throw new Error(`Unsupported product type: ${tankConfig.product}`);
    }
    
    res.json({
      success: true,
      dipReading: dipValue,
      volumeLiters: parseFloat(calculatedVolume.toFixed(2)),
      calculatedQuantity: parseFloat(calculatedVolume.toFixed(2)),
      tankName: tankConfig.tankName,
      product: tankConfig.product,
      capacity: tankConfig.capacity,
      remainingPercentage: ((calculatedVolume / tankConfig.capacity) * 100).toFixed(1),
      calculationMethod: "mathematical_formula",
      formulaUsed: formulaUsed
    });

  } catch (error) {
    console.error("❌ Calculate method error:", error);
    res.status(500).json({
      success: false,
      error: "Calculation error: " + error.message
    });
  }
});