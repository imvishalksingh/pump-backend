// controllers/fuelStockController.js - UPDATED with mongoose import
import mongoose from "mongoose";
import FuelStock from "../models/FuelStock.js";
import StockAdjustment from "../models/StockAdjustment.js";
import Notification from "../models/Notification.js";
import asyncHandler from "express-async-handler";
import Purchase from "../models/Purchase.js";
import TankConfig from "../models/TankConfig.js"; 


export const createTankPurchase = asyncHandler(async (req, res) => {
  const {
    tank,
    invoiceNumber,
    purchaseQuantity,
    purchaseValue,
    ratePerLiter,
    supplier,
    vehicleNumber,
    density
  } = req.body;

  if (!tank || !invoiceNumber || !purchaseQuantity || !purchaseValue || !ratePerLiter || !supplier) {
    res.status(400);
    throw new Error("Please provide all required fields");
  }

  // Get tank details
  const tankConfig = await TankConfig.findById(tank);
  if (!tankConfig) {
    res.status(404);
    throw new Error("Tank not found");
  }

  const previousStock = tankConfig.currentStock || 0;
  const newStock = previousStock + parseFloat(purchaseQuantity);

  // Validate capacity
  if (newStock > tankConfig.capacity) {
    res.status(400);
    throw new Error(`Purchase quantity exceeds tank capacity. Current: ${previousStock}L, Capacity: ${tankConfig.capacity}L, New total would be: ${newStock}L`);
  }

  // Create FuelStock transaction - FIXED: Actually create the record
  const fuelStockData = {
    tank,
    transactionType: "purchase", // REQUIRED
    quantity: parseFloat(purchaseQuantity), // REQUIRED
    previousStock: previousStock, // REQUIRED
    newStock: newStock, // REQUIRED
    product: tankConfig.product, // For purchases
    purchaseQuantity: parseFloat(purchaseQuantity), // For purchases
    purchaseValue: parseFloat(purchaseValue), // For purchases
    ratePerLiter: parseFloat(ratePerLiter),
    amount: parseFloat(purchaseValue),
    supplier: supplier.trim(),
    invoiceNumber: invoiceNumber.trim(),
    vehicleNumber: vehicleNumber?.trim(),
    density: density ? parseFloat(density) : undefined,
    date: new Date()
  };

  console.log("💾 Creating FuelStock purchase with data:", fuelStockData);

  // ✅ FIX: Actually create the FuelStock record
  const fuelStock = await FuelStock.create(fuelStockData);

  // Update tank current stock
  await TankConfig.findByIdAndUpdate(tank, {
    currentStock: newStock,
    currentLevel: Math.round((newStock / tankConfig.capacity) * 100),
    alert: newStock / tankConfig.capacity <= 0.2,
    lastUpdated: new Date()
  });

  // Create Purchase record for accounting
  const purchase = await Purchase.create({
    purchaseType: "fuel",
    supplier: supplier.trim(),
    invoiceNumber: invoiceNumber.trim(),
    invoiceDate: new Date(),
    product: tankConfig.product,
    tank,
    purchaseQuantity: parseFloat(purchaseQuantity),
    purchaseValue: parseFloat(purchaseValue),
    ratePerLiter: parseFloat(ratePerLiter),
    vehicleNumber: vehicleNumber?.trim(),
    density: density ? parseFloat(density) : undefined,
    totalValue: parseFloat(purchaseValue),
    recordedBy: req.user._id
  });

  res.status(201).json({
    message: "Tank purchase recorded successfully",
    fuelStock, // ✅ Now fuelStock is defined
    purchase
  });
});

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
  console.log("📦 Received stock purchase data:", req.body);
  
  const {
    product,
    tank,
    invoiceNumber,
    purchaseQuantity,
    purchaseValue,
    vehicleNumber,
    density,
    ratePerLiter,
    supplier
  } = req.body;

  // Debug: Check each field
  console.log("🔍 Field check:");
  console.log("- product:", product, !!product);
  console.log("- tank:", tank, !!tank);
  console.log("- invoiceNumber:", invoiceNumber, !!invoiceNumber);
  console.log("- purchaseQuantity:", purchaseQuantity, !!purchaseQuantity);
  console.log("- purchaseValue:", purchaseValue, !!purchaseValue);
  console.log("- ratePerLiter:", ratePerLiter, !!ratePerLiter);
  console.log("- supplier:", supplier, !!supplier);
  console.log("- vehicleNumber:", vehicleNumber);
  console.log("- density:", density);

  // Validate required fields with specific error messages
  const missingFields = [];
  if (!product) missingFields.push("product");
  if (!tank) missingFields.push("tank");
  if (!invoiceNumber) missingFields.push("invoiceNumber");
  if (!purchaseQuantity) missingFields.push("purchaseQuantity");
  if (!purchaseValue) missingFields.push("purchaseValue");
  if (!ratePerLiter) missingFields.push("ratePerLiter");
  if (!supplier) missingFields.push("supplier");

  if (missingFields.length > 0) {
    console.log("❌ Missing required fields:", missingFields);
    res.status(400);
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }

  // Check if invoice number already exists
  const existingInvoice = await FuelStock.findOne({ invoiceNumber });
  if (existingInvoice) {
    console.log("❌ Duplicate invoice number:", invoiceNumber);
    res.status(400);
    throw new Error("Invoice number already exists");
  }

  // Validate tank exists and matches product
  const TankConfig = mongoose.model("TankConfig");
  const tankConfig = await TankConfig.findById(tank);
  if (!tankConfig) {
    console.log("❌ Tank not found:", tank);
    res.status(404);
    throw new Error("Tank not found");
  }

  if (tankConfig.product !== product) {
    console.log("❌ Tank-product mismatch:", tankConfig.product, "!=", product);
    res.status(400);
    throw new Error("Selected tank does not match the product");
  }

  // Validate purchase quantity doesn't exceed tank capacity
  const latestStock = await FuelStock.findOne({ tank }).sort({ createdAt: -1 });
  const currentStock = latestStock ? latestStock.closingStock : 0;
  const newStock = currentStock + parseFloat(purchaseQuantity);
  
  if (newStock > tankConfig.capacity) {
    console.log("❌ Capacity exceeded:", newStock, ">", tankConfig.capacity);
    res.status(400);
    throw new Error(`Purchase quantity exceeds tank capacity. Current: ${currentStock}L, Capacity: ${tankConfig.capacity}L, New total would be: ${newStock}L`);
  }

  // Create the fuel stock entry
  const fuelStockData = {
    product,
    tank,
    invoiceNumber: invoiceNumber.trim(),
    purchaseQuantity: parseFloat(purchaseQuantity),
    purchaseValue: parseFloat(purchaseValue),
    ratePerLiter: parseFloat(ratePerLiter),
    supplier: supplier.trim()
  };

  // Add optional fields if provided
  if (vehicleNumber) fuelStockData.vehicleNumber = vehicleNumber.trim();
  if (density) fuelStockData.density = parseFloat(density);

  console.log("💾 Creating fuel stock with data:", fuelStockData);

  const fuelStock = await FuelStock.create(fuelStockData);

  // Handle low stock alerts
  await handleLowStockAlert(fuelStock);

  console.log("✅ Stock purchase recorded successfully:", fuelStock._id);

  res.status(201).json({
    success: true,
    message: "Stock purchase recorded successfully",
    fuelStock
  });
});

