// controllers/fuelStockController.js - COMPLETE FIXED VERSION
import mongoose from "mongoose";
import FuelStock from "../models/FuelStock.js";
import StockAdjustment from "../models/StockAdjustment.js";
import Notification from "../models/Notification.js";
import asyncHandler from "express-async-handler";
import Purchase from "../models/Purchase.js";
import TankConfig from "../models/TankConfig.js"; 

// @desc    Create tank purchase (SIMPLIFIED - No Purchase record conflicts)
// @route   POST /api/stock/purchase/tank
// @access  Private
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

  console.log("🛒 Purchase data received:", req.body);

  // Basic validation
  if (!tank || !invoiceNumber || !purchaseQuantity || !supplier) {
    res.status(400);
    throw new Error("Please provide tank, invoice number, quantity, and supplier");
  }

  // Get tank details
  const tankConfig = await TankConfig.findById(tank);
  if (!tankConfig) {
    res.status(404);
    throw new Error("Tank not found");
  }

  // Get current stock from tank config or latest transaction
  const previousStock = tankConfig.currentStock || 0;
  const newStock = previousStock + parseFloat(purchaseQuantity);

  console.log(`📊 Stock calculation: ${previousStock} + ${purchaseQuantity} = ${newStock}`);

  // Validate capacity
  if (newStock > tankConfig.capacity) {
    res.status(400);
    throw new Error(`Purchase quantity exceeds tank capacity. Current: ${previousStock}L, Capacity: ${tankConfig.capacity}L`);
  }

  // Create FuelStock entry ONLY (no Purchase record to avoid conflicts)
  const fuelStockData = {
    tank,
    transactionType: "purchase",
    quantity: parseFloat(purchaseQuantity),
    previousStock: previousStock,
    newStock: newStock,
    product: tankConfig.product,
    amount: parseFloat(purchaseValue) || 0,
    supplier: supplier.trim(),
    invoiceNumber: invoiceNumber.trim(),
    vehicleNumber: vehicleNumber?.trim(),
    density: density ? parseFloat(density) : undefined,
    date: new Date(),
    recordedBy: req.user._id
  };

  console.log("💾 Creating FuelStock:", fuelStockData);

  const fuelStock = await FuelStock.create(fuelStockData);

  // Update tank current stock
  const currentLevel = Math.round((newStock / tankConfig.capacity) * 100);
  const alert = currentLevel <= 20;
  
  await TankConfig.findByIdAndUpdate(tank, {
    currentStock: newStock,
    currentLevel: currentLevel,
    alert: alert,
    lastUpdated: new Date()
  });

  console.log(`✅ Tank updated: ${tankConfig.tankName} -> ${newStock}L (${currentLevel}%)`);

  res.status(201).json({
    success: true,
    message: "Tank purchase recorded successfully",
    fuelStock,
    tankUpdate: {
      currentStock: newStock,
      currentLevel: currentLevel,
      alert: alert
    }
  });
});

// @desc    Sync all tank stocks (emergency fix)
// @route   POST /api/stock/sync-tanks
// @access  Private/Admin
export const syncTankStocks = asyncHandler(async (req, res) => {
  const tanks = await TankConfig.find({ isActive: true });
  
  const results = await Promise.all(
    tanks.map(async (tank) => {
      try {
        const latestStock = await FuelStock.findOne({ tank: tank._id })
          .sort({ createdAt: -1 });
        
        const newStock = latestStock ? latestStock.newStock : 0;
        const currentLevel = Math.round((newStock / tank.capacity) * 100);
        const alert = currentLevel <= 20;
        
        await TankConfig.findByIdAndUpdate(tank._id, {
          currentStock: newStock,
          currentLevel: currentLevel,
          alert: alert,
          lastUpdated: new Date()
        });
        
        return {
          tank: tank.tankName,
          previousStock: tank.currentStock,
          newStock: newStock,
          success: true
        };
      } catch (error) {
        return {
          tank: tank.tankName,
          error: error.message,
          success: false
        };
      }
    })
  );

  res.json({
    message: "Tank stocks synchronized",
    results
  });
});

// @desc    Get all fuel stock entries
// @route   GET /api/stock
// @access  Private
export const getFuelStocks = asyncHandler(async (req, res) => {
  const { product, tank, startDate, endDate, transactionType } = req.query;

  let query = {};
  if (product && product !== "all") query.product = product;
  if (tank && tank !== "all") query.tank = tank;
  if (transactionType && transactionType !== "all") query.transactionType = transactionType;
  
  if (startDate && endDate) {
    query.date = { 
      $gte: new Date(startDate), 
      $lte: new Date(endDate) 
    };
  }

  const fuelStocks = await FuelStock.find(query)
    .populate("tank", "tankName capacity product currentStock currentLevel")
    .populate("purchaseReference", "invoiceNumber invoiceDate totalValue")
    .sort({ createdAt: -1 });

  res.json(fuelStocks);
});

