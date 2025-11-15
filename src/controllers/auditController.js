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

// Helper: Generate or resolve low stock alerts
const handleLowStockAlert = async (stock) => {
  try {
    if (!stock?.product) return;

    // If below 30% capacity -> create alert
    if (stock.currentLevel < 30) {
      const existing = await Notification.findOne({
        type: "Stock",
        description: { $regex: stock.product, $options: "i" },
        status: "Unread",
      });

      if (!existing) {
        await Notification.create({
          type: "Stock",
          description: `${stock.product} stock below 30%`,
          priority: stock.currentLevel < 15 ? "High" : "Medium",
          status: "Unread",
        });
        console.log(`🔔 Low stock alert created for ${stock.product}`);
      }
    }

    // If refilled (> 40%) -> mark previous alerts as Read
    if (stock.currentLevel > 40) {
      await Notification.updateMany(
        {
          type: "Stock",
          description: { $regex: stock.product, $options: "i" },
          status: "Unread",
        },
        { status: "Read" }
      );
    }
  } catch (err) {
    console.error("⚠️ Error handling stock alert:", err.message);
  }
};

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

// @desc    Get stock discrepancies
// @route   GET /api/audit/stock/discrepancies
// @access  Private (Auditor)
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
              purchases: latestStock.purchases,
              sales: latestStock.sales,
              closingStock: latestStock.closingStock,
              capacity: latestStock.capacity,
              currentLevel: latestStock.currentLevel
            },
            severity: Math.abs(difference) > 100 ? "High" : "Medium"
          });
        }
      }
    }

    // Get pending stock adjustments
    const pendingAdjustments = await StockAdjustment.find({
      status: "Pending"
    })
    .populate("adjustedBy", "name")
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

