// controllers/shiftController.js - COMPLETE UPDATED VERSION WITH TANK DEDUCTION
import Shift from "../models/Shift.js";
import Nozzle from "../models/Nozzle.js";
import Nozzleman from "../models/NozzleMan.js";
import Assignment from "../models/Assignment.js";
import CashHandover from "../models/CashHandover.js";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import Pump from "../models/Pump.js";
import TankConfig from "../models/TankConfig.js";


// // In shiftController.js - UPDATED VERSION
// const deductFuelFromTank = async (fuelType, amount) => {
//   try {
//     console.log(`⛽ Looking for tank configuration for fuel type: ${fuelType}`);
    
//     // Validate that fuelType is a string
//     if (typeof fuelType !== 'string') {
//       console.error('❌ Invalid fuel type received:', fuelType);
//       throw new Error(`Invalid fuel type format. Expected string, got: ${typeof fuelType}`);
//     }
    
//     // Map fuel types to tank products
//     const fuelTypeToProductMap = {
//       "Petrol": "MS",
//       "Diesel": "HSD", 
//       "CNG": "CNG"
//     };
    
//     const product = fuelTypeToProductMap[fuelType];
    
//     if (!product) {
//       throw new Error(`Unsupported fuel type: ${fuelType}`);
//     }
    
//     console.log(`🔍 Mapped ${fuelType} to product: ${product}`);
    
//     // Find active tank for this product
//     const tankConfig = await TankConfig.findOne({ 
//       product: product,
//       isActive: true 
//     });
    
//     if (!tankConfig) {
//       throw new Error(`Tank configuration not found for fuel type: ${fuelType} (product: ${product})`);
//     }
    
//     console.log(`✅ Found tank: ${tankConfig.tankName} with current stock: ${tankConfig.currentStock}`);
    
//     // Check if enough fuel in tank
//     if (tankConfig.currentStock < amount) {
//       throw new Error(`Insufficient fuel in ${fuelType} tank. Available: ${tankConfig.currentStock}, Required: ${amount}`);
//     }
    
//     // Deduct fuel from tank
//     const previousStock = tankConfig.currentStock;
//     tankConfig.currentStock -= amount;
//     tankConfig.currentLevel = Math.round((tankConfig.currentStock / tankConfig.capacity) * 100);
//     tankConfig.alert = tankConfig.currentLevel <= 20;
//     tankConfig.lastUpdated = new Date();
    
//     await tankConfig.save();
    
//     console.log(`✅ Fuel deducted: ${amount}L from ${tankConfig.tankName}. New stock: ${tankConfig.currentStock}`);
    
//     return tankConfig;
    
//   } catch (error) {
//     console.error(`❌ Error in deductFuelFromTank for ${fuelType}:`, error.message);
//     throw error;
//   }
// };
// ✅ Add this helper function for low stock alerts
const handleLowStockAlert = async (stock) => {
  try {
    const Notification = mongoose.model("Notification");
    
    if (stock.currentLevel <= 20) {
      const existing = await Notification.findOne({
        type: "Stock",
        description: { $regex: stock.product, $options: "i" },
        status: "Unread",
      });

      if (!existing) {
        await Notification.create({
          type: "Stock",
          description: `${stock.product} stock critically low at ${stock.currentLevel}%`,
          priority: stock.currentLevel <= 10 ? "High" : "Medium",
          status: "Unread",
        });
        console.log(`🔔 Low stock alert created for ${stock.product} at ${stock.currentLevel}%`);
      }
    }
  } catch (err) {
    console.error("⚠️ Error handling stock alert:", err.message);
  }
};

// ✅ NEW FUNCTION: Adjust tank based on auditor's final verification
const adjustTankForAuditor = async (shift, adjustment) => {
  try {
    console.log(`🔄 Processing auditor tank adjustment: ${adjustment}L`);
    
    // Get nozzle fuel type
    const nozzle = await Nozzle.findById(shift.nozzle);
    const fuelType = nozzle.fuelType;

    // Find the tank configuration
    const TankConfig = mongoose.model("TankConfig");
    const tank = await TankConfig.findOne({ product: fuelType });
    
    if (!tank) {
      throw new Error(`Tank configuration not found for fuel type: ${fuelType}`);
    }

    console.log(`📦 Current tank stock before adjustment: ${tank.currentStock}L`);

    // Calculate new stock (adjustment can be positive or negative)
    const newStock = Math.max(0, tank.currentStock - adjustment); // Subtract adjustment because it's additional deduction
    const currentLevel = Math.round((newStock / tank.capacity) * 100);
    const alert = currentLevel <= 20;

    console.log(`📊 Auditor tank adjustment: ${tank.currentStock}L - ${adjustment}L = ${newStock}L`);

    // Update tank
    const updatedTank = await TankConfig.findByIdAndUpdate(
      tank._id,
      {
        currentStock: newStock,
        currentLevel: currentLevel,
        alert: alert,
        lastUpdated: new Date()
      },
      { new: true }
    );

    // Create FuelStock record for auditor adjustment
    const FuelStock = mongoose.model("FuelStock");
    await FuelStock.create({
      tank: tank._id,
      transactionType: "auditor_adjustment",
      quantity: -adjustment, // Negative for deduction
      previousStock: tank.currentStock,
      newStock: newStock,
      product: tank.product,
      ratePerLiter: 0,
      amount: 0,
      shift: shift._id,
      auditor: shift.auditedBy,
      reason: `Auditor final adjustment for shift ${shift.shiftId}`,
      date: new Date(),
      recordedBy: shift.auditedBy
    });

    console.log(`✅ Auditor adjustment completed. New tank stock: ${updatedTank.currentStock}L`);

    // Trigger low stock alert if needed
    if (currentLevel <= 20) {
      await handleLowStockAlert({
        product: tank.product,
        currentLevel: currentLevel,
        closingStock: newStock
      });
    }

    return updatedTank;

  } catch (error) {
    console.error("❌ Error in adjustTankForAuditor:", error);
    throw error;
  }
};