// @desc    Get latest stock for each tank
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
  const populatedStocks = await TankConfig.populate(latestStocks, { path: 'tank' });

  res.json(populatedStocks);
});

// @desc    Get fuel stock statistics
// @route   GET /api/stock/stats
// @access  Private
export const getFuelStockStats = asyncHandler(async (req, res) => {
  // Get all tanks with current stock
  const tanks = await TankConfig.find({ isActive: true })
    .select('tankName product capacity currentStock currentLevel alert');
  
  const totalCapacity = tanks.reduce((sum, tank) => sum + tank.capacity, 0);
  const totalCurrent = tanks.reduce((sum, tank) => sum + (tank.currentStock || 0), 0);
  const averageLevel = totalCapacity > 0 ? Math.round((totalCurrent / totalCapacity) * 100) : 0;
  const lowStockAlerts = tanks.filter(tank => tank.alert).length;

  res.json({
    tanks,
    totalCapacity,
    totalCurrent,
    averageLevel,
    lowStockAlerts,
    totalTanks: tanks.length
  });
});

// @desc    Get single fuel stock entry
// @route   GET /api/stock/:id
// @access  Private
export const getFuelStock = asyncHandler(async (req, res) => {
  const fuelStock = await FuelStock.findById(req.params.id)
    .populate("tank", "tankName capacity product currentStock currentLevel")
    .populate("purchaseReference", "invoiceNumber invoiceDate totalValue");
    
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

  // Update tank stock if this transaction affects stock levels
  if (updatedFuelStock.tank && updatedFuelStock.newStock !== undefined) {
    const tank = await TankConfig.findById(updatedFuelStock.tank);
    if (tank) {
      const currentLevel = Math.round((updatedFuelStock.newStock / tank.capacity) * 100);
      const alert = currentLevel <= 20;
      
      await TankConfig.findByIdAndUpdate(updatedFuelStock.tank, {
        currentStock: updatedFuelStock.newStock,
        currentLevel: currentLevel,
        alert: alert,
        lastUpdated: new Date()
      });
    }
  }

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

  // If it's a purchase transaction, also delete the linked purchase
  if (fuelStock.purchaseReference) {
    await Purchase.findByIdAndDelete(fuelStock.purchaseReference);
  }

  await FuelStock.findByIdAndDelete(req.params.id);
  
  res.json({ message: "Fuel stock entry removed successfully" });
});


// @desc    Create stock adjustment (FIXED VALIDATION)
// @route   POST /api/stock/adjustment
// @access  Private
export const createStockAdjustment = asyncHandler(async (req, res) => {
  console.log("📝 Stock Adjustment Request:", req.body);
  
  const { tank, adjustmentType, quantity, reason, dipReading, calculatedQuantity } = req.body;

  // IMPROVED VALIDATION WITH BETTER ERROR MESSAGES
  if (!tank) {
    res.status(400);
    throw new Error("Tank selection is required");
  }
  
  if (!adjustmentType) {
    res.status(400);
    throw new Error("Adjustment type is required");
  }
  
  if (!quantity || quantity === "" || parseFloat(quantity) <= 0) {
    res.status(400);
    throw new Error("Valid quantity is required");
  }
  
  if (!reason || reason.trim() === "") {
    res.status(400);
    throw new Error("Reason is required");
  }

  // Get tank details
  const tankConfig = await TankConfig.findById(tank);
  if (!tankConfig) {
    console.log("❌ Tank not found:", tank);
    res.status(404);
    throw new Error("Selected tank not found");
  }

  const previousStock = tankConfig.currentStock || 0;
  let newStock = previousStock;
  const quantityNum = parseFloat(quantity);

  // Calculate what the new stock WOULD BE
  switch (adjustmentType) {
    case "addition":
      newStock = previousStock + quantityNum;
      break;
    case "deduction":
      newStock = previousStock - quantityNum;
      if (newStock < 0) {
        res.status(400);
        throw new Error(`Deduction quantity (${quantityNum}L) exceeds current stock (${previousStock}L)`);
      }
      break;
    case "calibration":
    case "daily_update":
      newStock = quantityNum;
      if (newStock < 0) {
        res.status(400);
        throw new Error("Calibration quantity cannot be negative");
      }
      if (newStock > tankConfig.capacity) {
        res.status(400);
        throw new Error(`Calibration quantity (${quantityNum}L) exceeds tank capacity (${tankConfig.capacity}L)`);
      }
      break;
    default:
      res.status(400);
      throw new Error("Invalid adjustment type");
  }

  // Validate capacity for additions
  if (adjustmentType === "addition" && newStock > tankConfig.capacity) {
    res.status(400);
    throw new Error(`Addition would exceed tank capacity. Current: ${previousStock}L, Capacity: ${tankConfig.capacity}L, New total: ${newStock}L`);
  }

  // ALL adjustments require auditor approval
  const status = "Pending";

  // Create stock adjustment record
  const stockAdjustment = await StockAdjustment.create({
    tank,
    adjustmentType,
    quantity: quantityNum,
    dipReading: dipReading ? parseFloat(dipReading) : undefined,
    calculatedQuantity: calculatedQuantity ? parseFloat(calculatedQuantity) : undefined,
    reason: reason.trim(),
    previousStock,
    newStock,
    adjustedBy: req.user._id,
    status
  });

  console.log(`✅ Stock adjustment request created: ${stockAdjustment._id} (Status: ${stockAdjustment.status})`);

  res.status(201).json({
    success: true,
    message: "Stock adjustment request submitted for auditor approval",
    adjustment: stockAdjustment
  });
});

