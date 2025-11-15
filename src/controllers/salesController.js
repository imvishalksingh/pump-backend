import Sale from "../models/Sale.js";
import asyncHandler from "express-async-handler";
import Tank from "../models/FuelStock.js";
import Nozzle from "../models/Nozzle.js";
import Product from "../models/Product.js";
import Customer from "../models/Customer.js";

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
export const getSales = asyncHandler(async (req, res) => {
  try {
    console.log("🔍 Fetching sales...");
    const sales = await Sale.find()
      .populate("nozzle", "number fuelType")
      .populate("verifiedBy", "name")
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${sales.length} sales`);
    res.status(200).json(sales);
  } catch (err) {
    console.error("❌ Error fetching sales:", err);
    res.status(500).json({ message: "Error fetching sales", error: err.message });
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
export const createSale = async (req, res) => {
  try {
    const { nozzle, product, customer, liters, price, paymentMode } = req.body;

    // Optionally update customer balance if credit
    let newSale = await Sale.create({
      nozzle,
      product,
      customer,
      liters,
      price,
      paymentMode,
      createdBy: req.user._id,
    });

    res.status(201).json({ message: "Sale recorded successfully", sale: newSale });
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
