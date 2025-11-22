import Shift from "../models/Shift.js";
import Nozzleman from "../models/NozzleMan.js";
import Sale from "../models/Sale.js"; // ADD THIS IMPORT
import asyncHandler from "express-async-handler";

// @desc    Get nozzleman wise sales details
// @route   GET /api/nozzleman-sales
// @access  Private
export const getNozzlemanSales = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate, nozzlemanId } = req.query;

    console.log("📅 Requested date range:", { startDate, endDate, nozzlemanId });

    // Build date filter for sales
    let dateFilter = {};
    
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      dateFilter.createdAt = {
        $gte: start,
        $lte: end
      };

      console.log("🔍 Date filter:", {
        from: start.toISOString(),
        to: end.toISOString()
      });
    }

    // Get sales data for the date range
    const sales = await Sale.find(dateFilter)
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

    console.log(`✅ Found ${sales.length} sales for the date range`);

    if (sales.length === 0) {
      return res.json({
        success: true,
        data: [],
        totalShifts: 0,
        totalSales: 0,
        period: {
          startDate: startDate || 'All',
          endDate: endDate || 'All'
        },
        message: "No sales found for the selected date range"
      });
    }

    // Group sales by nozzleman
    const salesByNozzleman = {};
    const shiftsMap = new Map(); // To track unique shifts

    sales.forEach(sale => {
      if (!sale.shift || !sale.shift.nozzleman) {
        console.log("⚠️ Sale missing shift or nozzleman:", sale._id);
        return;
      }

      const nozzleman = sale.shift.nozzleman;
      const nozzlemanId = nozzleman._id.toString();
      const shiftId = sale.shift._id.toString();

      // Track unique shifts
      if (!shiftsMap.has(shiftId)) {
        shiftsMap.set(shiftId, sale.shift);
      }

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
          meterReadings: {
            HSD: { opening: 0, closing: 0 },
            Petrol: { opening: 0, closing: 0 }
          },
          cashInHand: 0
        };
      }

      const nozzlemanData = salesByNozzleman[nozzlemanId];
      
      // Calculate sale amount safely
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
          nozzlemanData.cashSales += saleAmount; // Default to cash
      }
    });

    // Add shifts to each nozzleman (unique shifts only)
    shiftsMap.forEach(shift => {
      const nozzlemanId = shift.nozzleman._id.toString();
      if (salesByNozzleman[nozzlemanId]) {
        // Only add shift if not already present
        const existingShift = salesByNozzleman[nozzlemanId].shifts.find(s => s._id.toString() === shift._id.toString());
        if (!existingShift) {
          salesByNozzleman[nozzlemanId].shifts.push(shift);
        }
      }
    });

    // Calculate additional metrics for each nozzleman
    Object.values(salesByNozzleman).forEach(nozzlemanData => {
      // Calculate expenses and deposits from shifts
      nozzlemanData.expenses = nozzlemanData.shifts.reduce((sum, shift) => sum + (shift.expenses || 0), 0);
      nozzlemanData.cashDeposit = nozzlemanData.shifts.reduce((sum, shift) => sum + (shift.cashDeposit || 0), 0);
      nozzlemanData.cashInHand = nozzlemanData.cashSales - nozzlemanData.expenses - nozzlemanData.cashDeposit;

      // Calculate meter readings from shifts
      nozzlemanData.meterReadings.HSD.opening = nozzlemanData.shifts.reduce((sum, shift) => sum + (shift.meterReadingHSD?.opening || 0), 0);
      nozzlemanData.meterReadings.HSD.closing = nozzlemanData.shifts.reduce((sum, shift) => sum + (shift.meterReadingHSD?.closing || 0), 0);
      nozzlemanData.meterReadings.Petrol.opening = nozzlemanData.shifts.reduce((sum, shift) => sum + (shift.meterReadingPetrol?.opening || 0), 0);
      nozzlemanData.meterReadings.Petrol.closing = nozzlemanData.shifts.reduce((sum, shift) => sum + (shift.meterReadingPetrol?.closing || 0), 0);
    });

    const result = Object.values(salesByNozzleman);

    console.log(`📊 Aggregated data for ${result.length} nozzlemen`);
    console.log("💰 Total sales by nozzleman:");
    result.forEach(nm => {
      console.log(`   ${nm.nozzleman.name}: ₹${nm.totalSales} from ${nm.shifts.length} shifts, ${nm.fuelDispensed}L fuel`);
    });

    res.json({
      success: true,
      data: result,
      totalShifts: shiftsMap.size,
      totalSales: sales.length,
      period: {
        startDate: startDate || 'All',
        endDate: endDate || 'All'
      },
      debug: {
        salesFound: sales.length,
        uniqueShifts: shiftsMap.size,
        nozzlemenWithSales: result.length
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

    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      dateFilter.createdAt = { $gte: start, $lte: end };
    }

    // Get sales for this nozzleman
    const sales = await Sale.find(dateFilter)
      .populate({
        path: 'shift',
        match: { nozzleman: nozzlemanId },
        populate: {
          path: 'nozzleman',
          select: 'name employeeId'
        }
      })
      .populate('nozzle', 'number fuelType')
      .sort({ createdAt: -1 });

    // Filter sales that have shifts with this nozzleman
    const filteredSales = sales.filter(sale => sale.shift && sale.shift.nozzleman);

    if (filteredSales.length === 0) {
      return res.json({
        success: true,
        message: "No sales data found for this nozzleman in the selected period",
        data: {
          nozzleman: await Nozzleman.findById(nozzlemanId),
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
            fuelDispensed: 0
          }
        }
      });
    }

    const summary = filteredSales.reduce((acc, sale) => {
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
      otpSales: 0,
      creditSales: 0,
      expenses: 0,
      cashDeposit: 0,
      fuelDispensed: 0
    });

    // Get shift data for expenses and deposits
    const shifts = await Shift.find({ 
      nozzleman: nozzlemanId,
      status: "Completed",
      ...(startDate && endDate && {
        endTime: {
          $gte: new Date(startDate),
          $lte: new Date(endDate + 'T23:59:59.999Z')
        }
      })
    });

    summary.expenses = shifts.reduce((sum, shift) => sum + (shift.expenses || 0), 0);
    summary.cashDeposit = shifts.reduce((sum, shift) => sum + (shift.cashDeposit || 0), 0);
    summary.cashInHand = summary.cashSales - summary.expenses - summary.cashDeposit;

    res.json({
      success: true,
      data: {
        nozzleman: await Nozzleman.findById(nozzlemanId),
        sales: filteredSales,
        shifts: shifts,
        summary
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