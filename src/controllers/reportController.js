// controllers/reportController.js - ENHANCED VERSION WITH NOZZLEMAN DATA
import asyncHandler from "express-async-handler";
import Sale from "../models/Sale.js";
import Expense from "../models/Expense.js";
import Shift from "../models/Shift.js";
import TankConfig from "../models/TankConfig.js";
import User from "../models/User.js";
import Audit from "../models/Audit.js";
import Nozzle from "../models/Nozzle.js";
import mongoose from "mongoose";

export const getDailyReport = asyncHandler(async (req, res) => {
  try {
    const { date } = req.query;
    
    // Use today's date if not provided
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    console.log(`📊 Fetching daily report for ${targetDate.toISOString()}`);

    // Get sales data
    const sales = await Sale.find({ 
      createdAt: { $gte: targetDate, $lt: nextDate } 
    })
    .populate("nozzle", "number fuelType")
    .populate("shift", "nozzleman")
    .populate({
      path: "shift",
      populate: {
        path: "nozzleman",
        select: "name employeeId"
      }
    })
    .populate("verifiedBy", "name")
    .sort({ createdAt: -1 });

    // Get shift data for the day (this has the actual fuel dispensed data)
    const shifts = await Shift.find({ 
      startTime: { $gte: targetDate, $lt: nextDate },
      status: { $in: ["Completed", "Approved"] }
    })
    .populate("nozzleman", "name employeeId")
    .populate("pump", "name")
    .populate("nozzle", "number fuelType rate")
    .sort({ createdAt: -1 });

    const expenses = await Expense.find({ 
      date: { $gte: targetDate, $lt: nextDate } 
    });

    console.log(`📈 Found ${sales.length} sales and ${shifts.length} shifts for today`);

    // Use shift data to calculate actual sales when sales collection is empty
    let actualSalesData = [];
    let totalSalesAmount = 0;
    let totalLitersSold = 0;

    if (sales.length === 0 && shifts.length > 0) {
      console.log("🔄 Using shift data to calculate sales...");
      
      // Create sales data from shifts
      shifts.forEach(shift => {
        if (shift.fuelDispensed > 0) {
          const fuelType = shift.nozzle?.fuelType || 'Petrol';
          const rate = shift.nozzle?.rate || 90; // Default rate
          const salesAmount = shift.fuelDispensed * rate;
          
          totalSalesAmount += salesAmount;
          totalLitersSold += shift.fuelDispensed;
          
          actualSalesData.push({
            _id: shift._id,
            shift: shift._id,
            nozzle: shift.nozzle,
            liters: shift.fuelDispensed,
            price: rate,
            totalAmount: salesAmount,
            fuelType: fuelType,
            paymentMode: "Cash",
            createdAt: shift.endTime || shift.createdAt,
            nozzleman: shift.nozzleman,
            isFromShift: true // Flag to indicate this is derived from shift data
          });
        }
      });
      
      console.log(`✅ Derived ${actualSalesData.length} sales from ${shifts.length} shifts`);
    } else {
      // Use actual sales data
      actualSalesData = sales;
      totalSalesAmount = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      totalLitersSold = sales.reduce((sum, sale) => sum + (sale.liters || 0), 0);
    }

    // Generate hourly distribution for charts
    const hourlyData = generateHourlyData(actualSalesData);

    // Calculate nozzleman-wise sales
    const nozzlemanSales = calculateNozzlemanSales(actualSalesData, shifts);

    // Calculate summary statistics
    const summary = {
      totalSales: totalSalesAmount,
      totalLiters: totalLitersSold,
      activeTransactions: actualSalesData.length,
      totalExpenses: expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
      growthPercentage: calculateGrowthPercentage(actualSalesData),
      totalNozzlemen: Object.keys(nozzlemanSales).length,
      dataSource: sales.length === 0 ? "shift_data" : "sales_data"
    };

    res.json({ 
      success: true,
      sales: actualSalesData, 
      shifts,
      expenses, 
      hourlyData,
      nozzlemanSales: Object.values(nozzlemanSales),
      summary
    });

  } catch (error) {
    console.error("❌ Error fetching daily report:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching daily report", 
      error: error.message 
    });
  }
});