// @desc    Get all shifts with filters
// @route   GET /api/shifts
// @access  Private
export const getShifts = asyncHandler(async (req, res) => {
  try {
    const {
      status,
      nozzlemanId,
      pumpId,
      nozzleId,
      startDate,
      endDate,
      page = 1,
      limit = 10
    } = req.query;

    // Build filter object
    let filter = {};

    if (status) filter.status = status;
    if (nozzlemanId) filter.nozzleman = nozzlemanId;
    if (pumpId) filter.pump = pumpId;
    if (nozzleId) filter.nozzle = nozzleId;

    // Date range filter
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.startTime.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.startTime.$lte = end;
      }
    }

    const skip = (page - 1) * limit;

    // Get shifts with population
    const shifts = await Shift.find(filter)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("createdBy", "name email")
      .populate("auditedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Shift.countDocuments(filter);

    res.json({
      shifts,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalShifts: total,
        hasNext: page * limit < total,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error("Error in getShifts:", error);
    res.status(500);
    throw new Error("Failed to fetch shifts");
  }
});

// @desc    Get shift statistics
// @route   GET /api/shifts/stats
// @access  Private
export const getShiftStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // Get active shifts count
    const activeShifts = await Shift.countDocuments({ 
      status: "Active" 
    });

    // Get total dispensed today
    const todayShifts = await Shift.find({
      startTime: { $gte: today, $lt: tomorrow },
      status: { $in: ["Completed", "Approved", "Pending Approval"] }
    });

    const totalDispensed = todayShifts.reduce((total, shift) => {
      return total + (shift.fuelDispensed || 0);
    }, 0);

    // Get total cash collected today
    const totalCash = todayShifts.reduce((total, shift) => {
      return total + (shift.cashCollected || 0);
    }, 0);

    // Get pending approvals
    const pendingApprovals = await Shift.countDocuments({
      status: "Pending Approval"
    });

    // Get shifts by status
    const shiftsByStatus = await Shift.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      activeShifts,
      totalDispensed,
      totalCash,
      pendingApprovals,
      shiftsByStatus,
      todayShifts: todayShifts.length
    });
  } catch (error) {
    console.error("Error fetching shift stats:", error);
    res.status(500);
    throw new Error("Failed to fetch shift statistics");
  }
});

// @desc    Get single shift
// @route   GET /api/shifts/:id
// @access  Private
export const getShift = asyncHandler(async (req, res) => {
  try {
    const shift = await Shift.findById(req.params.id)
      .populate("nozzleman", "name employeeId mobile shift status")
      .populate("pump", "name location fuelType")
      .populate("nozzle", "number fuelType currentReading rate")
      .populate("createdBy", "name email")
      .populate("auditedBy", "name email");
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    res.json(shift);
  } catch (error) {
    console.error("Error in getShift:", error);
    res.status(500);
    throw new Error("Failed to fetch shift");
  }
});

// @desc    Get assigned nozzles for logged-in nozzleman
// @route   GET /api/shifts/assigned-nozzles
// @access  Private (Nozzleman only)
export const getAssignedNozzles = asyncHandler(async (req, res) => {
  try {
    const nozzlemanId = req.user.nozzlemanProfile;

    if (!nozzlemanId) {
      res.status(403);
      throw new Error("No nozzleman profile found");
    }

    const currentAssignments = await Assignment.find({
      nozzleman: nozzlemanId,
      status: "Active"
    })
      .populate("nozzle", "number fuelType currentReading status")
      .populate("pump", "name location fuelType")
      .sort({ assignedDate: -1 });

    // Check if nozzleman has any active shifts
    const activeShift = await Shift.findOne({
      nozzleman: nozzlemanId,
      status: "Active"
    });

    res.json({
      assignments: currentAssignments,
      hasActiveShift: !!activeShift,
      activeShiftId: activeShift?._id
    });
  } catch (error) {
    console.error("Error in getAssignedNozzles:", error);
    res.status(500);
    throw new Error("Failed to fetch assigned nozzles");
  }
});

