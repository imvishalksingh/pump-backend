// controllers/fuelStockController.js - UPDATED VERSION
import FuelStock from "../models/FuelStock.js";
import StockAdjustment from "../models/StockAdjustment.js";
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

// @desc    Create new fuel stock entry
// @route   POST /api/stock
// @access  Private
export const createFuelStock = asyncHandler(async (req, res) => {
  const {
    product,
    openingStock,
    purchases,
    sales,
    capacity,
    rate,
    amount,
    supplier,
    invoiceNumber,
  } = req.body;

  if (
    !product ||
    !openingStock ||
    !purchases ||
    !capacity ||
    !rate ||
    !amount ||
    !supplier ||
    !invoiceNumber
  ) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  const fuelStock = await FuelStock.create({
    product,
    openingStock: parseFloat(openingStock),
    purchases: parseFloat(purchases),
    sales: parseFloat(sales) || 0,
    capacity: parseFloat(capacity),
    rate: parseFloat(rate),
    amount: parseFloat(amount),
    supplier,
    invoiceNumber,
  });

  // ✅ Check for low stock alerts
  await handleLowStockAlert(fuelStock);

  res.status(201).json(fuelStock);
});

// @desc    Get all fuel stock entries
// @route   GET /api/stock
// @access  Private
export const getFuelStocks = asyncHandler(async (req, res) => {
  const { product, date } = req.query;

  let query = {};
  if (product && product !== "all") query.product = product;
  if (date) {
    const startDate = new Date(date);
    const endDate = new Date(date);
    endDate.setDate(endDate.getDate() + 1);
    query.date = { $gte: startDate, $lt: endDate };
  }

  const fuelStocks = await FuelStock.find(query).sort({ createdAt: -1 });
  res.json(fuelStocks);
});

// @desc    Get latest stock for each product
// @route   GET /api/stock/latest
// @access  Private
export const getLatestStocks = asyncHandler(async (req, res) => {
  const latestStocks = await FuelStock.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$product",
        latestEntry: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$latestEntry" } },
  ]);

  res.json(latestStocks);
});

// @desc    Get fuel stock statistics
// @route   GET /api/stock/stats
// @access  Private
export const getFuelStockStats = asyncHandler(async (req, res) => {
  const stats = await FuelStock.aggregate([
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$product",
        latestStock: { $first: "$closingStock" },
        capacity: { $first: "$capacity" },
        currentLevel: { $first: "$currentLevel" },
        alert: { $first: "$alert" },
      },
    },
    {
      $project: {
        product: "$_id",
        closingStock: "$latestStock",
        capacity: 1,
        currentLevel: 1,
        alert: 1,
        _id: 0,
      },
    },
  ]);

  const totalCapacity = stats.reduce((sum, item) => sum + item.capacity, 0);
  const totalCurrent = stats.reduce((sum, item) => sum + item.closingStock, 0);
  const averageLevel = Math.round((totalCurrent / totalCapacity) * 100);
  const lowStockAlerts = stats.filter((item) => item.alert).length;

  res.json({
    products: stats,
    totalCapacity,
    totalCurrent,
    averageLevel,
    lowStockAlerts,
  });
});

// @desc    Get single fuel stock entry
// @route   GET /api/stock/:id
// @access  Private
export const getFuelStock = asyncHandler(async (req, res) => {
  const fuelStock = await FuelStock.findById(req.params.id);
  if (!fuelStock) {
    res.status(404);
    throw new Error("Fuel stock entry not found");
  }
  res.json(fuelStock);
});

// @desc    Update fuel stock entry
// @route   PUT /api/stock/:id
// @access  Private
export const updateFuelStock = asyncHandler(async (req, res) => {
  const fuelStock = await FuelStock.findById(req.params.id);
  if (!fuelStock) {
    res.status(404);
    throw new Error("Fuel stock entry not found");
  }

  const updatedFuelStock = await FuelStock.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  // ✅ Check for low stock alerts
  await handleLowStockAlert(updatedFuelStock);

  res.json(updatedFuelStock);
});