// Enhanced Sales report that uses shift data
export const getSalesReport = asyncHandler(async (req, res) => {
  try {
    const { period = "7days" } = req.query;
    
    let startDate = new Date();
    
    // Calculate date range based on period
    switch (period) {
      case "7days":
        startDate.setDate(startDate.getDate() - 7);
        break;
      case "30days":
        startDate.setDate(startDate.getDate() - 30);
        break;
      case "90days":
        startDate.setDate(startDate.getDate() - 90);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    startDate.setHours(0, 0, 0, 0);

    console.log(`📈 Fetching sales report for period: ${period}`);

    // Get sales data
    const sales = await Sale.find({
      createdAt: { $gte: startDate }
    })
    .populate("nozzle", "number fuelType")
    .populate({
      path: "shift",
      populate: {
        path: "nozzleman",
        select: "name employeeId"
      }
    })
    .populate("customer", "name")
    .sort({ createdAt: -1 });

    // Get shift data for the same period
    const shifts = await Shift.find({
      startTime: { $gte: startDate },
      status: { $in: ["Completed", "Approved"] }
    })
    .populate("nozzleman", "name employeeId")
    .populate("nozzle", "number fuelType rate")
    .sort({ createdAt: -1 });

    console.log(`📊 Found ${sales.length} sales and ${shifts.length} shifts for period ${period}`);

    // Use shift data to supplement sales data
    let combinedSalesData = [...sales];
    
    if (sales.length === 0 && shifts.length > 0) {
      console.log("🔄 Using shift data to generate sales report...");
      
      shifts.forEach(shift => {
        if (shift.fuelDispensed > 0) {
          const fuelType = shift.nozzle?.fuelType || 'Petrol';
          const rate = shift.nozzle?.rate || 90;
          const salesAmount = shift.fuelDispensed * rate;
          
          combinedSalesData.push({
            _id: shift._id,
            shift: shift._id,
            nozzle: shift.nozzle,
            liters: shift.fuelDispensed,
            price: rate,
            totalAmount: salesAmount,
            fuelType: fuelType,
            paymentMode: "Cash",
            createdAt: shift.endTime || shift.createdAt,
            nozzleman: shift.nozzleman,
            isFromShift: true
          });
        }
      });
    }

    // Generate sales trend data
    const salesTrend = generateSalesTrend(combinedSalesData, period);

    // Generate product performance data
    const productPerformance = generateProductPerformance(combinedSalesData);

    // Generate nozzleman performance data
    const nozzlemanPerformance = calculateNozzlemanPerformance(combinedSalesData, period);

    res.json({
      success: true,
      sales: combinedSalesData,
      salesTrend,
      productPerformance,
      nozzlemanPerformance,
      period,
      dataSource: sales.length === 0 ? "shift_data" : "sales_data"
    });

  } catch (error) {
    console.error("❌ Error fetching sales report:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching sales report", 
      error: error.message 
    });
  }
});

