// controllers/nozzlemanSalesController.js - COMPLETE VERSION
import Shift from "../models/Shift.js";
import Nozzleman from "../models/NozzleMan.js";
import Sale from "../models/Sale.js";
import asyncHandler from "express-async-handler";
import mongoose from "mongoose";

// @desc    Get nozzleman wise sales details from SHIFTS and SALES
// @route   GET /api/nozzleman-sales
// @access  Private
export const getNozzlemanSales = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, nozzlemanId, includeManual = true } = req.query;

    console.log("📅 Requested nozzleman sales with:", { 
      startDate, 
      endDate, 
      nozzlemanId, 
      includeManual 
    });

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      dateFilter = {
        $gte: start,
        $lte: end
      };
    }

    // Build filter for shifts
    let shiftFilter = { 
      status: { $in: ["Approved", "Completed", "Pending Approval"] }
    };

    if (nozzlemanId) {
      shiftFilter.nozzleman = nozzlemanId;
    }

    if (startDate && endDate) {
      shiftFilter.startTime = dateFilter;
    }

    // Build filter for sales (for manual entries and verified sales)
    let saleFilter = {};
    if (nozzlemanId) {
      saleFilter.nozzleman = nozzlemanId;
    }
    if (startDate && endDate) {
      saleFilter.createdAt = dateFilter;
    }

    console.log("🔍 Fetching shifts and sales data...");

    // Get shifts with populated data
    const shifts = await Shift.find(shiftFilter)
      .populate("nozzleman", "name employeeId")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("auditedBy", "name")
      .sort({ startTime: -1 });

    console.log(`✅ Found ${shifts.length} shifts`);

    // Get sales data (for manual entries and additional sales records)
    const sales = await Sale.find(saleFilter)
      .populate({
        path: 'shift',
        populate: {
          path: 'nozzleman',
          select: 'name employeeId'
        }
      })
      .populate('nozzle', 'number fuelType')
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${sales.length} sales records`);

    if (shifts.length === 0 && sales.length === 0) {
      return res.json({
        success: true,
        data: [],
        totalShifts: 0,
        totalSales: 0,
        period: {
          startDate: startDate || 'All',
          endDate: endDate || 'All'
        },
        message: "No data found for the selected period"
      });
    }

    // Group data by nozzleman
    const salesByNozzleman = {};

    // Process shifts data
    shifts.forEach(shift => {
      if (!shift.nozzleman) {
        console.log("⚠️ Shift missing nozzleman:", shift._id);
        return;
      }

      const nozzleman = shift.nozzleman;
      const nozzlemanId = nozzleman._id.toString();

      if (!salesByNozzleman[nozzlemanId]) {
        salesByNozzleman[nozzlemanId] = {
          nozzleman: {
            _id: nozzleman._id,
            name: nozzleman.name,
            employeeId: nozzleman.employeeId
          },
          totalSales: 0,
          phonePeSales: 0,
          cashSales: 0,
          posSales: 0,
          otpSales: 0,
          creditSales: 0,
          expenses: 0,
          cashDeposit: 0,
          fuelDispensed: 0,
          shifts: [],
          sales: [],
          meterReadings: {
            HSD: { opening: 0, closing: 0 },
            Petrol: { opening: 0, closing: 0 }
          },
          cashInHand: 0,
          totalShifts: 0,
          approvedShifts: 0,
          manualEntries: 0
        };
      }

      const nozzlemanData = salesByNozzleman[nozzlemanId];
      
      // Calculate total sales from shift
      const shiftTotalSales = (shift.cashCollected || 0) + 
                            (shift.phonePeSales || 0) + 
                            (shift.posSales || 0) + 
                            (shift.otpSales || 0) + 
                            (shift.creditSales || 0);

      // Update nozzleman data
      nozzlemanData.totalSales += shiftTotalSales;
      nozzlemanData.cashSales += shift.cashCollected || 0;
      nozzlemanData.phonePeSales += shift.phonePeSales || 0;
      nozzlemanData.posSales += shift.posSales || 0;
      nozzlemanData.otpSales += shift.otpSales || 0;
      nozzlemanData.creditSales += shift.creditSales || 0;
      nozzlemanData.expenses += shift.expenses || 0;
      nozzlemanData.cashDeposit += shift.cashDeposit || 0;
      nozzlemanData.fuelDispensed += shift.fuelDispensed || 0;
      nozzlemanData.totalShifts += 1;

      if (shift.status === "Approved") {
        nozzlemanData.approvedShifts += 1;
      }

      if (shift.isManualEntry) {
        nozzlemanData.manualEntries += 1;
      }

      // Add shift to nozzleman's shifts
      nozzlemanData.shifts.push(shift);

      // Update meter readings
      nozzlemanData.meterReadings.HSD.opening += shift.meterReadingHSD?.opening || 0;
      nozzlemanData.meterReadings.HSD.closing += shift.meterReadingHSD?.closing || 0;
      nozzlemanData.meterReadings.Petrol.opening += shift.meterReadingPetrol?.opening || 0;
      nozzlemanData.meterReadings.Petrol.closing += shift.meterReadingPetrol?.closing || 0;
    });

    // Process sales data (for additional sales records)
    sales.forEach(sale => {
      let nozzleman;
      
      // Determine nozzleman from sale
      if (sale.shift && sale.shift.nozzleman) {
        nozzleman = sale.shift.nozzleman;
      } else if (sale.nozzleman) {
        nozzleman = sale.nozzleman;
      } else {
        console.log("⚠️ Sale missing nozzleman:", sale._id);
        return;
      }

      const nozzlemanId = nozzleman._id.toString();

      // Create nozzleman entry if it doesn't exist
      if (!salesByNozzleman[nozzlemanId]) {
        salesByNozzleman[nozzlemanId] = {
          nozzleman: {
            _id: nozzleman._id,
            name: nozzleman.name,
            employeeId: nozzleman.employeeId
          },
          totalSales: 0,
          phonePeSales: 0,
          cashSales: 0,
          posSales: 0,
          otpSales: 0,
          creditSales: 0,
          expenses: 0,
          cashDeposit: 0,
          fuelDispensed: 0,
          shifts: [],
          sales: [],
          meterReadings: {
            HSD: { opening: 0, closing: 0 },
            Petrol: { opening: 0, closing: 0 }
          },
          cashInHand: 0,
          totalShifts: 0,
          approvedShifts: 0,
          manualEntries: 0
        };
      }

      const nozzlemanData = salesByNozzleman[nozzlemanId];
      
      // Calculate sale amount
      const saleAmount = sale.totalAmount || (sale.liters || 0) * (sale.price || 0);
      const fuelLiters = sale.liters || 0;

      nozzlemanData.totalSales += saleAmount;
      nozzlemanData.fuelDispensed += fuelLiters;

      // Payment mode breakdown
      const paymentMode = (sale.paymentMode || 'cash').toLowerCase();
      switch (paymentMode) {
        case 'cash':
          nozzlemanData.cashSales += saleAmount;
          break;
        case 'upi':
        case 'phonepe':
          nozzlemanData.phonePeSales += saleAmount;
          break;
        case 'card':
        case 'pos':
          nozzlemanData.posSales += saleAmount;
          break;
        case 'credit':
          nozzlemanData.creditSales += saleAmount;
          break;
        default:
          nozzlemanData.cashSales += saleAmount;
      }

      // Add sale to nozzleman's sales
      nozzlemanData.sales.push(sale);
    });

    // Calculate cash in hand for each nozzleman
    Object.values(salesByNozzleman).forEach(nozzlemanData => {
      nozzlemanData.cashInHand = nozzlemanData.cashSales - nozzlemanData.expenses - nozzlemanData.cashDeposit;
    });

    const result = Object.values(salesByNozzleman);

    console.log(`📊 Aggregated sales data for ${result.length} nozzlemen`);
    
    // Log summary for debugging
    result.forEach(nm => {
      console.log(`   ${nm.nozzleman.name}: ₹${nm.totalSales} from ${nm.totalShifts} shifts, ${nm.sales.length} sales, ${nm.fuelDispensed}L fuel`);
    });

    res.json({
      success: true,
      data: result,
      totalShifts: shifts.length,
      totalSales: sales.length,
      totalRevenue: result.reduce((sum, nm) => sum + nm.totalSales, 0),
      period: {
        startDate: startDate || 'All',
        endDate: endDate || 'All'
      },
      debug: {
        shiftsFound: shifts.length,
        salesFound: sales.length,
        nozzlemenWithData: result.length,
        filterUsed: { shiftFilter, saleFilter }
      }
    });

  } catch (error) {
    console.error("❌ Error in getNozzlemanSales:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching nozzleman sales",
      error: error.message
    });
  }
});

// @desc    Get detailed sales for a specific nozzleman
// @route   GET /api/nozzleman-sales/:nozzlemanId
// @access  Private
export const getNozzlemanSalesDetail = asyncHandler(async (req, res) => {
  try {
    const { nozzlemanId } = req.params;
    const { startDate, endDate } = req.query;

    console.log("🔍 Getting detailed sales for nozzleman:", nozzlemanId);

    // Verify nozzleman exists
    const nozzleman = await Nozzleman.findById(nozzlemanId);
    if (!nozzleman) {
      return res.status(404).json({
        success: false,
        message: "Nozzleman not found"
      });
    }

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      dateFilter = { $gte: start, $lte: end };
    }

    // Get shifts for this nozzleman
    const shifts = await Shift.find({
      nozzleman: nozzlemanId,
      status: { $in: ["Approved", "Completed", "Pending Approval"] },
      ...(startDate && endDate && { startTime: dateFilter })
    })
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("auditedBy", "name")
      .sort({ startTime: -1 });

    // Get sales for this nozzleman
    const sales = await Sale.find({
      $or: [
        { nozzleman: nozzlemanId },
        { 'shift.nozzleman': nozzlemanId }
      ],
      ...(startDate && endDate && { createdAt: dateFilter })
    })
      .populate({
        path: 'shift',
        populate: {
          path: 'nozzleman',
          select: 'name employeeId'
        }
      })
      .populate('nozzle', 'number fuelType')
      .populate('verifiedBy', 'name')
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${shifts.length} shifts and ${sales.length} sales for nozzleman ${nozzleman.name}`);

    if (shifts.length === 0 && sales.length === 0) {
      return res.json({
        success: true,
        message: "No data found for this nozzleman in the selected period",
        data: {
          nozzleman: nozzleman,
          shifts: [],
          sales: [],
          summary: {
            totalSales: 0,
            phonePeSales: 0,
            cashSales: 0,
            posSales: 0,
            otpSales: 0,
            creditSales: 0,
            expenses: 0,
            cashDeposit: 0,
            cashInHand: 0,
            fuelDispensed: 0,
            totalShifts: 0,
            approvedShifts: 0,
            manualEntries: 0
          }
        }
      });
    }

    // Calculate summary from shifts
    const shiftSummary = shifts.reduce((acc, shift) => {
      const shiftTotalSales = (shift.cashCollected || 0) + 
                            (shift.phonePeSales || 0) + 
                            (shift.posSales || 0) + 
                            (shift.otpSales || 0) + 
                            (shift.creditSales || 0);

      acc.totalSales += shiftTotalSales;
      acc.cashSales += shift.cashCollected || 0;
      acc.phonePeSales += shift.phonePeSales || 0;
      acc.posSales += shift.posSales || 0;
      acc.otpSales += shift.otpSales || 0;
      acc.creditSales += shift.creditSales || 0;
      acc.expenses += shift.expenses || 0;
      acc.cashDeposit += shift.cashDeposit || 0;
      acc.fuelDispensed += shift.fuelDispensed || 0;
      acc.totalShifts += 1;

      if (shift.status === "Approved") {
        acc.approvedShifts += 1;
      }

      if (shift.isManualEntry) {
        acc.manualEntries += 1;
      }

      return acc;
    }, {
      totalSales: 0,
      phonePeSales: 0,
      cashSales: 0,
      posSales: 0,
      otpSales: 0,
      creditSales: 0,
      expenses: 0,
      cashDeposit: 0,
      fuelDispensed: 0,
      totalShifts: 0,
      approvedShifts: 0,
      manualEntries: 0
    });

    // Calculate summary from sales
    const salesSummary = sales.reduce((acc, sale) => {
      const saleAmount = sale.totalAmount || (sale.liters || 0) * (sale.price || 0);
      const fuelLiters = sale.liters || 0;

      acc.totalSales += saleAmount;
      acc.fuelDispensed += fuelLiters;

      const paymentMode = (sale.paymentMode || 'cash').toLowerCase();
      switch (paymentMode) {
        case 'cash':
          acc.cashSales += saleAmount;
          break;
        case 'upi':
        case 'phonepe':
          acc.phonePeSales += saleAmount;
          break;
        case 'card':
        case 'pos':
          acc.posSales += saleAmount;
          break;
        case 'credit':
          acc.creditSales += saleAmount;
          break;
      }

      return acc;
    }, {
      totalSales: 0,
      phonePeSales: 0,
      cashSales: 0,
      posSales: 0,
      creditSales: 0,
      fuelDispensed: 0
    });

    // Combine summaries
    const combinedSummary = {
      totalSales: shiftSummary.totalSales + salesSummary.totalSales,
      phonePeSales: shiftSummary.phonePeSales + salesSummary.phonePeSales,
      cashSales: shiftSummary.cashSales + salesSummary.cashSales,
      posSales: shiftSummary.posSales + salesSummary.posSales,
      otpSales: shiftSummary.otpSales,
      creditSales: shiftSummary.creditSales + salesSummary.creditSales,
      expenses: shiftSummary.expenses,
      cashDeposit: shiftSummary.cashDeposit,
      fuelDispensed: shiftSummary.fuelDispensed + salesSummary.fuelDispensed,
      totalShifts: shiftSummary.totalShifts,
      approvedShifts: shiftSummary.approvedShifts,
      manualEntries: shiftSummary.manualEntries
    };

    combinedSummary.cashInHand = combinedSummary.cashSales - combinedSummary.expenses - combinedSummary.cashDeposit;

    // Calculate meter readings from shifts
    const meterReadings = {
      HSD: {
        opening: shifts.reduce((sum, shift) => sum + (shift.meterReadingHSD?.opening || 0), 0),
        closing: shifts.reduce((sum, shift) => sum + (shift.meterReadingHSD?.closing || 0), 0)
      },
      Petrol: {
        opening: shifts.reduce((sum, shift) => sum + (shift.meterReadingPetrol?.opening || 0), 0),
        closing: shifts.reduce((sum, shift) => sum + (shift.meterReadingPetrol?.closing || 0), 0)
      }
    };

    res.json({
      success: true,
      data: {
        nozzleman: nozzleman,
        shifts: shifts,
        sales: sales,
        summary: combinedSummary,
        meterReadings: meterReadings
      }
    });

  } catch (error) {
    console.error("❌ Error in getNozzlemanSalesDetail:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});

// FIXED createManualEntry function in nozzlemanSalesController.js
export const createManualEntry = asyncHandler(async (req, res) => {
  try {
    const {
      nozzlemanId,
      date,
      cashSales,        // This maps to cashCollected
      phonePeSales,    
      posSales,        
      creditSales,      
      expenses,
      cashDeposit,
      fuelDispensed,
      notes
    } = req.body;

    console.log("📝 Creating manual entry for nozzleman:", nozzlemanId);

    // Verify nozzleman exists
    const nozzleman = await Nozzleman.findById(nozzlemanId);
    if (!nozzleman) {
      return res.status(404).json({
        success: false,
        message: "Nozzleman not found"
      });
    }

    // For manual entries, we need to get a default pump and nozzle
    // Let's get the first active pump and nozzle
    const Pump = mongoose.model("Pump");
    const Nozzle = mongoose.model("Nozzle");
    
    const defaultPump = await Pump.findOne({ status: "Active" });
    const defaultNozzle = await Nozzle.findOne({ status: "Active" });

    if (!defaultPump || !defaultNozzle) {
      return res.status(400).json({
        success: false,
        message: "No active pump or nozzle found for manual entry"
      });
    }

    // Generate shift ID for manual entry
    const count = await Shift.countDocuments();
    const shiftId = `MAN-${String(count + 1).padStart(4, "0")}`;

    // Create manual shift entry with ALL required fields
    const manualShift = await Shift.create({
      shiftId,
      nozzleman: nozzlemanId,
      pump: defaultPump._id,           // Required field
      nozzle: defaultNozzle._id,       // Required field
      startTime: new Date(`${date}T00:00:00`),
      endTime: new Date(`${date}T23:59:59`),
      startReading: 0,                 // Required field
      endReading: 0,                   // Set to 0 for manual entries
      startReadingImage: "manual-entry", // Required field - dummy value
      endReadingImage: "manual-entry",   // Dummy value
      cashCollected: parseFloat(cashSales) || 0,
      phonePeSales: parseFloat(phonePeSales) || 0,
      posSales: parseFloat(posSales) || 0,
      creditSales: parseFloat(creditSales) || 0,
      expenses: parseFloat(expenses) || 0,
      cashDeposit: parseFloat(cashDeposit) || 0,
      cashInHand: (parseFloat(cashSales) || 0) - (parseFloat(expenses) || 0) - (parseFloat(cashDeposit) || 0),
      fuelDispensed: parseFloat(fuelDispensed) || 0,
      status: "Approved",  // Manual entries are auto-approved
      notes: notes || "Manual entry created by admin",
      auditNotes: "Auto-approved manual entry",
      auditedBy: req.user._id,
      auditedAt: new Date(),
      createdBy: req.user._id,        // Required field
      isManualEntry: true             // Custom flag to identify manual entries
    });

    console.log("✅ Manual entry created:", manualShift._id);

    // Update nozzleman statistics
    await Nozzleman.findByIdAndUpdate(nozzlemanId, {
      $inc: {
        totalShifts: 1,
        totalFuelDispensed: parseFloat(fuelDispensed) || 0
      }
    });

    // Populate and return the shift
    const populatedShift = await Shift.findById(manualShift._id)
      .populate("nozzleman", "name employeeId")
      .populate("pump", "name location")
      .populate("nozzle", "number fuelType")
      .populate("createdBy", "name")
      .populate("auditedBy", "name");

    res.status(201).json({
      success: true,
      message: "Manual entry created successfully",
      data: populatedShift
    });

  } catch (error) {
    console.error("❌ Error creating manual entry:", error);
    
    // More detailed error logging
    if (error.name === 'ValidationError') {
      console.error("Validation errors:", error.errors);
    }
    
    res.status(500).json({
      success: false,
      message: "Failed to create manual entry",
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error : undefined
    });
  }
});