// controllers/auditController.js - COMPLETE UPDATED VERSION
import Shift from "../models/Shift.js";
import CashHandover from "../models/CashHandover.js";
import FuelStock from "../models/FuelStock.js";
import StockAdjustment from "../models/StockAdjustment.js";
import Sale from "../models/Sale.js";
import AuditLog from "../models/AuditLog.js";
import AuditReport from "../models/Audit.js";
import Notification from "../models/Notification.js";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";
import TankConfig from "../models/TankConfig.js";

// // Helper: Generate or resolve low stock alerts - FIXED VERSION
// const handleLowStockAlert = async (stock) => {
//   try {
//     if (!stock?.product || stock.currentLevel === undefined) {
//       console.log('⚠️ Invalid stock data for alert handling:', stock);
//       return;
//     }

//     console.log(`🔍 Checking stock alert for ${stock.product}: ${stock.currentLevel}%`);

//     // If below 20% capacity -> create alert
//     if (stock.currentLevel <= 20) {
//       const existing = await Notification.findOne({
//         type: "Stock",
//         description: { $regex: stock.product, $options: "i" },
//         status: "Unread",
//       });

//       if (!existing) {
//         await Notification.create({
//           type: "Stock",
//           description: `${stock.product} stock critically low at ${stock.currentLevel}%`,
//           priority: stock.currentLevel <= 10 ? "High" : "Medium",
//           status: "Unread",
//         });
//         console.log(`🔔 Low stock alert created for ${stock.product} at ${stock.currentLevel}%`);
//       } else {
//         console.log(`ℹ️ Low stock alert already exists for ${stock.product}`);
//       }
//     }

//     // If refilled (> 30%) -> mark previous alerts as Read
//     if (stock.currentLevel > 30) {
//       const result = await Notification.updateMany(
//         {
//           type: "Stock",
//           description: { $regex: stock.product, $options: "i" },
//           status: "Unread",
//         },
//         { status: "Read" }
//       );
      
//       if (result.modifiedCount > 0) {
//         console.log(`✅ Resolved ${result.modifiedCount} low stock alerts for ${stock.product}`);
//       }
//     }
//   } catch (err) {
//     console.error("⚠️ Error handling stock alert:", err.message);
//   }
// };
// @desc    Get auditor dashboard statistics
// @route   GET /api/audit/stats
// @access  Private (Auditor)
export const getAuditorStats = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // Pending shifts count
    const pendingShifts = await Shift.countDocuments({
      status: "Pending Approval"
    });

    // Pending cash entries count
    const pendingCashEntries = await CashHandover.countDocuments({
      status: "Pending"
    });

    // Stock discrepancies
    const stockDiscrepancies = await checkStockDiscrepancies();

    // Pending stock adjustments count
    const pendingStockAdjustments = await StockAdjustment.countDocuments({
      status: "Pending"
    });

    // Pending sales audits (sales without verification)
    const pendingSalesAudits = await Sale.countDocuments({
      verifiedBy: { $exists: false },
      createdAt: { $gte: today, $lt: tomorrow }
    });

    // Today's audit summary
    const approvedCount = await AuditLog.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
      action: "approved"
    });

    const rejectedCount = await AuditLog.countDocuments({
      createdAt: { $gte: today, $lt: tomorrow },
      action: "rejected"
    });

    console.log("📊 Auditor Stats:", {
      pendingShifts,
      pendingCashEntries,
      stockDiscrepancies,
      pendingStockAdjustments,
      pendingSalesAudits
    });

    res.json({
      pendingShifts,
      pendingCashEntries,
      stockDiscrepancies,
      pendingSalesAudits: pendingSalesAudits + pendingStockAdjustments,
      totalApproved: approvedCount,
      totalRejected: rejectedCount
    });
  } catch (error) {
    console.error("Error fetching auditor stats:", error);
    res.status(500);
    throw new Error("Failed to fetch auditor statistics");
  }
});