// Enhanced helper function to calculate nozzleman sales from both sales and shifts
const calculateNozzlemanSales = (sales, shifts = []) => {
  const nozzlemanMap = {};
  
  // Process sales data
  sales.forEach(sale => {
    const nozzleman = sale.shift?.nozzleman || sale.nozzleman;
    if (nozzleman) {
      const nozzlemanId = nozzleman._id?.toString() || nozzleman.toString();
      
      if (!nozzlemanMap[nozzlemanId]) {
        nozzlemanMap[nozzlemanId] = {
          nozzlemanId: nozzleman._id || nozzleman,
          name: nozzleman.name || 'Unknown Nozzleman',
          employeeId: nozzleman.employeeId || 'N/A',
          totalSales: 0,
          totalLiters: 0,
          transactions: 0,
          fuelBreakdown: {}
        };
      }
      
      const nozzlemanData = nozzlemanMap[nozzlemanId];
      nozzlemanData.totalSales += sale.totalAmount || 0;
      nozzlemanData.totalLiters += sale.liters || 0;
      nozzlemanData.transactions += 1;
      
      // Update fuel breakdown
      const fuelType = sale.fuelType || sale.nozzle?.fuelType || 'Unknown';
      if (!nozzlemanData.fuelBreakdown[fuelType]) {
        nozzlemanData.fuelBreakdown[fuelType] = 0;
      }
      nozzlemanData.fuelBreakdown[fuelType] += sale.liters || 0;
    }
  });

  // Process shift data (for cases where sales are empty)
  if (sales.length === 0) {
    shifts.forEach(shift => {
      if (shift.fuelDispensed > 0 && shift.nozzleman) {
        const nozzleman = shift.nozzleman;
        const nozzlemanId = nozzleman._id.toString();
        const fuelType = shift.nozzle?.fuelType || 'Petrol';
        const rate = shift.nozzle?.rate || 90;
        const salesAmount = shift.fuelDispensed * rate;
        
        if (!nozzlemanMap[nozzlemanId]) {
          nozzlemanMap[nozzlemanId] = {
            nozzlemanId: nozzleman._id,
            name: nozzleman.name || 'Unknown Nozzleman',
            employeeId: nozzleman.employeeId || 'N/A',
            totalSales: 0,
            totalLiters: 0,
            transactions: 0,
            fuelBreakdown: {}
          };
        }
        
        const nozzlemanData = nozzlemanMap[nozzlemanId];
        nozzlemanData.totalSales += salesAmount;
        nozzlemanData.totalLiters += shift.fuelDispensed;
        nozzlemanData.transactions += 1;
        
        // Update fuel breakdown
        if (!nozzlemanData.fuelBreakdown[fuelType]) {
          nozzlemanData.fuelBreakdown[fuelType] = 0;
        }
        nozzlemanData.fuelBreakdown[fuelType] += shift.fuelDispensed;
      }
    });
  }
  
  return nozzlemanMap;
};

// Keep other helper functions the same but ensure they work with the enhanced data
const generateHourlyData = (sales) => {
  const hours = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
  const hourlyData = {};

  // Initialize hours
  hours.forEach(hour => {
    hourlyData[hour] = { hour, petrol: 0, diesel: 0, cng: 0 };
  });

  // Fill with actual data
  sales.forEach(sale => {
    const saleTime = sale.createdAt ? new Date(sale.createdAt) : new Date();
    const saleHour = saleTime.getHours();
    let hourKey = "06:00";
    
    if (saleHour >= 6 && saleHour < 9) hourKey = "06:00";
    else if (saleHour >= 9 && saleHour < 12) hourKey = "09:00";
    else if (saleHour >= 12 && saleHour < 15) hourKey = "12:00";
    else if (saleHour >= 15 && saleHour < 18) hourKey = "15:00";
    else if (saleHour >= 18 && saleHour < 21) hourKey = "18:00";
    else hourKey = "21:00";

    const fuelType = (sale.fuelType || sale.nozzle?.fuelType || 'petrol').toLowerCase();
    const liters = sale.liters || 0;

    if (fuelType.includes('petrol') || fuelType.includes('ms')) {
      hourlyData[hourKey].petrol += liters;
    } else if (fuelType.includes('diesel') || fuelType.includes('hsd')) {
      hourlyData[hourKey].diesel += liters;
    } else if (fuelType.includes('cng')) {
      hourlyData[hourKey].cng += liters;
    }
  });

  return Object.values(hourlyData);
};

const generateSalesTrend = (sales, period) => {
  const days = period === "7days" ? 7 : period === "30days" ? 30 : 90;
  const trend = [];
  
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    
    const daySales = sales.filter(sale => {
      const saleDate = sale.createdAt ? new Date(sale.createdAt) : new Date();
      return saleDate >= date && saleDate < nextDate;
    });
    
    const revenue = daySales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const liters = daySales.reduce((sum, sale) => sum + (sale.liters || 0), 0);
    
    trend.push({
      date: date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric'
      }),
      revenue,
      liters,
      transactions: daySales.length
    });
  }
  
  return trend;
};