// @desc    Get all fuel stock entries
// @route   GET /api/stock
// @access  Private
export const getFuelStocks = asyncHandler(async (req, res) => {
  const { product, tank, startDate, endDate } = req.query;

  let query = {};
  if (product && product !== "all") query.product = product;
  if (tank && tank !== "all") query.tank = tank;
  
  if (startDate && endDate) {
    query.date = { 
      $gte: new Date(startDate), 
      $lte: new Date(endDate) 
    };
  }

  const fuelStocks = await FuelStock.find(query)
    .populate("tank", "name capacity product currentStock")
    .sort({ createdAt: -1 });

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
        _id: "$tank",
        latestEntry: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$latestEntry" } },
  ]);

  // Populate tank information
  const TankConfig = mongoose.model("TankConfig");
  const populatedStocks = await TankConfig.populate(latestStocks, { path: 'tank' });

  res.json(populatedStocks);
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
  const fuelStock = await FuelStock.findById(req.params.id)
    .populate("tank", "name capacity product currentStock");
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

// @desc    Create stock adjustment (REQUIRES AUDITOR APPROVAL FOR ALL TYPES)
// @route   POST /api/stock/adjustment
// @access  Private
export const createStockAdjustment = asyncHandler(async (req, res) => {
  console.log("📝 Stock Adjustment Request:", req.body);
  
  const { tank, adjustmentType, quantity, reason, dipReading, calculatedQuantity } = req.body;

  // VALIDATION FOR STOCK ADJUSTMENT
  if (!tank || !adjustmentType || !quantity || !reason) {
    console.log("❌ Missing stock adjustment fields:", { tank, adjustmentType, quantity, reason });
    res.status(400);
    throw new Error("Please provide tank, adjustment type, quantity, and reason");
  }

  // Get tank details
  const TankConfig = mongoose.model("TankConfig");
  const tankConfig = await TankConfig.findById(tank);
  if (!tankConfig) {
    console.log("❌ Tank not found:", tank);
    res.status(404);
    throw new Error("Tank not found");
  }

  const previousStock = tankConfig.currentStock || 0;
  let newStock = previousStock;

  // Calculate what the new stock WOULD BE, but don't update actual stock yet
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
    case "daily_update":
      newStock = parseFloat(quantity);
      break;
    default:
      res.status(400);
      throw new Error("Invalid adjustment type");
  }

  // ALL adjustments now require auditor approval
  const status = "Pending";

  // Create stock adjustment record (PENDING APPROVAL)
  const stockAdjustment = await StockAdjustment.create({
    tank,
    adjustmentType,
    quantity: parseFloat(quantity),
    dipReading: dipReading ? parseFloat(dipReading) : undefined,
    calculatedQuantity: calculatedQuantity ? parseFloat(calculatedQuantity) : undefined,
    reason,
    previousStock,
    newStock,
    adjustedBy: req.user._id,
    status // Always pending for auditor approval
  });

  // DO NOT create FuelStock record here - wait for auditor approval
  // DO NOT update tank current stock here - wait for auditor approval

  console.log(`✅ Stock adjustment request created: ${stockAdjustment._id} (Status: ${stockAdjustment.status})`);

  res.status(201).json({
    success: true,
    message: "Stock adjustment request submitted for auditor approval",
    adjustment: stockAdjustment
  });
});
// @desc    Get stock adjustment history
// @route   GET /api/stock/adjustments/history
// @access  Private
export const getStockAdjustments = asyncHandler(async (req, res) => {
  const { tank, startDate, endDate, status } = req.query;

  let query = {};
  if (tank && tank !== "all") query.tank = tank;
  if (status && status !== "all") query.status = status;
  
  if (startDate && endDate) {
    query.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }

  const adjustments = await StockAdjustment.find(query)
    .populate("tank", "tankName product capacity") // Add tank population
    .populate("adjustedBy", "name email")
    .populate("approvedBy", "name email")
    .sort({ createdAt: -1 });

  res.json(adjustments);
});