// @desc    Get pending shifts for approval
// @route   GET /api/audit/shifts/pending
// @access  Private (Auditor)
export const getPendingShifts = asyncHandler(async (req, res) => {
  try {
    const shifts = await Shift.find({
      status: "Pending Approval"
    })
    .populate("nozzleman", "name employeeId")
    .populate("nozzle", "name fuelType rate")
    .populate("pump", "name")
    .sort({ endTime: -1 });

    const shiftsWithCalculations = shifts.map(shift => {
      const expectedCash = shift.fuelDispensed * (shift.nozzle?.rate || 0);
      const discrepancy = shift.cashCollected - expectedCash;
      
      return {
        ...shift.toObject(),
        expectedCash,
        discrepancy
      };
    });

    console.log(`📋 Found ${shiftsWithCalculations.length} pending shifts`);
    res.json(shiftsWithCalculations);
  } catch (error) {
    console.error("Error fetching pending shifts:", error);
    res.status(500);
    throw new Error("Failed to fetch pending shifts");
  }
});

// @desc    Approve/Reject shift
// @route   POST /api/audit/shifts/:id/approve
// @access  Private (Auditor)
export const approveShift = asyncHandler(async (req, res) => {
  const { approved, notes } = req.body;

  try {
    console.log("🔄 Processing shift approval:", req.params.id, { approved, notes });

    const shift = await Shift.findById(req.params.id);
    if (!shift) {
      res.status(404);
      throw new Error("Shift not found");
    }

    if (shift.status !== "Pending Approval") {
      res.status(400);
      throw new Error("Shift is not pending approval");
    }

    shift.status = approved ? "Approved" : "Rejected";
    shift.auditNotes = notes;
    shift.auditedBy = req.user._id;
    shift.auditedAt = new Date();

    await shift.save();

    // Create audit log
    await AuditLog.create({
      action: approved ? "approved" : "rejected",
      entityType: "Shift",
      entityId: shift._id,
      entityName: `Shift ${shift.shiftId}`,
      performedBy: req.user._id,
      notes: notes || (approved ? "Shift approved by auditor" : "Shift rejected by auditor"),
      details: {
        fuelDispensed: shift.fuelDispensed,
        cashCollected: shift.cashCollected,
        expectedCash: shift.fuelDispensed * (shift.nozzle?.rate || 0)
      }
    });

    res.json({
      message: `Shift ${approved ? "approved" : "rejected"} successfully`,
      shift
    });
  } catch (error) {
    console.error("Error approving shift:", error);
    res.status(500);
    throw new Error("Failed to process shift approval");
  }
});

// @desc    Get pending cash entries
// @route   GET /api/audit/cash/pending
// @access  Private (Auditor)
export const getPendingCashEntries = asyncHandler(async (req, res) => {
  try {
    const cashEntries = await CashHandover.find({
      status: "Pending"
    })
    .populate({
      path: "shift",
      populate: {
        path: "nozzleman",
        select: "name"
      }
    })
    .populate("nozzleman", "name")
    .populate("verifiedBy", "name")
    .sort({ createdAt: -1 });

    console.log(`💰 Found ${cashEntries.length} pending cash entries`);
    res.json(cashEntries);
  } catch (error) {
    console.error("Error fetching pending cash entries:", error);
    res.status(500);
    throw new Error("Failed to fetch pending cash entries");
  }
});