const generateProductPerformance = (sales) => {
  const performance = {};
  
  sales.forEach(sale => {
    const fuelType = sale.fuelType || sale.nozzle?.fuelType || 'Unknown';
    const liters = sale.liters || 0;
    const revenue = sale.totalAmount || 0;
    
    if (!performance[fuelType]) {
      performance[fuelType] = {
        product: fuelType,
        revenue: 0,
        liters: 0,
        transactions: 0
      };
    }
    
    performance[fuelType].revenue += revenue;
    performance[fuelType].liters += liters;
    performance[fuelType].transactions += 1;
  });
  
  return Object.values(performance).sort((a, b) => b.revenue - a.revenue);
};

const calculateNozzlemanPerformance = (sales, period) => {
  const nozzlemanMap = {};
  
  sales.forEach(sale => {
    const nozzleman = sale.shift?.nozzleman || sale.nozzleman;
    if (nozzleman) {
      const nozzlemanId = nozzleman._id?.toString() || nozzleman.toString();
      const saleDate = sale.createdAt ? new Date(sale.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      
      if (!nozzlemanMap[nozzlemanId]) {
        nozzlemanMap[nozzlemanId] = {
          nozzlemanId: nozzleman._id || nozzleman,
          name: nozzleman.name || 'Unknown Nozzleman',
          employeeId: nozzleman.employeeId || 'N/A',
          totalRevenue: 0,
          totalLiters: 0,
          totalTransactions: 0,
          dailyPerformance: {}
        };
      }
      
      const nozzlemanData = nozzlemanMap[nozzlemanId];
      nozzlemanData.totalRevenue += sale.totalAmount || 0;
      nozzlemanData.totalLiters += sale.liters || 0;
      nozzlemanData.totalTransactions += 1;
      
      // Update daily performance
      if (!nozzlemanData.dailyPerformance[saleDate]) {
        nozzlemanData.dailyPerformance[saleDate] = {
          revenue: 0,
          liters: 0,
          transactions: 0
        };
      }
      nozzlemanData.dailyPerformance[saleDate].revenue += sale.totalAmount || 0;
      nozzlemanData.dailyPerformance[saleDate].liters += sale.liters || 0;
      nozzlemanData.dailyPerformance[saleDate].transactions += 1;
    }
  });
  
  return Object.values(nozzlemanMap).sort((a, b) => b.totalRevenue - a.totalRevenue);
};

const calculateGrowthPercentage = (sales) => {
  if (sales.length === 0) return 0;
  
  const todayRevenue = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const avgTransaction = todayRevenue / sales.length;
  
  return avgTransaction > 1000 ? 12 : avgTransaction > 500 ? 8 : 5;
};

// Enhanced Stock report
export const getStockReport = asyncHandler(async (req, res) => {
  try {
    console.log("📦 Fetching stock report...");

    const tanks = await TankConfig.find({ isActive: true })
      .select('tankName product capacity currentStock currentLevel alert lastUpdated')
      .sort({ product: 1 });

    // Generate stock movement data
    const stockMovement = generateStockMovement(tanks);

    // Calculate summary statistics
    const summary = {
      totalStockValue: tanks.reduce((sum, tank) => {
        const price = tank.product === "MS" ? 95 : 87; // Sample prices
        return sum + (tank.currentStock * price);
      }, 0),
      lowStockAlerts: tanks.filter(tank => tank.alert).length,
      avgConsumption: calculateAverageConsumption(tanks),
      totalCapacity: tanks.reduce((sum, tank) => sum + tank.capacity, 0),
      totalCurrentStock: tanks.reduce((sum, tank) => sum + tank.currentStock, 0)
    };

    res.json({
      success: true,
      tanks,
      stockMovement,
      summary
    });

  } catch (error) {
    console.error("❌ Error fetching stock report:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching stock report", 
      error: error.message 
    });
  }
});




