// controllers/tankConfigController.js - UPDATED
import TankConfig from "../models/TankConfig.js";
import asyncHandler from "express-async-handler";
import csv from "csv-parser";
import stream from "stream";

// @desc    Create tank configuration
// @route   POST /api/tanks/config
// @access  Private/Admin
export const createTankConfig = asyncHandler(async (req, res) => {
  const { tankName, product, capacity, tankShape, dimensions, calibrationTable } = req.body;

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
    tankShape: tankShape || "horizontal_cylinder",
    dimensions: dimensions || {},
    calibrationTable: calibrationTable || [],
    lastCalibrationBy: req.user?.name || "System"
  });

  res.status(201).json(tankConfig);
});

// @desc    Get all tank configurations
// @route   GET /api/tanks/config
// @access  Private
export const getTankConfigs = asyncHandler(async (req, res) => {
  const tanks = await TankConfig.find({ isActive: true }).sort({ tankName: 1 });
  
  const isAdmin = req.user && req.user.role === "admin";
  
  res.json({
    tanks,
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

  const updateData = { ...req.body };
  
  if (req.body.dimensions) {
    updateData.dimensions = {
      ...tank.dimensions.toObject(),
      ...req.body.dimensions
    };
  }

  // Update calibration date if calibration table is modified
  if (req.body.calibrationTable) {
    updateData.calibrationDate = new Date();
    updateData.lastCalibrationBy = req.user?.name || "System";
  }

  const updatedTank = await TankConfig.findByIdAndUpdate(
    req.params.id,
    updateData,
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

// In tankConfigController.js - UPDATE calculateDipQuantity with debugging
export const calculateDipQuantity = asyncHandler(async (req, res) => {
  console.log("🎯 Calculate endpoint called with body:", JSON.stringify(req.body));
  
  // Handle multiple possible parameter names
  const tankId = req.body.tankId || req.body.tank;
  const dipMM = req.body.dipMM || req.body.dipReading;
  
  console.log("🔍 Extracted parameters:", { tankId, dipMM });

  // Validate required parameters
  if (!tankId) {
    return res.status(400).json({
      success: false,
      error: "Tank ID is required"
    });
  }

  if (dipMM === undefined || dipMM === null || dipMM === "") {
    return res.status(400).json({
      success: false,
      error: "Dip reading is required"
    });
  }

  const dipValue = parseFloat(dipMM);
  if (isNaN(dipValue) || dipValue < 0) {
    return res.status(400).json({
      success: false,
      error: "Valid dip reading (in mm) is required"
    });
  }

  const tankConfig = await TankConfig.findById(tankId);
  if (!tankConfig) {
    return res.status(404).json({
      success: false,
      error: "Tank configuration not found"
    });
  }

  console.log("📊 Tank found:", {
    name: tankConfig.tankName,
    capacity: tankConfig.capacity,
    calibrationPoints: tankConfig.calibrationTable?.length || 0
  });

  try {
    // Calculate volume using calibration table
    const calculatedVolume = tankConfig.calculateVolumeFromDip(dipValue);
    
    console.log("✅ Calculation result:", {
      dipMM: dipValue,
      calculatedVolume: calculatedVolume,
      tankCapacity: tankConfig.capacity
    });
    
    res.json({
      success: true,
      dipMM: dipValue,
      volumeLiters: parseFloat(calculatedVolume.toFixed(2)),
      calculatedQuantity: parseFloat(calculatedVolume.toFixed(2)), // For frontend compatibility
      tankName: tankConfig.tankName,
      product: tankConfig.product,
      capacity: tankConfig.capacity,
      remainingPercentage: ((calculatedVolume / tankConfig.capacity) * 100).toFixed(1),
      calibrationPointsUsed: tankConfig.calibrationTable?.length || 0
    });

  } catch (error) {
    console.error("❌ Calculate method error:", error);
    res.status(500).json({
      success: false,
      error: "Calculation error: " + error.message
    });
  }
});
// @desc    Upload calibration table via CSV
// @route   POST /api/tanks/config/:id/upload-calibration
// @access  Private/Admin
export const uploadCalibrationCSV = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("CSV file is required");
  }

  const tank = await TankConfig.findById(req.params.id);
  if (!tank) {
    res.status(404);
    throw new Error("Tank configuration not found");
  }

  const calibrationTable = [];
  const bufferStream = new stream.PassThrough();
  bufferStream.end(req.file.buffer);

  return new Promise((resolve, reject) => {
    bufferStream
      .pipe(csv())
      .on('data', (row) => {
        const dipMM = parseFloat(row.dip || row.dipMM || row.mm);
        const volumeLiters = parseFloat(row.liters || row.volume || row.volumeLiters);
        
        if (!isNaN(dipMM) && !isNaN(volumeLiters)) {
          calibrationTable.push({
            dipMM,
            volumeLiters
          });
        }
      })
      .on('end', async () => {
        try {
          if (calibrationTable.length === 0) {
            res.status(400);
            throw new Error("No valid data found in CSV file");
          }

          tank.calibrationTable = calibrationTable;
          tank.calibrationDate = new Date();
          tank.lastCalibrationBy = req.user?.name || "CSV Upload";
          
          await tank.save();
          
          res.json({
            message: `Calibration table updated with ${calibrationTable.length} entries`,
            calibrationTable: tank.calibrationTable
          });
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (error) => {
        reject(error);
      });
  });
});

// @desc    Add single calibration point
// @route   POST /api/tanks/config/:id/calibration
// @access  Private/Admin
export const addCalibrationPoint = asyncHandler(async (req, res) => {
  const { dipMM, volumeLiters } = req.body;
  
  if (dipMM === undefined || volumeLiters === undefined) {
    res.status(400);
    throw new Error("Dip reading (mm) and volume (liters) are required");
  }

  const tank = await TankConfig.findById(req.params.id);
  if (!tank) {
    res.status(404);
    throw new Error("Tank configuration not found");
  }

  // Remove existing point with same dipMM if exists
  tank.calibrationTable = tank.calibrationTable.filter(point => point.dipMM !== dipMM);
  
  // Add new point
  tank.calibrationTable.push({ dipMM, volumeLiters });
  
  // Sort by dipMM
  tank.calibrationTable.sort((a, b) => a.dipMM - b.dipMM);
  
  tank.calibrationDate = new Date();
  tank.lastCalibrationBy = req.user?.name || "Manual Entry";
  
  await tank.save();

  res.json({
    message: "Calibration point added successfully",
    calibrationTable: tank.calibrationTable
  });
});