// @desc    Verify cash entry
// @route   POST /api/audit/cash/:id/verify
// @access  Private (Auditor)
export const verifyCashEntry = asyncHandler(async (req, res) => {
  const { approved, notes } = req.body;

  try {
    const cashEntry = await CashHandover.findById(req.params.id);
    if (!cashEntry) {
      res.status(404);
      throw new Error("Cash entry not found");
    }

    cashEntry.status = approved ? "Verified" : "Rejected";
    cashEntry.verifiedBy = req.user._id;
    cashEntry.verifiedAt = new Date();
    cashEntry.notes = notes || (approved ? "Cash entry verified" : "Cash entry rejected");

    await cashEntry.save();

    // Create audit log
    await AuditLog.create({
      action: approved ? "approved" : "rejected",
      entityType: "CashEntry",
      entityId: cashEntry._id,
      entityName: `Cash Handover ${cashEntry._id}`,
      performedBy: req.user._id,
      notes: cashEntry.notes,
      details: {
        amount: cashEntry.amount,
        shift: cashEntry.shift
      }
    });

    res.json({
      message: `Cash entry ${approved ? "verified" : "rejected"} successfully`,
      cashEntry
    });
  } catch (error) {
    console.error("Error verifying cash entry:", error);
    res.status(500);
    throw new Error("Failed to verify cash entry");
  }
});

// In auditController.js - Update getStockDiscrepancies to show pending adjustments
export const getStockDiscrepancies = asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const discrepancies = [];
    const products = ["Petrol", "Diesel", "CNG"];

    console.log(`🔍 Checking stock discrepancies for:`, products);

    for (const product of products) {
      // Get latest stock entry for each product
      const latestStock = await FuelStock.findOne({ product })
        .sort({ createdAt: -1 });

      if (latestStock) {
        const expectedClosing = await calculateExpectedStock(product, today, tomorrow);
        const actualClosing = latestStock.closingStock;
        const difference = actualClosing - expectedClosing;

        console.log(`📊 ${product}: Expected=${expectedClosing}, Actual=${actualClosing}, Diff=${difference}`);

        if (Math.abs(difference) > 1) {
          discrepancies.push({
            product,
            expectedClosing,
            actualClosing,
            difference,
            stockEntry: {
              openingStock: latestStock.openingStock,
              purchases: latestStock.purchaseQuantity || 0,
              sales: 0,
              closingStock: latestStock.closingStock,
              capacity: latestStock.capacity || 0,
              currentLevel: latestStock.currentLevel,
              alert: latestStock.alert
            },
            severity: Math.abs(difference) > 100 ? "High" : "Medium"
          });
        }
      }
    }

    // Get ALL pending stock adjustments (not just today)
    const pendingAdjustments = await StockAdjustment.find({
      status: "Pending"
    })
    .populate("adjustedBy", "name")
    .populate("tank", "tankName product capacity")
    .sort({ createdAt: -1 });

    console.log(`📦 Found ${discrepancies.length} discrepancies and ${pendingAdjustments.length} pending adjustments`);

    res.json({
      calculationDiscrepancies: discrepancies,
      pendingAdjustments
    });
  } catch (error) {
    console.error("Error fetching stock discrepancies:", error);
    res.status(500);
    throw new Error("Failed to fetch stock discrepancies");
  }
});