// @desc    Delete fuel stock entry
// @route   DELETE /api/stock/:id
// @access  Private
export const deleteFuelStock = asyncHandler(async (req, res) => {
  const fuelStock = await FuelStock.findById(req.params.id);
  if (!fuelStock) {
    res.status(404);
    throw new Error("Fuel stock entry not found");
  }

  await FuelStock.findByIdAndDelete(req.params.id);
  res.json({ message: "Fuel stock entry removed successfully" });
});

// @desc    Create stock adjustment (NOW REQUIRES AUDITOR APPROVAL)
// @route   POST /api/stock/adjustment
// @access  Private
export const createStockAdjustment = asyncHandler(async (req, res) => {
  const { product, adjustmentType, quantity, reason } = req.body;

  if (!product || !adjustmentType || !quantity || !reason) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  const latestStock = await FuelStock.findOne({ product }).sort({ createdAt: -1 });
  if (!latestStock) {
    res.status(404);
    throw new Error(`No stock found for product: ${product}`);
  }

  const previousStock = latestStock.closingStock;
  let newStock = previousStock;

  switch (adjustmentType) {
    case "addition":
      newStock = previousStock + parseFloat(quantity);
      break;
    case "deduction":
      newStock = previousStock - parseFloat(quantity);
      if (newStock < 0) {
        res.status(400);
        throw new Error("Deduction quantity cannot exceed current stock");
      }
      break;
    case "calibration":
      newStock = parseFloat(quantity);
      break;
    default:
      res.status(400);
      throw new Error("Invalid adjustment type");
  }

  // ✅ CRITICAL CHANGE: Only create StockAdjustment with Pending status
  // Don't create FuelStock entry until auditor approves
  const stockAdjustment = await StockAdjustment.create({
    product,
    adjustmentType,
    quantity: parseFloat(quantity),
    reason,
    previousStock,
    newStock,
    adjustedBy: req.user._id,
    status: "Pending" // 👈 Wait for auditor approval
  });

  console.log(`📝 Stock adjustment created (Pending): ${stockAdjustment._id}`);

  res.status(201).json({
    message: "Stock adjustment request submitted for auditor approval",
    adjustment: stockAdjustment
    // ❌ REMOVED: updatedStock - will be created only after approval
  });
});

// @desc    Get stock adjustment history
// @route   GET /api/stock/adjustments/history
// @access  Private
export const getStockAdjustments = asyncHandler(async (req, res) => {
  const { product, startDate, endDate, status } = req.query;

  let query = {};
  if (product && product !== "all") query.product = product;
  if (status && status !== "all") query.status = status;
  
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const adjustments = await StockAdjustment.find(query)
    .populate("adjustedBy", "name email")
    .populate("approvedBy", "name email")
    .sort({ createdAt: -1 });

  res.json(adjustments);
});

// @desc    Get stock adjustment statistics
// @route   GET /api/stock/adjustments/stats
// @access  Private
export const getAdjustmentStats = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days));

  const stats = await StockAdjustment.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: { type: "$adjustmentType", status: "$status" },
        count: { $sum: 1 },
        totalQuantity: { $sum: "$quantity" },
      },
    },
    {
      $project: {
        adjustmentType: "$_id.type",
        status: "$_id.status",
        count: 1,
        totalQuantity: 1,
        _id: 0,
      },
    },
  ]);

  const totalAdjustments = await StockAdjustment.countDocuments({
    createdAt: { $gte: startDate },
  });

  const pendingCount = await StockAdjustment.countDocuments({
    createdAt: { $gte: startDate },
    status: "Pending"
  });

  res.json({
    period: `${days} days`,
    totalAdjustments,
    pendingCount,
    byType: stats,
  });
});