// In fuelStockController.js - Update getStockTransactions
export const getStockTransactions = asyncHandler(async (req, res) => {
  const { tank, startDate, endDate, transactionType } = req.query;

  let query = {};
  
  if (tank && tank !== "all") query.tank = tank;
  if (transactionType && transactionType !== "all") query.transactionType = transactionType;
  
  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  console.log("🔍 Stock transactions query:", query);

  try {
    const transactions = await FuelStock.find(query)
      .populate("tank", "tankName product capacity")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    console.log(`📊 Found ${transactions.length} stock transactions`);

    // Transform the data with safe defaults
    const transformedTransactions = transactions.map(transaction => ({
      _id: transaction._id?.toString() || `temp-${Date.now()}`,
      tank: transaction.tank?._id?.toString() || transaction.tank?.toString() || "unknown",
      tankName: transaction.tank?.tankName || "Unknown Tank",
      product: transaction.product || transaction.tank?.product || "Unknown Product",
      transactionType: transaction.transactionType || "adjustment",
      quantity: transaction.quantity || 0,
      previousStock: transaction.previousStock || 0,
      newStock: transaction.newStock || 0,
      rate: transaction.ratePerLiter,
      amount: transaction.amount,
      supplier: transaction.supplier,
      invoiceNumber: transaction.invoiceNumber,
      reason: transaction.reason,
      date: transaction.date || transaction.createdAt,
      createdAt: transaction.createdAt
    }));

    res.json(transformedTransactions);
  } catch (error) {
    console.error("❌ Error fetching stock transactions:", error);
    res.status(500);
    throw new Error("Failed to fetch stock transactions");
  }
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


// In fuelStockController.js - UPDATE createPurchase function
export const createPurchase = asyncHandler(async (req, res) => {
  const {
    purchaseType,
    supplier,
    invoiceNumber,
    invoiceDate,
    // Fuel purchase fields
    product,
    tank,
    purchaseQuantity,
    purchaseValue,
    ratePerLiter,
    vehicleNumber,
    density,
    vat,
    otherCharges,
    // GST fields
    taxableValue,
    cgst,
    sgst,
    igst,
    discount,
    totalValue,
    // Asset fields
    assetName,
    assetCategory,
    assetDescription,
    notes
  } = req.body;

  console.log("📦 Purchase Request:", req.body);

  // Validate required fields
  if (!purchaseType || !supplier || !invoiceNumber || !invoiceDate) {
    res.status(400);
    throw new Error("Please provide all required fields: purchaseType, supplier, invoiceNumber, invoiceDate");
  }

  // Check for duplicate invoice number
  const existingPurchase = await Purchase.findOne({ invoiceNumber });
  if (existingPurchase) {
    res.status(400);
    throw new Error("Invoice number already exists");
  }

  // Create purchase record
  const purchaseData = {
    purchaseType,
    supplier,
    invoiceNumber,
    invoiceDate: new Date(invoiceDate),
    totalValue: parseFloat(totalValue) || 0,
    recordedBy: req.user._id,
    notes
  };

  // Add type-specific fields
  if (purchaseType === "fuel") {
    Object.assign(purchaseData, {
      product,
      tank,
      purchaseQuantity: parseFloat(purchaseQuantity) || 0,
      purchaseValue: parseFloat(purchaseValue) || 0,
      ratePerLiter: parseFloat(ratePerLiter) || 0,
      vehicleNumber,
      density: density ? parseFloat(density) : undefined,
      vat: parseFloat(vat) || 0,
      otherCharges: parseFloat(otherCharges) || 0
    });
  } else if (purchaseType === "lube") {
    Object.assign(purchaseData, {
      product: assetName, // Use assetName as product name for lube
      taxableValue: parseFloat(taxableValue) || 0,
      cgst: parseFloat(cgst) || 0,
      sgst: parseFloat(sgst) || 0,
      igst: parseFloat(igst) || 0,
      discount: parseFloat(discount) || 0
    });
  } else if (purchaseType === "fixed-asset") {
    Object.assign(purchaseData, {
      assetName,
      assetCategory,
      assetDescription,
      taxableValue: parseFloat(taxableValue) || 0,
      cgst: parseFloat(cgst) || 0,
      sgst: parseFloat(sgst) || 0,
      igst: parseFloat(igst) || 0,
      discount: parseFloat(discount) || 0
    });
  }

  const purchase = await Purchase.create(purchaseData);

  // For fuel purchases, also create FuelStock entry - UPDATED FOR NEW MODEL
  if (purchaseType === "fuel") {
    try {
      // Get tank details to calculate stock levels
      const tankConfig = await TankConfig.findById(tank);
      if (!tankConfig) {
        throw new Error("Tank not found");
      }

      const previousStock = tankConfig.currentStock || 0;
      const newStock = previousStock + parseFloat(purchaseQuantity);

      // Validate capacity
      if (newStock > tankConfig.capacity) {
        throw new Error(`Purchase quantity exceeds tank capacity. Current: ${previousStock}L, Capacity: ${tankConfig.capacity}L, New total would be: ${newStock}L`);
      }

      // Create FuelStock with NEW required fields
      const fuelStockData = {
        tank,
        transactionType: "purchase", // REQUIRED
        quantity: parseFloat(purchaseQuantity), // REQUIRED
        previousStock: previousStock, // REQUIRED
        newStock: newStock, // REQUIRED
        product: product, // For purchases
        purchaseQuantity: parseFloat(purchaseQuantity), // For purchases
        purchaseValue: parseFloat(purchaseValue), // For purchases
        ratePerLiter: parseFloat(ratePerLiter) || 0,
        amount: parseFloat(purchaseValue) || 0,
        supplier: supplier.trim(),
        invoiceNumber: invoiceNumber.trim(),
        vehicleNumber: vehicleNumber?.trim(),
        density: density ? parseFloat(density) : undefined,
        date: new Date()
      };

      console.log("💾 Creating FuelStock purchase with data:", fuelStockData);

      const fuelStock = await FuelStock.create(fuelStockData);

      // Update tank current stock
      await TankConfig.findByIdAndUpdate(tank, {
        currentStock: newStock,
        currentLevel: Math.round((newStock / tankConfig.capacity) * 100),
        alert: newStock / tankConfig.capacity <= 0.2,
        lastUpdated: new Date()
      });

      res.status(201).json({
        message: "Fuel purchase recorded successfully",
        purchase,
        fuelStock
      });

    } catch (fuelStockError) {
      console.error("❌ FuelStock creation failed:", fuelStockError);
      
      // If FuelStock creation fails, delete the purchase record
      await Purchase.findByIdAndDelete(purchase._id);
      throw new Error(`Failed to create fuel stock: ${fuelStockError.message}`);
    }
  } else {
    res.status(201).json({
      message: "Purchase recorded successfully",
      purchase
    });
  }
});


// @desc    Get all purchases with filters
// @route   GET /api/purchases
// @access  Private
export const getPurchases = asyncHandler(async (req, res) => {
  const { 
    purchaseType, 
    supplier, 
    startDate, 
    endDate, 
    page = 1, 
    limit = 10 
  } = req.query;

  let query = {};

  if (purchaseType && purchaseType !== 'all') {
    query.purchaseType = purchaseType;
  }

  if (supplier && supplier !== 'all') {
    query.supplier = new RegExp(supplier, 'i');
  }

  if (startDate && endDate) {
    query.invoiceDate = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const purchases = await Purchase.find(query)
    .populate("tank", "tankName capacity product")
    .populate("recordedBy", "name email")
    .sort({ invoiceDate: -1, createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));

  const total = await Purchase.countDocuments(query);

  res.json({
    purchases,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / parseInt(limit)),
      totalPurchases: total,
      hasNext: skip + purchases.length < total,
      hasPrev: parseInt(page) > 1
    }
  });
});

// @desc    Get purchase by ID
// @route   GET /api/purchases/:id
// @access  Private
export const getPurchaseById = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id)
    .populate("tank", "tankName capacity product")
    .populate("recordedBy", "name email")
    .populate("approvedBy", "name email");

  if (!purchase) {
    res.status(404);
    throw new Error("Purchase not found");
  }

  res.json(purchase);
});