// In auditController.js - UPDATE approveStockAdjustment function
export const approveStockAdjustment = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { approved, notes } = req.body;
    const auditorId = req.user._id;

    console.log(`🔄 Processing stock adjustment: ${id}, Approved: ${approved}`);

    // Find the adjustment with proper population
    const adjustment = await StockAdjustment.findById(id)
      .populate('tank');
    
    if (!adjustment) {
      return res.status(404).json({
        message: "Stock adjustment not found"
      });
    }

    if (adjustment.status !== "Pending") {
      return res.status(400).json({
        message: "Adjustment has already been processed"
      });
    }

    // Update adjustment status
    adjustment.status = approved ? "Approved" : "Rejected";
    adjustment.approvedBy = auditorId;
    adjustment.approvalNotes = notes || `Stock adjustment ${approved ? 'approved' : 'rejected'}`;
    adjustment.approvedAt = new Date();

    await adjustment.save();

    // ONLY if approved, update the actual fuel stock
    if (approved) {
      try {
        console.log('🔄 Starting fuel stock update process...');
        await updateFuelStockFromAdjustment(adjustment);
        
        // Verify the update worked by fetching the updated tank
        const updatedTank = await TankConfig.findById(adjustment.tank._id);
        console.log(`✅ Verification - Tank ${updatedTank.tankName} now has: ${updatedTank.currentStock}L (${updatedTank.currentLevel}%)`);
        
      } catch (stockError) {
        console.error("❌ Failed to update fuel stock:", stockError);
        // Revert the adjustment status
        adjustment.status = "Pending";
        adjustment.approvedBy = undefined;
        adjustment.approvalNotes = undefined;
        adjustment.approvedAt = undefined;
        await adjustment.save();
        
        return res.status(500).json({
          message: `Failed to update tank stock: ${stockError.message}`,
          error: stockError.message
        });
      }
    }

    // Create audit log
    await AuditLog.create({
      action: approved ? "approved" : "rejected",
      entityType: "StockAdjustment",
      entityId: adjustment._id,
      entityName: `${adjustment.tank?.product} ${adjustment.adjustmentType}`,
      performedBy: auditorId,
      notes: adjustment.approvalNotes,
      details: {
        product: adjustment.tank?.product,
        adjustmentType: adjustment.adjustmentType,
        quantity: adjustment.quantity,
        previousStock: adjustment.previousStock,
        newStock: adjustment.newStock,
        tankName: adjustment.tank?.tankName
      }
    });

    console.log(`✅ Stock adjustment ${approved ? 'approved' : 'rejected'} successfully`);

    res.status(200).json({
      message: `Stock adjustment ${approved ? 'approved' : 'rejected'} successfully`,
      adjustment,
      tankUpdated: approved ? {
        tankName: adjustment.tank?.tankName,
        newStock: adjustment.newStock,
        newLevel: Math.round((adjustment.newStock / adjustment.tank?.capacity) * 100)
      } : undefined
    });

  } catch (error) {
    console.error("❌ Error processing stock adjustment:", error);
    res.status(500).json({
      message: "Failed to process stock adjustment",
      error: error.message
    });
  }
});

// Update the updateFuelStockFromAdjustment function to create FuelStock record
// In auditController.js - UPDATE the updateFuelStockFromAdjustment function
// In auditController.js - UPDATE the updateFuelStockFromAdjustment function
const updateFuelStockFromAdjustment = async (adjustment) => {
  try {
    console.log('🔄 Updating fuel stock for approved adjustment:', adjustment._id);

    // Validate tank exists - FIXED: Use the imported TankConfig model
    if (!adjustment.tank) {
      throw new Error("Tank not found in adjustment");
    }

    // Get current tank state
    const tank = await TankConfig.findById(adjustment.tank._id || adjustment.tank);
    if (!tank) {
      throw new Error(`Tank configuration not found for ID: ${adjustment.tank._id || adjustment.tank}`);
    }

    const currentStock = tank.currentStock || 0;
    
    console.log(`📊 Current tank stock: ${currentStock}L, Adjustment target: ${adjustment.newStock}L`);

    // Calculate the difference for the FuelStock record
    const quantity = adjustment.newStock - currentStock;
    
    // Create FuelStock transaction record
    const fuelStockData = {
      tank: tank._id,
      transactionType: "adjustment",
      quantity: quantity,
      previousStock: currentStock,
      newStock: adjustment.newStock,
      product: tank.product,
      ratePerLiter: 0,
      amount: 0,
      supplier: "System Adjustment - Auditor Approved",
      invoiceNumber: `ADJ-APPROVED-${Date.now()}`,
      reason: adjustment.reason,
      date: new Date(),
      recordedBy: adjustment.adjustedBy
    };

    console.log('💾 Creating FuelStock record:', fuelStockData);

    const fuelStock = await FuelStock.create(fuelStockData);

    // Update tank current stock
    const currentLevel = Math.round((adjustment.newStock / tank.capacity) * 100);
    const alert = currentLevel <= 20;

    console.log(`📈 Updating tank ${tank.tankName}: ${currentStock}L → ${adjustment.newStock}L (${currentLevel}%)`);

    const updatedTank = await TankConfig.findByIdAndUpdate(
      tank._id, 
      {
        currentStock: adjustment.newStock,
        currentLevel: currentLevel,
        alert: alert,
        lastUpdated: new Date()
      },
      { new: true } // Return the updated document
    );

    console.log(`✅ Updated tank ${updatedTank.tankName} stock to: ${updatedTank.currentStock}L`);

    // Trigger low stock alert handling
    await handleLowStockAlert({
      product: tank.product,
      currentLevel: currentLevel,
      closingStock: adjustment.newStock
    });

    return fuelStock;

  } catch (error) {
    console.error("❌ Error updating fuel stock from adjustment:", error);
    throw error;
  }
};