// @desc    Start new shift
// @route   POST /api/shifts/start
// @access  Private
export const startShift = asyncHandler(async (req, res) => {
  try {
    console.log("🔍 Start Shift Request Body:", req.body);
    console.log("👤 User making request:", req.user._id);

    const { 
      nozzleman, 
      pump, 
      nozzle, 
      startReading, 
      startReadingImage,
      assignmentId // Optional: for assignment-based shifts
    } = req.body;

    // Validate required fields
    if (!nozzleman) {
      return res.status(400).json({
        success: false,
        error: "Nozzleman ID is required"
      });
    }

    if (!pump) {
      return res.status(400).json({
        success: false,
        error: "Pump ID is required"
      });
    }

    if (!nozzle) {
      return res.status(400).json({
        success: false,
        error: "Nozzle ID is required"
      });
    }

    if (startReading === undefined || startReading === null) {
      return res.status(400).json({
        success: false,
        error: "Start reading is required"
      });
    }

    if (!startReadingImage) {
      return res.status(400).json({
        success: false,
        error: "Start reading proof image is required"
      });
    }

    // Check if nozzleman exists and is active
    const nozzlemanExists = await Nozzleman.findById(nozzleman);
    if (!nozzlemanExists) {
      return res.status(400).json({
        success: false,
        error: "Nozzleman not found"
      });
    }

    if (nozzlemanExists.status !== "Active") {
      return res.status(400).json({
        success: false,
        error: "Nozzleman is not active"
      });
    }

    // Check if nozzle exists and is active
    const nozzleExists = await Nozzle.findById(nozzle);
    if (!nozzleExists) {
      return res.status(404).json({
        success: false,
        error: "Nozzle not found"
      });
    }

    if (nozzleExists.status !== "Active") {
      return res.status(400).json({
        success: false,
        error: "Nozzle is not active"
      });
    }

    // Check if nozzleman already has active shift
    const existingActiveShift = await Shift.findOne({
      nozzleman,
      status: "Active"
    });

    if (existingActiveShift) {
      return res.status(400).json({
        success: false,
        error: "Nozzleman already has an active shift",
        activeShiftId: existingActiveShift._id
      });
    }

    // If assignmentId is provided, verify it belongs to the nozzleman
    if (assignmentId) {
      const assignment = await Assignment.findOne({
        _id: assignmentId,
        nozzleman: nozzleman,
        status: "Active"
      });
      
      if (!assignment) {
        return res.status(400).json({
          success: false,
          error: "Invalid assignment or assignment not active"
        });
      }
    }

    // Generate shift ID
    const count = await Shift.countDocuments();
    const shiftId = `SH-${String(count + 1).padStart(4, "0")}`;

    console.log("📝 Creating shift with data:", {
      shiftId,
      nozzleman,
      pump,
      nozzle,
      startReading,
      assignmentId
    });

    // Create shift data
    const shiftData = {
      shiftId,
      nozzleman,
      pump,
      nozzle,
      startTime: new Date(),
      startReading: parseFloat(startReading),
      startReadingImage,
      status: "Active",
      createdBy: req.user._id,
    };

    // Add assignment if provided
    if (assignmentId) {
      shiftData.assignment = assignmentId;
    }

    const shift = await Shift.create(shiftData);
    console.log("✅ Shift created successfully:", shift._id);

    // Update nozzleman's total shifts
    await Nozzleman.findByIdAndUpdate(nozzleman, {
      $inc: { totalShifts: 1 },
    });

    // Populate the shift for response
    const populatedShift = await Shift.findById(shift._id)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: "Shift started successfully",
      shift: populatedShift
    });

  } catch (error) {
    console.error("❌ Error in startShift:", error);
    
    // More specific error handling
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: errors
      });
    }

    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: "Duplicate shift ID or unique constraint violation"
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to start shift",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// controllers/shiftController.js - COMPLETE FIXED endShift FUNCTION
// controllers/shiftController.js - FIXED endShift WITHOUT TRANSACTIONS
export const endShift = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      endReading, 
      endReadingImage, 
      cashCollected, 
      phonePeSales = 0, 
      posSales = 0, 
      otpSales = 0, 
      creditSales = 0,
      expenses = 0,
      cashDeposit = 0,
      notes = '',
      testingFuel = 0
    } = req.body;

    console.log(`🔄 Ending shift: ${id}`);
    console.log('📊 End shift data:', { 
      endReading, 
      cashCollected, 
      phonePeSales, 
      posSales, 
      creditSales,
      expenses,
      testingFuel 
    });

    // Validate required fields
    if (!endReading || endReading < 0) {
      res.status(400);
      throw new Error('Valid end reading is required');
    }

    // Find shift
    const shift = await Shift.findById(id)
      .populate('nozzle', 'number fuelType pump')
      .populate('pump', 'name location fuelType');

    if (!shift) {
      res.status(404);
      throw new Error('Shift not found');
    }

    if (shift.status === 'Completed') {
      res.status(400);
      throw new Error('Shift already completed');
    }

    // Validate end reading is greater than start reading
    if (endReading <= shift.startReading) {
      res.status(400);
      throw new Error('End reading must be greater than start reading');
    }

    // Calculate fuel dispensed
    const fuelDispensed = endReading - shift.startReading;
    const finalFuelDispensed = fuelDispensed - testingFuel;

    if (finalFuelDispensed < 0) {
      res.status(400);
      throw new Error('Testing fuel cannot exceed total fuel dispensed');
    }

    // GET FUEL TYPE CORRECTLY
    let fuelType;
    if (shift.nozzle && shift.nozzle.fuelType) {
      fuelType = shift.nozzle.fuelType; // This should be 'Petrol', 'Diesel', or 'CNG'
    } else if (shift.pump && shift.pump.fuelType) {
      fuelType = shift.pump.fuelType;
    } else {
      fuelType = 'Petrol'; // Default fallback
    }

    console.log(`⛽ Fuel Calculation:`, {
      startReading: shift.startReading,
      endReading: endReading,
      rawFuelDispensed: fuelDispensed,
      testingFuel: testingFuel,
      finalFuelDispensed: finalFuelDispensed,
      fuelType: fuelType
    });

    // Calculate cash in hand
    const totalNonCashSales = phonePeSales + posSales + otpSales + creditSales;
    const cashInHand = cashCollected - cashDeposit - expenses;

    // Update shift with end details
    shift.endTime = new Date();
    shift.endReading = endReading;
    shift.endReadingImage = endReadingImage;
    shift.cashCollected = cashCollected;
    shift.phonePeSales = phonePeSales;
    shift.posSales = posSales;
    shift.otpSales = otpSales;
    shift.creditSales = creditSales;
    shift.expenses = expenses;
    shift.cashDeposit = cashDeposit;
    shift.cashInHand = cashInHand;
    shift.fuelDispensed = finalFuelDispensed;
    shift.testingFuel = testingFuel;
    shift.notes = notes;
    shift.status = 'Pending Approval';

    // Update meter readings based on fuel type
    if (fuelType === 'Petrol' || fuelType === 'MS') {
      shift.meterReadingPetrol = {
        opening: shift.startReading,
        closing: endReading
      };
    } else if (fuelType === 'Diesel' || fuelType === 'HSD') {
      shift.meterReadingHSD = {
        opening: shift.startReading,
        closing: endReading
      };
    }

    await shift.save();

    console.log(`✅ Shift ${shift.shiftId} updated successfully`);

    // DEDUCT FUEL FROM TANK - FIXED CALL
    if (finalFuelDispensed > 0) {
      console.log(`🔄 Starting automatic tank deduction for shift ${shift.shiftId}`);
      console.log(`⛽ Fuel type for deduction: ${fuelType}`);
      
      try {
        await deductFuelFromTank(fuelType, finalFuelDispensed);
        console.log(`✅ Tank deduction completed for ${finalFuelDispensed}L of ${fuelType}`);
      } catch (tankError) {
        console.error('❌ Tank deduction failed:', tankError.message);
        // Don't throw error here - continue with shift ending but log the issue
        shift.notes = `${shift.notes || ''} [Tank deduction failed: ${tankError.message}]`.trim();
        await shift.save();
      }
    }

    // Update nozzle current reading
    if (shift.nozzle) {
      const nozzle = await Nozzle.findById(shift.nozzle._id);
      if (nozzle) {
        nozzle.currentReading = endReading;
        nozzle.totalDispensed += finalFuelDispensed;
        await nozzle.save();
        console.log(`✅ Nozzle ${nozzle.number} reading updated to ${endReading}`);
      }
    }

    // Update pump current reading and total sales
    if (shift.pump) {
      const pump = await Pump.findById(shift.pump._id);
      if (pump) {
        pump.currentReading = endReading;
        pump.totalSales += finalFuelDispensed;
        await pump.save();
        console.log(`✅ Pump ${pump.name} reading updated to ${endReading}`);
      }
    }

    // Populate and return the updated shift
    const updatedShift = await Shift.findById(id)
      .populate('nozzle', 'number fuelType')
      .populate('pump', 'name location fuelType')
      .populate('nozzleman', 'name employeeId')
      .populate('createdBy', 'name');

    console.log(`🎉 Shift ${shift.shiftId} ended successfully`);

    res.json({
      message: 'Shift ended successfully',
      shift: updatedShift,
      fuelSummary: {
        totalDispensed: finalFuelDispensed,
        fuelType: fuelType,
        testingFuel: testingFuel
      },
      financialSummary: {
        cashCollected: cashCollected,
        nonCashSales: totalNonCashSales,
        expenses: expenses,
        cashDeposit: cashDeposit,
        cashInHand: cashInHand
      }
    });

  } catch (error) {
    console.error('❌ Error in endShift:', error);
    res.status(400);
    throw new Error(`Failed to end shift: ${error.message}`);
  }
});

