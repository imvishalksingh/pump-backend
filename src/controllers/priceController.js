import Product from "../models/Product.js";
import PriceHistory from "../models/PriceHistory.js";
import asyncHandler from "express-async-handler";

// @desc    Update product price
// @route   PUT /api/prices/update-price/:id
// @access  Private
export const updatePrice = asyncHandler(async (req, res) => {
  try {
    const { newPrice, reason } = req.body;
    const productId = req.params.id;

    console.log("🟡 Updating price for product:", productId, { newPrice, reason });

    // Validation
    if (!newPrice || parseFloat(newPrice) <= 0) {
      return res.status(400).json({
        message: "Please provide a valid new price"
      });
    }

    const product = await Product.findById(productId);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    if (product.status !== "Active") {
      return res.status(400).json({
        message: "Cannot update price for inactive product"
      });
    }

    const priceNumber = parseFloat(newPrice);

    // Create price history entry
    const priceHistory = await PriceHistory.create({
      product: productId,
      productName: product.name,
      oldPrice: product.currentPrice,
      newPrice: priceNumber,
      updatedBy: req.user?.name || "Admin",
      status: "Pending",
      reason: reason || "Price update requested"
    });

    console.log("✅ Price update submitted for approval:", priceHistory);

    res.status(200).json({
      message: "Price update submitted for approval",
      priceHistory
    });
  } catch (error) {
    console.error("❌ Error updating price:", error);
    res.status(500).json({
      message: "Failed to update price",
      error: error.message
    });
  }
});

// @desc    Get price history for a product
// @route   GET /api/prices/history/:id
// @access  Private
export const priceHistory = asyncHandler(async (req, res) => {
  try {
    const productId = req.params.id;

    const history = await PriceHistory.find({ product: productId })
      .sort({ createdAt: -1 })
      .select('-__v');

    console.log(`📊 Found ${history.length} price history records for product ${productId}`);

    res.status(200).json(history);
  } catch (error) {
    console.error("❌ Error fetching price history:", error);
    res.status(500).json({
      message: "Failed to fetch price history",
      error: error.message
    });
  }
});

// @desc    Get all price history
// @route   GET /api/prices/price-history/all
// @access  Private
export const getAllPriceHistory = asyncHandler(async (req, res) => {
  try {
    const history = await PriceHistory.find()
      .populate("product", "name type unit")
      .sort({ createdAt: -1 })
      .select('-__v');

    console.log(`📊 Found ${history.length} total price history records`);

    res.status(200).json(history);
  } catch (error) {
    console.error("❌ Error fetching all price history:", error);
    res.status(500).json({
      message: "Failed to fetch price history",
      error: error.message
    });
  }
});

// @desc    Get current prices for all products
// @route   GET /api/prices/price-history/current
// @access  Private
export const getCurrentPrices = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find({ status: "Active" })
      .sort({ name: 1 })
      .select('-__v');

    const currentPrices = products.map(product => ({
      product: {
        _id: product._id,
        name: product.name,
        type: product.type,
        unit: product.unit
      },
      currentPrice: product.currentPrice,
      lastUpdated: product.updatedAt
    }));

    console.log(`💰 Found current prices for ${currentPrices.length} active products`);

    res.status(200).json(currentPrices);
  } catch (error) {
    console.error("❌ Error fetching current prices:", error);
    res.status(500).json({
      message: "Failed to fetch current prices",
      error: error.message
    });
  }
});

// @desc    Approve price change
// @route   PUT /api/prices/approve/:id
// @access  Private
export const approvePriceChange = asyncHandler(async (req, res) => {
  try {
    const historyId = req.params.id;

    console.log("🟡 Approving price change:", historyId);

    const priceHistory = await PriceHistory.findById(historyId).populate("product");

    if (!priceHistory) {
      return res.status(404).json({
        message: "Price history record not found"
      });
    }

    if (priceHistory.status !== "Pending") {
      return res.status(400).json({
        message: "Price change is not pending approval"
      });
    }

    // Update product current price
    const product = await Product.findById(priceHistory.product._id);
    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    product.currentPrice = priceHistory.newPrice;
    await product.save();

    // Update price history status
    priceHistory.status = "Approved";
    priceHistory.effectiveDate = new Date();
    priceHistory.updatedBy = req.user?.name || "Admin";
    await priceHistory.save();

    console.log("✅ Price change approved and applied:", priceHistory);

    res.status(200).json({
      message: "Price change approved and applied successfully",
      priceHistory,
      product
    });
  } catch (error) {
    console.error("❌ Error approving price change:", error);
    res.status(500).json({
      message: "Failed to approve price change",
      error: error.message
    });
  }
});

// @desc    Reject price change
// @route   PUT /api/prices/reject/:id
// @access  Private
export const rejectPriceChange = asyncHandler(async (req, res) => {
  try {
    const historyId = req.params.id;
    const { reason } = req.body;

    console.log("🟡 Rejecting price change:", historyId);

    const priceHistory = await PriceHistory.findById(historyId);

    if (!priceHistory) {
      return res.status(404).json({
        message: "Price history record not found"
      });
    }

    if (priceHistory.status !== "Pending") {
      return res.status(400).json({
        message: "Price change is not pending approval"
      });
    }

    // Update price history status
    priceHistory.status = "Rejected";
    priceHistory.reason = reason || "Price change rejected";
    priceHistory.updatedBy = req.user?.name || "Admin";
    await priceHistory.save();

    console.log("✅ Price change rejected:", priceHistory);

    res.status(200).json({
      message: "Price change rejected successfully",
      priceHistory
    });
  } catch (error) {
    console.error("❌ Error rejecting price change:", error);
    res.status(500).json({
      message: "Failed to reject price change",
      error: error.message
    });
  }
});