export const getPendingSalesAudits = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const salesTransactions = await Sale.find({
      verifiedBy: { $exists: false },
      createdAt: { $gte: today, $lt: tomorrow }
    })
    .populate("shift", "shiftId nozzleman")
    .populate("nozzle", "name fuelType rate")
    .populate("customer", "name")
    .sort({ createdAt: -1 });

    res.json(salesTransactions);
  } catch (error) {
    console.error("Error fetching pending sales:", error);
    res.status(500);
    throw new Error("Failed to fetch pending sales audits");
  }
});

// ADD TO auditController.js

// @desc    Verify sales transaction with automatic tank deduction
// @route   POST /api/audit/sales/:id/verify
// @access  Private (Auditor)
export const verifySalesTransaction = asyncHandler(async (req, res) => {
  const { approved, notes } = req.body;

  try {
    const salesTransaction = await Sale.findById(req.params.id)
      .populate("nozzle", "fuelType")
      .populate("shift", "nozzleman pump");

    if (!salesTransaction) {
      res.status(404);
      throw new Error("Sales transaction not found");
    }

    if (approved) {
      salesTransaction.verifiedBy = req.user._id;
      
      // ✅ AUTOMATIC TANK DEDUCTION WHEN VERIFIED
      if (!salesTransaction.tankDeducted) {
        await deductFuelFromTankForSale(salesTransaction);
        salesTransaction.tankDeducted = true;
        salesTransaction.deductionNotes = "Automatically deducted upon auditor verification";
      }
    } else {
      // Mark as rejected
      salesTransaction.auditStatus = "Rejected";
      salesTransaction.auditNotes = notes;
    }

    await salesTransaction.save();

    // Create audit log
    await AuditLog.create({
      action: approved ? "approved" : "rejected",
      entityType: "SalesTransaction",
      entityId: salesTransaction._id,
      entityName: `Sales Transaction ${salesTransaction.transactionId}`,
      performedBy: req.user._id,
      notes: notes || (approved ? "Sales transaction verified with automatic tank deduction" : "Sales transaction rejected"),
      details: {
        amount: salesTransaction.totalAmount,
        liters: salesTransaction.liters,
        fuelType: salesTransaction.fuelType,
        tankDeducted: approved ? true : false
      }
    });

    res.json({
      message: `Sales transaction ${approved ? "verified" : "rejected"} successfully`,
      salesTransaction,
      tankDeducted: approved
    });
  } catch (error) {
    console.error("Error verifying sales transaction:", error);
    res.status(500);
    throw new Error("Failed to verify sales transaction");
  }
});