// @desc    Get tax summaries for filing
// @route   GET /api/purchases/tax/summary
// @access  Private
export const getTaxSummary = asyncHandler(async (req, res) => {
  const { period = "month" } = req.query;
  
  let startDate, endDate;
  const now = new Date();

  if (period === "month") {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  } else if (period === "quarter") {
    const quarter = Math.floor(now.getMonth() / 3);
    startDate = new Date(now.getFullYear(), quarter * 3, 1);
    endDate = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
  } else {
    // Custom period or year
    startDate = new Date(now.getFullYear(), 0, 1);
    endDate = new Date(now.getFullYear(), 11, 31);
  }

  const [gstSummary, vatSummary] = await Promise.all([
    Purchase.getGSTSummary(startDate, endDate),
    Purchase.getVATSummary(startDate, endDate)
  ]);

  res.json({
    period: {
      start: startDate,
      end: endDate
    },
    gstSummary,
    vatSummary,
    overall: {
      totalPurchases: gstSummary.totalPurchases + vatSummary.totalPurchases,
      totalValue: gstSummary.totalValue + vatSummary.totalValue,
      totalTax: gstSummary.totalCGST + gstSummary.totalSGST + gstSummary.totalIGST + vatSummary.totalVAT
    }
  });
});

// @desc    Update purchase status
// @route   PUT /api/purchases/:id/status
// @access  Private/Admin
export const updatePurchaseStatus = asyncHandler(async (req, res) => {
  const { status, notes } = req.body;

  const purchase = await Purchase.findById(req.params.id);
  
  if (!purchase) {
    res.status(404);
    throw new Error("Purchase not found");
  }

  purchase.status = status;
  purchase.notes = notes || purchase.notes;
  
  if (status === "approved") {
    purchase.approvedBy = req.user._id;
    purchase.approvedAt = new Date();
  }

  await purchase.save();

  res.json({
    message: "Purchase status updated successfully",
    purchase
  });
});

// @desc    Delete purchase
// @route   DELETE /api/purchases/:id
// @access  Private/Admin
export const deletePurchase = asyncHandler(async (req, res) => {
  const purchase = await Purchase.findById(req.params.id);
  
  if (!purchase) {
    res.status(404);
    throw new Error("Purchase not found");
  }

  // If it's a fuel purchase, also delete the corresponding FuelStock entry
  if (purchase.purchaseType === "fuel") {
    await FuelStock.findOneAndDelete({ invoiceNumber: purchase.invoiceNumber });
  }

  await Purchase.findByIdAndDelete(req.params.id);

  res.json({ 
    message: "Purchase deleted successfully" 
  });
});