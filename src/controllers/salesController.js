import Sale from "../models/Sale.js";
import asyncHandler from "express-async-handler";
import Tank from "../models/FuelStock.js";
import Nozzle from "../models/Nozzle.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";
import mongoose from "mongoose";

// Get sales statistics - FIXED CALCULATION
export const getSaleStats = asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log("📊 Fetching sales stats for today...");

    // Get today's sales without problematic population
    const todaySales = await Sale.find({
      createdAt: { $gte: today, $lt: tomorrow }
    });

    console.log(`📈 Today's sales count: ${todaySales.length}`);

    // Use safe calculations with fallbacks
    const totalSales = todaySales.reduce((sum, sale) => {
      // Calculate total amount safely
      const saleAmount = sale.totalAmount || (sale.liters || 0) * (sale.price || 0);
      return sum + saleAmount;
    }, 0);

    const totalTransactions = todaySales.length;
    
    const totalFuelSold = todaySales.reduce((sum, sale) => {
      return sum + (sale.liters || 0);
    }, 0);

    const averagePrice = totalFuelSold > 0 ? totalSales / totalFuelSold : 0;

    console.log("📊 Sales stats:", {
      totalSales,
      totalTransactions,
      totalFuelSold,
      averagePrice
    });

    res.json({
      totalSales,
      totalTransactions,
      totalFuelSold,
      averagePrice
    });
  } catch (error) {
    console.error("❌ Error fetching sales stats:", error);
    res.status(500).json({
      totalSales: 0,
      totalTransactions: 0,
      totalFuelSold: 0,
      averagePrice: 0
    });
  }
});