// @desc    Get tank configurations with safe defaults
// @route   GET /api/tanks/config
// @access  Private
export const getTankConfigs = asyncHandler(async (req, res) => {
  const tanks = await TankConfig.find({ isActive: true })
    .select('tankName product capacity currentStock currentLevel alert isActive lastCalibrationBy createdAt updatedAt')
    .sort({ tankName: 1 });
  
  // Ensure all tanks have required fields with safe defaults
  const tanksWithDefaults = tanks.map(tank => ({
    ...tank.toObject(),
    currentStock: tank.currentStock || 0,
    currentLevel: tank.currentLevel || 0,
    alert: tank.alert || false
  }));
  
  const isAdmin = req.user && req.user.role === "admin";
  
  res.json({
    success: true,
    tanks: tanksWithDefaults,
    isAdmin
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
    .populate("tank", "tankName product capacity currentStock currentLevel")
    .populate("adjustedBy", "name email")
    .populate("approvedBy", "name email")
    .sort({ createdAt: -1 });

  res.json(adjustments);
});

// @desc    Get stock transactions (FuelStock entries)
// @route   GET /api/stock/transactions
// @access  Private
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
      .populate("tank", "tankName product capacity currentStock currentLevel")
      .populate("purchaseReference", "invoiceNumber invoiceDate totalValue")
      .sort({ date: -1, createdAt: -1 })
      .lean();

    console.log(`📊 Found ${transactions.length} stock transactions`);

    // Transform the data with safe defaults
    const transformedTransactions = transactions.map(transaction => ({
      _id: transaction._id?.toString(),
      tank: transaction.tank?._id?.toString(),
      tankName: transaction.tank?.tankName || "Unknown Tank",
      product: transaction.product || transaction.tank?.product || "Unknown Product",
      transactionType: transaction.transactionType,
      quantity: transaction.quantity,
      previousStock: transaction.previousStock,
      newStock: transaction.newStock,
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

// @desc    Create purchase (for other purchase types)
// @route   POST /api/stock/purchase
// @access  Private
// In fuelStockController.js - UPDATE the createPurchase function
export const createPurchase = asyncHandler(async (req, res) => {
  const {
    purchaseType,
    supplier,
    invoiceNumber,
    invoiceDate,
    product,
    tank,
    purchaseQuantity,
    purchaseValue,
    ratePerLiter,
    vehicleNumber,
    density,
    vat,
    otherCharges,
    taxableValue,
    cgst,
    sgst,
    igst,
    discount,
    totalValue,
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

  // Check for duplicate invoice number in Purchase collection only
  const existingPurchase = await Purchase.findOne({ invoiceNumber });
  if (existingPurchase) {
    res.status(400);
    throw new Error("Invoice number already exists in purchase records");
  }

  // ✅ FIX: For fuel purchases, handle everything in one transaction
  if (purchaseType === "fuel" && tank) {
    try {
      const tankConfig = await TankConfig.findById(tank);
      if (!tankConfig) {
        res.status(404);
        throw new Error("Tank not found");
      }

      const currentStock = tankConfig.currentStock || 0;
      const purchaseQty = parseFloat(purchaseQuantity) || 0;
      const newStock = currentStock + purchaseQty;

      console.log(`📊 Capacity Check: ${currentStock}L + ${purchaseQty}L = ${newStock}L / ${tankConfig.capacity}L`);

      // Validate capacity
      if (newStock > tankConfig.capacity) {
        const availableSpace = tankConfig.capacity - currentStock;
        res.status(400);
        throw new Error(
          `Purchase quantity exceeds available tank capacity. ` +
          `Current: ${currentStock}L, Capacity: ${tankConfig.capacity}L, ` +
          `Available: ${availableSpace}L, Required: ${purchaseQty}L`
        );
      }

      // ✅ STEP 1: Create FuelStock entry FIRST
      const fuelStockInvoiceNumber = `${invoiceNumber}-${Date.now()}`;
      
      const fuelStockData = {
        tank,
        transactionType: "purchase",
        quantity: purchaseQty,
        previousStock: currentStock,
        newStock: newStock,
        product: product || tankConfig.product,
        amount: parseFloat(purchaseValue) || 0,
        supplier: supplier.trim(),
        invoiceNumber: fuelStockInvoiceNumber,
        vehicleNumber: vehicleNumber?.trim(),
        density: density ? parseFloat(density) : undefined,
        date: new Date(invoiceDate),
        recordedBy: req.user._id
      };

      console.log("💾 Creating FuelStock:", fuelStockData);
      const fuelStock = await FuelStock.create(fuelStockData);

      // ✅ STEP 2: Update tank current stock
      const currentLevel = Math.round((newStock / tankConfig.capacity) * 100);
      const alert = currentLevel <= 20;
      
      await TankConfig.findByIdAndUpdate(tank, {
        currentStock: newStock,
        currentLevel: currentLevel,
        alert: alert,
        lastUpdated: new Date()
      });

      console.log(`✅ Tank updated: ${tankConfig.tankName} -> ${newStock}L (${currentLevel}%)`);

      // ✅ STEP 3: Create Purchase record with fuelStock reference
      const purchaseData = {
        purchaseType,
        supplier,
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        totalValue: parseFloat(totalValue) || 0,
        recordedBy: req.user._id,
        notes,
        // Fuel specific fields
        product: product || tankConfig.product,
        tank,
        purchaseQuantity: purchaseQty,
        purchaseValue: parseFloat(purchaseValue) || 0,
        ratePerLiter: parseFloat(ratePerLiter) || 0,
        vehicleNumber,
        density: density ? parseFloat(density) : undefined,
        vat: parseFloat(vat) || 0,
        otherCharges: parseFloat(otherCharges) || 0,
        // Link to fuel stock
        fuelStockEntry: fuelStock._id
      };

      const purchase = await Purchase.create(purchaseData);

      res.status(201).json({
        message: "Fuel purchase recorded successfully",
        purchase,
        fuelStock,
        tankUpdate: {
          currentStock: newStock,
          currentLevel: currentLevel,
          alert: alert
        }
      });

    } catch (error) {
      console.error("❌ Fuel purchase failed:", error);
      // If anything fails, don't create partial records
      throw new Error(`Fuel purchase failed: ${error.message}`);
    }
  } else {
    // For non-fuel purchases (lube, fixed-asset)
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
    if (purchaseType === "lube") {
      Object.assign(purchaseData, {
        product: assetName,
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
    .populate("tank", "tankName capacity product currentStock currentLevel")
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
    .populate("tank", "tankName capacity product currentStock currentLevel")
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

  if (purchase.purchaseType === "fuel") {
    await FuelStock.findOneAndDelete({ invoiceNumber: purchase.invoiceNumber });
  }

  await Purchase.findByIdAndDelete(req.params.id);

  res.json({ 
    message: "Purchase deleted successfully" 
  });
});

// Helper: Generate or resolve low stock alerts
const handleLowStockAlert = async (tankId) => {
  try {
    const tank = await TankConfig.findById(tankId);
    if (!tank) return;

    if (tank.currentLevel < 30) {
      const existing = await Notification.findOne({
        type: "Stock",
        description: { $regex: tank.product, $options: "i" },
        status: "Unread",
      });

      if (!existing) {
        await Notification.create({
          type: "Stock",
          description: `${tank.product} stock below 30% in ${tank.tankName}`,
          priority: tank.currentLevel < 15 ? "High" : "Medium",
          status: "Unread",
        });
        console.log(`🔔 Low stock alert created for ${tank.product}`);
      }
    }

    if (tank.currentLevel > 40) {
      await Notification.updateMany(
        {
          type: "Stock",
          description: { $regex: tank.product, $options: "i" },
          status: "Unread",
        },
        { status: "Read" }
      );
    }
  } catch (err) {
    console.error("⚠️ Error handling stock alert:", err.message);
  }
};