// UPDATED deductFuelFromTank FUNCTION (without session)
const deductFuelFromTank = async (fuelType, amount) => {
  try {
    console.log(`⛽ Looking for tank configuration for fuel type: ${fuelType}`);
    
    // Validate that fuelType is a string
    if (typeof fuelType !== 'string') {
      console.error('❌ Invalid fuel type received:', fuelType);
      throw new Error(`Invalid fuel type format. Expected string, got: ${typeof fuelType}`);
    }
    
    // Map fuel types to tank products
    const fuelTypeToProductMap = {
      "Petrol": "MS",
      "Diesel": "HSD", 
      "CNG": "CNG"
    };
    
    const product = fuelTypeToProductMap[fuelType];
    
    if (!product) {
      throw new Error(`Unsupported fuel type: ${fuelType}`);
    }
    
    console.log(`🔍 Mapped ${fuelType} to product: ${product}`);
    
    // Find active tank for this product
    const tankConfig = await TankConfig.findOne({ 
      product: product,
      isActive: true 
    });
    
    if (!tankConfig) {
      throw new Error(`Tank configuration not found for fuel type: ${fuelType} (product: ${product})`);
    }
    
    console.log(`✅ Found tank: ${tankConfig.tankName} with current stock: ${tankConfig.currentStock}`);
    
    // Check if enough fuel in tank
    if (tankConfig.currentStock < amount) {
      throw new Error(`Insufficient fuel in ${fuelType} tank. Available: ${tankConfig.currentStock}L, Required: ${amount}L`);
    }
    
    // Deduct fuel from tank
    const previousStock = tankConfig.currentStock;
    tankConfig.currentStock -= amount;
    tankConfig.currentLevel = Math.round((tankConfig.currentStock / tankConfig.capacity) * 100);
    tankConfig.alert = tankConfig.currentLevel <= 20;
    tankConfig.lastUpdated = new Date();
    
    await tankConfig.save();
    
    console.log(`✅ Fuel deducted: ${amount}L from ${tankConfig.tankName}. New stock: ${tankConfig.currentStock}L`);
    
    // Create fuel stock transaction record
    const FuelStock = mongoose.model("FuelStock");
    await FuelStock.create({
      tank: tankConfig._id,
      transactionType: "sale_deduction",
      previousStock: previousStock,
      quantity: -amount, // Negative for deduction
      newStock: tankConfig.currentStock,
      reference: `shift_deduction_${Date.now()}`,
      notes: `Automatic deduction for ${fuelType} sales from shift`,
      createdBy: "system"
    });
    
    return tankConfig;
    
  } catch (error) {
    console.error(`❌ Error in deductFuelFromTank for ${fuelType}:`, error.message);
    throw error;
  }
};