// ✅ NEW FUNCTION: Deduct fuel from tank for verified sales
const deductFuelFromTankForSale = async (sale) => {
  try {
    console.log(`🔄 Starting automatic tank deduction for sale ${sale.transactionId}`);
    
    const fuelType = sale.fuelType;
    const fuelLiters = sale.liters;

    console.log(`⛽ Fuel deduction for sale: ${fuelLiters}L of ${fuelType}`);

    // Find the tank configuration for this fuel type
    const TankConfig = mongoose.model("TankConfig");
    const tank = await TankConfig.findOne({ 
      product: fuelType === "Petrol" ? "MS" : "HSD",
      isActive: true 
    });
    
    if (!tank) {
      throw new Error(`Active tank configuration not found for fuel type: ${fuelType}`);
    }

    console.log(`📦 Found tank: ${tank.tankName}, Current stock: ${tank.currentStock}L`);

    // Calculate new stock
    const previousStock = tank.currentStock || 0;
    const newStock = Math.max(0, previousStock - fuelLiters);
    const currentLevel = Math.round((newStock / tank.capacity) * 100);
    const alert = currentLevel <= 20;

    console.log(`📊 Tank update: ${previousStock}L - ${fuelLiters}L = ${newStock}L (${currentLevel}%)`);

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

    // Create FuelStock record for the sale deduction
    const FuelStock = mongoose.model("FuelStock");
    await FuelStock.create({
      tank: tank._id,
      transactionType: "sale",
      quantity: -fuelLiters, // Negative for deduction
      previousStock: previousStock,
      newStock: newStock,
      product: tank.product,
      ratePerLiter: sale.price,
      amount: sale.totalAmount,
      saleReference: sale._id,
      shift: sale.shift?._id,
      nozzleman: sale.shift?.nozzleman,
      reason: `Automatic deduction from verified sale ${sale.transactionId}`,
      date: new Date(),
      recordedBy: sale.verifiedBy
    });

    // Update sale with tank reference
    await Sale.findByIdAndUpdate(sale._id, {
      tankReference: tank._id
    });

    console.log(`✅ Successfully deducted ${fuelLiters}L from tank ${tank.tankName}`);
    console.log(`📈 New tank stock: ${updatedTank.currentStock}L (${updatedTank.currentLevel}%)`);

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
    console.error("❌ Error in deductFuelFromTankForSale:", error);
    throw error;
  }
};

// @desc    Get audit report
// @route   GET /api/audit/report
// @access  Private (Auditor)
export const getAuditReport = asyncHandler(async (req, res) => {
  const { date } = req.query;
  
  const reportDate = date ? new Date(date) : new Date();
  reportDate.setHours(0, 0, 0, 0);
  
  const nextDay = new Date(reportDate);
  nextDay.setDate(nextDay.getDate() + 1);

  try {
    // Get all audit logs for the date
    const auditLogs = await AuditLog.find({
      createdAt: { $gte: reportDate, $lt: nextDay }
    })
    .populate("performedBy", "name email")
    .sort({ createdAt: -1 });

    // Get summary statistics
    const shiftsApproved = await AuditLog.countDocuments({
      createdAt: { $gte: reportDate, $lt: nextDay },
      entityType: "Shift",
      action: "approved"
    });

    const shiftsRejected = await AuditLog.countDocuments({
      createdAt: { $gte: reportDate, $lt: nextDay },
      entityType: "Shift",
      action: "rejected"
    });

    const cashEntriesApproved = await AuditLog.countDocuments({
      createdAt: { $gte: reportDate, $lt: nextDay },
      entityType: "CashEntry",
      action: "approved"
    });

    const stockAdjustmentsApproved = await AuditLog.countDocuments({
      createdAt: { $gte: reportDate, $lt: nextDay },
      entityType: "StockAdjustment",
      action: "approved"
    });

    // Check if report already exists
    const existingReport = await AuditReport.findOne({
      reportDate: { $gte: reportDate, $lt: nextDay }
    });

    res.json({
      reportDate: reportDate.toISOString().split('T')[0],
      summary: {
        shiftsApproved,
        shiftsRejected,
        cashEntriesApproved,
        stockAdjustmentsApproved,
        totalAudits: auditLogs.length
      },
      auditLogs,
      existingReport
    });
  } catch (error) {
    console.error("Error fetching audit report:", error);
    res.status(500);
    throw new Error("Failed to fetch audit report");
  }
});

