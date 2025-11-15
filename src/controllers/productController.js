import Product from "../models/Product.js";
import PriceHistory from "../models/PriceHistory.js";
import asyncHandler from "express-async-handler";

// @desc    Get all products
// @route   GET /api/products
// @access  Private
export const getProducts = asyncHandler(async (req, res) => {
  try {
    const products = await Product.find()
      .sort({ name: 1 })
      .select('-__v');
    
    console.log(`📦 Found ${products.length} products`);
    
    res.status(200).json(products);
  } catch (error) {
    console.error("❌ Error fetching products:", error);
    res.status(500).json({
      message: "Failed to fetch products",
      error: error.message
    });
  }
});

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
export const getProduct = asyncHandler(async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    
    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error("❌ Error fetching product:", error);
    res.status(500).json({
      message: "Failed to fetch product",
      error: error.message
    });
  }
});

// @desc    Create new product
// @route   POST /api/products
// @access  Private
export const createProduct = asyncHandler(async (req, res) => {
  try {
    const { name, type, currentPrice, unit, status } = req.body;

    console.log("🟡 Creating product with data:", req.body);

    // Validation
    if (!name || !type || !currentPrice || !unit) {
      return res.status(400).json({
        message: "Please provide name, type, currentPrice, and unit"
      });
    }

    // Check if product with same name already exists
    const existingProduct = await Product.findOne({ 
      name: { $regex: new RegExp(`^${name}$`, 'i') } 
    });
    
    if (existingProduct) {
      return res.status(400).json({
        message: "Product with this name already exists"
      });
    }

    const product = await Product.create({
      name: name.trim(),
      type,
      currentPrice: parseFloat(currentPrice),
      unit,
      status: status || "Active",
      createdBy: req.user?._id || "system"
    });

    console.log("✅ Product created successfully:", product);

    // Create initial price history entry
    await PriceHistory.create({
      product: product._id,
      productName: product.name,
      oldPrice: 0,
      newPrice: product.currentPrice,
      updatedBy: req.user?.name || "Admin",
      status: "Approved",
      reason: "Initial product creation",
      effectiveDate: new Date()
    });

    res.status(201).json(product);
  } catch (error) {
    console.error("❌ Error creating product:", error);
    res.status(500).json({
      message: "Failed to create product",
      error: error.message
    });
  }
});

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
export const updateProduct = asyncHandler(async (req, res) => {
  try {
    const { name, type, currentPrice, unit, status } = req.body;
    
    console.log("🟡 Updating product:", req.params.id, req.body);

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    // Check if name is being changed and conflicts with existing product
    if (name && name !== product.name) {
      const existingProduct = await Product.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: product._id }
      });
      
      if (existingProduct) {
        return res.status(400).json({
          message: "Another product with this name already exists"
        });
      }
    }

    // Update fields
    if (name) product.name = name.trim();
    if (type) product.type = type;
    if (currentPrice) product.currentPrice = parseFloat(currentPrice);
    if (unit) product.unit = unit;
    if (status) product.status = status;

    const updatedProduct = await product.save();

    console.log("✅ Product updated successfully:", updatedProduct);

    res.status(200).json(updatedProduct);
  } catch (error) {
    console.error("❌ Error updating product:", error);
    res.status(500).json({
      message: "Failed to update product",
      error: error.message
    });
  }
});

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
export const deleteProduct = asyncHandler(async (req, res) => {
  try {
    console.log("🟡 Deleting product:", req.params.id);

    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        message: "Product not found"
      });
    }

    // Delete associated price history
    await PriceHistory.deleteMany({ product: product._id });

    await Product.findByIdAndDelete(req.params.id);

    console.log("✅ Product deleted successfully");

    res.status(200).json({
      message: "Product deleted successfully"
    });
  } catch (error) {
    console.error("❌ Error deleting product:", error);
    res.status(500).json({
      message: "Failed to delete product",
      error: error.message
    });
  }
});