// @desc    Verify shift (Supervisor approval) - UPDATED WITH AUDITOR TANK ADJUSTMENT
// @route   PUT /api/shifts/verify/:id
// @access  Private (Supervisor/Admin)
export const verifyShift = asyncHandler(async (req, res) => {
  try {
    const { isApproved, auditNotes, finalFuelAdjustment = 0 } = req.body;

    const shift = await Shift.findById(req.params.id)
      .populate("nozzle", "fuelType");
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    if (shift.status !== "Pending Approval") {
      res.status(400);
      throw new Error("Shift is not pending approval");
    }

    const previousFuelDispensed = shift.fuelDispensed;

    if (isApproved) {
      shift.status = "Approved";
      shift.auditNotes = auditNotes;
      shift.auditedBy = req.user._id;
      shift.auditedAt = new Date();

      // If auditor makes final adjustment to fuel quantity
      if (finalFuelAdjustment !== 0) {
        console.log(`📊 Auditor fuel adjustment: ${finalFuelAdjustment}L`);
        shift.fuelDispensed += parseFloat(finalFuelAdjustment);
        shift.auditNotes += ` | Fuel adjusted by auditor: ${finalFuelAdjustment}L`;
        
        // Update the tank with final adjustment
        await adjustTankForAuditor(shift, parseFloat(finalFuelAdjustment));
      }

      // Update nozzleman average cash handled
      const nozzleman = await Nozzleman.findById(shift.nozzleman);
      const totalSales = shift.cashCollected + shift.phonePeSales + shift.posSales + shift.otpSales + shift.creditSales;
      
      const newAverage = nozzleman.totalShifts > 0 
        ? (nozzleman.averageCashHandled * (nozzleman.totalShifts - 1) + totalSales) / nozzleman.totalShifts
        : totalSales;

      await Nozzleman.findByIdAndUpdate(shift.nozzleman, {
        averageCashHandled: newAverage
      });

    } else {
      shift.status = "Rejected";
      shift.auditNotes = auditNotes;
      shift.auditedBy = req.user._id;
      shift.auditedAt = new Date();
    }

    const updatedShift = await shift.save();

    // Create audit log
    const AuditLog = mongoose.model("AuditLog");
    await AuditLog.create({
      action: isApproved ? "approved" : "rejected",
      entityType: "Shift",
      entityId: shift._id,
      entityName: `Shift ${shift.shiftId}`,
      performedBy: req.user._id,
      notes: auditNotes || (isApproved ? "Shift approved by auditor" : "Shift rejected by auditor"),
      details: {
        previousFuelDispensed,
        finalFuelDispensed: shift.fuelDispensed,
        fuelAdjustment: finalFuelAdjustment,
        cashCollected: shift.cashCollected
      }
    });

    const populatedShift = await Shift.findById(updatedShift._id)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("auditedBy", "name email");

    res.json({
      message: `Shift ${isApproved ? 'approved' : 'rejected'} successfully`,
      shift: populatedShift,
      adjustments: finalFuelAdjustment !== 0 ? {
        fuelAdjustment: finalFuelAdjustment,
        previousFuelTotal: previousFuelDispensed,
        newFuelTotal: shift.fuelDispensed
      } : null
    });
  } catch (error) {
    console.error("Error in verifyShift:", error);
    res.status(500);
    throw new Error("Failed to verify shift");
  }
});