// @desc    Create audit sign-off
// @route   POST /api/audit/report/sign-off
// @access  Private (Auditor)
export const createAuditSignOff = asyncHandler(async (req, res) => {
  const { reportDate, overallFindings, recommendations, isDataVerified } = req.body;

  try {
    const auditDate = new Date(reportDate);
    auditDate.setHours(0, 0, 0, 0);
    
    const nextDay = new Date(auditDate);
    nextDay.setDate(nextDay.getDate() + 1);

    // Check if report already exists
    const existingReport = await AuditReport.findOne({
      reportDate: { $gte: auditDate, $lt: nextDay }
    });

    if (existingReport) {
      res.status(400);
      throw new Error("Audit report already exists for this date");
    }

    // Get audit summary for the date
    const auditLogs = await AuditLog.find({
      createdAt: { $gte: auditDate, $lt: nextDay }
    });

    const auditReport = await AuditReport.create({
      reportDate: auditDate,
      performedBy: req.user._id,
      overallFindings,
      recommendations,
      isDataVerified,
      summary: {
        totalAudits: auditLogs.length,
        approved: auditLogs.filter(log => log.action === 'approved').length,
        rejected: auditLogs.filter(log => log.action === 'rejected').length
      },
      signedAt: new Date()
    });

    res.status(201).json({
      message: "Audit report signed off successfully",
      auditReport
    });
  } catch (error) {
    console.error("Error creating audit sign-off:", error);
    res.status(500);
    throw new Error("Failed to create audit sign-off");
  }
});

// Fix the calculateExpectedStock function
const calculateExpectedStock = async (product, startDate, endDate) => {
  try {
    console.log(`📊 Calculating expected stock for ${product} from ${startDate} to ${endDate}`);

    // Get ALL stock entries for this product, sorted by date
    const stockEntries = await FuelStock.find({
      product,
      date: { $gte: startDate, $lt: endDate }
    }).sort({ date: 1, createdAt: 1 });

    if (stockEntries.length === 0) {
      console.log(`📊 No stock entries found for ${product} in this period`);
      return 0;
    }

    // The first entry's opening stock is our starting point
    const openingStock = stockEntries[0].openingStock;
    console.log(`📊 Opening stock for ${product}: ${openingStock}L`);

    // Calculate net changes from all entries
    let totalPurchases = 0;
    let totalSales = 0;

    stockEntries.forEach((entry, index) => {
      const purchases = entry.purchaseQuantity || 0;
      // For sales, we need to calculate from closing/opening
      const sales = (entry.openingStock + purchases) - (entry.closingStock || 0);
      
      totalPurchases += purchases;
      totalSales += Math.max(0, sales); // Ensure sales don't go negative
      
      console.log(`📊 Entry ${index + 1}: Opening=${entry.openingStock}L, Purchases=${purchases}L, Closing=${entry.closingStock}L, Sales=${sales}L`);
    });

    const expectedStock = openingStock + totalPurchases - totalSales;
    
    console.log(`📊 Expected stock calculation for ${product}:`);
    console.log(`   Opening: ${openingStock}L`);
    console.log(`   Purchases: +${totalPurchases}L`);
    console.log(`   Sales: -${totalSales}L`);
    console.log(`   Expected: ${expectedStock}L`);
    
    return expectedStock;
  } catch (error) {
    console.error("❌ Error calculating expected stock:", error);
    return 0;
  }
};
// Helper function to check stock discrepancies
const checkStockDiscrepancies = async () => {
  try {
    const products = await FuelStock.distinct("product");
    let discrepancies = 0;

    for (const product of products) {
      const latestStocks = await FuelStock.find({ product })
        .sort({ createdAt: -1 })
        .limit(2);

      if (latestStocks.length === 2) {
        const [current, previous] = latestStocks;
        if (Math.abs(previous.closingStock - current.openingStock) > 1) {
          discrepancies++;
        }
      }
    }

    return discrepancies;
  } catch (error) {
    console.error("Error checking stock discrepancies:", error);
    return 0;
  }
};