const generateStockMovement = (tanks) => {
  const currentDate = new Date().toISOString().split('T')[0];
  
  return tanks.map(tank => {
    return {
      date: currentDate,
      product: tank.product,
      opening: 0, // You might want to calculate this from previous day
      received: 0, // You might want to calculate purchases
      sold: 0, // You might want to calculate sales
      closing: tank.currentStock || 0,
      capacity: tank.capacity || 0,
      percentage: tank.capacity > 0 ? Math.round((tank.currentStock / tank.capacity) * 100) : 0
    };
  });
};



const calculateAverageConsumption = (tanks) => {
  // Simplified calculation
  const totalStock = tanks.reduce((sum, tank) => sum + (tank.currentStock || 0), 0);
  return tanks.length > 0 ? Math.round(totalStock / tanks.length) : 0;
};


// Enhanced Financial report
export const getFinancialReport = asyncHandler(async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    let dateFilter = {};
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      
      dateFilter = {
        createdAt: { $gte: start, $lte: end }
      };
    }

    const sales = await Sale.find(dateFilter)
      .populate("nozzle", "fuelType")
      .sort({ createdAt: -1 });

    const expenses = await Expense.find(dateFilter)
      .sort({ date: -1 });

    // Calculate financial metrics
    const totalRevenue = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
    const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    
    // Revenue by product type
    const revenueByProduct = sales.reduce((acc, sale) => {
      const fuelType = sale.nozzle?.fuelType || 'Unknown';
      if (!acc[fuelType]) {
        acc[fuelType] = 0;
      }
      acc[fuelType] += sale.totalAmount || 0;
      return acc;
    }, {});

    res.json({
      success: true,
      sales,
      expenses,
      summary: {
        totalRevenue,
        totalExpenses,
        netProfit,
        profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
        revenueByProduct
      }
    });

  } catch (error) {
    console.error("❌ Error fetching financial report:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching financial report", 
      error: error.message 
    });
  }
});

// Enhanced Shift report
export const getShiftReport = asyncHandler(async (req, res) => {
  try {
    const { date } = req.query;
    
    let dateFilter = {};
    if (date) {
      const targetDate = new Date(date);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);
      
      dateFilter = {
        startTime: { $gte: targetDate, $lt: nextDate }
      };
    }

    const shifts = await Shift.find(dateFilter)
      .populate("nozzleman", "name email")
      .populate("pump", "name")
      .populate("nozzles", "number fuelType")
      .sort({ startTime: -1 });

    // Calculate shift performance metrics
    const shiftsWithMetrics = await Promise.all(
      shifts.map(async (shift) => {
        const shiftSales = await Sale.find({ shift: shift._id });
        
        const totalSales = shiftSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
        const totalLiters = shiftSales.reduce((sum, sale) => sum + (sale.liters || 0), 0);
        
        return {
          ...shift.toObject(),
          metrics: {
            totalSales,
            totalLiters,
            transactionCount: shiftSales.length,
            averageSale: shiftSales.length > 0 ? totalSales / shiftSales.length : 0
          }
        };
      })
    );

    res.json({
      success: true,
      shifts: shiftsWithMetrics
    });

  } catch (error) {
    console.error("❌ Error fetching shift report:", error);
    res.status(500).json({ 
      success: false,
      message: "Error fetching shift report", 
      error: error.message 
    });
  }
});

// Employee report - Keep existing
export const getEmployeeReport = async (req, res) => {
  try {
    const users = await User.find({ role: "Nozzleman" });
    const shifts = await Shift.find().populate("nozzleman");
    res.status(200).json({ users, shifts });
  } catch (err) {
    res.status(500).json({ message: "Error fetching employee report", error: err.message });
  }
};

// Audit report - Keep existing
export const getAuditReport = async (req, res) => {
  try {
    const audits = await Audit.find().populate("shift sale stock");
    res.status(200).json({ audits });
  } catch (err) {
    res.status(500).json({ message: "Error fetching audit report", error: err.message });
  }
};