// @desc    Update shift - COMPLETELY REWRITTEN DEBUG VERSION
// @route   PUT /api/shifts/:id
// @access  Private/Admin
export const updateShift = asyncHandler(async (req, res) => {
  console.log("=== 🚨 UPDATE SHIFT STARTED ===");
  console.log("📝 Shift ID from params:", req.params.id);
  console.log("👤 User making request:", req.user?._id, req.user?.role);
  
  let shift;
  
  try {
    // STEP 1: Find the shift
    console.log("🔍 STEP 1: Finding shift...");
    shift = await Shift.findById(req.params.id);
    
    if (!shift) {
      console.log("❌ STEP 1 FAILED: Shift not found");
      return res.status(404).json({
        success: false,
        error: "Shift not found",
        details: `Shift ID: ${req.params.id}`
      });
    }
    
    console.log("✅ STEP 1 SUCCESS: Shift found");
    console.log("📋 Current Shift Data:", {
      _id: shift._id,
      shiftId: shift.shiftId,
      status: shift.status,
      nozzleman: shift.nozzleman,
      pump: shift.pump,
      nozzle: shift.nozzle
    });

    // STEP 2: Check permissions
    console.log("🔍 STEP 2: Checking permissions...");
    if (["Completed", "Approved"].includes(shift.status)) {
      const userRole = req.user?.role;
      const isAdmin = userRole === 'admin' || userRole === 'Admin';
      
      if (!isAdmin) {
        console.log("❌ STEP 2 FAILED: No admin privileges");
        return res.status(403).json({
          success: false,
          error: `Cannot update ${shift.status.toLowerCase()} shift without admin privileges`
        });
      }
      console.log("✅ STEP 2 SUCCESS: Admin override allowed");
    }

    // STEP 3: Log incoming data
    console.log("📦 STEP 3: Processing request data...");
    console.log("Incoming request body:", JSON.stringify(req.body, null, 2));
    
    // Check for problematic fields
    const problematicFields = [];
    Object.keys(req.body).forEach(key => {
      if (req.body[key] === undefined || req.body[key] === null) {
        problematicFields.push(key);
      }
    });
    
    if (problematicFields.length > 0) {
      console.log("⚠️ Problematic fields with undefined/null:", problematicFields);
    }

    // STEP 4: Update fields one by one with validation
    console.log("🔄 STEP 4: Updating fields...");
    
    const updateableFields = [
      'shiftId', 'nozzlemanId', 'pumpId', 'nozzleId', 'startTime', 'endTime',
      'startReading', 'endReading', 'fuelDispensed', 'testingFuel',
      'cashCollected', 'phonePeSales', 'posSales', 'otpSales', 'creditSales',
      'expenses', 'cashDeposit', 'cashInHand', 'meterReadingHSD', 'meterReadingPetrol',
      'status', 'notes', 'auditNotes', 'isManualEntry'
    ];

    for (const field of updateableFields) {
      if (req.body[field] !== undefined) {
        console.log(`   Updating ${field}: ${shift[field]} → ${req.body[field]}`);
        
        // Special handling for ObjectId fields
        if (field.endsWith('Id') && req.body[field]) {
          if (!mongoose.Types.ObjectId.isValid(req.body[field])) {
            console.log(`❌ Invalid ObjectId for ${field}: ${req.body[field]}`);
            return res.status(400).json({
              success: false,
              error: `Invalid ID format for ${field}`,
              details: `Value: ${req.body[field]}`
            });
          }
        }
        
        shift[field] = req.body[field];
      }
    }

    // STEP 5: Handle nested objects
    console.log("🔄 STEP 5: Handling nested objects...");
    if (req.body.meterReadingHSD) {
      console.log("   Updating meterReadingHSD:", req.body.meterReadingHSD);
      shift.meterReadingHSD = shift.meterReadingHSD || {};
      Object.keys(req.body.meterReadingHSD).forEach(key => {
        shift.meterReadingHSD[key] = req.body.meterReadingHSD[key];
      });
    }

    if (req.body.meterReadingPetrol) {
      console.log("   Updating meterReadingPetrol:", req.body.meterReadingPetrol);
      shift.meterReadingPetrol = shift.meterReadingPetrol || {};
      Object.keys(req.body.meterReadingPetrol).forEach(key => {
        shift.meterReadingPetrol[key] = req.body.meterReadingPetrol[key];
      });
    }

    // STEP 6: Manual validation
    console.log("🔍 STEP 6: Manual validation...");
    
    // Check required fields
    if (!shift.shiftId) {
      return res.status(400).json({
        success: false,
        error: "Shift ID is required"
      });
    }
    
    if (!shift.nozzleman) {
      return res.status(400).json({
        success: false,
        error: "Nozzleman is required"
      });
    }
    
    // Check numeric fields
    const numericFields = ['startReading', 'endReading', 'fuelDispensed', 'testingFuel', 'cashCollected', 'expenses', 'cashDeposit'];
    for (const field of numericFields) {
      if (shift[field] !== undefined && isNaN(parseFloat(shift[field]))) {
        return res.status(400).json({
          success: false,
          error: `Invalid number for ${field}`,
          details: `Value: ${shift[field]}`
        });
      }
    }

    console.log("✅ STEP 6 SUCCESS: Manual validation passed");

    // STEP 7: Save the document
    console.log("💾 STEP 7: Saving shift...");
    
    // Try manual save first to see exact error
    try {
      const validationError = shift.validateSync();
      if (validationError) {
        console.log("❌ Mongoose validation error:", validationError);
        const errors = {};
        Object.keys(validationError.errors).forEach(key => {
          errors[key] = validationError.errors[key].message;
        });
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: errors
        });
      }
    } catch (validateError) {
      console.log("❌ ValidateSync error:", validateError);
    }

    // Now try to save
    const updatedShift = await shift.save();
    console.log("✅ STEP 7 SUCCESS: Shift saved");

    // STEP 8: Populate and return
    console.log("🔍 STEP 8: Populating data...");
    const populatedShift = await Shift.findById(updatedShift._id)
      .populate("nozzleman", "name employeeId")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType");

    console.log("🎉 === UPDATE COMPLETED SUCCESSFULLY ===");

    return res.json({
      success: true,
      message: "Shift updated successfully",
      shift: populatedShift
    });

  } catch (error) {
    console.error("💥 === CRITICAL ERROR IN UPDATE SHIFT ===");
    console.error("Error name:", error.name);
    console.error("Error message:", error.message);
    console.error("Error code:", error.code);
    console.error("Error stack:", error.stack);
    
    // Log the current shift state if available
    if (shift) {
      console.error("Current shift state before error:", {
        _id: shift._id,
        shiftId: shift.shiftId,
        status: shift.status
      });
    }

    // Specific error handling
    if (error.name === 'CastError') {
      console.error("❌ CastError - Invalid ID format");
      return res.status(400).json({
        success: false,
        error: "Invalid shift ID format",
        details: error.message
      });
    } else if (error.name === 'ValidationError') {
      console.error("❌ ValidationError - Data validation failed");
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({
        success: false,
        error: "Data validation failed",
        details: errors
      });
    } else if (error.name === 'MongoError' || error.name === 'MongoServerError') {
      console.error("❌ MongoDB Error");
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          error: "Duplicate shift ID",
          details: "A shift with this ID already exists"
        });
      }
      return res.status(500).json({
        success: false,
        error: "Database error occurred",
        details: error.message
      });
    } else {
      console.error("❌ Unknown error type");
      return res.status(500).json({
        success: false,
        error: "Failed to update shift",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
});

// @desc    Get shifts for specific nozzleman
// @route   GET /api/shifts/nozzleman/:nozzlemanId
// @access  Private
export const getShiftsByNozzleman = asyncHandler(async (req, res) => {
  try {
    const { nozzlemanId } = req.params;
    const { status, startDate, endDate } = req.query;

    let filter = { nozzleman: nozzlemanId };

    if (status) filter.status = status;

    // Date range filter
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        filter.startTime.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filter.startTime.$lte = end;
      }
    }

    const shifts = await Shift.find(filter)
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("auditedBy", "name email")
      .sort({ startTime: -1 });

    // Calculate statistics
    const totalFuel = shifts.reduce((sum, shift) => sum + (shift.fuelDispensed || 0), 0);
    const totalCash = shifts.reduce((sum, shift) => sum + (shift.cashCollected || 0), 0);
    const completedShifts = shifts.filter(shift => shift.status === "Approved").length;

    res.json({
      shifts,
      statistics: {
        totalShifts: shifts.length,
        completedShifts,
        totalFuelDispensed: totalFuel,
        totalCashCollected: totalCash
      }
    });
  } catch (error) {
    console.error("Error in getShiftsByNozzleman:", error);
    res.status(500);
    throw new Error("Failed to fetch nozzleman shifts");
  }
});