// @desc    Approve stock adjustment
// @route   POST /api/audit/stock/adjustments/:id/approve
// @access  Private (Auditor)
// In auditController.js - approveStockAdjustment function
export const approveStockAdjustment = asyncHandler(async (req, res) => {
  const { approved, notes } = req.body;

  try {
    console.log("🔄 Processing stock adjustment:", req.params.id, { approved, notes });

    const adjustment = await StockAdjustment.findById(req.params.id);
    if (!adjustment) {
      console.log("❌ Adjustment not found:", req.params.id);
      res.status(404);
      throw new Error("Stock adjustment not found");
    }

    console.log("📋 Found adjustment:", {
      id: adjustment._id,
      status: adjustment.status,
      product: adjustment.product
    });

    if (adjustment.status !== "Pending") {
      console.log("❌ Adjustment not pending:", adjustment.status);
      res.status(400);
      throw new Error("Adjustment is not pending approval");
    }

    // Update adjustment status
    adjustment.status = approved ? "Approved" : "Rejected";
    adjustment.approvedBy = req.user._id;
    adjustment.approvedAt = new Date();
    adjustment.approvalNotes = notes;

    await adjustment.save();
    console.log(`✅ Stock adjustment ${approved ? 'approved' : 'rejected'}:`, adjustment._id);

    // ✅ CRITICAL: Only create FuelStock entry if approved
    let fuelStockEntry = null;
    if (approved) {
      console.log("✅ Creating FuelStock entry for approved adjustment");
      
      const latestStock = await FuelStock.findOne({ product: adjustment.product })
        .sort({ createdAt: -1 });

      console.log("📊 Latest stock found:", latestStock);

      // Check if we have required fields
      if (!latestStock) {
        console.log("❌ No latest stock found for product:", adjustment.product);
        res.status(400);
        throw new Error(`No stock data found for ${adjustment.product}`);
      }

      fuelStockEntry = await FuelStock.create({
        product: adjustment.product,
        openingStock: adjustment.previousStock,
        purchases: adjustment.adjustmentType === "addition" ? adjustment.quantity : 0,
        sales: adjustment.adjustmentType === "deduction" ? adjustment.quantity : 0,
        capacity: latestStock.capacity,
        rate: latestStock.rate || 95,
        amount: 0,
        supplier: "System Adjustment - Auditor Approved",
        invoiceNumber: `ADJ-APPROVED-${Date.now()}`,
        date: new Date()
      });

      console.log("✅ FuelStock created:", fuelStockEntry._id);
      
      // ✅ Trigger low stock alert check
      await handleLowStockAlert(fuelStockEntry);
    }

    // Create audit log
    await AuditLog.create({
      action: approved ? "approved" : "rejected",
      entityType: "StockAdjustment",
      entityId: adjustment._id,
      entityName: `Stock Adjustment for ${adjustment.product}`,
      performedBy: req.user._id,
      notes: notes || (approved ? "Stock adjustment approved and applied" : "Stock adjustment rejected"),
      details: {
        product: adjustment.product,
        adjustmentType: adjustment.adjustmentType,
        quantity: adjustment.quantity,
        reason: adjustment.reason,
        previousStock: adjustment.previousStock,
        newStock: adjustment.newStock,
        fuelStockCreated: approved,
        fuelStockId: fuelStockEntry?._id
      }
    });

    console.log("✅ Audit log created successfully");

    res.json({
      message: `Stock adjustment ${approved ? "approved and applied" : "rejected"} successfully`,
      adjustment,
      fuelStockCreated: approved,
      fuelStock: fuelStockEntry
    });

  } catch (error) {
    console.error("❌ Error in approveStockAdjustment:", error);
    console.error("❌ Error details:", {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500);
    throw new Error(`Failed to process stock adjustment: ${error.message}`);
  }
});


// @desc    Get pending sales audits
// @route   GET /api/audit/sales/pending
// @access  Private (Auditor)
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

// @desc    Verify sales transaction
// @route   POST /api/audit/sales/:id/verify
// @access  Private (Auditor)
export const verifySalesTransaction = asyncHandler(async (req, res) => {
  const { approved, notes } = req.body;

  try {
    const salesTransaction = await Sale.findById(req.params.id);
    if (!salesTransaction) {
      res.status(404);
      throw new Error("Sales transaction not found");
    }

    if (approved) {
      salesTransaction.verifiedBy = req.user._id;
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
      notes: notes || (approved ? "Sales transaction verified" : "Sales transaction rejected"),
      details: {
        amount: salesTransaction.totalAmount,
        liters: salesTransaction.liters,
        fuelType: salesTransaction.nozzle?.fuelType
      }
    });

    res.json({
      message: `Sales transaction ${approved ? "verified" : "rejected"} successfully`,
      salesTransaction
    });
  } catch (error) {
    console.error("Error verifying sales transaction:", error);
    res.status(500);
    throw new Error("Failed to verify sales transaction");
  }
});

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

// Helper function to calculate expected stock
const calculateExpectedStock = async (product, startDate, endDate) => {
  try {
    // Get opening stock for the day
    const openingStockEntry = await FuelStock.findOne({
      product,
      date: { $gte: startDate, $lt: endDate }
    }).sort({ createdAt: 1 });

    if (!openingStockEntry) return 0;

    const openingStock = openingStockEntry.openingStock;

    // Calculate total purchases
    const purchaseEntries = await FuelStock.find({
      product,
      date: { $gte: startDate, $lt: endDate },
      purchases: { $gt: 0 }
    });

    const totalPurchases = purchaseEntries.reduce((sum, entry) => sum + entry.purchases, 0);

    // Calculate total sales from sales transactions
    const salesTransactions = await Sale.find({
      createdAt: { $gte: startDate, $lt: endDate }
    }).populate("nozzle", "fuelType");

    const totalSales = salesTransactions
      .filter(transaction => transaction.nozzle?.fuelType === product)
      .reduce((sum, transaction) => sum + (transaction.liters || 0), 0);

    return openingStock + totalPurchases - totalSales;
  } catch (error) {
    console.error("Error calculating expected stock:", error);
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