// controllers/auditController.js - ADD THESE FUNCTIONS

// @desc    Get tank stock levels for audit
// @route   GET /api/audit/tank-levels
// @access  Private (Auditor)
export const getTankLevelsForAudit = asyncHandler(async (req, res) => {
  try {
    const TankConfig = mongoose.model("TankConfig");
    const tanks = await TankConfig.find({})
      .select('tankName product capacity currentStock currentLevel alert lastUpdated')
      .sort({ product: 1 });

    console.log(`📊 Found ${tanks.length} tanks for audit`);

    res.json({
      tanks,
      summary: {
        totalTanks: tanks.length,
        lowStockTanks: tanks.filter(tank => tank.alert).length,
        totalCapacity: tanks.reduce((sum, tank) => sum + tank.capacity, 0),
        totalCurrentStock: tanks.reduce((sum, tank) => sum + tank.currentStock, 0)
      }
    });
  } catch (error) {
    console.error("Error fetching tank levels:", error);
    res.status(500);
    throw new Error("Failed to fetch tank levels for audit");
  }
});

// @desc    Adjust tank stock manually (for discrepancies)
// @route   POST /api/audit/tanks/:id/adjust
// @access  Private (Auditor)
export const adjustTankStock = asyncHandler(async (req, res) => {
  try {
    const { adjustment, reason, notes } = req.body;
    const auditorId = req.user._id;

    console.log(`🔄 Manual tank adjustment request:`, { adjustment, reason });

    const TankConfig = mongoose.model("TankConfig");
    const tank = await TankConfig.findById(req.params.id);
    
    if (!tank) {
      return res.status(404).json({
        message: "Tank not found"
      });
    }

    const previousStock = tank.currentStock;
    const newStock = Math.max(0, previousStock + parseFloat(adjustment));
    const currentLevel = Math.round((newStock / tank.capacity) * 100);
    const alert = currentLevel <= 20;

    console.log(`📊 Tank adjustment: ${tank.tankName} - ${previousStock}L + ${adjustment}L = ${newStock}L`);

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

    // Create FuelStock record for manual adjustment
    const FuelStock = mongoose.model("FuelStock");
    await FuelStock.create({
      tank: tank._id,
      transactionType: "manual_adjustment",
      quantity: parseFloat(adjustment),
      previousStock: previousStock,
      newStock: newStock,
      product: tank.product,
      ratePerLiter: 0,
      amount: 0,
      auditor: auditorId,
      reason: reason || "Manual adjustment by auditor",
      notes: notes,
      date: new Date(),
      recordedBy: auditorId
    });

    // Create audit log
    const AuditLog = mongoose.model("AuditLog");
    await AuditLog.create({
      action: "adjusted",
      entityType: "TankStock",
      entityId: tank._id,
      entityName: `Tank ${tank.tankName}`,
      performedBy: auditorId,
      notes: `Manual stock adjustment: ${adjustment}L. ${notes || ''}`,
      details: {
        product: tank.product,
        adjustment: parseFloat(adjustment),
        previousStock: previousStock,
        newStock: newStock,
        reason: reason
      }
    });

    // Trigger low stock alert if needed
    if (currentLevel <= 20) {
      await handleLowStockAlert({
        product: tank.product,
        currentLevel: currentLevel,
        closingStock: newStock
      });
    }

    res.status(200).json({
      message: "Tank stock adjusted successfully",
      adjustment: {
        tankName: updatedTank.tankName,
        product: updatedTank.product,
        adjustment: parseFloat(adjustment),
        previousStock: previousStock,
        newStock: updatedTank.currentStock,
        newLevel: updatedTank.currentLevel
      }
    });

  } catch (error) {
    console.error("❌ Error adjusting tank stock:", error);
    res.status(500).json({
      message: "Failed to adjust tank stock",
      error: error.message
    });
  }
});

// ✅ Add this to your existing helper functions in auditController.js
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