// @desc    Get current active shift for nozzleman
// @route   GET /api/shifts/active/nozzleman
// @access  Private (Nozzleman only)
export const getActiveShift = asyncHandler(async (req, res) => {
  try {
    const nozzlemanId = req.user.nozzlemanProfile;

    if (!nozzlemanId) {
      res.status(403);
      throw new Error("No nozzleman profile found");
    }

    const activeShift = await Shift.findOne({
      nozzleman: nozzlemanId,
      status: "Active"
    })
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType currentReading");

    if (!activeShift) {
      return res.json({ 
        hasActiveShift: false,
        message: "No active shift found"
      });
    }

    res.json({
      hasActiveShift: true,
      shift: activeShift
    });
  } catch (error) {
    console.error("Error in getActiveShift:", error);
    res.status(500);
    throw new Error("Failed to fetch active shift");
  }
});

// @desc    Cancel shift
// @route   PUT /api/shifts/cancel/:id
// @access  Private (Admin/Supervisor)
export const cancelShift = asyncHandler(async (req, res) => {
  try {
    const { reason } = req.body;

    const shift = await Shift.findById(req.params.id);
    
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    if (shift.status === "Completed" || shift.status === "Approved") {
      res.status(400);
      throw new Error("Cannot cancel completed or approved shift");
    }

    shift.status = "Cancelled";
    shift.auditNotes = `Cancelled: ${reason}`;
    shift.auditedBy = req.user._id;
    shift.auditedAt = new Date();

    const updatedShift = await shift.save();

    res.json({
      message: "Shift cancelled successfully",
      shift: updatedShift
    });
  } catch (error) {
    console.error("Error in cancelShift:", error);
    res.status(500);
    throw new Error("Failed to cancel shift");
  }
});

// @desc    Get yesterday's closing readings for a nozzleman
// @route   GET /api/shifts/yesterday-readings/:nozzlemanId
// @access  Private
export const getYesterdayReadings = asyncHandler(async (req, res) => {
  const { nozzlemanId } = req.params;
  const { date } = req.query;
  
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // Find yesterday's completed shifts for this nozzleman
  const yesterdayShifts = await Shift.find({
    nozzleman: nozzlemanId,
    status: "Completed",
    endTime: {
      $gte: new Date(yesterday.setHours(0, 0, 0, 0)),
      $lte: new Date(yesterday.setHours(23, 59, 59, 999))
    }
  }).populate('nozzle', 'number fuelType');
  
  const nozzleReadings = yesterdayShifts.map(shift => ({
    nozzleId: shift.nozzle._id,
    nozzleNumber: shift.nozzle.number,
    fuelType: shift.nozzle.fuelType,
    closingReading: shift.endReading // This becomes today's opening
  }));
  
  res.json({ nozzleReadings });
});

