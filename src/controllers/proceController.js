import Product from "../models/Product.js";
import Price from "../models/PriceHistory.js";
import asyncHandler from "express-async-handler";

// Add product
export const addProduct = asyncHandler(async (req, res) => {
  const { name, type } = req.body;
  const product = await Product.create({ name, type });
  res.status(201).json(product);
});

// Update price
export const updatePrice = asyncHandler(async (req, res) => {
  const { productId, price } = req.body;
  const priceRecord = await Price.create({ product: productId, price, date: new Date() });
  res.status(201).json(priceRecord);
});

// Get current prices
export const getPrices = asyncHandler(async (req, res) => {
  const prices = await Price.find().populate("product");
  res.json(prices);
});
