// controllers/reportController.js - ENHANCED VERSION
import asyncHandler from "express-async-handler";
import Sale from "../models/Sale.js";
import Expense from "../models/Expense.js";
import Shift from "../models/Shift.js";
import Tank from "../models/FuelStock.js";
import User from "../models/User.js";
import Audit from "../models/Audit.js";
import Nozzle from "../models/Nozzle.js";

// Enhanced Daily report
export const getDailyReport = asyncHandler(async (req, res) => {
  try {
    const { date } = req.query;
    
    // Use today's date if not provided
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);
    
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    console.log(`📊 Fetching daily report for ${targetDate.toISOString()}`);

    // Get sales with proper population
    const sales = await Sale.find({ 
      createdAt: { $gte: targetDate, $lt: nextDate } 
    })
    .populate("nozzle", "number fuelType")
    .populate("verifiedBy", "name")
    .sort({ createdAt: -1 });

    const expenses = await Expense.find({ 
      date: { $gte: targetDate, $lt: nextDate } 
    });

    const shifts = await Shift.find({ 
      startTime: { $gte: targetDate, $lt: nextDate } 
    })
    .populate("nozzleman", "name")
    .populate("pump", "name");

    // Generate hourly distribution for charts
    const hourlyData = generateHourlyData(sales);

    // Calculate summary statistics
    const summary = {
      totalSales: sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0),
      totalLiters: sales.reduce((sum, sale) => sum + (sale.liters || 0), 0),
      activeTransactions: sales.length,
      totalExpenses: expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0),
      growthPercentage: calculateGrowthPercentage(sales)
    };

    res.json({ 
      success: true,
      sales, 
      expenses, 
      shifts,
      hourlyData,
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

// Enhanced Sales report
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

    const sales = await Sale.find({
      createdAt: { $gte: startDate }
    })
    .populate("nozzle", "number fuelType")
    .populate("customer", "name")
    .sort({ createdAt: -1 });

    // Generate sales trend data
    const salesTrend = generateSalesTrend(sales, period);

    // Generate product performance data
    const productPerformance = generateProductPerformance(sales);

    res.json({
      success: true,
      sales,
      salesTrend,
      productPerformance,
      period
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

// Enhanced Stock report
export const getStockReport = asyncHandler(async (req, res) => {
  try {
    console.log("📦 Fetching stock report...");

    const tanks = await Tank.find({})
      .populate("product", "name currentPrice")
      .sort({ fuelType: 1 });

    // Generate stock movement data
    const stockMovement = generateStockMovement(tanks);

    // Calculate summary statistics
    const summary = {
      totalStockValue: tanks.reduce((sum, tank) => {
        const price = tank.product?.currentPrice || 80;
        return sum + (tank.currentStock * price);
      }, 0),
      lowStockAlerts: tanks.filter(tank => {
        const percentage = (tank.currentStock / tank.capacity) * 100;
        return percentage < 20;
      }).length,
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

// Helper functions
const generateHourlyData = (sales) => {
  const hours = ["06:00", "09:00", "12:00", "15:00", "18:00", "21:00"];
  const hourlyData = {};

  // Initialize hours
  hours.forEach(hour => {
    hourlyData[hour] = { hour, petrol: 0, diesel: 0, cng: 0 };
  });

  // Fill with actual data
  sales.forEach(sale => {
    const saleHour = new Date(sale.createdAt).getHours();
    let hourKey = "06:00";
    
    if (saleHour >= 6 && saleHour < 9) hourKey = "06:00";
    else if (saleHour >= 9 && saleHour < 12) hourKey = "09:00";
    else if (saleHour >= 12 && saleHour < 15) hourKey = "12:00";
    else if (saleHour >= 15 && saleHour < 18) hourKey = "15:00";
    else if (saleHour >= 18 && saleHour < 21) hourKey = "18:00";
    else hourKey = "21:00";

    const fuelType = sale.nozzle?.fuelType?.toLowerCase() || 'petrol';
    const liters = sale.liters || 0;

    if (fuelType.includes('petrol')) {
      hourlyData[hourKey].petrol += liters;
    } else if (fuelType.includes('diesel')) {
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
      const saleDate = new Date(sale.createdAt);
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
    const fuelType = sale.nozzle?.fuelType || 'Unknown';
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

const generateStockMovement = (tanks) => {
  const currentDate = new Date().toISOString().split('T')[0];
  
  return tanks.map(tank => {
    const productName = tank.product?.name || tank.fuelType || 'Unknown';
    
    return {
      date: currentDate,
      product: productName,
      opening: tank.openingStock || 0,
      received: tank.receivedStock || 0,
      sold: tank.soldStock || 0,
      closing: tank.currentStock || 0,
      capacity: tank.capacity || 0,
      percentage: tank.capacity > 0 ? Math.round((tank.currentStock / tank.capacity) * 100) : 0
    };
  });
};

const calculateGrowthPercentage = (sales) => {
  // Simplified calculation - in real app, compare with previous period
  if (sales.length === 0) return 0;
  
  const todayRevenue = sales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
  const avgTransaction = todayRevenue / sales.length;
  
  return avgTransaction > 1000 ? 12 : avgTransaction > 500 ? 8 : 5;
};

const calculateAverageConsumption = (tanks) => {
  const totalConsumption = tanks.reduce((sum, tank) => {
    return sum + (tank.dailyConsumption || tank.soldStock || 0);
  }, 0);
  
  return tanks.length > 0 ? Math.round(totalConsumption / tanks.length) : 0;
};