// controllers/shiftController.js - UPDATED VERSION
export const createManualShiftEntry = asyncHandler(async (req, res) => {
  try {
    console.log("🔍 Manual Shift Entry Request");
    console.log("User Role:", req.user?.role);
    console.log("Request Body:", req.body);

    const {
      nozzlemanId,
      pumpId,
      nozzleId,
      startReading,
      endReading,
      startTime,
      endTime,
      date,
      notes = "",
      // Initial values
      cashCollected = 0,
      phonePeSales = 0,
      posSales = 0,
      otpSales = 0,
      creditSales = 0,
      fuelDispensed = 0,
      testingFuel = 0,
      expenses = 0,
      cashDeposit = 0,
      cashInHand = 0,
      status = "Active", // Default to Active for admin-created shifts
      meterReadingHSD = { opening: 0, closing: 0 },
      meterReadingPetrol = { opening: 0, closing: 0 },
      shiftId,
      // NEW FLAG FOR SIMPLE SHIFT START
      isSimpleStart = false // Add this flag
    } = req.body;

    // VALIDATION - REQUIRED FIELDS
    if (!nozzlemanId) {
      return res.status(400).json({
        success: false,
        error: "Nozzleman ID is required"
      });
    }

    // For simple shift start, only date is required
    let requiredDate = date;
    if (!requiredDate && !isSimpleStart) {
      return res.status(400).json({
        success: false,
        error: "Date is required"
      });
    }

    // If no date provided for simple start, use today
    if (!requiredDate && isSimpleStart) {
      requiredDate = new Date().toISOString().split('T')[0];
    }

    // Check if nozzleman exists
    const nozzleman = await Nozzleman.findById(nozzlemanId);
    if (!nozzleman) {
      return res.status(404).json({
        success: false,
        error: "Nozzleman not found"
      });
    }

    // Check if nozzleman already has active shift
    const activeShift = await Shift.findOne({
      nozzleman: nozzlemanId,
      status: { $in: ["Active", "Pending Approval"] }
    });

    if (activeShift) {
      return res.status(400).json({
        success: false,
        error: `Nozzleman already has an active shift (${activeShift.shiftId})`,
        activeShiftId: activeShift._id,
        shiftId: activeShift.shiftId
      });
    }

    // Generate shift ID if not provided
    const finalShiftId = shiftId || `SH-${Date.now().toString().slice(-6)}`;

    // Parse dates
    let parsedStartTime, parsedEndTime;
    
    if (startTime && requiredDate) {
      parsedStartTime = new Date(`${requiredDate}T${startTime}:00.000Z`);
    } else if (requiredDate) {
      parsedStartTime = new Date(`${requiredDate}T08:00:00.000Z`); // Default 8 AM
    } else {
      parsedStartTime = new Date();
    }

    if (endTime && requiredDate) {
      parsedEndTime = new Date(`${requiredDate}T${endTime}:00.000Z`);
    } else {
      parsedEndTime = new Date(parsedStartTime);
      parsedEndTime.setHours(parsedEndTime.getHours() + 8); // Default 8 hour shift
    }

    // FOR SIMPLE SHIFT START - Use nozzleman's assigned pump & nozzle
    let finalPumpId = pumpId;
    let finalNozzleId = nozzleId;
    let finalStartReading = startReading;

    if (isSimpleStart) {
      // Try to get nozzleman's assigned pump and nozzle
      if (nozzleman.assignedPump) {
        finalPumpId = nozzleman.assignedPump;
      }
      
      if (nozzleman.assignedNozzle) {
        finalNozzleId = nozzleman.assignedNozzle;
        
        // Get current reading from nozzle
        const nozzle = await Nozzle.findById(finalNozzleId);
        if (nozzle) {
          finalStartReading = nozzle.currentReading || 0;
        }
      }
    }

    // Create shift data
    const shiftData = {
      shiftId: finalShiftId,
      nozzleman: nozzlemanId,
      pump: finalPumpId,
      nozzle: finalNozzleId,
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      startReading: parseFloat(finalStartReading) || 0,
      endReading: parseFloat(endReading) || parseFloat(finalStartReading) || 0,
      fuelDispensed: parseFloat(fuelDispensed) || 0,
      testingFuel: parseFloat(testingFuel) || 0,
      cashCollected: parseFloat(cashCollected) || 0,
      phonePeSales: parseFloat(phonePeSales) || 0,
      posSales: parseFloat(posSales) || 0,
      otpSales: parseFloat(otpSales) || 0,
      creditSales: parseFloat(creditSales) || 0,
      expenses: parseFloat(expenses) || 0,
      cashDeposit: parseFloat(cashDeposit) || 0,
      cashInHand: parseFloat(cashInHand) || 0,
      meterReadingHSD: meterReadingHSD,
      meterReadingPetrol: meterReadingPetrol,
      status: status,
      notes: notes || `Shift started by ${req.user.name} for ${nozzleman.name}`,
      isManualEntry: true,
      createdBy: req.user._id
    };

    // Remove null/undefined fields
    Object.keys(shiftData).forEach(key => {
      if (shiftData[key] === null || shiftData[key] === undefined) {
        delete shiftData[key];
      }
    });

    console.log("📋 Creating shift with data:", shiftData);

    const shift = await Shift.create(shiftData);

    // Update nozzle current reading if available
    if (finalNozzleId) {
      await Nozzle.findByIdAndUpdate(finalNozzleId, {
        currentReading: parseFloat(finalStartReading) || 0
      });
    }

    // Update nozzleman stats
    await Nozzleman.findByIdAndUpdate(nozzlemanId, {
      $inc: { totalShifts: 1 }
    });

    // Populate response
    const populatedShift = await Shift.findById(shift._id)
      .populate("nozzleman", "name employeeId mobile")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("createdBy", "name email");

    res.status(201).json({
      success: true,
      message: isSimpleStart ? "Shift started successfully" : "Manual entry created successfully",
      shift: populatedShift,
      isSimpleStart: isSimpleStart
    });

  } catch (error) {
    console.error("❌ Error in createManualShiftEntry:", error);
    res.status(500).json({
      success: false,
      error: "Failed to create entry",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