// Get all sales - FIXED POPULATION
// @desc    Get all sales with date filtering
// @route   GET /api/sales
// @access  Private
// In salesController.js - IMPROVED DATE FILTERING
export const getSales = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let query = {};
    
    // Add date filtering if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0); // Start of the day
      
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of the day
      
      query.createdAt = {
        $gte: start,
        $lte: end
      };
      
      console.log(`📅 Filtering sales from ${start} to ${end}`);
    } else {
      // Default to last 7 days if no dates provided
      const defaultEnd = new Date();
      defaultEnd.setHours(23, 59, 59, 999);
      
      const defaultStart = new Date();
      defaultStart.setDate(defaultStart.getDate() - 7);
      defaultStart.setHours(0, 0, 0, 0);
      
      query.createdAt = {
        $gte: defaultStart,
        $lte: defaultEnd
      };
    }

    console.log("🔄 Fetching sales with query:", query);
    
    const sales = await Sale.find(query)
      .populate("shift", "shiftId startTime endTime nozzleman")
      .populate("nozzle", "number fuelType")
      .populate("verifiedBy", "name")
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${sales.length} sales records for the date range`);
    
    res.json(sales);
  } catch (error) {
    console.error("❌ Error fetching sales:", error);
    res.status(500);
    throw new Error("Failed to fetch sales data");
  }
});

// Record sale
export const recordSale = asyncHandler(async (req, res) => {
  const { nozzle, product, liters, price, paymentMode, customer } = req.body;
  const sale = await Sale.create({ nozzle, product, liters, price, paymentMode, customer, date: new Date() });

  // Update tank stock
  const tank = await Tank.findOne({ type: product });
  if (tank) {
    tank.currentStock -= liters;
    await tank.save();
  }

  res.status(201).json(sale);
});


// Get all sales
export const getSale = async (req, res) => {
  try {
    const sales = await Sale.find()
      .populate("nozzle product customer")
      .sort({ createdAt: -1 });
    res.status(200).json(sales);
  } catch (err) {
    res.status(500).json({ message: "Error fetching sales", error: err.message });
  }
};

// Create a new sale
// In salesController.js - update createSale function
export const createSale = async (req, res) => {
  try {
    const { nozzle, product, customer, liters, price, paymentMode, fuelType } = req.body;

    // Get nozzle to determine fuel type if not provided
    let actualFuelType = fuelType;
    if (!actualFuelType && nozzle) {
      const nozzleDoc = await Nozzle.findById(nozzle);
      actualFuelType = nozzleDoc?.fuelType || "Petrol";
    }

    // Generate transaction ID
    const count = await Sale.countDocuments();
    const transactionId = `TXN-${String(count + 1).padStart(6, "0")}`;

    let newSale = await Sale.create({
      transactionId,
      nozzle,
      product,
      customer,
      liters,
      price,
      totalAmount: liters * price,
      paymentMode,
      fuelType: actualFuelType, // ADD FUEL TYPE
      createdBy: req.user._id,
    });

    res.status(201).json({ 
      message: "Sale recorded successfully", 
      sale: newSale,
      note: "Tank will be automatically deducted when auditor verifies this sale"
    });
  } catch (err) {
    res.status(500).json({ message: "Error creating sale", error: err.message });
  }
};

// Update an existing sale
export const updateSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: "Sale not found" });

    Object.assign(sale, req.body); // update with provided fields
    await sale.save();

    res.status(200).json({ message: "Sale updated successfully", sale });
  } catch (err) {
    res.status(500).json({ message: "Error updating sale", error: err.message });
  }
};


// Update in salesController.js - FIXED VERSION
export const getDetailedSalesStats = asyncHandler(async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    console.log("📊 Fetching detailed sales stats...");

    // Get today's sales without population first
    const todaySales = await Sale.find({
      createdAt: { $gte: today, $lt: tomorrow }
    }).lean();

    console.log(`📈 Found ${todaySales.length} sales for today`);

    if (todaySales.length === 0) {
      return res.json({
        totalSales: 0,
        totalTransactions: 0,
        totalFuelSold: 0,
        averagePrice: 0,
        paymentBreakdown: { cash: 0, upi: 0, card: 0, credit: 0 },
        nozzlemanSales: [],
        meterReadings: {
          hsd: { opening: 0, closing: 0, sales: 0 },
          petrol: { opening: 0, closing: 0, sales: 0 }
        },
        expenses: 0,
        cashDeposit: 0,
        fuelSales: { petrol: 0, diesel: 0, cng: 0 }
      });
    }

    // Get shift IDs from sales
    const shiftIds = todaySales.map(sale => sale.shift).filter(Boolean);
    console.log(`🔄 Found ${shiftIds.length} unique shifts in sales`);

    // Fetch shifts with nozzleman data
    const Shift = mongoose.model("Shift");
    const shifts = await Shift.find({ _id: { $in: shiftIds } })
      .populate('nozzleman', 'name employeeId')
      .lean();

    console.log(`👥 Populated ${shifts.length} shifts with nozzleman data`);

    // Create a map for quick shift lookup
    const shiftMap = new Map();
    shifts.forEach(shift => {
      shiftMap.set(shift._id.toString(), shift);
    });

    // Get nozzle data
    const nozzleIds = todaySales.map(sale => sale.nozzle).filter(Boolean);
    const Nozzle = mongoose.model("Nozzle");
    const nozzles = await Nozzle.find({ _id: { $in: nozzleIds } })
      .select('number fuelType')
      .lean();
    
    const nozzleMap = new Map();
    nozzles.forEach(nozzle => {
      nozzleMap.set(nozzle._id.toString(), nozzle);
    });

    // Calculate basic stats
    const totalSales = todaySales.reduce((sum, sale) => {
      const saleAmount = sale.totalAmount || (sale.liters || 0) * (sale.price || 0);
      return sum + saleAmount;
    }, 0);

    const totalTransactions = todaySales.length;
    const totalFuelSold = todaySales.reduce((sum, sale) => sum + (sale.liters || 0), 0);
    const averagePrice = totalFuelSold > 0 ? totalSales / totalFuelSold : 0;

    // Payment breakdown
    const paymentBreakdown = {
      cash: 0,
      upi: 0,
      card: 0,
      credit: 0
    };

    todaySales.forEach(sale => {
      const saleAmount = sale.totalAmount || (sale.liters || 0) * (sale.price || 0);
      const paymentMode = (sale.paymentMode || 'cash').toLowerCase();
      if (paymentBreakdown.hasOwnProperty(paymentMode)) {
        paymentBreakdown[paymentMode] += saleAmount;
      } else {
        paymentBreakdown.cash += saleAmount;
      }
    });

    // NOZZLEMAN-WISE SALES CALCULATION - FIXED
    const nozzlemanSalesMap = new Map();

    todaySales.forEach(sale => {
      const shift = shiftMap.get(sale.shift?.toString());
      
      if (shift && shift.nozzleman) {
        const nozzleman = shift.nozzleman;
        const saleAmount = sale.totalAmount || (sale.liters || 0) * (sale.price || 0);
        const nozzle = nozzleMap.get(sale.nozzle?.toString());
        const fuelType = nozzle?.fuelType?.toLowerCase() || 'unknown';
        
        const nozzlemanKey = nozzleman._id.toString();
        
        if (!nozzlemanSalesMap.has(nozzlemanKey)) {
          nozzlemanSalesMap.set(nozzlemanKey, {
            nozzlemanId: nozzleman._id,
            employeeId: nozzleman.employeeId || `EMP-${nozzleman._id.toString().slice(-4)}`,
            name: nozzleman.name || 'Unknown Nozzleman',
            totalSales: 0,
            totalFuel: 0,
            transactions: 0,
            fuelBreakdown: {
              petrol: 0,
              diesel: 0,
              cng: 0,
              unknown: 0
            },
            paymentBreakdown: {
              cash: 0,
              upi: 0,
              card: 0,
              credit: 0
            }
          });
        }
        
        const nozzlemanData = nozzlemanSalesMap.get(nozzlemanKey);
        nozzlemanData.totalSales += saleAmount;
        nozzlemanData.totalFuel += sale.liters || 0;
        nozzlemanData.transactions += 1;
        
        // Update fuel breakdown
        if (nozzlemanData.fuelBreakdown.hasOwnProperty(fuelType)) {
          nozzlemanData.fuelBreakdown[fuelType] += sale.liters || 0;
        }
        
        // Update payment breakdown
        const paymentMode = (sale.paymentMode || 'cash').toLowerCase();
        if (nozzlemanData.paymentBreakdown.hasOwnProperty(paymentMode)) {
          nozzlemanData.paymentBreakdown[paymentMode] += saleAmount;
        }
      } else {
        console.log(`⚠️ Sale ${sale._id} has no nozzleman data. Shift:`, shift);
      }
    });

    // Convert to array and sort by total sales
    const nozzlemanSales = Array.from(nozzlemanSalesMap.values())
      .sort((a, b) => b.totalSales - a.totalSales);

    console.log(`✅ Calculated sales for ${nozzlemanSales.length} nozzlemen`);

    // Calculate fuel sales by type
    const fuelSales = {
      petrol: 0,
      diesel: 0,
      cng: 0
    };

    todaySales.forEach(sale => {
      const nozzle = nozzleMap.get(sale.nozzle?.toString());
      if (nozzle && nozzle.fuelType) {
        const fuelType = nozzle.fuelType.toLowerCase();
        const fuelAmount = sale.liters || 0;
        
        if (fuelSales.hasOwnProperty(fuelType)) {
          fuelSales[fuelType] += fuelAmount;
        } else if (fuelType === 'hsd') {
          fuelSales.diesel += fuelAmount;
        }
      }
    });

    // Meter readings (you can replace with actual data)
    const meterReadings = {
      hsd: {
        opening: 15000,
        closing: 15000 - fuelSales.diesel,
        sales: fuelSales.diesel
      },
      petrol: {
        opening: 20000,
        closing: 20000 - fuelSales.petrol,
        sales: fuelSales.petrol
      }
    };

    // Expenses (replace with actual data)
    let expenses = 5000;
    try {
      const Expense = mongoose.model("Expense");
      const todayExpenses = await Expense.find({
        date: { $gte: today, $lt: tomorrow }
      }).lean();
      expenses = todayExpenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    } catch (error) {
      console.log("⚠️ No expenses model found, using default");
    }

    const cashDeposit = Math.max(0, paymentBreakdown.cash - expenses);

    const detailedStats = {
      totalSales,
      totalTransactions,
      totalFuelSold,
      averagePrice,
      paymentBreakdown,
      nozzlemanSales,
      meterReadings,
      expenses,
      cashDeposit,
      fuelSales,
      debug: {
        totalSalesCount: todaySales.length,
        shiftsFound: shifts.length,
        nozzlemenWithSales: nozzlemanSales.length
      }
    };

    console.log("✅ Detailed stats calculated successfully");
    
    res.json(detailedStats);
  } catch (error) {
    console.error("❌ Error in detailed sales stats:", error);
    res.status(500).json({
      message: "Error fetching detailed sales statistics",
      error: error.message
    });
  }
});